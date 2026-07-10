'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { Files, Search, Bot, Settings, Zap, Terminal, Wrench, Database, DollarSign } from 'lucide-react';
import ExplorerPanel  from '@/components/ExplorerPanel';
import CodeViewer     from '@/components/CodeViewer';
import AIPanel        from '@/components/AIPanel';
import TerminalPanel  from '@/components/TerminalPanel';
import SearchPanel    from '@/components/SearchPanel';
import SettingsTab    from '@/components/SettingsTab';
import AIConfigTab    from '@/components/AIConfigTab';
import { NotificationBell } from '@/components/notifications/NotificationCenter';
import { useMigration }  from '@/hooks/useMigration';
import { usePanelResize } from '@/hooks/useResize';
import { useBackendUrl }  from '@/hooks/useSettings';
import { useNotifications } from '@/context/NotificationContext';
import type { MigrationStatus } from '@/types';

// ── Status Label Map ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<MigrationStatus, string> = {
  idle:                 'Ready',
  scanning:             'Scanning...',
  planning:             'Planning...',
  discovery:            'Discovery...',
  'file-analysis':      'File Analysis...',
  'graph-resolution':   'Graph Resolution...',
  'awaiting-graph-review': 'Awaiting Graph Review',
  'section-writing':    'Writing Sections...',
  assembly:             'Assembly...',
  'migration-planning': 'Planning Migration...',
  'code-generation':    'Generating Code...',
  verification:         'Verifying...',
  'migration-assembly': 'Migration Report...',
  complete:             'Complete',
  error:                'Error',
  paused:               'Paused',
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

  // ── Notification system (must be before useMigration) ──────────────────────
  const { notify } = useNotifications();
  const prevStatusRef = useRef<MigrationStatus>('idle');

  // ── Migration state + handlers ─────────────────────────────────────────────
  const {
    status, sessionId, fileTree, detectedStack,
    selectedFile, legacyCode, modernCode,
    logs, progress, currentFile, phases,
    modernFileTree, modernFolderBasename,
    tokenUsage, isRunning, hasProject,
    activeTool, toolCallHistory,
    migrationTaskList, ruleCoverageReport, isPlanning, isGenerating, isVerifying,
    graphResolutionSummary, isCheckpointBusy,
    lastEventAt, runStartedAt, phaseDurations, reconnect,
    handleUpload, handleStart, handleContinueAnalysis, handleSkipToStage2,
    handleStartMigrationPlanning, handleStartCodeGeneration,
    handleStartVerification,
    handleStop, handlePause, handleSelectFile, clearSelectedFile,
    handleDownload,
  } = useMigration(backendUrl, notify);

  // Also pings a native OS notification for checkpoint-worthy transitions, so you
  // don't have to keep the tab focused to notice one was reached. Gated on all of:
  // the user opted in (Settings > Desktop Notifications), the browser actually
  // granted permission (requested at opt-in time, in SettingsTab's click handler —
  // never here, since Notification.requestPermission() needs a real user gesture),
  // and the tab isn't currently focused (no point pinging what's already visible).
  const notifyCheckpoint = useCallback((opts: Parameters<typeof notify>[0], nativeBody?: string) => {
    notify(opts);
    if (!nativeBody) return;
    if (typeof document !== 'undefined' && !document.hidden) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    let enabled = false;
    try { enabled = JSON.parse(localStorage.getItem('setting_general_desktop_notifications') || 'false'); } catch {}
    if (!enabled) return;
    new Notification('Code Migration Platform', { body: nativeBody });
  }, [notify]);

  // Fire notifications on status transitions (SNS IDE MessageService pattern)
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev === status) return;
    prevStatusRef.current = status;

    switch (status) {
      case 'scanning':
        notify({ type: 'info', message: 'Stage-1 Analysis started…' });
        break;
      case 'complete':
        notifyCheckpoint(
          { type: 'success', message: 'Stage-1 Analysis complete! View Stage1_Analysis.md in Explorer.', timeout: 8000 },
          'Stage 1 Analysis complete — review it and configure code migration.'
        );
        break;
      // HITL checkpoint: the pipeline is paused waiting on YOUR decision (continue
      // to the analysis report, or skip to code migration) — previously fired no
      // notification of any kind, in-app or native, so reaching it was silent.
      case 'awaiting-graph-review':
        notifyCheckpoint(
          { type: 'info', message: 'Graph resolution complete — review it in the Operational Panel to continue.', timeout: 8000 },
          'Graph review checkpoint reached — your decision is needed to continue.'
        );
        break;
      case 'error':
        notifyCheckpoint(
          { type: 'error', message: 'Pipeline error — check the Terminal for details.', persistent: true },
          'Pipeline error — check the app for details.'
        );
        break;
      case 'paused':
        notify({ type: 'warning', message: 'Migration paused. Click Resume to continue.' });
        break;
      case 'idle':
        if (prev === 'planning' || prev === 'scanning') {
          notify({ type: 'warning', message: 'Migration stopped by user.' });
        }
        break;
    }
  }, [status, notify, notifyCheckpoint]);

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
        <div className="title-bar__logo">
          <img src="/agent_workbench_logo.png" alt="Logo" className="title-bar__logo-img" />
          <span className="title-bar__brand">
            <span className="title-bar__brand-strong">Code Migration</span>
            <span className="title-bar__brand-light">Platform</span>
          </span>
        </div>
        <div className="title-bar__actions">
          {sessionId && (
            <span style={{ fontSize: 11, color: 'var(--activity-fg-inactive)', fontFamily: 'var(--font-mono)' }}>
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
            modernFileTree={modernFileTree}
            modernFolderBasename={modernFolderBasename}
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
            sessionId={sessionId}
          />
        ) : (
          <CodeViewer
            legacyCode={legacyCode}
            modernCode={modernCode}
            legacyFile={selectedFile}
            modernFile={selectedFile ?? null}
            onClose={clearSelectedFile}
            onDownload={handleDownload}
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
              logs={logs}
              hasProject={hasProject}
              activeTool={activeTool}
              toolCallHistory={toolCallHistory}
              onStart={handleStart}
              onStop={handleStop}
              onPause={handlePause}
              graphResolutionSummary={graphResolutionSummary}
              isCheckpointBusy={isCheckpointBusy}
              onContinueAnalysis={handleContinueAnalysis}
              onSkipToStage2={handleSkipToStage2}
              lastEventAt={lastEventAt}
              runStartedAt={runStartedAt}
              phaseDurations={phaseDurations}
              onReconnect={reconnect}
              settingsTrigger={settingsTrigger}
              onSettingsSaved={handleSettingsSaved}
              width={aiPanelWidth}
              migrationTaskList={migrationTaskList}
              ruleCoverageReport={ruleCoverageReport}
              isPlanning={isPlanning}
              onStartMigration={handleStartMigrationPlanning}
              isGenerating={isGenerating}
              onStartGeneration={handleStartCodeGeneration}
              isVerifying={isVerifying}
              onStartVerification={handleStartVerification}
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
        {/* estimatedCost is null when no pricing rate is configured for the
            model(s) used — the badge is simply omitted rather than showing a
            fabricated $0.00. costIncomplete marks a real but partial sum. */}
        {tokenUsage && tokenUsage.estimatedCost !== null && tokenUsage.estimatedCost > 0 && (
          <span
            className="status-bar__item"
            style={{ gap: '4px', color: 'var(--text-success)' }}
            title={tokenUsage.costIncomplete ? 'Partial estimate — a pricing rate is missing for at least one model used' : undefined}
          >
            <DollarSign size={11} />
            {tokenUsage.estimatedCost < 0.01
              ? '<$0.01'
              : `$${tokenUsage.estimatedCost.toFixed(4)}`}
            {tokenUsage.costIncomplete ? '*' : ''}
          </span>
        )}
        {/* Notification Bell — SNS IDE status bar bell pattern */}
        <NotificationBell />
      </footer>
    </div>
  );
}
