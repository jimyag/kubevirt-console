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
        <div style={{
            padding: '16px 32px',
            background: 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)',
            borderBottom: '1px solid #262626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
        }}>
            <Space align="center">
                <Badge
                    status={getStatusColor() as any}
                    text={
                        <Text style={{
                            color: '#ffffff',
                            fontSize: '14px',
                            fontWeight: '500',
                            letterSpacing: '0.3px'
                        }}>
                            {getStatusText()}
                        </Text>
                    }
                />
            </Space>

            {connection.error && (
                <Alert
                    message={connection.error}
                    type="error"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0
                    }}
                />
            )}
        </div>
    );
};
