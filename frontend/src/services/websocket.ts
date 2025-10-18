import { useConsoleStore } from '../store/consoleStore';

export class WebSocketService {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;

    connect(namespace: string, vmi: string, onMessage: (data: string) => void, onError: (error: string) => void) {
        const store = useConsoleStore.getState();

        // 关闭现有连接
        this.disconnect();

        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${protocol}://${window.location.host}/ws?namespace=${encodeURIComponent(namespace)}&vmi=${encodeURIComponent(vmi)}`;

        try {
            this.ws = new WebSocket(wsUrl);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                store.setConnection({
                    isConnected: true,
                    status: 'connected',
                    namespace,
                    vmi
                });
            };

            this.ws.onmessage = (event) => {
                if (event.data instanceof ArrayBuffer) {
                    const decoder = new TextDecoder();
                    const data = decoder.decode(event.data);
                    onMessage(data);
                } else if (typeof event.data === 'string') {
                    if (event.data === 'serial console ready') {
                        console.log('Serial console ready');
                    } else if (event.data.startsWith('serial console error:') || event.data.startsWith('console ')) {
                        onError(event.data);
                    } else {
                        onMessage(event.data);
                    }
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                onError('WebSocket connection error');
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket closed:', event);
                store.setConnection({
                    isConnected: false,
                    status: event.wasClean ? 'idle' : 'error',
                    error: event.wasClean ? undefined : 'Connection lost'
                });

                // 自动重连逻辑
                if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    setTimeout(() => {
                        this.connect(namespace, vmi, onMessage, onError);
                    }, this.reconnectDelay * this.reconnectAttempts);
                }
            };

        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            onError('Failed to create WebSocket connection');
        }
    }

    send(data: string) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export const websocketService = new WebSocketService();
