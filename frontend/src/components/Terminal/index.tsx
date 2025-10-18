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

        console.log('Initializing xterm terminal...');

        // 清空容器
        terminalRef.current.innerHTML = '';

        // 初始化 xterm
        const terminal = new XTerm({
            convertEol: true,
            cursorBlink: true,
            disableStdin: false,
            fontFamily: 'Menlo, Consolas, "Liberation Mono", monospace',
            fontSize: 14,
            theme: {
                background: '#000000',
                foreground: '#ffffff',
                cursor: '#ffffff'
            }
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);

        // 确保容器可见
        if (terminalRef.current) {
            terminalRef.current.style.display = 'block';
            terminalRef.current.style.height = '100%';
            terminalRef.current.style.width = '100%';
        }

        terminal.open(terminalRef.current);

        // 延迟执行 fit 和 focus
        setTimeout(() => {
            fitAddon.fit();
            terminal.focus();
        }, 100);

        // 显示初始提示
        terminal.writeln('KubeVirt Console Ready');
        terminal.writeln('Waiting for connection...');

        xtermRef.current = terminal;
        fitAddonRef.current = fitAddon;

        console.log('xterm terminal initialized');

        // 处理终端输入
        terminal.onData((data) => {
            console.log('Terminal input:', data);
            const { connection: liveConnection } = useConsoleStore.getState();
            if (liveConnection.isConnected) {
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
            console.log('Connecting to WebSocket...');

            // 显示连接状态
            if (xtermRef.current) {
                xtermRef.current.writeln(`\r\nConnecting to ${connection.namespace}/${connection.vmi}...`);
            }

            // 连接 WebSocket
            websocketService.connect(
                connection.namespace,
                connection.vmi,
                (data) => {
                    console.log('WebSocket data received:', data);
                    if (xtermRef.current) {
                        // 确保终端可见并写入数据
                        xtermRef.current.write(data);
                        // 强制刷新显示
                        xtermRef.current.refresh(0, xtermRef.current.rows - 1);
                    }
                },
                (error) => {
                    console.error('WebSocket error:', error);
                    if (xtermRef.current) {
                        xtermRef.current.writeln(`\r\nConnection error: ${error.message}`);
                    }
                    disconnect();
                }
            );
        }
    }, [connection.status, connection.namespace, connection.vmi, disconnect]);

    // 更新连接状态
    useEffect(() => {
        if (connection.status === 'connected') {
            // 连接成功，更新状态
            const { setConnection } = useConsoleStore.getState();
            setConnection({ isConnected: true });
        }
    }, [connection.status]);

    const classes = ['terminal-container'];
    if (className) {
        classes.push(className);
    }

    return <div ref={terminalRef} className={classes.join(' ')} />;
};
