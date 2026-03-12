package main

import (
	_ "embed"
	"bufio"
	"context"
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"sort"
	"strings"

	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"kubevirt.io/client-go/kubecli"
	kvv1 "kubevirt.io/api/core/v1"
	"sigs.k8s.io/yaml"
)

var (
	listenAddr  string
	namespace   string
	kubeconfig  string
	contextName string
	statusFile  = "vm-statuses.txt"
)

var defaultStatuses = []string{
	"all", "Running", "Stopped", "Starting", "Migrating", "Paused", "ErrorPvcNotFound", "DataVolumeError", "ImagePullBackOff", "CrashLoopBackOff", "Terminating",
}

var rootCmd = &cobra.Command{
	Use:   "kubevirt-dashboard",
	Short: "KubeVirt Dashboard - Stable & Reliable",
	RunE: func(cmd *cobra.Command, args []string) error {
		restConfig, defaultNamespace, err := getKubeConfig()
		if err != nil { return err }
		virtClient, err := kubecli.GetKubevirtClientFromRESTConfig(restConfig)
		if err != nil { return err }
		if namespace == "" { namespace = defaultNamespace }
		ensureStatusFile()
		return runServer(restConfig, virtClient, listenAddr)
	},
}

func init() {
	rootCmd.Flags().StringVar(&listenAddr, "listen", "127.0.0.1:11111", "address to serve the dashboard on")
	rootCmd.Flags().StringVarP(&namespace, "namespace", "n", "", "default namespace (optional)")
	rootCmd.Flags().StringVar(&kubeconfig, "kubeconfig", "", "absolute path to the kubeconfig file")
	rootCmd.Flags().StringVar(&contextName, "context", "", "the name of the kubeconfig context to use")
}

func main() {
	if err := rootCmd.Execute(); err != nil { os.Exit(1) }
}

func ensureStatusFile() {
	if _, err := os.Stat(statusFile); os.IsNotExist(err) {
		f, _ := os.Create(statusFile)
		defer f.Close()
		for _, s := range defaultStatuses { f.WriteString(s + "\n") }
	}
}

func loadStatuses() []string {
	f, err := os.Open(statusFile)
	if err != nil { return defaultStatuses }
	defer f.Close()
	var statuses []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" { statuses = append(statuses, line) }
	}
	return statuses
}

func getKubeConfig() (*rest.Config, string, error) {
	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	if kubeconfig != "" { loadingRules.ExplicitPath = kubeconfig }
	configOverrides := &clientcmd.ConfigOverrides{}
	if contextName != "" { configOverrides.CurrentContext = contextName }
	clientConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)
	ns, _, _ := clientConfig.Namespace()
	if ns == "" { ns = "default" }
	restConfig, err := clientConfig.ClientConfig()
	return restConfig, ns, err
}

func runServer(config *rest.Config, virtClient kubecli.KubevirtClient, addr string) error {
	distFS, _ := fs.Sub(uiContent, "ui/dist")
	target, _ := url.Parse(config.Host)
	transport, _ := rest.TransportFor(config)
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.Transport = transport

	dynClient, err := dynamic.NewForConfig(config)
	if err != nil { return err }

	mux := http.NewServeMux()

	mux.HandleFunc("/api/v1/vms", func(w http.ResponseWriter, r *http.Request) { handleListVMs(virtClient, w, r) })
	mux.HandleFunc("/api/v1/vm-statuses", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(loadStatuses())
	})

	mux.HandleFunc("/api/v1/yaml/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/yaml/"), "/")
		if len(parts) < 3 {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}
		resType, ns, name := parts[0], parts[1], parts[2]
		
		var gvr schema.GroupVersionResource
		var apiVersion, kind string

		if resType == "virtualmachines" {
			gvr = schema.GroupVersionResource{Group: "kubevirt.io", Version: "v1", Resource: "virtualmachines"}
			apiVersion, kind = "kubevirt.io/v1", "VirtualMachine"
		} else if resType == "datavolumes" {
			gvr = schema.GroupVersionResource{Group: "cdi.kubevirt.io", Version: "v1beta1", Resource: "datavolumes"}
			apiVersion, kind = "cdi.kubevirt.io/v1beta1", "DataVolume"
		} else {
			http.Error(w, "unsupported resource type", http.StatusBadRequest)
			return
		}

		obj, err := dynClient.Resource(gvr).Namespace(ns).Get(context.Background(), name, metav1.GetOptions{})
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		// Clean metadata
		obj.SetManagedFields(nil)
		obj.SetResourceVersion("")
		obj.SetGeneration(0)
		obj.SetUID("")
		
		raw := obj.UnstructuredContent()
		raw["apiVersion"] = apiVersion
		raw["kind"] = kind

		data, _ := yaml.Marshal(raw)
		w.Header().Set("Content-Type", "text/yaml; charset=utf-8")
		w.Write(data)
	})

	mux.HandleFunc("/api/v1/namespaces-list", func(w http.ResponseWriter, r *http.Request) {
		vms, _ := virtClient.VirtualMachine(metav1.NamespaceAll).List(context.Background(), metav1.ListOptions{})
		nsMap := make(map[string]bool)
		for _, vm := range vms.Items { nsMap[vm.Namespace] = true }
		nss := []string{"all"}
		for ns := range nsMap { nss = append(nss, ns) }
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(nss)
	})

	mux.HandleFunc("/apis/", func(w http.ResponseWriter, r *http.Request) { proxy.ServeHTTP(w, r) })

	fileServer := http.FileServer(http.FS(distFS))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/apis") { return }
		f, err := distFS.Open(strings.TrimPrefix(path, "/"))
		if err != nil || path == "/" { r.URL.Path = "/" } else { f.Close() }
		fileServer.ServeHTTP(w, r)
	})

	log.Printf("Starting Dashboard at http://%s", addr)
	return http.ListenAndServe(addr, mux)
}

func handleListVMs(client kubecli.KubevirtClient, w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	targetNs := q.Get("namespace")
	if targetNs == "" || targetNs == "all" { targetNs = metav1.NamespaceAll }
	nameSearch := strings.ToLower(q.Get("name"))
	statusFilter := strings.ToLower(q.Get("status"))

	vms, err := client.VirtualMachine(targetNs).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	filtered := make([]kvv1.VirtualMachine, 0)
	for _, vm := range vms.Items {
		if nameSearch != "" && !strings.Contains(strings.ToLower(vm.Name), nameSearch) { continue }
		printableStatus := strings.ToLower(string(vm.Status.PrintableStatus))
		if statusFilter != "" && statusFilter != "all" {
			if !strings.Contains(printableStatus, statusFilter) { continue }
		}
		filtered = append(filtered, vm)
	}
	sort.Slice(filtered, func(i, j int) bool { return filtered[i].CreationTimestamp.After(filtered[j].CreationTimestamp.Time) })
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{ "items": filtered })
}
