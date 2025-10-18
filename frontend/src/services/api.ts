import axios from 'axios';
import { ConsoleConfig, VMIInfo } from '../types';

const api = axios.create({
    baseURL: '/api',
    timeout: 10000,
});

export const apiService = {
    // Fetch console configuration from the backend.
    getConfig: async (): Promise<ConsoleConfig> => {
        const response = await api.get('/config');
        return response.data;
    },

    // Retrieve the list of VMIs.
    getVMIs: async (namespace?: string): Promise<VMIInfo[]> => {
        const params = namespace ? { namespace } : {};
        const response = await api.get('/vmis', { params });
        return response.data;
    },

    // Retrieve the list of namespaces.
    getNamespaces: async (): Promise<string[]> => {
        const response = await api.get('/namespaces');
        return response.data;
    }
};
