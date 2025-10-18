import { useState, useCallback, useRef } from 'react';

interface ReconnectOptions {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    onReconnect?: () => void;
    onMaxAttemptsReached?: () => void;
}

export const useReconnect = (options: ReconnectOptions = {}) => {
    const {
        maxAttempts = 5,
        baseDelay = 1000,
        maxDelay = 30000,
        onReconnect,
        onMaxAttemptsReached
    } = options;

    const [attempts, setAttempts] = useState(0);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const timeoutRef = useRef<number>();

    const calculateDelay = (attempt: number) => {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        return Math.min(delay, maxDelay);
    };

    const reconnect = useCallback(() => {
        if (attempts >= maxAttempts) {
            onMaxAttemptsReached?.();
            return;
        }

        setIsReconnecting(true);
        const delay = calculateDelay(attempts + 1);

        timeoutRef.current = setTimeout(() => {
            setAttempts(prev => prev + 1);
            onReconnect?.();
            setIsReconnecting(false);
        }, delay);
    }, [attempts, maxAttempts, baseDelay, maxDelay, onReconnect, onMaxAttemptsReached]);

    const reset = useCallback(() => {
        setAttempts(0);
        setIsReconnecting(false);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    const canReconnect = attempts < maxAttempts;

    return {
        attempts,
        isReconnecting,
        canReconnect,
        reconnect,
        reset
    };
};
