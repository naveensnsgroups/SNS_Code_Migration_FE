'use client';

import React, { useState } from 'react';
import { ChevronRight, FolderOpen } from 'lucide-react';
import { getFileIcon, getFolderIcon } from '../utils/labelProvider';
import type { FileNode } from '@/types';

interface Props {
  fileTree: FileNode[];
  selectedFile: string | null;
  onSelectFile: (path: string, content?: string) => void;
  onUpload: (files: FileList | File[], paths?: string[]) => void;
  hasProject: boolean;
  width?: number;
  modernFileTree?: FileNode[];       // Output directory tree from @parcel/watcher refresh
  modernFolderBasename?: string;     // Display name for the output folder (e.g. "Demo-5")
}

function FileItem({
  node,
  depth,
  selectedFile,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  selectedFile: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);

  const icon =
    node.type === 'directory' ? (
      getFolderIcon(open)
    ) : (
      getFileIcon(node.name)
    );

  return (
    <div>
      <div
        className={`file-tree__item ${node.type === 'directory' ? 'file-tree__item--folder' : 'file-tree__item--file'} ${selectedFile === node.path ? 'selected' : ''}`}
        style={{ paddingLeft: `${4 + depth * 14}px` }}
        onClick={() => {
          if (node.type === 'directory') setOpen(!open);
          else onSelect(node.path);
        }}
      >
        {/* Absolute Indent Guides */}
        {Array.from({ length: depth }).map((_, i) => (
          <span
            key={i}
            className="file-tree__indent-guide"
            style={{ left: `${10 + i * 14}px` }}
          />
        ))}

        {/* Expansion Toggle */}
        {node.type === 'directory' ? (
          <span className={`file-tree__toggle ${open ? 'expanded' : 'collapsed'}`}>
            <ChevronRight size={10} className="file-tree__toggle-icon" />
          </span>
        ) : (
          <span className="file-tree__toggle-placeholder" />
        )}

        <span className="file-tree__item-icon">{icon}</span>
        <span className="file-tree__item-name">{node.name}</span>
        {node.migrated && (
          <span style={{ marginLeft: 'auto', color: 'var(--text-success)', fontSize: 10 }}>✓</span>
        )}
      </div>
      {node.type === 'directory' && open && node.children?.map((child) => (
        <FileItem key={child.path} node={child} depth={depth + 1} selectedFile={selectedFile} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default function ExplorerPanel({ fileTree, selectedFile, onSelectFile, onUpload, hasProject, width, modernFileTree = [], modernFolderBasename }: Props) {
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const fileEntries: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          fileEntries.push(entry);
        }
      }
    }

    if (fileEntries.length === 0) return;

    const traverseEntry = async (entry: any, relPath: string = ''): Promise<{ file: File; path: string }[]> => {
      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file((file: File) => {
            resolve([{ file, path: relPath + file.name }]);
          });
        });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readEntriesPromise = (): Promise<any[]> => {
          return new Promise((resolve) => {
            reader.readEntries(
              (entries: any[]) => resolve(entries),
              () => resolve([])
            );
          });
        };

        let allChildren: any[] = [];
        let chunk = await readEntriesPromise();
        while (chunk.length > 0) {
          allChildren = allChildren.concat(chunk);
          chunk = await readEntriesPromise();
        }

        const subResults = await Promise.all(
          allChildren.map((child) => traverseEntry(child, relPath + entry.name + '/'))
        );
        return subResults.flat();
      }
      return [];
    };

    const allFilesWithPaths = await Promise.all(
      fileEntries.map((entry) => traverseEntry(entry))
    );
    const flatFiles = allFilesWithPaths.flat();

    const files = flatFiles.map(f => f.file);
    const paths = flatFiles.map(f => f.path);

    onUpload(files, paths);
  };

  return (
    <aside className="sidebar" style={{ width: width ? `${width}px` : undefined }}>
      <div className="sidebar__header">Explorer</div>
      <div className="sidebar__content">
        {!hasProject ? (
          <div className="theia-welcome-view">
            <FolderOpen size={28} className="theia-welcome-icon" style={{ color: '#858585' }} />
            <p className="theia-welcome-text">You have not yet opened a legacy project folder.</p>
            <button
              className="btn-premium btn-premium--primary theia-welcome-btn"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.webkitdirectory = true;
                input.multiple = true;
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (files) onUpload(files);
                };
                input.click();
              }}
            >
              Open Folder
            </button>
            <div
              className="theia-welcome-dropzone"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              or drag &amp; drop project folder here
            </div>
          </div>
        ) : (
          <div className="file-tree">
            {fileTree.length > 0 && (
              <>
                <div className="file-tree__section-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {getFolderIcon(false)} {fileTree[0]?.name || 'Project'}
                </div>
                {fileTree.map((node) => (
                  <FileItem
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedFile={selectedFile}
                    onSelect={onSelectFile}
                  />
                ))}
              </>
            )}
            {/* ── Output Tree (SNS IDE: Navigator pattern — same FileItem widget) ── */}
            {modernFileTree.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div
                  className="file-tree__section-label"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {getFolderIcon(false)}
                  {modernFolderBasename || 'Output'}
                </div>
                {modernFileTree.map((node) => (
                  <FileItem
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedFile={selectedFile}
                    onSelect={onSelectFile}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
