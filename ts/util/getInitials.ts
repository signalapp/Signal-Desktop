export function getInitials(name?: string): string | undefined {
  if (!name || !name.length) {
    return;
  }

  if (name.length > 2 && name.startsWith('05')) {
    return name[2];
  }

  return name[0];
}
