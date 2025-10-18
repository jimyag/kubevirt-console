import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export const useNamespaceDiscovery = () => {
    const [namespaces, setNamespaces] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const discoverNamespaces = async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await apiService.getNamespaces();
            setNamespaces(result);

            // 缓存到 localStorage
            localStorage.setItem('cachedNamespaces', JSON.stringify({
                data: result,
                timestamp: Date.now()
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load namespaces');

            // 尝试从缓存加载
            try {
                const cached = localStorage.getItem('cachedNamespaces');
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    // 检查缓存是否过期（1 小时）
                    if (Date.now() - timestamp < 3600000) {
                        setNamespaces(data);
                    }
                }
            } catch (cacheError) {
                console.warn('Failed to load cached namespaces:', cacheError);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        discoverNamespaces();
    }, []);

    return {
        namespaces,
        loading,
        error,
        refresh: discoverNamespaces
    };
};
