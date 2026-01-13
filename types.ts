export enum SignalStatus {
  UNREVIEWED = 'UNREVIEWED',
  THREAD = 'THREAD',
  DISCARDED = 'DISCARDED',
  KEPT = 'KEPT' // Kept for 48h
}

export interface Signal {
  id: string;
  content: string;
  createdAt: number;
  status: SignalStatus;
  threadId?: string; // If promoted to a thread
}

export interface Thread {
  id: string;
  originalSignalId: string;
  content: string; // The core idea/title
  reason: string; // "Why did this feel important?"
  createdAt: number;
  updatedAt: number;
  updates: ThreadUpdate[];
}

export interface ThreadUpdate {
  id: string;
  content: string;
  createdAt: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'signal' | 'thread' | 'tag';
  val: number; // For visualization size
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}