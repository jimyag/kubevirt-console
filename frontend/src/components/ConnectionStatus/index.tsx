import React from 'react';
import { Badge, Alert, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useConsoleStore } from '../../store/consoleStore';

export const ConnectionStatus: React.FC = () => {
    const { connection } = useConsoleStore();

    const getStatusIcon = () => {
        switch (connection.status) {
            case 'connected':
                return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
            case 'connecting':
                return <LoadingOutlined style={{ color: '#1890ff' }} />;
            case 'error':
                return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
            default:
                return null;
        }
    };

    const getStatusText = () => {
        switch (connection.status) {
            case 'connected':
                return `Connected to ${connection.namespace}/${connection.vmi}`;
            case 'connecting':
                return `Connecting to ${connection.namespace}/${connection.vmi}...`;
            case 'error':
                return 'Connection failed';
            default:
                return 'Not connected';
        }
    };

    const getStatusColor = () => {
        switch (connection.status) {
            case 'connected':
                return 'success';
            case 'connecting':
                return 'processing';
            case 'error':
                return 'error';
            default:
                return 'default';
        }
    };

    return (
        <div style={{ padding: '8px 16px', background: '#fafafa', borderBottom: '1px solid #d9d9d9' }}>
            <Space>
                <Badge
                    status={getStatusColor() as any}
                    text={getStatusText()}
                />
                {getStatusIcon()}
            </Space>

            {connection.error && (
                <Alert
                    message={connection.error}
                    type="error"
                    showIcon
                    style={{ marginTop: '8px' }}
                />
            )}
        </div>
    );
};
