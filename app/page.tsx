'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { Files, Search, Settings, Zap, Terminal, Wrench, Database, DollarSign } from 'lucide-react';
import GithubLogo from '@/components/icons/GithubLogo';
import ExplorerPanel  from '@/components/ExplorerPanel';
import CodeViewer     from '@/components/CodeViewer';
import AIPanel        from '@/components/AIPanel';
import TerminalPanel  from '@/components/TerminalPanel';
import SearchPanel    from '@/components/SearchPanel';
import SettingsTab    from '@/components/SettingsTab';
import AccountMenu, { type GithubUser } from '@/components/AccountMenu';
import GithubSignInDialog from '@/components/GithubSignInDialog';
import { NotificationBell } from '@/components/notifications/NotificationCenter';
import { useMigration }  from '@/hooks/useMigration';
import { usePanelResize } from '@/hooks/useResize';
import { useBackendUrl }  from '@/hooks/useSettings';
import { useNotifications } from '@/context/NotificationContext';
import type { MigrationStatus, FileNode } from '@/types';
import { STAGE1_ANALYSIS_VIRTUAL_PATH, KNOWLEDGE_GRAPH_FOLDER, KNOWLEDGE_GRAPH_CATEGORIES, knowledgeGraphVirtualPath, MIGRATION_PLAN_VIRTUAL_PATH } from '@/types';

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
  const [activeEditorTab, setActiveEditorTab]   = useState<'code' | 'settings'>('code');
  const [settingsTrigger, setSettingsTrigger]   = useState(0);
  const [accountMenuOpen, setAccountMenuOpen]   = useState(false);
  // GitHub account — null until signed in, restored from localStorage on mount.
  const [githubUser, setGithubUser]             = useState<GithubUser | null>(null);
  const [githubSignInOpen, setGithubSignInOpen] = useState(false);

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
    selectedFile, legacyCode, legacyBinaryContent, modernCode,
    logs, progress, currentFile, phases,
    modernFileTree, modernFolderBasename,
    tokenUsage, analysisReport, knowledgeGraph, isRunning, hasProject,
    activeTool, toolCallHistory,
    migrationTaskList, ruleCoverageReport, planSanityWarning, reportedIssues, handleReportIssue,
    isPlanning, isGenerating, isVerifying,
    graphResolutionSummary, isCheckpointBusy,
    lastEventAt, runStartedAt, phaseDurations, reconnect,
    validFileCount, emptyFileCount, emptyFiles,
    handleUpload,
    isTriggeringScannerAgent, handleTriggerScannerAgent,
    handleCloneFromGithub, handleStart, handleContinueAnalysis, handleSkipToStage2,
    handleStartMigrationPlanning, handleStartCodeGeneration,
    handleStartVerification,
    handleStop, handlePause, handleSelectFile, clearSelectedFile,
    handleDownload, handleNewProject,
  } = useMigration(backendUrl, notify);

  // Also pings a native OS notification for checkpoint-worthy transitions, so you
  // don't have to keep the tab focused to notice one was reached. Gated on all of:
  // the user opted in (setting_general_desktop_notifications), the browser
  // actually granted permission, and the tab isn't currently focused (no point
  // pinging what's already visible).
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
          { type: 'success', message: 'Stage-1 Analysis complete! See the report in the Terminal.', timeout: 8000 },
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

  // ── Target Configuration reset ─────────────────────────────────────────────
  // Target Framework/Database/Language values persist in localStorage
  // globally, not per-project — so every entry point that starts a genuinely
  // NEW project (not just the explicit "New Project" button) must clear them,
  // or Layer Analysis silently shows a previous, unrelated project's target
  // values as if they'd already been confirmed for the one just opened.
  const resetTargetConfig = useCallback(() => {
    localStorage.removeItem('setting_target_framework');
    localStorage.removeItem('setting_target_database');
    localStorage.removeItem('setting_target_lang');
    setSettingsTrigger(prev => prev + 1);
  }, []);

  // ── New Project ────────────────────────────────────────────────────────────
  // Blocked while a Stage-2 sub-stage is actively running — abandoning one
  // mid-flight would leave the backend session in a half-finished state with
  // no way back to it from this tab.
  const newProjectBlocked = isRunning || isPlanning || isGenerating || isVerifying;
  const handleStartNewProject = useCallback(() => {
    handleNewProject();
    resetTargetConfig();
  }, [handleNewProject, resetTargetConfig]);

  // ── Open Folder / Clone from GitHub ────────────────────────────────────────
  // Same target-config reset as New Project — these are the two OTHER entry
  // points for starting a new project (the first-ever project in a tab never
  // goes through "New Project" at all).
  const handleUploadNewProject = useCallback((files: FileList | File[], explicitPaths?: string[]) => {
    resetTargetConfig();
    return handleUpload(files, explicitPaths);
  }, [handleUpload, resetTargetConfig]);

  const handleCloneNewProject = useCallback((repoUrl: string, branch?: string) => {
    resetTargetConfig();
    return handleCloneFromGithub(repoUrl, branch);
  }, [handleCloneFromGithub, resetTargetConfig]);

  // ── File select wrapper ───────────────────────────────────────────────────
  const onSelectFile = useCallback((path: string) => {
    handleSelectFile(path, setActiveEditorTab);
  }, [handleSelectFile]);

  // Explorer tree + virtual entries once Stage-1 Analysis output exists —
  // synthesized here for display only; the real fileTree state stays
  // backend-only (see handleSelectFile's special case for reading them back).
  const knowledgeGraphFiles: FileNode[] = knowledgeGraph && typeof knowledgeGraph === 'object'
    ? KNOWLEDGE_GRAPH_CATEGORIES
        .filter(({ key }) => (knowledgeGraph as Record<string, unknown>)[key] !== undefined)
        .map(({ fileName }) => ({
          name: fileName,
          path: knowledgeGraphVirtualPath(fileName),
          type: 'file' as const,
          migrated: false,
          language: 'json',
        } satisfies FileNode))
    : [];

  const virtualEntries: FileNode[] = [
    ...(analysisReport
      ? [{
          name: 'Stage1_Analysis.md',
          path: STAGE1_ANALYSIS_VIRTUAL_PATH,
          type: 'file' as const,
          migrated: false,
          language: 'md',
        } satisfies FileNode]
      : []),
    ...(migrationTaskList && migrationTaskList.length > 0
      ? [{
          name: 'Migration_Plan.md',
          path: MIGRATION_PLAN_VIRTUAL_PATH,
          type: 'file' as const,
          migrated: false,
          language: 'md',
        } satisfies FileNode]
      : []),
    ...(knowledgeGraphFiles.length > 0
      ? [{
          name: KNOWLEDGE_GRAPH_FOLDER,
          path: KNOWLEDGE_GRAPH_FOLDER,
          type: 'directory' as const,
          children: knowledgeGraphFiles,
        } satisfies FileNode]
      : []),
  ];
  const explorerFileTree = virtualEntries.length > 0 ? [...fileTree, ...virtualEntries] : fileTree;

  // ── GitHub account (device-flow OAuth) ─────────────────────────────────────
  // Restore a previous sign-in on mount. The token lives in localStorage (same
  // model the app already uses for provider API keys) so clone/push can reuse it.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('github_user');
      if (raw) setGithubUser(JSON.parse(raw));
    } catch { /* ignore malformed */ }
  }, []);

  // No client-side gate here — the backend ships its own default Client ID
  // (GITHUB_OAUTH_CLIENT_ID), so sign-in just works, the same as VS Code's
  // "Sign in with GitHub" needing no setup. If that env var genuinely isn't
  // set on the server, GithubSignInDialog surfaces that error itself.
  const handleGithubSignIn = useCallback(() => {
    setAccountMenuOpen(false);
    setGithubSignInOpen(true);
  }, []);

  const handleGithubSignInSuccess = useCallback((token: string, user: GithubUser) => {
    localStorage.setItem('github_access_token', token);
    localStorage.setItem('github_user', JSON.stringify(user));
    setGithubUser(user);
    setGithubSignInOpen(false);
    notify({ type: 'success', message: `Connected to GitHub as @${user.login}.` });
  }, [notify]);

  const handleGithubSignOut = useCallback(() => {
    setAccountMenuOpen(false);
    localStorage.removeItem('github_access_token');
    localStorage.removeItem('github_user');
    setGithubUser(null);
    notify({ type: 'info', message: 'Signed out of GitHub.' });
  }, [notify]);

  const githubClientId = (typeof window !== 'undefined'
    ? (localStorage.getItem('setting_general_github_client_id') || '')
    : '').replace(/^"|"$/g, '').trim();

  // ── Activity bar items ─────────────────────────────────────────────────────
  // Top group scrolls with the views; Settings + Account are pinned at the
  // bottom (SNS IDE / Theia leftPanelHandler.addBottomMenu pattern).
  const activityItems = [
    { icon: <Files size={21} />,    id: 'explorer', title: 'Explorer',                type: 'sidebar'       as const },
    { icon: <Search size={21} />,   id: 'search',   title: 'Search',                  type: 'sidebar'       as const },
    { icon: <Zap size={21} />,      id: 'pipeline', title: 'Operational Panel',        type: 'right-sidebar' as const },
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
        </div>
      </header>

      {/* Work Area */}
      <div className="work-area">

        {/* Activity Bar */}
        <nav className="activity-bar">
          {activityItems.map(item => {
            const isActive =
              item.type === 'sidebar' ? sidebarOpen && activeTab === item.id : aiPanelOpen;

            return (
              <button
                key={item.id}
                className={`activity-bar__btn ${isActive ? 'active' : ''}`}
                title={item.title}
                onClick={() => {
                  if (item.type === 'sidebar') {
                    activeTab === item.id ? setSidebarOpen(o => !o) : (setActiveTab(item.id as 'explorer' | 'search'), setSidebarOpen(true));
                  } else {
                    setAiPanelOpen(o => !o);
                  }
                }}
              >
                {item.icon}
              </button>
            );
          })}

          {/* Bottom-pinned group: Account + Settings (Theia addBottomMenu pattern) */}
          <div className="activity-bar__bottom">
            <button
              className={`activity-bar__btn ${accountMenuOpen ? 'active' : ''}`}
              title={githubUser ? `Signed in as @${githubUser.login}` : 'Accounts'}
              onClick={() => setAccountMenuOpen(o => !o)}
            >
              <GithubLogo size={21} />
              {githubUser && <span className="activity-bar__connected-dot" />}
            </button>
            <button
              className={`activity-bar__btn ${activeEditorTab === 'settings' ? 'active' : ''}`}
              title="Settings"
              onClick={() => setActiveEditorTab(activeEditorTab === 'settings' ? 'code' : 'settings')}
            >
              <Settings size={21} />
            </button>
          </div>
        </nav>

        <AccountMenu
          open={accountMenuOpen}
          user={githubUser}
          onSignIn={handleGithubSignIn}
          onSignOut={handleGithubSignOut}
          onClose={() => setAccountMenuOpen(false)}
        />

        <GithubSignInDialog
          open={githubSignInOpen}
          backendUrl={backendUrl}
          clientId={githubClientId}
          onSuccess={handleGithubSignInSuccess}
          onClose={() => setGithubSignInOpen(false)}
        />

        {/* Sidebar */}
        {sidebarOpen && activeTab === 'explorer' && (
          <ExplorerPanel
            fileTree={explorerFileTree}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            onUpload={handleUploadNewProject}
            onCloneFromGithub={handleCloneNewProject}
            isGithubSignedIn={!!githubUser}
            hasProject={hasProject}
            width={sidebarWidth}
            modernFileTree={modernFileTree}
            modernFolderBasename={modernFolderBasename}
            onNewProject={newProjectBlocked ? undefined : handleStartNewProject}
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

        {/* Editor column — Terminal docks only under this area (like VS Code/Theia),
            never under the Explorer or Operational Panel, which stay full height. */}
        <div className="editor-column">
          {activeEditorTab === 'settings' ? (
            <SettingsTab
              onSettingsSaved={handleSettingsSaved}
              onClose={() => setActiveEditorTab('code')}
              settingsTrigger={settingsTrigger}
            />
          ) : (
            <CodeViewer
              legacyCode={legacyCode}
              legacyBinaryContent={legacyBinaryContent}
              modernCode={modernCode}
              legacyFile={selectedFile}
              modernFile={selectedFile ?? null}
              onClose={clearSelectedFile}
              onDownload={handleDownload}
            />
          )}

          {/* Terminal Sash */}
          <div className="sash-horizontal" onMouseDown={startResizeTerminal} />

          {/* Terminal */}
          <TerminalPanel logs={logs} isRunning={isRunning} height={terminalHeight} />
        </div>

        {/* Right Panel — AI Pipeline — always visible when toggled, even alongside AIConfig */}
        {aiPanelOpen && (
          <>
            <div className="sash-vertical" onMouseDown={startResizeAiPanel} />
            <AIPanel
              detectedStack={detectedStack}
              validFileCount={validFileCount}
              emptyFileCount={emptyFileCount}
              emptyFiles={emptyFiles}
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
              isTriggeringScannerAgent={isTriggeringScannerAgent}
              onTriggerScannerAgent={handleTriggerScannerAgent}
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
              planSanityWarning={planSanityWarning}
              reportedIssues={reportedIssues}
              onReportIssue={handleReportIssue}
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
