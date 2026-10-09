// Shared non-secret settings. OAuth tokens and Firebase ID tokens are never included.
export type TickTickLink = {
  remoteId: string;
  local: string;
  remote: string;
  done?: boolean;
  goalId?: string;
  projectId?: string;
};
export type TickTickSettings = {
  sphereLists: Record<string, string>;
  auto: boolean;
  deleteRemote: boolean;
  links: Record<string, TickTickLink>;
  dismissed: string[];
  lastSync?: string;
  revision: number;
};
export const tickTickSphereIds = ['health', 'sport', 'growth', 'english', 'finance', 'together', 'driving', 'tasks', 'hobby'];
export function emptyTickTickSettings(revision = 0): TickTickSettings {
  return { sphereLists: {}, auto: false, deleteRemote: false, links: {}, dismissed: [], revision };
}
export function validateTickTickSettings(value: unknown): TickTickSettings {
  const invalid = () => { throw new Error('Некорректные настройки TickTick.'); };
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const id = (v: unknown) => typeof v === 'string' && /^[\w-]{1,100}$/.test(v);
  if (!object(value) || !object(value.sphereLists) || !object(value.links) || !Array.isArray(value.dismissed)) return invalid();
  if (typeof value.auto !== 'boolean' || typeof value.deleteRemote !== 'boolean' || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0) return invalid();
  if (Object.keys(value.links).length > 1000 || value.dismissed.length > 2000) return invalid();
  if (Object.entries(value.sphereLists).some(([sphere, list]) => !tickTickSphereIds.includes(sphere) || (list !== '' && !id(list)))) return invalid();
  for (const [localId, link] of Object.entries(value.links)) {
    if (!id(localId) || !object(link) || !id(link.remoteId) || typeof link.local !== 'string' || typeof link.remote !== 'string' || link.local.length > 10000 || link.remote.length > 10000) return invalid();
    if ((link.projectId !== undefined && !id(link.projectId)) || (link.goalId !== undefined && !id(link.goalId)) || (link.done !== undefined && typeof link.done !== 'boolean')) return invalid();
  }
  if (value.dismissed.some(v => !id(v)) || (value.lastSync !== undefined && (typeof value.lastSync !== 'string' || !Number.isFinite(Date.parse(value.lastSync))))) return invalid();
  // Pick known fields: never persist arbitrary credentials supplied in a request.
  return {
    sphereLists: { ...value.sphereLists } as Record<string, string>,
    auto: value.auto, deleteRemote: value.deleteRemote,
    links: Object.fromEntries(Object.entries(value.links).map(([key, link]) => {
      const v = link as TickTickLink;
      return [key, { remoteId: v.remoteId, local: v.local, remote: v.remote, done: v.done, goalId: v.goalId, projectId: v.projectId }];
    })),
    dismissed: [...value.dismissed] as string[], lastSync: value.lastSync as string | undefined,
    revision: Number(value.revision),
  };
}
