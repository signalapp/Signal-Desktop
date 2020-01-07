const BAD_CHARACTERS = /[^A-Za-z\s]+/g;
const WHITESPACE = /\s+/g;

function removeNonInitials(name: string) {
  return name.replace(BAD_CHARACTERS, '').replace(WHITESPACE, ' ');
}

export function getInitials(name?: string): string | undefined {
  if (!name) {
    return;
  }

  const cleaned = removeNonInitials(name);
  const parts = cleaned.split(' ');
  const initials = parts.map(part => part.trim()[0]);
  if (!initials.length) {
    return;
  }

  return initials.slice(0, 2).join('');
}
