import React, { useEffect } from 'react';
import { Layout, ConfigProvider, Typography, Space, theme, Tag } from 'antd';
import { Terminal } from './components/Terminal';
import { ControlPanel } from './components/ControlPanel';
import { ConnectionStatus } from './components/ConnectionStatus';
import { useConsoleStore } from './store/consoleStore';
import { apiService } from './services/api';
import './App.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const App: React.FC = () => {
    const { setConfig } = useConsoleStore();

    // Initialize runtime configuration from the backend.
    useEffect(() => {
        const initConfig = async () => {
            try {
                const configData = await apiService.getConfig();
                setConfig(configData);
            } catch (error) {
                console.error('Failed to load config:', error);
            }
        };

        initConfig();
    }, [setConfig]);

    return (
        <ConfigProvider
            theme={{
                algorithm: theme.darkAlgorithm,
                token: {
                    colorPrimary: '#00d4aa',
                    colorSuccess: '#00d4aa',
                    colorWarning: '#ffa940',
                    colorError: '#ff4d4f',
                    colorBgContainer: '#0a0a0a',
                    colorBgElevated: '#1a1a1a',
                    colorBgLayout: '#0f0f0f',
                    colorBorder: '#262626',
                    colorBorderSecondary: '#1f1f1f',
                    colorText: '#ffffff',
                    colorTextSecondary: '#bfbfbf',
                    colorTextTertiary: '#8c8c8c',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                },
            }}
        >
            <div className="app-root">
                <div className="app-aurora" />
                <Layout className="app-layout">
                    <Header className="app-header">
                        <Space size={16} className="app-header__branding">
                            <div className="app-header__mark">K</div>
                            <div>
                                <Title level={4} className="app-header__title">KubeVirt Console</Title>
                                <Text className="app-header__subtitle">Seamless serial access for your virtual machines</Text>
                            </div>
                        </Space>
                        <Space size={12} align="center">
                            <Tag color="success" className="app-header__badge">Live</Tag>
                            <Text className="app-header__meta">Cluster Console</Text>
                        </Space>
                    </Header>
                    <Content className="app-content">
                        <div className="app-controls">
                            <ControlPanel />
                            <ConnectionStatus />
                        </div>
                        <div className="app-terminal-wrapper">
                            <Terminal className="terminal-shell" />
                        </div>
                    </Content>
                </Layout>
            </div>
        </ConfigProvider>
    );
};

export default App;
