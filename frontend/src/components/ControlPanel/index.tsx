import React, { useEffect, useState } from 'react';
import { Select, Button, Space, message, Row, Col, Card, Typography } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useConsoleStore } from '../../store/consoleStore';
import { apiService } from '../../services/api';

const { Option } = Select;
const { Text } = Typography;

export const ControlPanel: React.FC = () => {
    const {
        vmiList,
        namespaces,
        selectedNamespace,
        selectedVMI,
        connection,
        setVMIList,
        setNamespaces,
        setSelectedNamespace,
        setSelectedVMI,
        connect
    } = useConsoleStore();

    const [loading, setLoading] = useState(false);

    // 加载 VMI 列表
    const loadVMIs = async (namespace?: string) => {
        setLoading(true);
        try {
            const vmis = await apiService.getVMIs(namespace);
            setVMIList(vmis);

            // 提取命名空间列表
            const uniqueNamespaces = Array.from(new Set(vmis.map(vmi => vmi.namespace))).sort();
            setNamespaces(uniqueNamespaces);
        } catch (error) {
            message.error('Failed to load VMIs');
            console.error('Error loading VMIs:', error);
        } finally {
            setLoading(false);
        }
    };

    // 初始化加载
    useEffect(() => {
        loadVMIs();
    }, []);

    // 过滤 VMI 列表（基于选中的命名空间）
    const filteredVMIs = vmiList.filter(vmi => {
        return !selectedNamespace || selectedNamespace === '__ALL__' || vmi.namespace === selectedNamespace;
    });

    // 处理连接
    const handleConnect = () => {
        if (!selectedVMI) {
            message.warning('Please select a VMI');
            return;
        }

        const vmi = vmiList.find(v => v.name === selectedVMI);
        if (!vmi) {
            message.error('Selected VMI not found');
            return;
        }

        connect(vmi.namespace, vmi.name);
    };

    return (
        <Card
            size="small"
            style={{
                margin: '20px 32px',
                background: 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)',
                border: '1px solid #262626',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}
            bodyStyle={{ padding: '24px' }}
        >
            <Row gutter={[16, 16]} align="middle">
                {/* 命名空间选择 */}
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Text strong style={{
                            color: '#ffffff',
                            fontSize: '14px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>Namespace</Text>
                        <Select
                            value={selectedNamespace}
                            onChange={setSelectedNamespace}
                            style={{ width: '100%' }}
                            placeholder="Search and select namespace"
                            size="middle"
                            showSearch
                            optionFilterProp="children"
                            suffixIcon={<SearchOutlined style={{ color: '#a6a6a6' }} />}
                        >
                            <Option value="__ALL__">All namespaces</Option>
                            {namespaces.map(ns => (
                                <Option key={ns} value={ns}>{ns}</Option>
                            ))}
                        </Select>
                    </Space>
                </Col>

                {/* VMI 选择 */}
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Text strong style={{
                            color: '#ffffff',
                            fontSize: '14px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>VMI</Text>
                        <Select
                            value={selectedVMI}
                            onChange={setSelectedVMI}
                            style={{ width: '100%' }}
                            placeholder="Search and select VMI"
                            loading={loading}
                            size="middle"
                            showSearch
                            optionFilterProp="children"
                            suffixIcon={<SearchOutlined style={{ color: '#a6a6a6' }} />}
                        >
                            {filteredVMIs.map(vmi => (
                                <Option key={`${vmi.namespace}/${vmi.name}`} value={vmi.name}>
                                    {selectedNamespace === '__ALL__' ? `${vmi.namespace}/${vmi.name}` : vmi.name}
                                </Option>
                            ))}
                        </Select>
                    </Space>
                </Col>

                {/* 操作按钮 */}
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Space>
                        <Button
                            type="primary"
                            onClick={handleConnect}
                            disabled={!selectedVMI || connection.status === 'connecting'}
                            loading={connection.status === 'connecting'}
                            size="middle"
                            style={{
                                background: 'linear-gradient(135deg, #00d4aa 0%, #00b894 100%)',
                                borderColor: '#00d4aa',
                                boxShadow: '0 4px 12px rgba(0, 212, 170, 0.3)',
                                borderRadius: '8px',
                                fontWeight: '600',
                                height: '40px',
                                padding: '0 24px'
                            }}
                        >
                            {connection.status === 'connecting' ? 'Connecting...' : 'Connect'}
                        </Button>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => loadVMIs(selectedNamespace === '__ALL__' ? undefined : selectedNamespace)}
                            loading={loading}
                            size="middle"
                            style={{
                                background: 'transparent',
                                borderColor: '#262626',
                                color: '#bfbfbf',
                                borderRadius: '8px',
                                fontWeight: '500',
                                height: '40px',
                                padding: '0 20px'
                            }}
                        >
                            Refresh
                        </Button>
                    </Space>
                </Col>
            </Row>
        </Card>
    );
};
