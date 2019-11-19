// A separate file so this doesn't get picked up by StyleGuidist over real components

export function cleanId(id: string): string {
  return id.replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, '_');
}
