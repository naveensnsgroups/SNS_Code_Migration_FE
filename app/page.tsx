'use client';

import { useCallback, useState } from 'react';
import { Files, Search, Bot, Settings, Zap, Terminal, Wrench, Database } from 'lucide-react';
import ExplorerPanel  from '@/components/ExplorerPanel';
import CodeViewer     from '@/components/CodeViewer';
import AIPanel        from '@/components/AIPanel';
import TerminalPanel  from '@/components/TerminalPanel';
import SearchPanel    from '@/components/SearchPanel';
import SettingsTab    from '@/components/SettingsTab';
import AIConfigTab    from '@/components/AIConfigTab';
import { useMigration }  from '@/hooks/useMigration';
import { usePanelResize } from '@/hooks/useResize';
import { useBackendUrl }  from '@/hooks/useSettings';
import type { MigrationStatus, TargetStack } from '@/types';

// ── Status Label Map ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<MigrationStatus, string> = {
  idle:       'Ready',
  scanning:   'Scanning...',
  planning:   'Planning...',
  complete:   'Complete ✅',
  error:      'Error ❌',
  paused:     'Paused ⏸',
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HomePage() {
  // ── UI-only state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]               = useState<'explorer' | 'search'>('explorer');
  const [sidebarOpen, setSidebarOpen]           = useState(true);
  const [aiPanelOpen, setAiPanelOpen]           = useState(false);
  const [activeEditorTab, setActiveEditorTab]   = useState<'code' | 'settings' | 'aiconfig'>('code');
  const [settingsTrigger, setSettingsTrigger]   = useState(0);

  // ── Settings + backend URL ────────────────────────────────────────────────
  const backendUrl = useBackendUrl(settingsTrigger);

  // ── Resizable panels ──────────────────────────────────────────────────────
  const [sidebarWidth,    startResizeSidebar]    = usePanelResize(260,  150, 500, 'x');
  const [aiPanelWidth,    startResizeAiPanel]    = usePanelResize(300,  200, 600, 'x', true);
  const [terminalHeight,  startResizeTerminal]   = usePanelResize(220,  80,  600, 'y', true);

  // ── Migration state + handlers ─────────────────────────────────────────────
  const {
    status, sessionId, fileTree, detectedStack,
    selectedFile, legacyCode, modernCode,
    logs, progress, currentFile, phases,
    tokenUsage, isRunning, hasProject, planPhaseDone,
    handleUpload, handleStart, handleStop, handlePause, handleSelectFile, clearSelectedFile,
  } = useMigration(backendUrl, settingsTrigger);

  // ── Settings saved callback ───────────────────────────────────────────────
  const handleSettingsSaved = useCallback(() => {
    setSettingsTrigger(prev => prev + 1);
  }, []);

  // ── File select wrapper ───────────────────────────────────────────────────
  const onSelectFile = useCallback((path: string) => {
    handleSelectFile(path, setActiveEditorTab);
  }, [handleSelectFile]);

  // ── Activity bar items ─────────────────────────────────────────────────────
  const activityItems = [
    { icon: <Files size={18} />,    id: 'explorer', title: 'Explorer',                type: 'sidebar'       as const },
    { icon: <Search size={18} />,   id: 'search',   title: 'Search',                  type: 'sidebar'       as const },
    { icon: <Bot size={18} />,      id: 'aiconfig', title: 'AI Configuration',         type: 'tab'           as const, tabId: 'aiconfig' as const },
    { icon: <Zap size={18} />,      id: 'pipeline', title: 'Operational Panel',        type: 'right-sidebar' as const },
    { icon: <Settings size={18} />, id: 'settings', title: 'Settings',                 type: 'tab'           as const, tabId: 'settings' as const },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">

      {/* Title Bar */}
      <header className="title-bar">
        <div className="title-bar__logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/agent_workbench_logo.png" alt="Logo" style={{ width: '18px', height: '18px' }} />
          <span>Code Migration Platform</span>
        </div>
        <div className="title-bar__actions">
          {sessionId && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Session: {sessionId}
            </span>
          )}
          <button className="title-bar__btn" onClick={() => setActiveEditorTab('settings')}>Settings</button>
        </div>
      </header>

      {/* Work Area */}
      <div className="work-area">

        {/* Activity Bar */}
        <nav className="activity-bar">
          {activityItems.map(item => {
            const isActive =
              item.type === 'sidebar'       ? sidebarOpen && activeTab === item.id :
              item.type === 'right-sidebar' ? aiPanelOpen :
              activeEditorTab === item.tabId;

            return (
              <button
                key={item.id}
                className={`activity-bar__btn ${isActive ? 'active' : ''}`}
                title={item.title}
                onClick={() => {
                  if (item.type === 'sidebar') {
                    activeTab === item.id ? setSidebarOpen(o => !o) : (setActiveTab(item.id as 'explorer' | 'search'), setSidebarOpen(true));
                  } else if (item.type === 'right-sidebar') {
                    setAiPanelOpen(o => !o);
                  } else {
                    setActiveEditorTab(activeEditorTab === item.tabId ? 'code' : item.tabId!);
                  }
                }}
              >
                {item.icon}
              </button>
            );
          })}
        </nav>

        {/* Sidebar */}
        {sidebarOpen && activeTab === 'explorer' && (
          <ExplorerPanel
            fileTree={fileTree}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            onUpload={handleUpload}
            hasProject={hasProject}
            width={sidebarWidth}
            planPhaseDone={planPhaseDone}
          />
        )}
        {sidebarOpen && activeTab === 'search' && (
          <SearchPanel
            sessionId={sessionId}
            onSelectFile={onSelectFile}
            backendUrl={backendUrl}
            width={sidebarWidth}
          />
        )}
        {sidebarOpen && <div className="sash-vertical" onMouseDown={startResizeSidebar} />}

        {/* Editor Area */}
        {activeEditorTab === 'settings' ? (
          <SettingsTab
            onSettingsSaved={handleSettingsSaved}
            onClose={() => setActiveEditorTab('code')}
            settingsTrigger={settingsTrigger}
          />
        ) : activeEditorTab === 'aiconfig' ? (
          <AIConfigTab
            onClose={() => setActiveEditorTab('code')}
            onSettingsSaved={handleSettingsSaved}
            settingsTrigger={settingsTrigger}
            tokenUsage={tokenUsage ?? undefined}
            backendUrl={backendUrl}
            isRunning={isRunning}
            sessionId={sessionId}
          />
        ) : (
          <CodeViewer
            legacyCode={legacyCode}
            modernCode={modernCode}
            legacyFile={selectedFile}
            modernFile={selectedFile ?? null}
            onClose={clearSelectedFile}
          />
        )}

        {/* Right Panel — AI Pipeline — always visible when toggled, even alongside AIConfig */}
        {aiPanelOpen && (
          <>
            <div className="sash-vertical" onMouseDown={startResizeAiPanel} />
            <AIPanel
              detectedStack={detectedStack}
              status={status}
              phases={phases}
              progress={progress}
              currentFile={currentFile}
              hasProject={hasProject}
              onStart={handleStart}
              onStop={handleStop}
              onPause={handlePause}
              settingsTrigger={settingsTrigger}
              onSettingsSaved={handleSettingsSaved}
              width={aiPanelWidth}
            />
          </>
        )}

        {/* Auto-open AI Panel when pipeline icon clicked while on aiconfig tab */}

      </div>

      {/* Terminal Sash */}
      <div className="sash-horizontal" onMouseDown={startResizeTerminal} />

      {/* Terminal */}
      <TerminalPanel logs={logs} isRunning={isRunning} height={terminalHeight} />

      {/* Status Bar */}
      <footer className="status-bar">
        <span className="status-bar__item" style={{ gap: '6px' }}>
          <Zap size={12} style={{ color: '#fff' }} /> Code Migration
        </span>
        {detectedStack && (
          <>
            <span className="status-bar__item" style={{ gap: '6px' }}>
              <Terminal size={12} /> {detectedStack.language}
            </span>
            <span className="status-bar__item" style={{ gap: '6px' }}>
              <Wrench size={12} /> {detectedStack.framework}
            </span>
            <span className="status-bar__item" style={{ gap: '6px' }}>
              <Database size={12} /> {detectedStack.database}
            </span>
          </>
        )}
        <span className="status-bar__item status-bar__item--right">
          {STATUS_LABEL[status]}
        </span>
        {isRunning && <span className="status-bar__item">{progress}%</span>}
      </footer>
    </div>
  );
}
