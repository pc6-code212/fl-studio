export interface Channel {
  id: number;
  name: string;
  color: string;
  steps: boolean[];
  notes: PianoRow[];
  volume: number;
  pan: number;
  mixerChannel: number;
  muted: boolean;
  solo: boolean;
}

export interface PianoRow {
  label: string;
  black: boolean;
  notes: boolean[];
  lengths: number[];
}

export interface Pattern {
  id: number;
  name: string;
  channels: Channel[];
}

export interface PlaylistTrack {
  id: number;
  name: string;
  color: string;
  muted: boolean;
  solo: boolean;
}

export interface PlaylistClip {
  id: number;
  track: number;
  start: number;
  length: number;
  pattern: number;
  channelId: number;
  name: string;
  color: string;
}

export interface PlaylistClipNote {
  row: number;
  step: number;
  length: number;
}

export interface LibraryNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  size?: number;
  children?: LibraryNode[];
}

export interface LibraryResponse {
  root: string;
  folders: {
    samples: LibraryNode[];
    effects: LibraryNode[];
    instruments: LibraryNode[];
  };
}

export interface FlatNode {
  node: LibraryNode;
  depth: number;
}

export type BrowserTab = 'packs' | 'files' | 'plugins';

export interface BrowserSection {
  title: string;
  items: string[];
}

export type PanelId = 'channelRack' | 'pianoRoll' | 'playlist' | 'mixer';

export interface PanelState {
  open: boolean;
  collapsed: boolean;
  maximized: boolean;
  floating: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PanelStates = Record<PanelId, PanelState>;
