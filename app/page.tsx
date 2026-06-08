'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Files, Search, Bot, Settings, Info, Zap, Terminal, Wrench, Database } from 'lucide-react';
import ExplorerPanel from '@/components/ExplorerPanel';
import CodeViewer from '@/components/CodeViewer';
import AIPanel from '@/components/AIPanel';
import TerminalPanel from '@/components/TerminalPanel';
import SearchPanel from '@/components/SearchPanel';
import SettingsTab from '@/components/SettingsTab';
import AIConfigTab from '@/components/AIConfigTab';
import {
  DetectedStack,
  FileNode,
  LogEntry,
  MigrationPhase,
  MigrationStatus,
  TargetStack,
  MIGRATION_PHASES,
} from '@/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export default function HomePage() {
  // ── State ──────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<MigrationStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [detectedStack, setDetectedStack] = useState<DetectedStack | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [legacyCode, setLegacyCode] = useState<string | null>(null);
  const [modernCode, setModernCode] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [phases, setPhases] = useState<MigrationPhase[]>(MIGRATION_PHASES);
  const [activeTab, setActiveTab] = useState<'explorer' | 'search'>('explorer');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [backendUrl, setBackendUrl] = useState(BACKEND_URL);
  const [activeEditorTab, setActiveEditorTab] = useState<'code' | 'settings' | 'aiconfig'>('code');
  const [settingsTrigger, setSettingsTrigger] = useState(0);
  const [modernFileTree, setModernFileTree] = useState<FileNode[]>([]);
  const [modernFolderBasename, setModernFolderBasename] = useState<string>('');

  // Resizable panel states (Theia-style)
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [aiPanelWidth, setAiPanelWidth] = useState(300);
  const [terminalHeight, setTerminalHeight] = useState(220);

  const startResizeSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const doDrag = (moveEvent: MouseEvent) => {
      setSidebarWidth(Math.max(150, Math.min(500, startWidth + (moveEvent.clientX - startX))));
    };
    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  const startResizeAiPanel = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = aiPanelWidth;
    const doDrag = (moveEvent: MouseEvent) => {
      setAiPanelWidth(Math.max(200, Math.min(600, startWidth - (moveEvent.clientX - startX))));
    };
    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  };



  const startResizeTerminal = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = terminalHeight;
    const doDrag = (moveEvent: MouseEvent) => {
      setTerminalHeight(Math.max(80, Math.min(600, startHeight - (moveEvent.clientY - startY))));
    };
    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  // Load backend url and theme from settings on mount
  useEffect(() => {
    const savedUrl = localStorage.getItem('setting_general_backend_url');
    if (savedUrl) {
      try {
        setBackendUrl(JSON.parse(savedUrl));
      } catch {
        setBackendUrl(savedUrl);
      }
    }
    const savedTheme = localStorage.getItem('setting_general_theme');
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        document.documentElement.className = `theme-${parsed}`;
      } catch {
        document.documentElement.className = `theme-${savedTheme}`;
      }
    } else {
      document.documentElement.className = 'theme-dark';
    }
  }, []);

  const handleSettingsSaved = useCallback(() => {
    setSettingsTrigger(prev => prev + 1);
    const savedUrl = localStorage.getItem('setting_general_backend_url');
    if (savedUrl) {
      try {
        setBackendUrl(JSON.parse(savedUrl));
      } catch {
        setBackendUrl(savedUrl);
      }
    }
    const savedTheme = localStorage.getItem('setting_general_theme');
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        document.documentElement.className = `theme-${parsed}`;
      } catch {
        document.documentElement.className = `theme-${savedTheme}`;
      }
    }
  }, []);

  const fetchModernTree = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/migrate/tree?sessionId=${sid}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setModernFileTree(data.fileTree || []);
      if (data.modernPath) {
        const clean = data.modernPath.replace(/\\/g, '/');
        const parts = clean.split('/');
        const folderName = parts[parts.length - 1] || data.modernPath;
        setModernFolderBasename(folderName);
      }
    } catch {
      setModernFileTree([]);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (sessionId) {
      fetchModernTree(sessionId);
    } else {
      setModernFileTree([]);
      setModernFolderBasename('');
    }
  }, [sessionId, fetchModernTree]);

  const sseRef = useRef<EventSource | null>(null);
  const hasProject = fileTree.length > 0;
  const isRunning = ['scanning', 'planning', 'pseudocode', 'migrating', 'building', 'validating', 'testing'].includes(status);
  const planPhaseDone = phases.find(p => p.id === 'plan')?.status === 'done';

  // ── Log helper ─────────────────────────────────────────────────────────
  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info', phase?: string) => {
    setLogs(prev => [...prev, { id: generateId(), timestamp: timestamp(), level, message, phase }]);
  }, []);

  // ── File Upload → Send to Backend for Scan ─────────────────────────────
  const handleUpload = useCallback(async (files: FileList | File[], explicitPaths?: string[]) => {
    addLog('Reading project files...', 'info');
    setStatus('scanning');

    const formData = new FormData();
    const pathsArray: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = explicitPaths && explicitPaths[i]
        ? explicitPaths[i]
        : ((file as File & { webkitRelativePath: string }).webkitRelativePath || file.name);

      formData.append('files', file);
      pathsArray.push(relativePath);
    }
    formData.append('paths', JSON.stringify(pathsArray));

    // Retrieve active AI settings from localStorage
    let provider = 'anthropic';
    let model = 'claude-sonnet-4-6';
    let apiKey = '';
    
    if (typeof window !== 'undefined') {
      try {
        const storedProvider = localStorage.getItem('setting_selected_provider');
        if (storedProvider) provider = JSON.parse(storedProvider);
        
        const storedModel = localStorage.getItem(`setting_${provider}_selected_model`);
        if (storedModel) model = JSON.parse(storedModel);
        
        const storedApiKey = localStorage.getItem(`setting_${provider}_api_key`);
        if (storedApiKey) apiKey = JSON.parse(storedApiKey);
      } catch {
        const storedProvider = localStorage.getItem('setting_selected_provider');
        if (storedProvider) provider = storedProvider || 'anthropic';
        const storedModel = localStorage.getItem(`setting_${provider}_selected_model`);
        if (storedModel) model = storedModel || 'claude-sonnet-4-6';
        const storedApiKey = localStorage.getItem(`setting_${provider}_api_key`);
        if (storedApiKey) apiKey = storedApiKey || '';
      }
    }

    formData.append('provider', provider);
    formData.append('model', model);
    formData.append('apiKey', apiKey);

    try {
      const res = await fetch(`${backendUrl}/api/scan`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      setSessionId(data.sessionId);
      setFileTree(data.fileTree);
      setDetectedStack(data.detectedStack);
      setStatus('idle');
      fetchModernTree(data.sessionId);

      addLog(`✅ Scanned ${data.detectedStack.fileCount} files`, 'success');
      addLog(`Detected: ${data.detectedStack.language} / ${data.detectedStack.framework} / ${data.detectedStack.database}`, 'info');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addLog(`Scan failed: ${message}`, 'error');
      setStatus('error');
    }
  }, [addLog, backendUrl, fetchModernTree]);

  // ── Select File → Load Content ─────────────────────────────────────────
  const handleSelectFile = useCallback(async (path: string) => {
    setSelectedFile(path);
    setActiveEditorTab('code');
    if (!sessionId) return;

    try {
      const res = await fetch(`${backendUrl}/api/file?sessionId=${sessionId}&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setLegacyCode(data.content ?? null);
      setModernCode(data.modernContent ?? null);
    } catch {
      setLegacyCode('// Could not load file content');
      setModernCode(null);
    }
  }, [sessionId, backendUrl, setActiveEditorTab]);

  // ── Handle SSE Events ──────────────────────────────────────────────────
  const handleSSEEvent = useCallback((event: { type: string; data: Record<string, unknown> }) => {
    switch (event.type) {
      case 'log':
        addLog(event.data.message as string, (event.data.level as LogEntry['level']) ?? 'info', event.data.phase as string);
        if (sessionId && event.data.message && ((event.data.message as string).includes('successfully written to') || (event.data.message as string).includes('Fallback content') || (event.data.message as string).includes('custom local folder'))) {
          fetchModernTree(sessionId);
        }
        break;
      case 'progress':
        setProgress(event.data.percent as number ?? 0);
        setCurrentFile(event.data.currentFile as string ?? '');
        break;
      case 'phase_change':
        setStatus(event.data.phase as MigrationStatus);
        setPhases(prev => prev.map(p =>
          p.id === event.data.phaseId ? { ...p, status: event.data.status as MigrationPhase['status'] } : p
        ));
        if (sessionId) fetchModernTree(sessionId);
        break;
      case 'file_migrated':
        setFileTree(prev => markMigrated(prev, event.data.path as string));
        if (sessionId) fetchModernTree(sessionId);
        break;
      case 'complete':
        setStatus('complete');
        setProgress(100);
        sseRef.current?.close();
        addLog('🎉 Migration complete!', 'success');
        if (sessionId) fetchModernTree(sessionId);
        break;
      case 'error':
        setStatus('error');
        addLog(event.data.message as string, 'error');
        sseRef.current?.close();
        break;
      case 'heartbeat':
        break;
    }
  }, [addLog, sessionId, fetchModernTree]);

  // ── Start Migration ────────────────────────────────────────────────────
  const handleStart = useCallback(async (target: TargetStack) => {
    if (!sessionId) return;

    setStatus('scanning');
    setProgress(0);
    setPhases(prev => prev.map(p => {
      if (p.id === 'scan' || (p.id === 'plan' && planPhaseDone)) {
        return { ...p, status: 'done' };
      }
      return { ...p, status: 'pending' };
    }));
    addLog('Starting migration...', 'command');

    const getStoredKey = (keyName: string): string => {
      if (typeof window === 'undefined') return '';
      const saved = localStorage.getItem(keyName);
      if (!saved) return '';
      try {
        return JSON.parse(saved);
      } catch {
        return saved;
      }
    };

    const anthropicKey = getStoredKey('setting_anthropic_api_key');
    const openaiKey = getStoredKey('setting_openai_api_key');
    const googleKey = getStoredKey('setting_google_api_key');
    const grokKey = getStoredKey('setting_grok_api_key');
    const groqKey = getStoredKey('setting_groq_api_key');
    const openrouterKey = getStoredKey('setting_openrouter_api_key');
    const huggingfaceKey = getStoredKey('setting_huggingface_api_key');
    const localOutputPath = getStoredKey('setting_general_local_output_path');
    const agentsConfig = localStorage.getItem('ai_config_agents');

    const passwordInput = typeof document !== 'undefined' ? (document.querySelector('input[type="password"]') as HTMLInputElement) : null;
    const combinedApiKey = anthropicKey || openaiKey || googleKey || grokKey || groqKey || openrouterKey || huggingfaceKey || (passwordInput ? passwordInput.value : '');

    try {
      const res = await fetch(`${backendUrl}/api/migrate/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          targetStack: target,
          apiKey: combinedApiKey,
          localOutputPath,
          apiKeys: {
            anthropic: anthropicKey,
            openai: openaiKey,
            google: googleKey,
            grok: grokKey,
            groq: groqKey,
            openrouter: openrouterKey,
            huggingface: huggingfaceKey,
          },
          agentsConfig: agentsConfig ? JSON.parse(agentsConfig) : null
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      // Open SSE stream
      sseRef.current?.close();
      const sse = new EventSource(`${backendUrl}/api/stream/${sessionId}`);
      sseRef.current = sse;

      sse.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          handleSSEEvent(event);
        } catch { /* ignore parse errors */ }
      };

      sse.onerror = () => {
        addLog('Stream connection lost. Migration may still be running on server.', 'warning');
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addLog(`Migration start failed: ${message}`, 'error');
      setStatus('error');
    }
  }, [sessionId, addLog, backendUrl, handleSSEEvent, planPhaseDone]);

  // ── Stop / Pause ───────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    sseRef.current?.close();
    if (sessionId) {
      await fetch(`${backendUrl}/api/migrate/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
    setStatus('idle');
    addLog('Migration stopped by user.', 'warning');
  }, [sessionId, addLog, backendUrl]);

  const handlePause = useCallback(async () => {
    sseRef.current?.close();
    if (sessionId) {
      await fetch(`${backendUrl}/api/migrate/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
    setStatus('paused');
    addLog('Migration paused.', 'warning');
  }, [sessionId, addLog, backendUrl]);

  // Cleanup SSE on unmount
  useEffect(() => () => sseRef.current?.close(), []);

  // ── Helpers ────────────────────────────────────────────────────────────
  function markMigrated(tree: FileNode[], path: string): FileNode[] {
    return tree.map(node => {
      if (node.path === path) return { ...node, migrated: true };
      if (node.children) return { ...node, children: markMigrated(node.children, path) };
      return node;
    });
  }

  const statusLabel: Record<MigrationStatus, string> = {
    idle:       'Ready',
    scanning:   'Scanning...',
    planning:   'Planning...',
    pseudocode: 'Writing Pseudocode...',
    migrating:  'Migrating...',
    building:   'Building...',
    validating: 'Validating...',
    testing:    'Testing...',
    complete:   'Complete ✅',
    error:      'Error ❌',
    paused:     'Paused ⏸',
  };

  // ── Render ─────────────────────────────────────────────────────────────
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
          <button className="title-bar__btn">Docs</button>
        </div>
      </header>

      {/* Work Area */}
      <div className="work-area">

        {/* Activity Bar */}
        <nav className="activity-bar">
          {[
            { icon: <Files size={18} />, id: 'explorer', title: 'Explorer', type: 'sidebar' },
            { icon: <Search size={18} />, id: 'search',   title: 'Search',   type: 'sidebar' },
            { icon: <Bot size={18} />, id: 'aiconfig', title: 'AI Configuration', type: 'tab', tabId: 'aiconfig' },
            { icon: <Zap size={18} />, id: 'pipeline', title: 'Modernisation Pipeline', type: 'right-sidebar' },
            { icon: <Settings size={18} />, id: 'settings', title: 'Settings', type: 'tab', tabId: 'settings' },
          ].map(item => {
            const isActive = item.type === 'sidebar'
              ? sidebarOpen && activeTab === item.id
              : item.type === 'right-sidebar'
                ? aiPanelOpen
                : activeEditorTab === item.tabId;
            
            return (
              <button
                key={item.id}
                className={`activity-bar__btn ${isActive ? 'active' : ''}`}
                title={item.title}
                onClick={() => {
                  if (item.type === 'sidebar') {
                    if (activeTab === item.id) {
                      setSidebarOpen(!sidebarOpen);
                    } else {
                      setActiveTab(item.id as 'explorer' | 'search');
                      setSidebarOpen(true);
                    }
                  } else if (item.type === 'right-sidebar') {
                    setAiPanelOpen(!aiPanelOpen);
                  } else {
                    if (activeEditorTab === item.tabId) {
                      setActiveEditorTab('code');
                    } else {
                      setActiveEditorTab(item.tabId as 'settings' | 'aiconfig');
                    }
                  }
                }}
              >
                {item.icon}
              </button>
            );
          })}
          <div className="activity-bar__bottom">
            <button className="activity-bar__btn" title="About">
              <Info size={18} />
            </button>
          </div>
        </nav>

        {/* Sidebar panels */}
        {sidebarOpen && activeTab === 'explorer' && (
          <ExplorerPanel
            fileTree={fileTree}
            modernFileTree={modernFileTree}
            modernFolderBasename={modernFolderBasename}
            selectedFile={selectedFile}
            onSelectFile={handleSelectFile}
            onUpload={handleUpload}
            hasProject={hasProject}
            width={sidebarWidth}
            planPhaseDone={planPhaseDone}
          />
        )}

        {sidebarOpen && activeTab === 'search' && (
          <SearchPanel
            sessionId={sessionId}
            onSelectFile={handleSelectFile}
            backendUrl={backendUrl}
            width={sidebarWidth}
          />
        )}

        {sidebarOpen && (
          <div className="sash-vertical" onMouseDown={startResizeSidebar} />
        )}

        {/* Editor Area (Code Viewer or Settings or AI Config Tab) */}
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
          />
        ) : (
          <CodeViewer
            legacyCode={legacyCode}
            modernCode={modernCode}
            legacyFile={selectedFile}
            modernFile={selectedFile ? selectedFile.replace(/\.jsx$/, '.tsx').replace(/\.(js|py|java|php|rb)$/, '.ts') : null}
            onClose={() => {
              setSelectedFile(null);
              setLegacyCode(null);
              setModernCode(null);
            }}
          />
        )}

        {/* Right Side: Toggleable & Resizable AI Panel */}
        {aiPanelOpen && (
          <>
            <div className="sash-vertical" onMouseDown={startResizeAiPanel} />
            <AIPanel
              detectedStack={detectedStack}
              status={status}
              phases={phases}
              progress={progress}
              currentFile={currentFile}
              onStart={handleStart}
              onStop={handleStop}
              onPause={handlePause}
              settingsTrigger={settingsTrigger}
              onSettingsSaved={handleSettingsSaved}
              width={aiPanelWidth}
            />
          </>
        )}
      </div>

      {/* Horizontal resize sash for bottom terminal panel */}
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
          {statusLabel[status]}
        </span>
        {isRunning && (
          <span className="status-bar__item">{progress}%</span>
        )}
      </footer>
    </div>
  );
}
