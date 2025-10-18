import React, { useEffect } from 'react';
import { Layout, ConfigProvider } from 'antd';
import { Terminal } from './components/Terminal';
import { ControlPanel } from './components/ControlPanel';
import { ConnectionStatus } from './components/ConnectionStatus';
import { useConsoleStore } from './store/consoleStore';
import { apiService } from './services/api';

const { Header, Content } = Layout;

const App: React.FC = () => {
    const { setConfig } = useConsoleStore();

    // 初始化配置
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
                token: {
                    colorPrimary: '#1890ff',
                },
            }}
        >
            <Layout style={{ height: '100vh' }}>
                <Header style={{
                    background: '#001529',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 24px'
                }}>
                    <h2 style={{ margin: 0, color: 'white' }}>KubeVirt Console</h2>
                </Header>

                {/* 顶部控制面板 */}
                <ControlPanel />

                <Layout>
                    <ConnectionStatus />
                    <Content style={{ padding: 0, background: '#1b1b1b' }}>
                        <Terminal />
                    </Content>
                </Layout>
            </Layout>
        </ConfigProvider>
    );
};

export default App;
