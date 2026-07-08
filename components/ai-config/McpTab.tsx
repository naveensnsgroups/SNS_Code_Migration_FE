// MCP Servers tab — live status and tools per server, from real backend detection.
'use client';

import { useState } from 'react';
import { RefreshCw, ChevronRight, ChevronDown, Server, Zap, ZapOff } from 'lucide-react';

interface MCPServer {
  id: string;
  name: string;
  status: string;
  description: string;
  tools: string[];
  version?: string | null;
}

interface Props {
  servers: MCPServer[];
  loading: boolean;
  onRefresh: () => void;
}

function ServerRow({ server }: { server: MCPServer }) {
  const [expanded, setExpanded] = useState(false);
  const isConnected = server.status === 'connected';

  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      border: `1px solid ${isConnected ? 'rgba(78,201,176,0.25)' : 'var(--border-color)'}`,
      borderRadius: '6px', overflow: 'hidden'
    }}>
      {/* Header Row */}
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', gap: '10px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Status indicator */}
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
          background: isConnected ? 'var(--text-success)' : 'var(--text-error)',
          boxShadow: isConnected ? '0 0 6px rgba(78,201,176,0.6)' : 'none'
        }} />

        <Server size={13} style={{ color: isConnected ? 'var(--text-info)' : 'var(--text-muted)', flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: isConnected ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {server.name}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
            {server.description}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{
            fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
            background: isConnected ? 'rgba(78,201,176,0.12)' : 'rgba(244,135,113,0.12)',
            color: isConnected ? 'var(--text-success)' : 'var(--text-error)',
            border: `1px solid ${isConnected ? 'rgba(78,201,176,0.3)' : 'rgba(244,135,113,0.3)'}`
          }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {server.tools.length > 0 && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{server.tools.length} tools</span>
          )}
          {expanded
            ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
            : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>

      {/* Expanded tools list */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 12px', background: 'var(--bg-primary)' }}>
          {server.version && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
              Version: {server.version}
            </div>
          )}

          {server.tools.length > 0 ? (
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: 700 }}>
                Registered Tools
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {server.tools.map(tool => (
                  <span key={tool} style={{
                    fontSize: '10px', padding: '2px 7px', borderRadius: '3px',
                    background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                    fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)'
                  }}>
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No tools exposed by this server.</div>
          )}

          {/* Connect / Disconnect — the backend only reports MCP status today
              (GET /api/mcp/status); there is no connect/disconnect endpoint to
              call, so this control is honestly disabled rather than looking
              interactive and doing nothing. */}
          <button
            disabled
            title="Not yet supported — the backend does not expose an MCP connect/disconnect endpoint"
            style={{
              marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'not-allowed', border: 'none',
              background: 'rgba(120,120,120,0.1)',
              color: 'var(--text-muted)',
              opacity: 0.6,
            }}
            onClick={e => e.stopPropagation()}
          >
            {isConnected ? <ZapOff size={11} /> : <Zap size={11} />}
            {isConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function McpTab({ servers, loading, onRefresh }: Props) {
  const connected    = servers.filter(s => s.status === 'connected').length;
  const disconnected = servers.filter(s => s.status !== 'connected').length;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600 }}>MCP Servers</h3>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            <span style={{ color: 'var(--text-success)' }}>●</span> {connected} connected
            &nbsp;&nbsp;
            <span style={{ color: 'var(--text-error)' }}>●</span> {disconnected} disconnected
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 10px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}
        >
          <RefreshCw size={12} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Model Context Protocol servers provide tools to agents at runtime. Click any server to expand its tool list.
      </p>

      {loading ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
          <RefreshCw size={16} className="spin" style={{ marginBottom: '8px' }} />
          <br />Checking server status…
        </div>
      ) : servers.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
          No MCP servers detected. Ensure backend is running.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {servers.map(server => <ServerRow key={server.id} server={server} />)}
        </div>
      )}
    </div>
  );
}
