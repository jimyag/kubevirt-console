import { useConsoleStore } from '../store/consoleStore';
import { ConsoleError } from '../components/ErrorHandler';

export class WebSocketService {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private lastNamespace = '';
    private lastVMI = '';
    private reconnectTimeout: number | null = null;

    connect(namespace: string, vmi: string, onMessage: (data: string) => void, onError: (error: ConsoleError) => void) {
        const store = useConsoleStore.getState();

        // 保存连接信息用于重连
        this.lastNamespace = namespace;
        this.lastVMI = vmi;

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
                        onError({
                            type: 'NETWORK_ERROR',
                            message: 'Console error',
                            details: event.data,
                            suggestion: 'Please check the VMI status and try again'
                        });
                    } else {
                        onMessage(event.data);
                    }
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                onError({
                    type: 'NETWORK_ERROR',
                    message: 'WebSocket connection error',
                    details: 'Failed to establish WebSocket connection',
                    suggestion: 'Check your network connection and try again'
                });
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
                    this.scheduleReconnect(onMessage, onError);
                } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    onError({
                        type: 'NETWORK_ERROR',
                        message: 'Connection failed after multiple attempts',
                        details: `Failed to reconnect after ${this.maxReconnectAttempts} attempts`,
                        suggestion: 'Please check your connection and try again'
                    });
                }
            };

        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            onError({
                type: 'NETWORK_ERROR',
                message: 'Failed to create WebSocket connection',
                details: error instanceof Error ? error.message : 'Unknown error',
                suggestion: 'Please check your network connection and try again'
            });
        }
    }

    send(data: string) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        }
    }

    private scheduleReconnect(onMessage: (data: string) => void, onError: (error: ConsoleError) => void) {
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

        this.reconnectTimeout = setTimeout(() => {
            console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.connect(this.lastNamespace, this.lastVMI, onMessage, onError);
        }, delay);
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.reconnectAttempts = 0;
    }

    // 重置重连计数器
    resetReconnectAttempts() {
        this.reconnectAttempts = 0;
    }
}

export const websocketService = new WebSocketService();
