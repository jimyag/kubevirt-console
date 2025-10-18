package main

import (
	"embed"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/gorilla/websocket"
	"github.com/spf13/pflag"
	"golang.org/x/term"
	"kubevirt.io/client-go/kubecli"
	kvcorev1 "kubevirt.io/client-go/kubevirt/typed/core/v1"
)

var (
	timeout    = pflag.Int("timeout", 10, "timeout in minutes")
	namespace  = pflag.String("namespace", "", "namespace of the virtual machine instance")
	vmiName    = pflag.String("vmi", "", "name of the virtual machine instance")
	listenAddr = pflag.String("listen", ":8080", "address to serve the web console on")
	webMode    = pflag.Bool("web", false, "serve the web console instead of attaching to the terminal")
)

//go:embed web/* web/assets/*
var webContent embed.FS

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func main() {
	pflag.Parse()

	clientConfig := kubecli.DefaultClientConfig(&pflag.FlagSet{})
	client, err := clientConfig.ClientConfig()
	if err != nil {
		log.Fatalf("Error getting client config: %v", err)
	}
	virtClient, err := kubecli.GetKubevirtClientFromRESTConfig(client)
	if err != nil {
		log.Fatalf("cannot obtain KubeVirt client: %v\n", err)
	}

	if *webMode {
		if err := runWebServer(virtClient, *listenAddr); err != nil {
			log.Fatalf("web server exited with error: %v", err)
		}
		return
	}

	if *namespace == "" || *vmiName == "" {
		log.Fatalf("--namespace and --vmi are required when running without --web")
	}

	err = handleConsoleConnection(virtClient, *namespace, *vmiName)
	if err != nil {
		log.Fatalf("Error connecting to console: %v", err)
	}
	fmt.Println("Console connected successfully")
}

func handleConsoleConnection(client kubecli.KubevirtClient, namespace, vmi string) error {
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
			&kvcorev1.SerialConsoleOptions{ConnectionTimeout: time.Duration(*timeout) * time.Minute})
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

func runWebServer(client kubecli.KubevirtClient, addr string) error {
	contentFS, err := fs.Sub(webContent, "web")
	if err != nil {
		return fmt.Errorf("failed to load embedded web assets: %w", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebsocket(client, w, r)
	})
	mux.Handle("/", http.FileServer(http.FS(contentFS)))

	log.Printf("Serving web console at http://%s/", addr)
	return http.ListenAndServe(addr, mux)
}

func handleWebsocket(client kubecli.KubevirtClient, w http.ResponseWriter, r *http.Request) {
	namespace := r.URL.Query().Get("namespace")
	vmi := r.URL.Query().Get("vmi")
	if namespace == "" || vmi == "" {
		http.Error(w, "namespace and vmi query parameters are required", http.StatusBadRequest)
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
		console, err := client.VirtualMachineInstance(namespace).SerialConsole(vmi,
			&kvcorev1.SerialConsoleOptions{ConnectionTimeout: time.Duration(*timeout) * time.Minute})
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
