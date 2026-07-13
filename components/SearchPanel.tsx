'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, FileText, CornerDownRight, AlertCircle } from 'lucide-react';

interface Match {
  filePath: string;
  line: number;
  content: string;
}

interface Props {
  sessionId: string | null;
  onSelectFile: (path: string) => void;
  backendUrl: string;
  width?: number;
}

export default function SearchPanel({ sessionId, onSelectFile, backendUrl, width }: Props) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search trigger
  useEffect(() => {
    if (!sessionId) {
      setMatches([]);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!query.trim()) {
      setMatches([]);
      return;
    }

    setSearching(true);
    setError(null);

    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${backendUrl}/api/search?sessionId=${sessionId}&query=${encodeURIComponent(query)}`
        );
        if (!res.ok) throw new Error('Search request failed');
        const data = await res.json();
        setMatches(data.matches || []);
      } catch (err: any) {
        setError(err.message || 'Error executing search');
      } finally {
        setSearching(false);
      }
    }, 400); // 400ms debounce

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query, sessionId, backendUrl]);

  return (
    <aside className="sidebar" style={{ width: width ? `${width}px` : undefined }}>
      <div className="sidebar__header">Search</div>
      <div className="sidebar__content" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* Search Input */}
        <div className="form-group">
          <div className="input-with-button" style={{ width: '100%' }}>
            <input
              type="text"
              className="form-input-premium"
              placeholder="Search text in project files..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={!sessionId}
              style={{ paddingLeft: '30px' }}
            />
            <Search 
              size={13} 
              style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)', pointerEvents: 'none' }} 
            />
          </div>
        </div>

        {/* Status Messages */}
        {!sessionId && (
          <div className="stack-badge-empty">
            <AlertCircle size={14} />
            <span>Upload a project first to search files</span>
          </div>
        )}

        {searching && (
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="pulse-indicator" />
            <span>Searching files...</span>
          </div>
        )}

        {error && (
          <div style={{ fontSize: '11px', color: 'var(--text-error)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={12} />
            <span>{error}</span>
          </div>
        )}

        {/* Matches list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {query.trim() && !searching && matches.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '10px 0', textAlign: 'center' }}>
              No matches found
            </div>
          )}

          {matches.map((match, i) => (
            <div 
              key={i} 
              onClick={() => onSelectFile(match.filePath)}
              style={{
                cursor: 'pointer',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '6px 8px',
                fontSize: '11px',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
            >
              {/* File details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                <FileText size={11} className="text-blue" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {match.filePath.split('/').pop()}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                  Line {match.line}
                </span>
              </div>
              
              {/* Line snippet */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', overflow: 'hidden' }}>
                <CornerDownRight size={10} style={{ marginTop: '2px', flexShrink: 0, opacity: 0.5 }} />
                <span style={{ whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {match.content}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
