package main

import (
	_ "embed"
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"kubevirt.io/client-go/kubecli"
	kvv1 "kubevirt.io/api/core/v1"
	kvcorev1 "kubevirt.io/client-go/kubevirt/typed/core/v1"
	"sigs.k8s.io/yaml"
)

var (
	listenAddr  string
	namespace   string
	kubeconfig  string
	contextName string
	statusFile  = "vm-statuses.txt"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
	Subprotocols: []string{"binary"},
}

var defaultStatuses = []string{
	"all", "Running", "Stopped", "Starting", "Migrating", "Paused", "ErrorPvcNotFound", "DataVolumeError", "ImagePullBackOff", "CrashLoopBackOff", "Terminating",
}

// ClusterManager handles multiple kubeconfig contexts
type ClusterManager struct {
	mu       sync.RWMutex
	configs  map[string]*rest.Config
	clients  map[string]kubecli.KubevirtClient
	proxies  map[string]*httputil.ReverseProxy
	dynamics map[string]dynamic.Interface
	contexts []string
	defaultCtx string
}

func NewClusterManager() (*ClusterManager, error) {
	cm := &ClusterManager{
		configs:  make(map[string]*rest.Config),
		clients:  make(map[string]kubecli.KubevirtClient),
		proxies:  make(map[string]*httputil.ReverseProxy),
		dynamics: make(map[string]dynamic.Interface),
	}

	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	if kubeconfig != "" { loadingRules.ExplicitPath = kubeconfig }

	config, err := loadingRules.Load()
	if err != nil {
		log.Printf("Failed to load kubeconfig: %v. Checking in-cluster config...", err)
		restConfig, err := rest.InClusterConfig()
		if err != nil { return nil, fmt.Errorf("could not find kubeconfig or in-cluster config: %v", err) }
		cm.contexts = []string{"in-cluster"}
		cm.defaultCtx = "in-cluster"
		cm.configs["in-cluster"] = restConfig
		return cm, nil
	}

	for name := range config.Contexts { cm.contexts = append(cm.contexts, name) }
	sort.Strings(cm.contexts)
	cm.defaultCtx = config.CurrentContext
	if contextName != "" { cm.defaultCtx = contextName }

	return cm, nil
}

func (cm *ClusterManager) getClient(r *http.Request) (kubecli.KubevirtClient, dynamic.Interface, *httputil.ReverseProxy, error) {
	ctxName := r.Header.Get("X-Kube-Context")
	if ctxName == "" { ctxName = r.URL.Query().Get("context") }
	if ctxName == "" { ctxName = cm.defaultCtx }

	cm.mu.RLock()
	client, ok := cm.clients[ctxName]
	dyn, ok2 := cm.dynamics[ctxName]
	proxy, ok3 := cm.proxies[ctxName]
	cm.mu.RUnlock()

	if ok && ok2 && ok3 { return client, dyn, proxy, nil }

	cm.mu.Lock()
	defer cm.mu.Unlock()

	if client, ok := cm.clients[ctxName]; ok { return client, cm.dynamics[ctxName], cm.proxies[ctxName], nil }

	log.Printf("Initializing clients for context: %s", ctxName)
	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	if kubeconfig != "" { loadingRules.ExplicitPath = kubeconfig }
	configOverrides := &clientcmd.ConfigOverrides{CurrentContext: ctxName}
	clientConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)
	
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		if ctxName == "in-cluster" { restConfig, err = rest.InClusterConfig() }
		if err != nil { return nil, nil, nil, err }
	}

	virtClient, err := kubecli.GetKubevirtClientFromRESTConfig(restConfig)
	if err != nil { return nil, nil, nil, err }

	dynClient, err := dynamic.NewForConfig(restConfig)
	if err != nil { return nil, nil, nil, err }

	target, _ := url.Parse(restConfig.Host)
	transport, _ := rest.TransportFor(restConfig)
	proxy = httputil.NewSingleHostReverseProxy(target)
	proxy.Transport = transport

	cm.configs[ctxName] = restConfig
	cm.clients[ctxName] = virtClient
	cm.dynamics[ctxName] = dynClient
	cm.proxies[ctxName] = proxy

	return virtClient, dynClient, proxy, nil
}

var rootCmd = &cobra.Command{
	Use:   "kubevirt-dashboard",
	Short: "KubeVirt Dashboard - Multi-Cluster Management",
	RunE: func(cmd *cobra.Command, args []string) error {
		cm, err := NewClusterManager()
		if err != nil { return err }
		ensureStatusFile()
		return runServer(cm, listenAddr)
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

func runServer(cm *ClusterManager, addr string) error {
	distFS, _ := fs.Sub(uiContent, "ui/dist")
	mux := http.NewServeMux()

	mux.HandleFunc("/api/v1/contexts", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{ "contexts": cm.contexts, "default":  cm.defaultCtx })
	})

	mux.HandleFunc("/api/v1/vms", func(w http.ResponseWriter, r *http.Request) {
		virtClient, _, _, err := cm.getClient(r)
		if err != nil { http.Error(w, err.Error(), http.StatusInternalServerError); return }
		handleListVMs(virtClient, w, r)
	})

	mux.HandleFunc("/api/v1/vm-statuses", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(loadStatuses())
	})

	mux.HandleFunc("/api/v1/ws", func(w http.ResponseWriter, r *http.Request) {
		virtClient, _, _, err := cm.getClient(r)
		if err != nil { log.Printf("ws client fail: %v", err); return }
		handleWebsocket(virtClient, w, r)
	})

	mux.HandleFunc("/api/v1/yaml/", func(w http.ResponseWriter, r *http.Request) {
		_, dynClient, _, err := cm.getClient(r)
		if err != nil { http.Error(w, err.Error(), http.StatusInternalServerError); return }
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/yaml/"), "/")
		if len(parts) < 3 { http.Error(w, "invalid path", http.StatusBadRequest); return }
		resType, ns, name := parts[0], parts[1], parts[2]
		var gvr schema.GroupVersionResource
		var apiVersion, kind string
		if resType == "virtualmachines" {
			gvr = schema.GroupVersionResource{Group: "kubevirt.io", Version: "v1", Resource: "virtualmachines"}
			apiVersion, kind = "kubevirt.io/v1", "VirtualMachine"
		} else if resType == "datavolumes" {
			gvr = schema.GroupVersionResource{Group: "cdi.kubevirt.io", Version: "v1beta1", Resource: "datavolumes"}
			apiVersion, kind = "cdi.kubevirt.io/v1beta1", "DataVolume"
		} else { http.Error(w, "unsupported resource type", http.StatusBadRequest); return }
		obj, err := dynClient.Resource(gvr).Namespace(ns).Get(context.Background(), name, metav1.GetOptions{})
		if err != nil { http.Error(w, err.Error(), http.StatusNotFound); return }
		obj.SetManagedFields(nil); obj.SetResourceVersion(""); obj.SetGeneration(0); obj.SetUID("")
		raw := obj.UnstructuredContent(); raw["apiVersion"] = apiVersion; raw["kind"] = kind
		data, _ := yaml.Marshal(raw); w.Header().Set("Content-Type", "text/yaml; charset=utf-8"); w.Write(data)
	})

	mux.HandleFunc("/api/v1/namespaces-list", func(w http.ResponseWriter, r *http.Request) {
		virtClient, _, _, err := cm.getClient(r)
		if err != nil { http.Error(w, err.Error(), http.StatusInternalServerError); return }
		vms, _ := virtClient.VirtualMachine(metav1.NamespaceAll).List(context.Background(), metav1.ListOptions{})
		nsMap := make(map[string]bool)
		for _, vm := range vms.Items { nsMap[vm.Namespace] = true }
		nss := []string{"all"}
		for ns := range nsMap { nss = append(nss, ns) }
		w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(nss)
	})

	mux.HandleFunc("/apis/", func(w http.ResponseWriter, r *http.Request) {
		_, _, proxy, err := cm.getClient(r)
		if err != nil { http.Error(w, err.Error(), http.StatusInternalServerError); return }
		proxy.ServeHTTP(w, r)
	})

	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		_, _, proxy, err := cm.getClient(r)
		if err != nil { http.Error(w, err.Error(), http.StatusInternalServerError); return }
		proxy.ServeHTTP(w, r)
	})

	fileServer := http.FileServer(http.FS(distFS))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/apis") { return }
		f, err := distFS.Open(strings.TrimPrefix(path, "/"))
		if err != nil || path == "/" { r.URL.Path = "/" } else { f.Close() }
		fileServer.ServeHTTP(w, r)
	})

	log.Printf("Starting Dashboard at http://%s (Contexts: %v)", addr, cm.contexts)
	return http.ListenAndServe(addr, mux)
}

func handleWebsocket(client kubecli.KubevirtClient, w http.ResponseWriter, r *http.Request) {
	namespace := r.URL.Query().Get("namespace")
	vmi := r.URL.Query().Get("vmi")
	wsType := r.URL.Query().Get("type")
	if namespace == "" || vmi == "" {
		http.Error(w, "missing namespace or vmi", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	stdinReader, stdinWriter := io.Pipe()
	stdoutReader, stdoutWriter := io.Pipe()

	resChan := make(chan error, 1)
	runningChan := make(chan error, 1)

	go func() {
		var err error
		if wsType == "vnc" {
			log.Printf("Attempting VNC connection for %s/%s", namespace, vmi)
			vnc, vncErr := client.VirtualMachineInstance(namespace).VNC(vmi)
			err = vncErr
			runningChan <- err
			if err == nil {
				log.Printf("VNC stream established for %s/%s", namespace, vmi)
				resChan <- vnc.Stream(kvcorev1.StreamOptions{In: stdinReader, Out: stdoutWriter})
			} else {
				log.Printf("VNC connection failed for %s/%s: %v", namespace, vmi, err)
			}
		} else {
			console, consoleErr := client.VirtualMachineInstance(namespace).SerialConsole(vmi, &kvcorev1.SerialConsoleOptions{ConnectionTimeout: 10 * time.Minute})
			err = consoleErr
			runningChan <- err
			if err == nil {
				resChan <- console.Stream(kvcorev1.StreamOptions{In: stdinReader, Out: stdoutWriter})
			}
		}
	}()

	if err := <-runningChan; err != nil {
		_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("console error: %v", err)))
		return
	}

	// For VNC, do NOT send any ready message. The client expects raw RFB data immediately.
	if wsType != "vnc" {
		_ = conn.WriteMessage(websocket.TextMessage, []byte("serial console ready"))
		stdinWriter.Write([]byte("\r"))
	}

	writeErr := make(chan error, 1)
	readErr := make(chan error, 1)

	go func() {
		buffer := make([]byte, 65536)
		for {
			n, err := stdoutReader.Read(buffer)
			if n > 0 {
				if sendErr := conn.WriteMessage(websocket.BinaryMessage, buffer[:n]); sendErr != nil {
					writeErr <- sendErr
					return
				}
			}
			if err != nil { return }
		}
	}()

	go func() {
		for {
			messageType, payload, err := conn.ReadMessage()
			if err != nil {
				readErr <- err
				return
			}
			if messageType == websocket.TextMessage || messageType == websocket.BinaryMessage {
				stdinWriter.Write(payload)
			}
		}
	}()

	select {
	case <-resChan:
	case <-writeErr:
	case <-readErr:
	}
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
