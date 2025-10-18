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

            // Cache the namespaces in localStorage.
            localStorage.setItem('cachedNamespaces', JSON.stringify({
                data: result,
                timestamp: Date.now()
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load namespaces');

            // Attempt to load namespaces from cache.
            try {
                const cached = localStorage.getItem('cachedNamespaces');
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    // Validate cache freshness (1 hour TTL).
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
