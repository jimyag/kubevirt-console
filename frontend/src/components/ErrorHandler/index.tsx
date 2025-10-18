import React from 'react';
import { Alert, Button, Space } from 'antd';
import {
    UserDeleteOutlined,
    LockOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    ReloadOutlined
} from '@ant-design/icons';

export interface ConsoleError {
    type: 'VMI_NOT_FOUND' | 'RBAC_DENIED' | 'TIMEOUT' | 'NETWORK_ERROR' | 'UNKNOWN';
    message: string;
    details?: string;
    suggestion?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface ErrorHandlerProps {
    error: ConsoleError;
    onRetry?: () => void;
    onDismiss?: () => void;
}

export const ErrorHandler: React.FC<ErrorHandlerProps> = ({
    error,
    onRetry,
    onDismiss
}) => {
    const getErrorIcon = (type: string) => {
        switch (type) {
            case 'VMI_NOT_FOUND':
                return <UserDeleteOutlined style={{ color: '#ff4d4f' }} />;
            case 'RBAC_DENIED':
                return <LockOutlined style={{ color: '#faad14' }} />;
            case 'TIMEOUT':
                return <ClockCircleOutlined style={{ color: '#fa8c16' }} />;
            case 'NETWORK_ERROR':
                return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
            default:
                return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
        }
    };

    const getErrorTitle = (type: string) => {
        switch (type) {
            case 'VMI_NOT_FOUND':
                return 'VMI Not Found';
            case 'RBAC_DENIED':
                return 'Access Denied';
            case 'TIMEOUT':
                return 'Connection Timeout';
            case 'NETWORK_ERROR':
                return 'Network Error';
            default:
                return 'Unknown Error';
        }
    };

    const getErrorDescription = (type: string, details?: string) => {
        const baseDescriptions = {
            'VMI_NOT_FOUND': 'The specified Virtual Machine Instance could not be found.',
            'RBAC_DENIED': 'You do not have permission to access this VMI.',
            'TIMEOUT': 'The connection timed out. Please check your network connection.',
            'NETWORK_ERROR': 'A network error occurred while connecting.',
            'UNKNOWN': 'An unexpected error occurred.'
        };

        const baseDescription = baseDescriptions[type as keyof typeof baseDescriptions] || baseDescriptions.UNKNOWN;

        return details ? `${baseDescription} ${details}` : baseDescription;
    };

    return (
        <Alert
            message={getErrorTitle(error.type)}
            description={getErrorDescription(error.type, error.details)}
            type="error"
            icon={getErrorIcon(error.type)}
            action={
                <Space>
                    {error.action && (
                        <Button
                            size="small"
                            onClick={error.action.onClick}
                            type="primary"
                        >
                            {error.action.label}
                        </Button>
                    )}
                    {onRetry && (
                        <Button
                            size="small"
                            icon={<ReloadOutlined />}
                            onClick={onRetry}
                        >
                            Retry
                        </Button>
                    )}
                    {onDismiss && (
                        <Button
                            size="small"
                            onClick={onDismiss}
                        >
                            Dismiss
                        </Button>
                    )}
                </Space>
            }
            closable={!!onDismiss}
            onClose={onDismiss}
            style={{ marginBottom: 16 }}
        />
    );
};
