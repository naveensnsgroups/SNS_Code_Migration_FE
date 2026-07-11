'use client';

import { Check, HelpCircle, Plus, Trash2 } from 'lucide-react';

interface Props {
  values: string[];
  activeModel: string;
  newModelInput: string;
  onSelectModel: (model: string) => void;
  onRemoveValue: (index: number) => void;
  onNewModelInputChange: (v: string) => void;
  onAddValue: () => void;
}

export default function ModelListEditor({
  values, activeModel, newModelInput,
  onSelectModel, onRemoveValue, onNewModelInputChange, onAddValue,
}: Props) {
  return (
    <div className="settings-list-editor" style={{ maxWidth: '480px' }}>
      {/* Active model indicator — single line, no duplication with list highlight */}
      <div style={{
        fontSize: '11px',
        color: activeModel ? 'var(--accent-green)' : 'var(--text-warning)',
        marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px'
      }}>
        {activeModel
          ? <><Check size={11} /><span>Click a model below to set it as the default — used by any agent with no override in AI Config → Agents</span></>
          : <><HelpCircle size={11} /><span>Click a model below to set it as the default — used by any agent with no override in AI Config → Agents</span></>}
      </div>

      {/* List Items */}
      <div className="settings-list-items">
        {values.map((val, index) => {
          const isActive = val === activeModel;
          return (
            <div
              key={index}
              className="settings-list-item-row"
              style={{
                cursor: 'pointer',
                background: isActive ? 'rgba(0,200,100,0.08)' : undefined,
                border: isActive ? '1px solid rgba(0,200,100,0.25)' : undefined,
                borderRadius: isActive ? '4px' : undefined,
              }}
              onClick={() => onSelectModel(val)}
              title={`Click to set "${val}" as active model`}
            >
              {/* Active indicator dot */}
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: isActive ? 'var(--accent-green)' : 'var(--border-color)',
                display: 'inline-block', marginRight: '8px',
              }} />
              <span className="list-item-value-text" style={{ flex: 1, fontWeight: isActive ? 600 : 400 }}>
                {val}
              </span>
              {isActive && <Check size={12} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />}
              <button
                type="button"
                className="list-item-delete-btn"
                onClick={(e) => { e.stopPropagation(); onRemoveValue(index); }}
                title="Remove Model"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Item row */}
      <div className="settings-list-add-row">
        <input
          type="text"
          className="form-input-premium settings-list-add-input"
          placeholder="Add Value..."
          value={newModelInput}
          onChange={(e) => onNewModelInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onAddValue(); }}
        />
        <button type="button" className="settings-list-add-btn" onClick={onAddValue}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
