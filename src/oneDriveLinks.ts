/** References only. No permission, credential, signed URL or file bytes in a save. */
export type DriveLink = { driveId: string; itemId: string; name: string; folder: boolean };
export function validDriveLink(value: unknown): value is DriveLink {
  if (!value || typeof value !== 'object') return false;
  const link = value as DriveLink;
  return typeof link.driveId === 'string' && /^[\w!-]{1,200}$/.test(link.driveId) && typeof link.itemId === 'string' && /^[\w!-]{1,200}$/.test(link.itemId) &&
    typeof link.name === 'string' && !!link.name.trim() && link.name.length <= 255 && typeof link.folder === 'boolean' &&
    Object.keys(link).every(key => ['driveId', 'itemId', 'name', 'folder'].includes(key));
}
export function driveLinkHash(link: DriveLink) { return `#/drive?drive=${encodeURIComponent(link.driveId)}&item=${encodeURIComponent(link.itemId)}`; }

export const folderColors = ['yellow', 'blue', 'teal', 'orange', 'gray', 'purple', 'green'] as const;
