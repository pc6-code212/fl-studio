export interface Channel {
  id: number;
  name: string;
  color: string;
  steps: boolean[];
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

export interface PianoRow {
  label: string;
  black: boolean;
  notes: boolean[];
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
