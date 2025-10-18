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
        <Card size="small" className="control-panel-card">
            <Row gutter={[16, 16]} align="middle">
                {/* 命名空间选择 */}
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Text strong className="control-panel-label">Namespace</Text>
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
                        <Text strong className="control-panel-label">VMI</Text>
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
                        >
                            {connection.status === 'connecting' ? 'Connecting...' : 'Connect'}
                        </Button>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => loadVMIs(selectedNamespace === '__ALL__' ? undefined : selectedNamespace)}
                            loading={loading}
                            size="middle"
                            className="control-panel-refresh"
                        >
                            Refresh
                        </Button>
                    </Space>
                </Col>
            </Row>
        </Card>
    );
};
