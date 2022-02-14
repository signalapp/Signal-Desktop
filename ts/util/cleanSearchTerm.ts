export function cleanSearchTerm(searchTerm: string) {
  const lowercase = searchTerm.toLowerCase();
  const withoutSpecialCharacters = lowercase.replace(/([!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~])/g, ' ');
  const whiteSpaceNormalized = withoutSpecialCharacters.replace(/\s+/g, ' ');
  const byToken = whiteSpaceNormalized.split(' ');
  // be aware that a user typing Note To Self will have an issue when the `not` part of it is typed as the not word is reserved
  const withoutSpecialTokens = byToken.filter(
    token =>
      token &&
      token !== 'and' &&
      token !== 'or' &&
      token !== 'not' &&
      token !== ')' &&
      token !== '(' &&
      token !== '+' &&
      token !== ',' &&
      token !== 'near'
  );
  const withWildcards = withoutSpecialTokens.map(token => `${token}*`);

  return withWildcards.join(' ').trim();
}
