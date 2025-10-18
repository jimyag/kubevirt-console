import React, { useState, useEffect } from 'react';
import { Select, Space } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';

const { Option } = Select;

interface Language {
    code: string;
    name: string;
    flag: string;
}

const languages: Language[] = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' }
];

const translations = {
    en: {
        namespace: 'Namespace',
        vmi: 'VMI',
        connect: 'Connect',
        refresh: 'Refresh',
        connecting: 'Connecting...',
        connected: 'Connected',
        disconnected: 'Disconnected',
        selectNamespace: 'Search and select namespace',
        selectVMI: 'Search and select VMI',
        allNamespaces: 'All namespaces'
    },
    zh: {
        namespace: '命名空间',
        vmi: '虚拟机实例',
        connect: '连接',
        refresh: '刷新',
        connecting: '连接中...',
        connected: '已连接',
        disconnected: '已断开',
        selectNamespace: '搜索并选择命名空间',
        selectVMI: '搜索并选择虚拟机实例',
        allNamespaces: '所有命名空间'
    },
    ja: {
        namespace: 'ネームスペース',
        vmi: 'VMI',
        connect: '接続',
        refresh: '更新',
        connecting: '接続中...',
        connected: '接続済み',
        disconnected: '切断',
        selectNamespace: 'ネームスペースを検索・選択',
        selectVMI: 'VMI を検索・選択',
        allNamespaces: 'すべてのネームスペース'
    },
    ko: {
        namespace: '네임스페이스',
        vmi: 'VMI',
        connect: '연결',
        refresh: '새로고침',
        connecting: '연결 중...',
        connected: '연결됨',
        disconnected: '연결 끊김',
        selectNamespace: '네임스페이스 검색 및 선택',
        selectVMI: 'VMI 검색 및 선택',
        allNamespaces: '모든 네임스페이스'
    }
};

export const LanguageSwitcher: React.FC = () => {
    const [currentLanguage, setCurrentLanguage] = useState<string>('en');

    useEffect(() => {
        // 从 localStorage 加载保存的语言设置
        const savedLanguage = localStorage.getItem('consoleLanguage') || 'en';
        setCurrentLanguage(savedLanguage);
    }, []);

    const handleLanguageChange = (language: string) => {
        setCurrentLanguage(language);
        localStorage.setItem('consoleLanguage', language);

        // 触发语言变更事件
        window.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { language, translations: translations[language as keyof typeof translations] }
        }));
    };

    return (
        <Space>
            <GlobalOutlined />
            <Select
                value={currentLanguage}
                onChange={handleLanguageChange}
                style={{ width: 120 }}
                size="small"
            >
                {languages.map(lang => (
                    <Option key={lang.code} value={lang.code}>
                        <Space>
                            <span>{lang.flag}</span>
                            <span>{lang.name}</span>
                        </Space>
                    </Option>
                ))}
            </Select>
        </Space>
    );
};

// 导出翻译函数供其他组件使用
export const useTranslation = () => {
    const [t, setT] = useState(translations.en);

    useEffect(() => {
        const handleLanguageChange = (event: CustomEvent) => {
            setT(event.detail.translations);
        };

        window.addEventListener('languageChanged', handleLanguageChange as EventListener);

        return () => {
            window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
        };
    }, []);

    return t;
};
