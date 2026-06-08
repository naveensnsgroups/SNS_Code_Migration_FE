// =============================================================================
//  hooks/useResize.ts
//  Generic reusable panel resize hook.
//
//  Replaces 3 copy-pasted resize handlers in page.tsx with one generic hook.
//
//  Usage:
//    const [sidebarWidth, startResizeSidebar] = usePanelResize(260, 150, 500, 'x');
//    const [terminalHeight, startResizeTerminal] = usePanelResize(220, 80, 600, 'y', true);
// =============================================================================

import { useState } from 'react';

/**
 * @param initial  Initial size in pixels
 * @param min      Minimum allowed size
 * @param max      Maximum allowed size
 * @param axis     'x' for horizontal resize, 'y' for vertical resize
 * @param invert   If true, dragging in the positive direction DECREASES size (e.g. right-panel, bottom-panel)
 */
export function usePanelResize(
  initial: number,
  min: number,
  max: number,
  axis: 'x' | 'y',
  invert = false
): [number, (e: React.MouseEvent) => void] {
  const [size, setSize] = useState(initial);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startPos = axis === 'x' ? e.clientX : e.clientY;
    const startSize = size;

    const doDrag = (moveEvent: MouseEvent) => {
      const currentPos = axis === 'x' ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPos;
      const newSize = invert ? startSize - delta : startSize + delta;
      setSize(Math.max(min, Math.min(max, newSize)));
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  return [size, startResize];
}
