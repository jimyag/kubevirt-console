package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/jimmicro/version"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"golang.org/x/term"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd"
	"kubevirt.io/client-go/kubecli"
	kvcorev1 "kubevirt.io/client-go/kubevirt/typed/core/v1"
)

var (
	timeout          time.Duration
	namespace        string
	listenAddr       string
	webNamespaceFlag string
	webVMIFlag       string
)

//go:embed web/*
var webContent embed.FS

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var rootCmd = &cobra.Command{
	Use:           "kubevirt-console",
	Short:         "Connect to KubeVirt VMI serial consoles",
	Long:          "Connect to KubeVirt VirtualMachineInstance serial consoles from your terminal or an embedded web UI.",
	SilenceErrors: false,
	SilenceUsage:  true,
	Version:       version.Version(),
}

var consoleCmd = &cobra.Command{
	Use:   "console [flags] <vmi>",
	Short: "Attach to a VMI serial console in the terminal",
	Args:  cobra.ExactArgs(1),
	Example: `  kubevirt-console console --namespace demo test
  kubevirt-console console -n demo test --timeout 5m
  kubevirt-console console test # namespace inferred from kubeconfig`,
	RunE: func(cmd *cobra.Command, args []string) error {
		vmiName := args[0]
		virtClient, defaultNamespace, err := newVirtClient()
		if err != nil {
			return err
		}
		ns := namespace
		if ns == "" {
			ns = defaultNamespace
		}
		if ns == "" {
			return fmt.Errorf("namespace is required (pass --namespace or set one in your kubeconfig context)")
		}
		if err := handleConsoleConnection(virtClient, ns, vmiName, timeout); err != nil {
			return fmt.Errorf("error connecting to console: %w", err)
		}
		fmt.Println("Console connected successfully")
		return nil
	},
}

var webCmd = &cobra.Command{
	Use:   "web",
	Short: "Serve the browser-based serial console",
	Example: `  kubevirt-console web --listen :8080
  kubevirt-console web --listen 127.0.0.1:8080 --timeout 5m
  kubevirt-console web --namespace prod --vmi vm-01 # dedicated console`,
	RunE: func(cmd *cobra.Command, args []string) error {
		virtClient, defaultNamespace, err := newVirtClient()
		if err != nil {
			return err
		}
		initialNamespace := webNamespaceFlag
		if initialNamespace == "" {
			initialNamespace = defaultNamespace
		}
		fixedNamespace := ""
		if webVMIFlag != "" {
			if initialNamespace == "" {
				return fmt.Errorf("namespace is required when --vmi is specified and no default namespace is available")
			}
			fixedNamespace = initialNamespace
		}
		return runWebServer(virtClient, listenAddr, timeout, defaultNamespace, initialNamespace, fixedNamespace, webVMIFlag)
	},
}

func init() {
	timeout = 10 * time.Minute
	rootCmd.PersistentFlags().DurationVar(&timeout, "timeout", timeout, "timeout for establishing the console connection (e.g. 10m)")

	consoleCmd.Flags().StringVarP(&namespace, "namespace", "n", "", "namespace of the virtual machine instance")

	webCmd.Flags().StringVar(&listenAddr, "listen", "127.0.0.1:8080", "address to serve the web console on")
	webCmd.Flags().StringVar(&webNamespaceFlag, "namespace", "", "default namespace for the web console (defaults to kubeconfig namespace)")
	webCmd.Flags().StringVar(&webVMIFlag, "vmi", "", "serve a dedicated console for the specified VMI")

	rootCmd.AddCommand(consoleCmd)
	rootCmd.AddCommand(webCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func handleConsoleConnection(client kubecli.KubevirtClient, namespace, vmi string, timeout time.Duration) error {
	// in -> stdinWriter | stdinReader -> console
	// out <- stdoutReader | stdoutWriter <- console
	// Wait until the virtual machine is in running phase, user interrupt or timeout
	stdinReader, stdinWriter := io.Pipe()
	stdoutReader, stdoutWriter := io.Pipe()

	resChan := make(chan error)
	runningChan := make(chan error)
	waitInterrupt := make(chan os.Signal, 1)
	signal.Notify(waitInterrupt, os.Interrupt)

	go func() {
		con, err := client.VirtualMachineInstance(namespace).SerialConsole(vmi,
			&kvcorev1.SerialConsoleOptions{ConnectionTimeout: timeout})
		runningChan <- err

		if err != nil {
			return
		}

		resChan <- con.Stream(kvcorev1.StreamOptions{
			In:  stdinReader,
			Out: stdoutWriter,
		})
	}()

	select {
	case <-waitInterrupt:
		// Make a new line in the terminal
		fmt.Println()
		return nil
	case err := <-runningChan:
		if err != nil {
			return err
		}
	}
	err := Attach(stdinReader, stdoutReader, stdinWriter, stdoutWriter,
		fmt.Sprintf("Successfully connected to %s console. Press Ctrl+] or Ctrl+5 to exit console.\n", vmi),
		resChan)
	if err != nil {
		if e, ok := err.(*websocket.CloseError); ok && e.Code == websocket.CloseAbnormalClosure {
			fmt.Fprint(os.Stderr, "\n"+
				"You were disconnected from the console. This could be caused by one of the following:"+
				"\n - the target VM was powered off"+
				"\n - another user connected to the console of the target VM"+
				"\n - network issues\n")
		}
		return err
	}
	return nil
}

// Attach attaches stdin and stdout to the console
// in -> stdinWriter | stdinReader -> console
// out <- stdoutReader | stdoutWriter <- console
// copied from https://github.com/kubevirt/kubevirt/blob/2fe8900d08037dddf5b54d5d4395110e6d77b315/pkg/virtctl/console/console.go#L134-L141
func Attach(stdinReader, stdoutReader *io.PipeReader, stdinWriter, stdoutWriter *io.PipeWriter,
	message string, resChan <-chan error,
) (err error) {
	const (
		escapeSequenceCode = 29
		bufferSize         = 1024
	)
	stopChan := make(chan struct{}, 1)
	writeStop := make(chan error)
	readStop := make(chan error)
	if term.IsTerminal(int(os.Stdin.Fd())) {
		state, makeRawErr := term.MakeRaw(int(os.Stdin.Fd()))
		if makeRawErr != nil {
			return fmt.Errorf("make raw terminal failed: %s", makeRawErr)
		}
		defer func() {
			if restoreErr := term.Restore(int(os.Stdin.Fd()), state); restoreErr != nil {
				fmt.Fprintf(os.Stderr, "failed to restore terminal: %v\n", restoreErr)
			}
		}()
	}
	fmt.Fprint(os.Stderr, message)

	in := os.Stdin
	out := os.Stdout

	go func() {
		interrupt := make(chan os.Signal, 1)
		signal.Notify(interrupt, os.Interrupt)
		<-interrupt
		close(stopChan)
	}()

	go func() {
		_, copyErr := io.Copy(out, stdoutReader)
		readStop <- copyErr
	}()

	go func() {
		defer close(writeStop)
		buf := make([]byte, bufferSize)
		for {
			// reading from stdin
			n, readErr := in.Read(buf)
			if readErr != nil && readErr != io.EOF {
				writeStop <- readErr
				return
			}
			if n == 0 && readErr == io.EOF {
				return
			}

			// the escape sequence
			if buf[0] == escapeSequenceCode {
				return
			}
			// Writing out to the console connection
			_, err = stdinWriter.Write(buf[0:n])
			if err == io.EOF {
				return
			}
		}
	}()

	select {
	case <-stopChan:
	case err = <-readStop:
	case err = <-writeStop:
	case err = <-resChan:
	}

	return err
}

func newVirtClient() (kubecli.KubevirtClient, string, error) {
	fs := pflag.NewFlagSet("kubevirt-console", pflag.ContinueOnError)
	clientConfig := kubecli.DefaultClientConfig(fs)
	ns, _, err := clientConfig.Namespace()
	if err != nil {
		if !clientcmd.IsEmptyConfig(err) {
			return nil, "", fmt.Errorf("error resolving namespace from kubeconfig: %w", err)
		}
		ns = ""
	}
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, "", fmt.Errorf("error getting client config: %w", err)
	}
	virtClient, err := kubecli.GetKubevirtClientFromRESTConfig(restConfig)
	if err != nil {
		return nil, "", fmt.Errorf("cannot obtain KubeVirt client: %w", err)
	}
	return virtClient, ns, nil
}

type webServer struct {
	client           kubecli.KubevirtClient
	timeout          time.Duration
	defaultNamespace string
	initialNamespace string
	fixedNamespace   string
	fixedVMI         string
}

func runWebServer(client kubecli.KubevirtClient, addr string, timeout time.Duration, defaultNamespace, initialNamespace, fixedNamespace, fixedVMI string) error {
	contentFS, err := fs.Sub(webContent, "web")
	if err != nil {
		return fmt.Errorf("failed to load embedded web assets: %w", err)
	}

	if initialNamespace == "" {
		initialNamespace = defaultNamespace
	}

	server := &webServer{
		client:           client,
		timeout:          timeout,
		defaultNamespace: defaultNamespace,
		initialNamespace: initialNamespace,
		fixedNamespace:   fixedNamespace,
		fixedVMI:         fixedVMI,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", server.handleWebsocket)
	mux.HandleFunc("/api/config", server.handleConfig)
	mux.HandleFunc("/api/vmis", server.handleVMIs)
	mux.HandleFunc("/api/namespaces", server.handleNamespaces)

	// 静态文件服务，支持 React SPA 路由
	mux.Handle("/", server.handleStaticFiles(contentFS))

	log.Printf("Serving web console at http://%s/ (mode=%s)", addr, server.mode())
	return http.ListenAndServe(addr, mux)
}

func (s *webServer) mode() string {
	if s.fixedVMI != "" {
		return "dedicated"
	}
	return "shared"
}

func (s *webServer) resolvedNamespace(requested string) string {
	if s.fixedVMI != "" {
		if s.fixedNamespace != "" {
			return s.fixedNamespace
		}
		return s.defaultNamespace
	}
	if requested != "" {
		return requested
	}
	if s.initialNamespace != "" {
		return s.initialNamespace
	}
	return s.defaultNamespace
}

func (s *webServer) handleWebsocket(w http.ResponseWriter, r *http.Request) {
	namespace := strings.TrimSpace(r.URL.Query().Get("namespace"))
	vmi := strings.TrimSpace(r.URL.Query().Get("vmi"))

	if s.fixedVMI != "" {
		namespace = s.resolvedNamespace("")
		vmi = s.fixedVMI
	} else {
		if vmi == "" {
			http.Error(w, "vmi query parameter is required", http.StatusBadRequest)
			return
		}
		namespace = s.resolvedNamespace(namespace)
	}

	if namespace == "" {
		http.Error(w, "namespace cannot be determined", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()
	log.Printf("websocket connected: remote=%s namespace=%s vmi=%s", r.RemoteAddr, namespace, vmi)

	stdinReader, stdinWriter := io.Pipe()
	stdoutReader, stdoutWriter := io.Pipe()

	resChan := make(chan error, 1)
	runningChan := make(chan error, 1)

	go func() {
		console, err := s.client.VirtualMachineInstance(namespace).SerialConsole(vmi,
			&kvcorev1.SerialConsoleOptions{ConnectionTimeout: s.timeout})
		runningChan <- err
		if err != nil {
			return
		}

		resChan <- console.Stream(kvcorev1.StreamOptions{
			In:  stdinReader,
			Out: stdoutWriter,
		})
	}()

	if err := <-runningChan; err != nil {
		log.Printf("failed to establish serial console: %v", err)
		_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("serial console error: %v", err)))
		return
	}
	log.Printf("serial console stream established for %s/%s", namespace, vmi)
	_ = conn.WriteMessage(websocket.TextMessage, []byte("serial console ready"))
	if _, err := stdinWriter.Write([]byte("\r")); err != nil {
		log.Printf("failed to send initial newline to console: %v", err)
	}

	writeErr := make(chan error, 1)
	readErr := make(chan error, 1)

	go func() {
		buffer := make([]byte, 1024)
		for {
			n, err := stdoutReader.Read(buffer)
			if n > 0 {
				if sendErr := conn.WriteMessage(websocket.BinaryMessage, buffer[:n]); sendErr != nil {
					writeErr <- fmt.Errorf("send to websocket failed: %w", sendErr)
					return
				}
			}
			if err != nil {
				if err != io.EOF {
					writeErr <- err
				}
				return
			}
		}
	}()

	go func() {
		for {
			messageType, payload, err := conn.ReadMessage()
			if err != nil {
				readErr <- err
				return
			}
			if messageType != websocket.TextMessage && messageType != websocket.BinaryMessage {
				continue
			}
			if len(payload) == 1 && payload[0] == 29 {
				readErr <- io.EOF
				return
			}
			if _, err := stdinWriter.Write(payload); err != nil {
				readErr <- err
				return
			}
		}
	}()

	select {
	case err := <-resChan:
		if err != nil && err != io.EOF {
			log.Printf("serial console stream error: %v", err)
			_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("serial console error: %v", err)))
		}
	case err := <-writeErr:
		if err != nil && err != io.EOF {
			log.Printf("console write loop error: %v", err)
			_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("console write error: %v", err)))
		}
	case err := <-readErr:
		if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) || err == io.EOF {
			break
		}
		log.Printf("console read loop error: %v", err)
		_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("console read error: %v", err)))
	}

	_ = stdinWriter.Close()
	_ = stdoutWriter.Close()
	_ = stdinReader.Close()
	_ = stdoutReader.Close()
	log.Printf("websocket disconnected: namespace=%s vmi=%s", namespace, vmi)
}

func (s *webServer) handleConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	response := struct {
		Mode             string `json:"mode"`
		DefaultNamespace string `json:"defaultNamespace,omitempty"`
		InitialNamespace string `json:"initialNamespace,omitempty"`
		FixedNamespace   string `json:"fixedNamespace,omitempty"`
		FixedVMI         string `json:"fixedVmi,omitempty"`
	}{
		Mode:             s.mode(),
		DefaultNamespace: s.defaultNamespace,
		InitialNamespace: s.initialNamespace,
		FixedNamespace:   s.fixedNamespace,
		FixedVMI:         s.fixedVMI,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("failed to write config response: %v", err)
	}
}

func (s *webServer) handleVMIs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if s.fixedVMI != "" {
		ns := s.resolvedNamespace("")
		vmi := s.fixedVMI
		if ns == "" {
			http.Error(w, "namespace cannot be determined", http.StatusBadRequest)
			return
		}
		list := []map[string]string{
			{
				"namespace": ns,
				"name":      vmi,
			},
		}
		if err := json.NewEncoder(w).Encode(list); err != nil {
			log.Printf("failed to write dedicated vmi response: %v", err)
		}
		return
	}

	nsParam := strings.TrimSpace(r.URL.Query().Get("namespace"))
	targetNamespace := nsParam
	if targetNamespace == "" || strings.EqualFold(targetNamespace, "all") {
		targetNamespace = metav1.NamespaceAll
	}

	ctx := r.Context()
	vmiClient := s.client.VirtualMachineInstance(targetNamespace)
	list, err := vmiClient.List(ctx, metav1.ListOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to list VMIs: %v", err), http.StatusInternalServerError)
		return
	}

	type vmiInfo struct {
		Namespace string `json:"namespace"`
		Name      string `json:"name"`
		Phase     string `json:"phase,omitempty"`
	}

	result := make([]vmiInfo, 0, len(list.Items))
	for _, item := range list.Items {
		result = append(result, vmiInfo{
			Namespace: item.Namespace,
			Name:      item.Name,
			Phase:     string(item.Status.Phase),
		})
	}

	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Printf("failed to write vmi list response: %v", err)
	}
}

func (s *webServer) handleNamespaces(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if s.fixedVMI != "" {
		ns := s.resolvedNamespace("")
		if ns == "" {
			http.Error(w, "namespace cannot be determined", http.StatusBadRequest)
			return
		}
		result := []string{ns}
		if err := json.NewEncoder(w).Encode(result); err != nil {
			log.Printf("failed to write dedicated namespace response: %v", err)
		}
		return
	}

	// 获取所有命名空间
	ctx := r.Context()
	vmiClient := s.client.VirtualMachineInstance(metav1.NamespaceAll)
	list, err := vmiClient.List(ctx, metav1.ListOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to list VMIs: %v", err), http.StatusInternalServerError)
		return
	}

	namespaceSet := make(map[string]bool)
	for _, item := range list.Items {
		namespaceSet[item.Namespace] = true
	}

	result := make([]string, 0, len(namespaceSet))
	for ns := range namespaceSet {
		result = append(result, ns)
	}

	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Printf("failed to write namespace list response: %v", err)
	}
}

func (s *webServer) handleStaticFiles(contentFS fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 如果是 API 路径，跳过
		if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/ws") {
			http.NotFound(w, r)
			return
		}

		// 尝试打开文件
		file, err := contentFS.Open(strings.TrimPrefix(r.URL.Path, "/"))
		if err != nil {
			// 如果文件不存在，返回 index.html（支持 React Router）
			file, err = contentFS.Open("index.html")
			if err != nil {
				http.NotFound(w, r)
				return
			}
		}
		defer file.Close()

		// 设置正确的 Content-Type
		if strings.HasSuffix(r.URL.Path, ".js") {
			w.Header().Set("Content-Type", "application/javascript")
		} else if strings.HasSuffix(r.URL.Path, ".css") {
			w.Header().Set("Content-Type", "text/css")
		} else if strings.HasSuffix(r.URL.Path, ".html") {
			w.Header().Set("Content-Type", "text/html")
		}

		// 读取文件内容并写入响应
		content, err := io.ReadAll(file)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Write(content)
	})
}
