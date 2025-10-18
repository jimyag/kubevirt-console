import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { websocketService } from '../../services/websocket';
import { useConsoleStore } from '../../store/consoleStore';

interface TerminalProps {
    className?: string;
}

export const Terminal: React.FC<TerminalProps> = ({ className }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    const { connection, disconnect } = useConsoleStore();

    useEffect(() => {
        if (!terminalRef.current) return;

        // 初始化 xterm
        const terminal = new XTerm({
            convertEol: true,
            cursorBlink: true,
            disableStdin: false,
            fontFamily: 'Menlo, Consolas, "Liberation Mono", monospace',
            theme: {
                background: '#1b1b1b',
                foreground: '#f5f5f5'
            }
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(terminalRef.current);
        fitAddon.fit();
        terminal.focus();

        xtermRef.current = terminal;
        fitAddonRef.current = fitAddon;

        // 处理终端输入
        terminal.onData((data) => {
            if (connection.isConnected) {
                websocketService.send(data);
            }
        });

        // 处理窗口大小变化
        const handleResize = () => {
            fitAddon.fit();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            terminal.dispose();
        };
    }, []);

    useEffect(() => {
        if (connection.status === 'connecting' && connection.namespace && connection.vmi) {
            // 连接 WebSocket
            websocketService.connect(
                connection.namespace,
                connection.vmi,
                (data) => {
                    if (xtermRef.current) {
                        xtermRef.current.write(data);
                    }
                },
                (error) => {
                    console.error('WebSocket error:', error);
                    disconnect();
                }
            );
        }
    }, [connection.status, connection.namespace, connection.vmi, disconnect]);

    return (
        <div
            ref={terminalRef}
            className={className}
            style={{
                height: '100%',
                width: '100%',
                backgroundColor: '#1b1b1b'
            }}
        />
    );
};
