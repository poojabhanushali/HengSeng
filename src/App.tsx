import React, { useState, useEffect } from 'react';
import { Asset, ExchangeCode } from './types';
import { Navigation, ActiveTab } from './components/Navigation';
import { OverviewView } from './components/OverviewView';
import { ExchangeView } from './components/ExchangeView';
import { AssetExplorerView } from './components/AssetExplorerView';
import { AssetDetailModal } from './components/AssetDetailModal';
import { SocialSentimentView } from './components/SocialSentimentView';
import { NewsIntelligenceView } from './components/NewsIntelligenceView';
import { PredictionCenterView } from './components/PredictionCenterView';
import { ModelPerformanceView } from './components/ModelPerformanceView';
import { BacktestingView } from './components/BacktestingView';
import { ReportsView } from './components/ReportsView';
import { DataSourcesView } from './components/DataSourcesView';
import { PipelineMonitorView } from './components/PipelineMonitorView';
import { RolesAndPermissionsView } from './components/RolesAndPermissionsView';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { apiJson } from './lib/api';

export function AppInner() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [selectedExchange, setSelectedExchange] = useState<ExchangeCode | 'ALL'>('ALL');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isPipelineRunning, setIsPipelineRunning] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const { user, logout, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const fetchAssets = async () => {
    try {
      const data = await apiJson('/api/v1/assets');
      setAssets(data.assets || []);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleTriggerPipeline = async () => {
    setIsPipelineRunning(true);
    try {
      await apiJson('/api/v1/agents/run', { method: 'POST' });
      await fetchAssets();
    } catch (err) {
      console.error('Error running pipeline:', err);
    } finally {
      setIsPipelineRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedExchange={selectedExchange}
        setSelectedExchange={setSelectedExchange}
        isDark={isDark}
        setIsDark={setIsDark}
        isPipelineRunning={isPipelineRunning}
        onTriggerPipeline={handleTriggerPipeline}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        user={user}
        onLogout={logout}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          collapsed={sidebarCollapsed}
          user={user}
        />

        <main
          className={`flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-0' : ''}`}
        >
          <>
              {activeTab === 'overview' && (
                <OverviewView
                  assets={assets}
                  selectedExchange={selectedExchange}
                  onSelectAsset={setSelectedAsset}
                  onNavigateTab={setActiveTab}
                />
              )}
              {activeTab === 'exchange' && (
                <ExchangeView
                  assets={assets}
                  selectedExchange={selectedExchange}
                  setSelectedExchange={setSelectedExchange}
                  onSelectAsset={setSelectedAsset}
                />
              )}
              {activeTab === 'assets' && (
                <AssetExplorerView
                  assets={assets}
                  selectedExchange={selectedExchange}
                  setSelectedExchange={setSelectedExchange}
                  onSelectAsset={setSelectedAsset}
                />
              )}
              {activeTab === 'social' && <SocialSentimentView />}
              {activeTab === 'news' && <NewsIntelligenceView />}
              {activeTab === 'predictions' && (
                <PredictionCenterView
                  assets={assets}
                  onSelectAsset={setSelectedAsset}
                  onRefreshPredictions={fetchAssets}
                />
              )}
              {activeTab === 'performance' && <ModelPerformanceView />}
              {activeTab === 'backtesting' && <BacktestingView assets={assets} />}
              {activeTab === 'reports' && <ReportsView />}
              {activeTab === 'sources' && <DataSourcesView />}
              {activeTab === 'pipeline' && (
                <PipelineMonitorView
                  isPipelineRunning={isPipelineRunning}
                  onTriggerPipeline={handleTriggerPipeline}
                />
              )}
              {activeTab === 'permissions' && <RolesAndPermissionsView />}
              {activeTab === 'settings' && <SettingsView user={user} />}
            </>
          )
        </main>
      </div>

      {selectedAsset && (
        <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  );
}

// Consumer of AuthContext — rendered inside AuthProvider so useAuth() is valid.
export function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();
  return (
    <LanguageProvider>
      {isLoading ? (
        <div className="min-h-screen flex items-center justify-center bg-[#0b0f17] text-slate-400 text-sm">
          Initializing HengSeng Sentiment Intelligence Engine…
        </div>
      ) : isAuthenticated ? (
        <AppInner />
      ) : (
        <LoginView onLogin={() => {}} />
      )}
    </LanguageProvider>
  );
}

// Default export wraps everything in AuthProvider so useAuth() works throughout.
export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
