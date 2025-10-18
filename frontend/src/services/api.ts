import axios from 'axios';
import { ConsoleConfig, VMIInfo } from '../types';

const api = axios.create({
    baseURL: '/api',
    timeout: 10000,
});

export const apiService = {
    // 获取控制台配置
    getConfig: async (): Promise<ConsoleConfig> => {
        const response = await api.get('/config');
        return response.data;
    },

    // 获取 VMI 列表
    getVMIs: async (namespace?: string): Promise<VMIInfo[]> => {
        const params = namespace ? { namespace } : {};
        const response = await api.get('/vmis', { params });
        return response.data;
    },

    // 获取命名空间列表
    getNamespaces: async (): Promise<string[]> => {
        const response = await api.get('/namespaces');
        return response.data;
    }
};
