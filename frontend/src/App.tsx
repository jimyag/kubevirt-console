import React, { useEffect } from 'react';
import { Layout, ConfigProvider, Space, Typography, theme } from 'antd';
import { Terminal } from './components/Terminal';
import { ControlPanel } from './components/ControlPanel';
import { ConnectionStatus } from './components/ConnectionStatus';
import { useConsoleStore } from './store/consoleStore';
import { apiService } from './services/api';

const { Header, Content } = Layout;
const { Title } = Typography;

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
            <Layout style={{ height: '100vh', background: '#000' }}>
                {/* 顶部导航栏 */}
                <Header style={{
                    background: 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)',
                    borderBottom: '1px solid #262626',
                    padding: '0 32px',
                    height: '72px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                }}>
                    <Space align="center">
                        <div style={{
                            width: '44px',
                            height: '44px',
                            background: 'linear-gradient(135deg, #00d4aa 0%, #00b894 100%)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '22px',
                            fontWeight: 'bold',
                            color: 'white',
                            boxShadow: '0 4px 16px rgba(0, 212, 170, 0.4)',
                            border: '1px solid rgba(0, 212, 170, 0.2)'
                        }}>
                            K
                        </div>
                        <Title level={3} style={{
                            margin: 0,
                            color: '#ffffff',
                            fontWeight: '600',
                            background: 'linear-gradient(135deg, #ffffff 0%, #bfbfbf 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>
                            KubeVirt Console
                        </Title>
                    </Space>

                </Header>

                {/* 筛选控制面板 */}
                <ControlPanel />

                {/* 状态栏 */}
                <ConnectionStatus />

                {/* 终端区域 */}
                <Content style={{ padding: 0, background: '#000' }}>
                    <Terminal />
                </Content>
            </Layout>
        </ConfigProvider>
    );
};

export default App;
