import React from 'react';
import { Badge, Typography, Space, Alert } from 'antd';
import { useConsoleStore } from '../../store/consoleStore';

const { Text } = Typography;

export const ConnectionStatus: React.FC = () => {
    const { connection } = useConsoleStore();


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
        <div className="connection-status-bar">
            <Space align="center">
                <Badge
                    status={getStatusColor() as any}
                    text={
                        <Text className="connection-status-text">
                            {getStatusText()}
                        </Text>
                    }
                />
            </Space>

            {connection.error && (
                <Alert
                    message={connection.error}
                    type="error"
                    className="connection-status-alert"
                />
            )}
        </div>
    );
};
