'use client';

import React from 'react';
import { Folder, FolderOpen } from 'lucide-react';
// Returns CSS class names (e.g. "js-icon medium-yellow") mapped to font icons
// loaded from file-icons-js/css/style.css (imported in layout.tsx).
import * as fileIcons from 'file-icons-js';

export function getFileIcon(name: string): React.ReactNode {
  const displayName = name.split('/').pop() || name;
  const iconClass = fileIcons.getClassWithColor(displayName);

  if (iconClass) {
    return (
      <span
        className={`${iconClass} file-icon theia-file-icons-js`}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className="default-file-icon file-icon theia-file-icons-js"
      aria-hidden="true"
    />
  );
}

export function getFolderIcon(isOpen: boolean): React.ReactNode {
  return isOpen ? (
    <FolderOpen
      size={14}
      className="file-icon folder-icon"
      style={{ color: 'var(--text-secondary)', flexShrink: 0 }}
    />
  ) : (
    <Folder
      size={14}
      className="file-icon folder-icon"
      style={{ color: 'var(--text-secondary)', flexShrink: 0 }}
    />
  );
}
