# KubeVirt Console

KubeVirt Console is a single self-contained Go binary that lets you attach to VirtualMachineInstance (VMI) serial consoles from either a local terminal or a browser-based xterm.js UI.

- **Bring-your-own kubeconfig** – relies on the standard KubeVirt client-go configuration, so kubeconfig/env handling works out of the box.
- **Terminal or browser** – connect directly from your shell, or launch an embedded web server that serves an xterm.js frontend.
- **No extra assets** – the web UI, JS, and CSS are embedded so the binary stays portable.

## Prerequisites

- Access to a Kubernetes cluster with KubeVirt installed and an authenticated kubeconfig

## Build

```bash
go build -o kubevirt-console .
```

## CLI usage

Connect your local terminal to a VMI (similar to `virtctl console`):

```bash
./kubevirt-console console [-n <namespace>] <vmi-name>
```

If you omit `-n/--namespace`, the namespace from the active kubeconfig context is used. Press `Ctrl+]` (escape sequence 29) to exit, or wait for the VMI to disconnect.

## Web console mode

Serve the embedded UI and access the console through the browser:

```bash
./kubevirt-console web --listen 127.0.0.1:8080
```

Visit `http://127.0.0.1:8080/`, fill in the namespace and VMI (or pass them via query parameters), and the page will stream the serial console over WebSocket.
If you leave the namespace empty, the server falls back to the namespace from your kubeconfig context.

## Updating embedded web assets

Instructions for refreshing xterm.js bundles live in `web/README.md`.
