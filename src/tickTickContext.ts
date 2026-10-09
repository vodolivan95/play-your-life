import { createContext } from 'react';
import type { TickTickConnection } from './ticktick';
export type TickTickManager = {
  connection: TickTickConnection | null;
  status: string;
  busy: boolean;
  connected: boolean;
  signedIn: boolean;
  dirty: boolean;
  projects: { id: string; name: string }[];
  configure: (url: string) => Promise<void>;
  update: (patch: Partial<TickTickConnection>) => void;
  refresh: () => Promise<void>;
  sync: (taskIds?: readonly string[]) => Promise<void>;
  disconnect: () => Promise<void>;
  save: () => Promise<void>;
  suggest: () => void;
};
export const TickTickContext = createContext<TickTickManager | null>(null);
