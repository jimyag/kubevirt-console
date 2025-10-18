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

        // Clear any previous terminal markup.
        terminalRef.current.innerHTML = '';

        // Initialize the xterm instance.
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

        // Ensure the terminal container is visible.
        if (terminalRef.current) {
            terminalRef.current.style.display = 'block';
            terminalRef.current.style.height = '100%';
            terminalRef.current.style.width = '100%';
        }

        terminal.open(terminalRef.current);

        // Defer fit and focus so layout can settle.
        setTimeout(() => {
            fitAddon.fit();
            terminal.focus();
        }, 100);

        // Show an initial banner while waiting for the backend.
        terminal.writeln('KubeVirt Console Ready');
        terminal.writeln('Waiting for connection...');

        xtermRef.current = terminal;
        fitAddonRef.current = fitAddon;

        console.log('xterm terminal initialized');

        // Forward terminal input to the websocket when connected.
        terminal.onData((data) => {
            console.log('Terminal input:', data);
            const { connection: liveConnection } = useConsoleStore.getState();
            if (liveConnection.isConnected) {
                websocketService.send(data);
            }
        });

        // Recalculate layout on window resize.
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

            // Announce connection status in the terminal.
            if (xtermRef.current) {
                xtermRef.current.writeln(`\r\nConnecting to ${connection.namespace}/${connection.vmi}...`);
            }

            // Establish the websocket connection.
            websocketService.connect(
                connection.namespace,
                connection.vmi,
                (data) => {
                    console.log('WebSocket data received:', data);
                    if (xtermRef.current) {
                        // Keep the terminal visible and append incoming data.
                        xtermRef.current.write(data);
                        // Force-refresh the rendered rows.
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

    // Reflect connection status changes.
    useEffect(() => {
        if (connection.status === 'connected') {
            // Mark the console as ready once connected.
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
