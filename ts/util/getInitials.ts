export function getInitials(name?: string): string | undefined {
  if (!name || !name.length) {
    return;
  }

  if (name.length > 2 && name.startsWith('05')) {
    return name[2];
  }

  const initials = name.split(' ').slice(0, 2).map(n => {
    return n[0];
  })

  return initials.join('');
}
