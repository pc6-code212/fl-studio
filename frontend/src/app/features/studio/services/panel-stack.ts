import type { PanelId, PanelStates } from '../models/studio.model';

export const PANEL_IDS: readonly PanelId[] = [
  'channelRack',
  'pianoRoll',
  'playlist',
  'mixer'
];

export const PANEL_Z_BASE = 1000;

// Popped-out panes sit above the maximized workspace layers, so a small
// floating window is never buried behind a maximized panel.
export const PANEL_FLOATING_Z_BASE = 2000;

/** Move a panel to the top of the stack (end of the order array). */
export function movePanelToFront(
  order: readonly PanelId[],
  id: PanelId
): PanelId[] {
  return [...order.filter(panel => panel !== id), id];
}

/** Drop a panel to the bottom of the stack (start of the order array). */
export function movePanelToBack(
  order: readonly PanelId[],
  id: PanelId
): PanelId[] {
  return [id, ...order.filter(panel => panel !== id)];
}

/** Panels currently maximized, bottom-to-top in their stacking order. */
export function maximizedPanelStack(
  panels: PanelStates,
  order: readonly PanelId[]
): PanelId[] {
  return order.filter(
    id => panels[id].open && !panels[id].collapsed && panels[id].maximized
  );
}

/** z-index for a panel layer; later entries in the order paint on top. */
export function panelLayerZIndex(
  order: readonly PanelId[],
  id: PanelId,
  base = PANEL_Z_BASE
): number {
  const index = order.indexOf(id);
  return base + (index < 0 ? 0 : index);
}

/**
 * Maximize or restore a single panel while leaving every other panel's
 * maximized state untouched, so several panels can be maximized at once.
 */
export function setPanelMaximized(
  panels: PanelStates,
  id: PanelId,
  maximized: boolean
): PanelStates {
  return {
    ...panels,
    [id]: {
      ...panels[id],
      open: true,
      collapsed: false,
      maximized,
      floating: maximized ? false : panels[id].floating
    }
  };
}

/**
 * Maximize a panel, or pop it out into a floating window when it is already
 * maximized.
 */
export function togglePanelMaximizedState(
  panels: PanelStates,
  id: PanelId
): PanelStates {
  if (panels[id].maximized) {
    return {
      ...panels,
      [id]: {
        ...panels[id],
        open: true,
        collapsed: false,
        maximized: false,
        floating: true
      }
    };
  }
  return setPanelMaximized(panels, id, true);
}

/** True when any other visible panel is currently maximized. */
export function hasOtherMaximized(
  panels: PanelStates,
  id: PanelId
): boolean {
  return PANEL_IDS.some(
    other =>
      other !== id &&
      panels[other].open &&
      !panels[other].collapsed &&
      panels[other].maximized
  );
}
