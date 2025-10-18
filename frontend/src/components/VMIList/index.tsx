import React, { useEffect, useState } from 'react';
import { Select, Input, Button, Space, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useConsoleStore } from '../../store/consoleStore';
import { apiService } from '../../services/api';
// import { VMIInfo } from '../../types';

const { Option } = Select;

export const VMIList: React.FC = () => {
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

    const [namespaceSearch, setNamespaceSearch] = useState('');
    const [vmiSearch, setVmiSearch] = useState('');
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

    // 过滤 VMI 列表
    const filteredVMIs = vmiList.filter(vmi => {
        const matchesNamespace = !selectedNamespace || selectedNamespace === '__ALL__' || vmi.namespace === selectedNamespace;
        const matchesSearch = !vmiSearch ||
            vmi.name.toLowerCase().includes(vmiSearch.toLowerCase()) ||
            vmi.namespace.toLowerCase().includes(vmiSearch.toLowerCase());
        return matchesNamespace && matchesSearch;
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
        <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '6px' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {/* 命名空间选择 */}
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                        Namespace
                    </label>
                    <Space.Compact style={{ width: '100%' }}>
                        <Input
                            placeholder="Filter namespaces..."
                            value={namespaceSearch}
                            onChange={(e) => setNamespaceSearch(e.target.value)}
                            prefix={<SearchOutlined />}
                            style={{ width: '50%' }}
                        />
                        <Select
                            value={selectedNamespace}
                            onChange={setSelectedNamespace}
                            style={{ width: '50%' }}
                            placeholder="Select namespace"
                        >
                            <Option value="__ALL__">All namespaces</Option>
                            {namespaces
                                .filter(ns => !namespaceSearch || ns.toLowerCase().includes(namespaceSearch.toLowerCase()))
                                .map(ns => (
                                    <Option key={ns} value={ns}>{ns}</Option>
                                ))}
                        </Select>
                    </Space.Compact>
                </div>

                {/* VMI 选择 */}
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                        VMI
                    </label>
                    <Space.Compact style={{ width: '100%' }}>
                        <Input
                            placeholder="Filter VMIs..."
                            value={vmiSearch}
                            onChange={(e) => setVmiSearch(e.target.value)}
                            prefix={<SearchOutlined />}
                            style={{ width: '50%' }}
                        />
                        <Select
                            value={selectedVMI}
                            onChange={setSelectedVMI}
                            style={{ width: '50%' }}
                            placeholder="Select VMI"
                            loading={loading}
                        >
                            {filteredVMIs.map(vmi => (
                                <Option key={`${vmi.namespace}/${vmi.name}`} value={vmi.name}>
                                    {selectedNamespace === '__ALL__' ? `${vmi.namespace}/${vmi.name}` : vmi.name}
                                </Option>
                            ))}
                        </Select>
                    </Space.Compact>
                </div>

                {/* 操作按钮 */}
                <Space>
                    <Button
                        type="primary"
                        onClick={handleConnect}
                        disabled={!selectedVMI || connection.status === 'connecting'}
                        loading={connection.status === 'connecting'}
                    >
                        {connection.status === 'connecting' ? 'Connecting...' : 'Connect'}
                    </Button>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => loadVMIs(selectedNamespace === '__ALL__' ? undefined : selectedNamespace)}
                        loading={loading}
                    >
                        Refresh
                    </Button>
                </Space>
            </Space>
        </div>
    );
};
