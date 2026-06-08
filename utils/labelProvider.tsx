'use client';

import React from 'react';
import { Folder, FolderOpen } from 'lucide-react';
// file-icons-js is the exact same library used by Eclipse Theia's label-provider.ts
// It returns CSS class names like "js-icon medium-yellow" which map to font icons
// loaded from file-icons-js/css/style.css (imported in layout.tsx)
import * as fileIcons from 'file-icons-js';

/**
 * Returns a React node for a file icon using file-icons-js — exactly the same
 * approach used by Eclipse Theia (snside) in packages/core/src/browser/label-provider.ts:
 *
 *   protected getFileIcon(uri: URI): string | undefined {
 *     const fileIcon = fileIcons.getClassWithColor(uri.displayName);
 *     if (!fileIcon) { return undefined; }
 *     return fileIcon + ' theia-file-icons-js';
 *   }
 *
 * We render the result as a <span> element with those classes so the
 * font-icon glyphs (from the CSS @font-face rules) appear correctly.
 */
export function getFileIcon(name: string): React.ReactNode {
  // Strip any path prefix — only use the display name (basename)
  const displayName = name.split('/').pop() || name;

  // Get the CSS class string from file-icons-js (same API Theia uses)
  const iconClass = fileIcons.getClassWithColor(displayName);

  if (iconClass) {
    // Combine with 'file-icon' (required for font icon pseudo-element sizing)
    // and 'theia-file-icons-js' (matches our CSS from globals.css)
    return (
      <span
        className={`${iconClass} file-icon theia-file-icons-js`}
        aria-hidden="true"
      />
    );
  }

  // Fallback: generic file icon (codicon-style via CSS class)
  return (
    <span
      className="default-file-icon file-icon theia-file-icons-js"
      aria-hidden="true"
    />
  );
}

/**
 * Returns a folder icon. Theia uses a codicon 'folder' class for folders,
 * but since we use Lucide in our UI, we render Lucide Folder/FolderOpen icons
 * styled to match Theia's muted gray folder appearance.
 */
export function getFolderIcon(isOpen: boolean): React.ReactNode {
  return isOpen ? (
    <FolderOpen
      size={14}
      className="file-icon folder-icon"
      style={{ color: '#858585', flexShrink: 0 }}
    />
  ) : (
    <Folder
      size={14}
      className="file-icon folder-icon"
      style={{ color: '#858585', flexShrink: 0 }}
    />
  );
}
