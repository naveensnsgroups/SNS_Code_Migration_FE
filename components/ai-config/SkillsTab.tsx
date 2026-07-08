// Fetches real skill files from GET /api/config/skills — backend reads the /skills
// directory and parses SKILL.md YAML frontmatter. No mock data, no hardcoded IDs.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Award, RefreshCw, FileText, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface SkillFile {
  id:          string;
  name:        string;
  description: string;
  path:        string;
  sizeBytes:   number;
}

interface Props {
  backendUrl: string;
}

export default function SkillsTab({ backendUrl }: Props) {
  const [skills,    setSkills]    = useState<SkillFile[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Fetch skill list from backend ─────────────────────────────────────────
  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${backendUrl}/api/config/skills`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setSkills(data.skills ?? []);
    } catch (e: unknown) {
      setError((e as Error).message);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  // ── Toggle preview for a skill ────────────────────────────────────────────
  const handlePreview = useCallback(async (id: string) => {
    if (previewId === id) {
      setPreviewId(null);
      setPreviewContent('');
      return;
    }
    setPreviewId(id);
    setPreviewContent('');
    setPreviewLoading(true);
    try {
      const r = await fetch(`${backendUrl}/api/config/skill-content?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setPreviewContent(data.content ?? 'No content.');
    } catch (e: unknown) {
      setPreviewContent(`Error loading: ${(e as Error).message}`);
    } finally {
      setPreviewLoading(false);
    }
  }, [backendUrl, previewId]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={14} style={{ color: 'var(--accent-yellow)' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Skills</h3>
            {!loading && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {skills.length} {skills.length === 1 ? 'skill' : 'skills'} registered
              </span>
            )}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '500px' }}>
            Skills are <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-info)' }}>SKILL.md</code> files in{' '}
            <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-info)' }}>skills/&lt;name&gt;/</code>.
            Agents inject them via{' '}
            <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-info)' }}>getSkillFileContent</code>.
          </p>
        </div>
        <button
          onClick={loadSkills}
          disabled={loading}
          style={{
            background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px',
            padding: '4px 10px', color: 'var(--text-secondary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', flexShrink: 0
          }}
        >
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '12px' }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
          Reading skills directory…
        </div>
      ) : error ? (
        <div style={{ background: 'rgba(244,135,113,0.08)', border: '1px solid rgba(244,135,113,0.3)', borderRadius: '6px', padding: '12px', fontSize: '12px', color: 'var(--text-error)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><AlertCircle size={13} /> Could not load skills: {error}</span>
          <br />
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            Ensure the backend is running and <code style={{ fontFamily: 'var(--font-mono)' }}>skills/</code> directory exists.
          </span>
        </div>
      ) : skills.length === 0 ? (
        <div style={{
          border: '1px dashed var(--border-color)', borderRadius: '6px',
          padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px'
        }}>
          <Award size={24} style={{ opacity: 0.3, display: 'block', margin: '0 auto 10px' }} />
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>No skills found</div>
          <div>Create a <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-info)' }}>skills/&lt;name&gt;/SKILL.md</code> file to add a skill.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {skills.map(skill => (
            <div
              key={skill.id}
              style={{
                background: 'var(--bg-tertiary)',
                border: `1px solid ${previewId === skill.id ? 'rgba(0,122,204,0.4)' : 'var(--border-color)'}`,
                borderRadius: '6px', overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}
            >
              {/* Skill header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
                <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {skill.name}
                  </div>
                  {skill.description && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {skill.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '3px' }}>
                    <code style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {skill.path}
                    </code>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {(skill.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>

                {/* Preview toggle */}
                <button
                  onClick={() => handlePreview(skill.id)}
                  style={{
                    background: previewId === skill.id ? 'rgba(0,122,204,0.15)' : 'none',
                    border: '1px solid var(--border-color)', borderRadius: '4px',
                    padding: '4px 8px', cursor: 'pointer',
                    color: previewId === skill.id ? 'var(--accent-blue)' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px',
                    transition: 'all 0.15s', flexShrink: 0,
                  }}
                >
                  {previewId === skill.id ? <EyeOff size={11} /> : <Eye size={11} />}
                  {previewId === skill.id ? 'Hide' : 'Preview'}
                </button>
              </div>

              {/* Expandable preview pane */}
              {previewId === skill.id && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
                  {previewLoading ? (
                    <div style={{ padding: '12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      Loading…
                    </div>
                  ) : (
                    <pre style={{
                      margin: 0, padding: '12px 14px',
                      fontSize: '11px', fontFamily: 'var(--font-mono)',
                      color: 'var(--text-secondary)', whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word', maxHeight: '260px', overflowY: 'auto',
                      lineHeight: 1.6,
                    }}>
                      {previewContent}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottom spacer */}
      <div style={{ height: '20px', flexShrink: 0 }} />
    </div>
  );
}
