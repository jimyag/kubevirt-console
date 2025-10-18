import { create } from 'zustand';
import { VMIInfo, ConsoleConfig, ConnectionState } from '../types';

interface ConsoleStore {
    // 配置信息
    config: ConsoleConfig | null;

    // 连接状态
    connection: ConnectionState;

    // VMI 列表
    vmiList: VMIInfo[];
    namespaces: string[];

    // 选中的 VMI
    selectedNamespace: string;
    selectedVMI: string;

    // Actions
    setConfig: (config: ConsoleConfig) => void;
    setConnection: (connection: Partial<ConnectionState>) => void;
    setVMIList: (vmiList: VMIInfo[]) => void;
    setNamespaces: (namespaces: string[]) => void;
    setSelectedNamespace: (namespace: string) => void;
    setSelectedVMI: (vmi: string) => void;
    connect: (namespace: string, vmi: string) => void;
    disconnect: () => void;
}

export const useConsoleStore = create<ConsoleStore>((set) => ({
    config: null,
    connection: {
        isConnected: false,
        status: 'idle'
    },
    vmiList: [],
    namespaces: [],
    selectedNamespace: '__ALL__',
    selectedVMI: '',

    setConfig: (config) => set({ config }),

    setConnection: (connection) => set((state) => ({
        connection: { ...state.connection, ...connection }
    })),

    setVMIList: (vmiList) => set({ vmiList }),

    setNamespaces: (namespaces) => set({ namespaces }),

    setSelectedNamespace: (selectedNamespace) => set({ selectedNamespace }),

    setSelectedVMI: (selectedVMI) => set({ selectedVMI }),

    connect: (namespace, vmi) => set({
        connection: {
            isConnected: false,
            status: 'connecting',
            namespace,
            vmi
        },
        selectedNamespace: namespace,
        selectedVMI: vmi
    }),

    disconnect: () => set({
        connection: {
            isConnected: false,
            status: 'idle'
        }
    })
}));
