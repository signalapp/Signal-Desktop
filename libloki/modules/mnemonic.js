const crc32 = require('buffer-crc32');
const sc_reduce32_module = require('./sc_reduce32');

module.exports = {
  mn_encode,
  mn_decode,
  sc_reduce32,
  get_languages,
  pubkey_to_secret_words,
};
class MnemonicError extends Error {}

function hexToUint8Array(e) {
  if (e.length % 2 != 0) throw 'Hex string has invalid length!';
  for (var t = new Uint8Array(e.length / 2), r = 0; r < e.length / 2; ++r)
    t[r] = parseInt(e.slice(2 * r, 2 * r + 2), 16);
  return t;
}

function Uint8ArrayToHex(e) {
  for (var t = [], r = 0; r < e.length; ++r)
    t.push(('0' + e[r].toString(16)).slice(-2));
  return t.join('');
}

function sc_reduce32(e) {
  var t = hexToUint8Array(e);
  if (32 !== t.length) throw 'Invalid input length';
  var r = sc_reduce32_module._malloc(32);
  sc_reduce32_module.HEAPU8.set(t, r),
    sc_reduce32_module.ccall('sc_reduce32', 'void', ['number'], [r]);
  var o = sc_reduce32_module.HEAPU8.subarray(r, r + 32);
  return sc_reduce32_module._free(r), Uint8ArrayToHex(o);
}
/*
 mnemonic.js : Converts between 4-byte aligned strings and a human-readable
 sequence of words. Uses 1626 common words taken from wikipedia article:
 http://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Contemporary_poetry
 Originally written in python special for Electrum (lightweight Bitcoin client).
 This version has been reimplemented in javascript and placed in public domain.
 */

var mn_default_wordset = 'english';

function mn_get_checksum_index(words, prefix_len) {
  var trimmed_words = '';
  for (var i = 0; i < words.length; i++) {
    trimmed_words += words[i].slice(0, prefix_len);
  }
  var checksum = crc32.unsigned(trimmed_words);
  var index = checksum % words.length;
  return index;
}

function mn_encode(str, wordset_name) {
  'use strict';
  wordset_name = wordset_name || mn_default_wordset;
  var wordset = mn_words[wordset_name];
  var out = [];
  var n = wordset.words.length;
  for (var j = 0; j < str.length; j += 8) {
    str =
      str.slice(0, j) +
      mn_swap_endian_4byte(str.slice(j, j + 8)) +
      str.slice(j + 8);
  }
  for (var i = 0; i < str.length; i += 8) {
    var x = parseInt(str.substr(i, 8), 16);
    var w1 = x % n;
    var w2 = (Math.floor(x / n) + w1) % n;
    var w3 = (Math.floor(Math.floor(x / n) / n) + w2) % n;
    out = out.concat([wordset.words[w1], wordset.words[w2], wordset.words[w3]]);
  }
  if (wordset.prefix_len > 0) {
    out.push(out[mn_get_checksum_index(out, wordset.prefix_len)]);
  }
  return out.join(' ');
}

function mn_swap_endian_4byte(str) {
  'use strict';
  if (str.length !== 8)
    throw new MnemonicError('Invalid input length: ' + str.length);
  return str.slice(6, 8) + str.slice(4, 6) + str.slice(2, 4) + str.slice(0, 2);
}

function mn_decode(str, wordset_name) {
  'use strict';
  wordset_name = wordset_name || mn_default_wordset;
  var wordset = mn_words[wordset_name];
  var out = '';
  var n = wordset.words.length;
  var wlist = str.split(' ');
  var checksum_word = '';
  if (wlist.length < 12)
    throw new MnemonicError("You've entered too few words, please try again");
  if (
    (wordset.prefix_len === 0 && wlist.length % 3 !== 0) ||
    (wordset.prefix_len > 0 && wlist.length % 3 === 2)
  )
    throw new MnemonicError("You've entered too few words, please try again");
  if (wordset.prefix_len > 0 && wlist.length % 3 === 0)
    throw new MnemonicError(
      'You seem to be missing the last word in your private key, please try again'
    );
  if (wordset.prefix_len > 0) {
    // Pop checksum from mnemonic
    checksum_word = wlist.pop();
  }
  // Decode mnemonic
  for (var i = 0; i < wlist.length; i += 3) {
    var w1, w2, w3;
    if (wordset.prefix_len === 0) {
      w1 = wordset.words.indexOf(wlist[i]);
      w2 = wordset.words.indexOf(wlist[i + 1]);
      w3 = wordset.words.indexOf(wlist[i + 2]);
    } else {
      w1 = wordset.trunc_words.indexOf(wlist[i].slice(0, wordset.prefix_len));
      w2 = wordset.trunc_words.indexOf(
        wlist[i + 1].slice(0, wordset.prefix_len)
      );
      w3 = wordset.trunc_words.indexOf(
        wlist[i + 2].slice(0, wordset.prefix_len)
      );
    }
    if (w1 === -1 || w2 === -1 || w3 === -1) {
      throw new MnemonicError('invalid word in mnemonic');
    }
    var x = w1 + n * ((n - w1 + w2) % n) + n * n * ((n - w2 + w3) % n);
    if (x % n != w1)
      throw new MnemonicError(
        'Something went wrong when decoding your private key, please try again'
      );
    out += mn_swap_endian_4byte(('0000000' + x.toString(16)).slice(-8));
  }
  // Verify checksum
  if (wordset.prefix_len > 0) {
    var index = mn_get_checksum_index(wlist, wordset.prefix_len);
    var expected_checksum_word = wlist[index];
    if (
      expected_checksum_word.slice(0, wordset.prefix_len) !==
      checksum_word.slice(0, wordset.prefix_len)
    ) {
      throw new MnemonicError(
        'Your private key could not be verified, please verify the checksum word'
      );
    }
  }
  return out;
}

// Note: the value is the prefix_len
const languages = {
  chinese_simplified: 1,
  dutch: 4,
  electrum: 0,
  english: 3,
  esperanto: 4,
  french: 4,
  german: 4,
  italian: 4,
  japanese: 3,
  lojban: 4,
  portuguese: 4,
  russian: 4,
  spanish: 4,
};

let mn_words = {};
for (let [language, prefix_len] of Object.entries(languages)) {
  mn_words[language] = {
    prefix_len,
    words: require(`../../mnemonic_languages/${language}`),
  };
}

function get_languages() {
  return Object.keys(mn_words);
}

for (var i in mn_words) {
  if (mn_words.hasOwnProperty(i)) {
    if (mn_words[i].prefix_len === 0) {
      continue;
    }
    mn_words[i].trunc_words = [];
    for (var j = 0; j < mn_words[i].words.length; ++j) {
      mn_words[i].trunc_words.push(
        mn_words[i].words[j].slice(0, mn_words[i].prefix_len)
      );
    }
  }
}

function pubkey_to_secret_words(pubKey) {
  return mn_encode(pubKey.slice(2), 'english')
    .split(' ')
    .slice(0, 3)
    .join(' ');
}
