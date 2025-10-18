export interface VMIInfo {
    namespace: string;
    name: string;
    phase?: string;
}

export interface ConsoleConfig {
    mode: 'shared' | 'dedicated';
    defaultNamespace?: string;
    initialNamespace?: string;
    fixedNamespace?: string;
    fixedVmi?: string;
}

export interface ConnectionState {
    isConnected: boolean;
    status: 'idle' | 'connecting' | 'connected' | 'error';
    namespace?: string;
    vmi?: string;
    error?: string;
}

export interface TerminalData {
    data: string;
    timestamp: number;
}
