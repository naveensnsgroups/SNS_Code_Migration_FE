'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, Settings, X } from 'lucide-react';
import { SETTING_FIELDS, type SettingField } from '@/constants/settingFields';
import { applyTheme } from '@/utils/theme';
import { useNotifications } from '@/context/NotificationContext';
import StringField     from '@/components/settings/StringField';
import BooleanToggle    from '@/components/settings/BooleanToggle';
import SelectField      from '@/components/settings/SelectField';

interface Props {
  onSettingsSaved?: () => void;
  onClose?: () => void;
  settingsTrigger?: number;
}

// Builds a concise, Theia-style confirmation message for a committed setting.
function messageForField(field: SettingField, value: any): string {
  switch (field.id) {
    case 'general_theme': {
      const label = field.options?.find(o => o.value === value)?.label ?? value;
      return `Color theme changed to ${label}`;
    }
    case 'general_backend_url':
      return 'Backend API service URL updated';
    case 'general_local_output_path':
      return value ? 'Output workspace path updated' : 'Output workspace path cleared';
    case 'general_desktop_notifications':
      return value ? 'Desktop notifications enabled' : 'Desktop notifications disabled';
  }
  return `${field.label} updated`;
}

export default function SettingsTab({ onSettingsSaved, onClose, settingsTrigger }: Props) {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const { notify } = useNotifications();
  // Value captured when a text field gains focus — so blur only notifies if the
  // value actually changed (no toast storm on every focus/blur).
  const focusValueRef = useRef<Record<string, string>>({});

  // Load settings from localStorage
  useEffect(() => {
    const loadedSettings: Record<string, any> = {};
    SETTING_FIELDS.forEach(field => {
      const saved = localStorage.getItem(`setting_${field.id}`);
      if (saved !== null) {
        try {
          loadedSettings[field.id] = JSON.parse(saved);
        } catch {
          loadedSettings[field.id] = saved;
        }
      } else {
        loadedSettings[field.id] = field.defaultValue;
      }
    });
    setSettings(loadedSettings);
  }, [settingsTrigger]);

  // Save changes for a field. `emitNotification` is opt-in so text fields
  // (which call this on every keystroke) can stay silent and notify on blur instead.
  const updateSetting = (id: string, value: any, emitNotification = false) => {
    const updated = { ...settings, [id]: value };
    setSettings(updated);
    localStorage.setItem(`setting_${id}`, JSON.stringify(value));

    if (id === 'general_theme') applyTheme(value);

    if (onSettingsSaved) onSettingsSaved();

    setSaveStatus('Settings updated');
    setTimeout(() => setSaveStatus(null), 1500);

    if (emitNotification) {
      const field = SETTING_FIELDS.find(f => f.id === id);
      if (field) notify({ type: 'success', message: messageForField(field, value) });
    }
  };

  // Text fields: capture value on focus, notify on blur only if it changed.
  const handleTextFocus = (field: SettingField) => {
    focusValueRef.current[field.id] = settings[field.id] || '';
  };
  const handleTextBlur = (field: SettingField) => {
    const current = settings[field.id] || '';
    if (current !== (focusValueRef.current[field.id] ?? '')) {
      notify({ type: 'success', message: messageForField(field, current) });
    }
  };

  // Boolean toggles. 'general_desktop_notifications' needs special handling: the
  // browser's Notification.requestPermission() must be called synchronously from
  // within a real click handler (a user gesture) — calling it later from an effect
  // gets silently ignored or auto-denied by most browsers. So permission is
  // requested right here, at the moment of the click, and the setting is only
  // ever turned on if the user actually granted it — never left showing "on"
  // while permission was denied.
  const handleBooleanToggle = (field: SettingField) => {
    const turningOn = !settings[field.id];

    if (field.id === 'general_desktop_notifications' && turningOn) {
      if (typeof Notification === 'undefined') {
        notify({ type: 'warning', message: 'This browser does not support desktop notifications.' });
        return;
      }
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          updateSetting(field.id, true, true);
        } else {
          notify({ type: 'warning', message: 'Desktop notifications were not enabled — permission denied.' });
        }
      });
      return; // Don't flip the setting until the permission promise resolves.
    }

    updateSetting(field.id, turningOn, true);
  };

  return (
    <div className="editor-area settings-editor-page">
      {/* Settings Top Bar */}
      <div className="settings-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={15} style={{ color: 'var(--accent-blue)' }} />
          <span className="settings-title">Settings</span>
          {onClose && (
            <button className="settings-close" onClick={onClose} title="Close Settings">
              <X size={13} />
            </button>
          )}
        </div>
        {saveStatus && (
          <div className="settings-save-alert">
            <Check size={12} />
            <span>{saveStatus}</span>
          </div>
        )}
      </div>

      {/* Settings Main Content Area — a single General section, no provider
          categories left to browse, so no sidebar/search is needed. */}
      <div className="settings-content-wrapper">
        <div className="settings-fields-pane" style={{ flex: 1 }}>
          {SETTING_FIELDS.map(field => (
            <div key={field.id} className="settings-field-block">
              <div className="field-block__breadcrumb">
                <span className="field-block__crumb">Ai-features</span>
                <span className="field-block__crumb-sep">›</span>
                <span className="field-block__crumb">General</span>
                <span className="field-block__crumb-sep">›</span>
                <span className="field-block__crumb-current">{field.label}</span>
              </div>

              <div className="field-block__description">
                {field.description}
              </div>

              <div className="field-block__input-area">
                {field.type === 'string' && (
                  <StringField
                    value={settings[field.id] || ''}
                    onChange={(v) => updateSetting(field.id, v)}
                    onFocus={() => handleTextFocus(field)}
                    onBlur={() => handleTextBlur(field)}
                  />
                )}

                {field.type === 'boolean' && (
                  <BooleanToggle
                    checked={!!settings[field.id]}
                    onToggle={() => handleBooleanToggle(field)}
                  />
                )}

                {field.type === 'select' && (
                  <SelectField
                    value={settings[field.id] || field.defaultValue}
                    options={field.options || []}
                    onChange={(v) => updateSetting(field.id, v, true)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
