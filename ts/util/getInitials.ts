export function getInitials(name?: string): string {
  if (!name || !name.length) {
    return '0';
  }

  if (name.length > 2 && name.startsWith('05')) {
    // Just the third char of the pubkey when the name is a pubkey
    return upperAndShorten(name[2]);
  }

  if (name.indexOf(' ') === -1) {
    // there is no space, just return the first 2 chars of the name

    if (name.length > 1) {
      return upperAndShorten(name.slice(0, 2));
    }
    return upperAndShorten(name[0]);
  }

  // name has a space, just extract the first char of each words
  return upperAndShorten(
    name
      .split(' ')
      .slice(0, 2)
      .map(n => {
        return n[0];
      })
      .join('')
  );
}

function upperAndShorten(str: string) {
  // believe it or not, some chars put in uppercase can be more than one char. (ß for instance)
  return str.toLocaleUpperCase().slice(0, 2);
}
