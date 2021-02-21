// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function cleanSearchTerm(searchTerm: string): string {
  const lowercase = searchTerm.toLowerCase();
  const withoutSpecialCharacters = lowercase.replace(
    /([-!"#$%&'()*+,./\\:;<=>?@[\]^_`{|}~])/g,
    ' '
  );
  const whiteSpaceNormalized = withoutSpecialCharacters.replace(/\s+/g, ' ');
  const byToken = whiteSpaceNormalized.split(' ');
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
