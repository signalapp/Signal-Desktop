export function getInitials(name?: string): string {
  if (!name || !name.length) {
    return '0';
  }

  if (name.length > 2 && name.startsWith('05')) {
    // Just the third char of the pubkey when the name is a pubkey
    return upperAndShorten(name[2]);
  }

  if (name.split(/[-\s]/).length === 1) {
    // there is one word, so just return the first 2 alphanumeric chars of the name

    if (name.length > 1) {
      const alphanum = name.match(/[\p{L}\p{N}]+/u);
      if (alphanum) {
        return upperAndShorten(alphanum[0].slice(0, 2));
      }
    }
    return upperAndShorten(name[0]);
  }

  // name has a space, just extract the first char of each words
  return upperAndShorten(
    name
      .split(/[-\s]/)
      .slice(0, 2)
      .map(n =>
        // Allow a letter or a digit from any alphabet.
        n.match(/^[\p{L}\p{N}]/u)
      )
      .join('')
  );
}

function upperAndShorten(str: string) {
  // believe it or not, some chars put in uppercase can be more than one char. (ß for instance)
  return str.toLocaleUpperCase().slice(0, 2);
}
