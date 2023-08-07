/* eslint-disable camelcase */
import crc32 from 'buffer-crc32';

class MnemonicError extends Error {}

/*
 mnemonic.js : Converts between 4-byte aligned strings and a human-readable
 sequence of words. Uses 1626 common words taken from wikipedia article:
 http://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Contemporary_poetry
 Originally written in python special for Electrum (lightweight Bitcoin client).
 This version has been reimplemented in javascript and placed in public domain.
 */

const MN_DEFAULT_WORDSET = 'english';

function mn_get_checksum_index(words: Array<string>, prefixLen: number) {
  let trimmedWords = '';

  for (let i = 0; i < words.length; i++) {
    trimmedWords += words[i].slice(0, prefixLen);
  }
  const checksum = crc32.unsigned(trimmedWords as any);
  const index = checksum % words.length;
  return index;
}

export function mnEncode(str: string, wordsetName: string = MN_DEFAULT_WORDSET): string {
  const wordset = mnWords[wordsetName];
  let out = [] as Array<any>;
  const n = wordset.words.length;
  let strCopy = str;
  for (let j = 0; j < strCopy.length; j += 8) {
    strCopy =
      strCopy.slice(0, j) + mn_swap_endian_4byte(strCopy.slice(j, j + 8)) + strCopy.slice(j + 8);
  }
  for (let i = 0; i < strCopy.length; i += 8) {
    const x = parseInt(strCopy.substr(i, 8), 16);
    const w1 = x % n;
    const w2 = (Math.floor(x / n) + w1) % n;
    const w3 = (Math.floor(Math.floor(x / n) / n) + w2) % n;
    out = out.concat([wordset.words[w1], wordset.words[w2], wordset.words[w3]]);
  }
  if (wordset.prefixLen > 0) {
    out.push(out[mn_get_checksum_index(out, wordset.prefixLen)]);
  }
  return out.join(' ');
}

function mn_swap_endian_4byte(str: string) {
  if (str.length !== 8) {
    throw new MnemonicError(`Invalid input length: ${str.length}`);
  }
  return str.slice(6, 8) + str.slice(4, 6) + str.slice(2, 4) + str.slice(0, 2);
}

export function mnDecode(str: string, wordsetName: string = MN_DEFAULT_WORDSET): string {
  const wordset = mnWords[wordsetName];
  let out = '';
  const n = wordset.words.length;
  const wlist = str.split(' ');
  let checksumWord = '';
  if (wlist.length < 12) {
    throw new MnemonicError("You've entered too few words, please try again");
  }
  if (
    (wordset.prefixLen === 0 && wlist.length % 3 !== 0) ||
    (wordset.prefixLen > 0 && wlist.length % 3 === 2)
  ) {
    throw new MnemonicError("You've entered too few words, please try again");
  }
  if (wordset.prefixLen > 0 && wlist.length % 3 === 0) {
    throw new MnemonicError(
      'You seem to be missing the last word in your private key, please try again'
    );
  }
  if (wordset.prefixLen > 0) {
    // Pop checksum from mnemonic
    checksumWord = wlist.pop() as string;
  }
  // Decode mnemonic
  for (let i = 0; i < wlist.length; i += 3) {
    let w1;
    let w2;
    let w3;
    if (wordset.prefixLen === 0) {
      w1 = wordset.words.indexOf(wlist[i]);
      w2 = wordset.words.indexOf(wlist[i + 1]);
      w3 = wordset.words.indexOf(wlist[i + 2]);
    } else {
      w1 = wordset.truncWords.indexOf(wlist[i].slice(0, wordset.prefixLen));
      w2 = wordset.truncWords.indexOf(wlist[i + 1].slice(0, wordset.prefixLen));
      w3 = wordset.truncWords.indexOf(wlist[i + 2].slice(0, wordset.prefixLen));
    }
    if (w1 === -1 || w2 === -1 || w3 === -1) {
      throw new MnemonicError('invalid word in mnemonic');
    }

    const x = w1 + n * ((n - w1 + w2) % n) + n * n * ((n - w2 + w3) % n);
    if (x % n !== w1) {
      throw new MnemonicError(
        'Something went wrong when decoding your private key, please try again'
      );
    }
    out += mn_swap_endian_4byte(`0000000${x.toString(16)}`.slice(-8));
  }
  // Verify checksum
  if (wordset.prefixLen > 0) {
    const index = mn_get_checksum_index(wlist, wordset.prefixLen);
    const expectedChecksumWord = wlist[index];
    if (
      expectedChecksumWord.slice(0, wordset.prefixLen) !== checksumWord.slice(0, wordset.prefixLen)
    ) {
      throw new MnemonicError(
        'Your private key could not be verified, please verify the checksum word'
      );
    }
  }
  return out;
}

const mnWords = {} as Record<
  string,
  {
    prefixLen: number;
    words: any;
    truncWords: Array<any>;
  }
>;
mnWords.english = {
  prefixLen: 3,
  // eslint-disable-next-line global-require
  words: require('../../../mnemonic_languages/english.json'),
  truncWords: [],
};

export function get_languages(): Array<string> {
  return Object.keys(mnWords);
}

// eslint-disable-next-line no-restricted-syntax
for (const i in mnWords) {
  // eslint-disable-next-line no-prototype-builtins
  if (mnWords.hasOwnProperty(i)) {
    if (mnWords[i].prefixLen === 0) {
      continue;
    }
    for (let j = 0; j < mnWords[i].words.length; ++j) {
      mnWords[i].truncWords.push(mnWords[i].words[j].slice(0, mnWords[i].prefixLen));
    }
  }
}
