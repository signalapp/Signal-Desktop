/* global URL */

const { isNumber, compact } = require('lodash');
const he = require('he');
const nodeUrl = require('url');
const LinkifyIt = require('linkify-it');

const linkify = LinkifyIt();
const { concatenateBytes, getViewOfArrayBuffer } = require('./crypto');

module.exports = {
  assembleChunks,
  findLinks,
  getChunkPattern,
  getDomain,
  getTitleMetaTag,
  getImageMetaTag,
  isLinkInWhitelist,
  isMediaLinkInWhitelist,
  isLinkSneaky,
};

const SUPPORTED_DOMAINS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'reddit.com',
  'www.reddit.com',
  'm.reddit.com',
  'imgur.com',
  'www.imgur.com',
  'm.imgur.com',
  'i.imgur.com',
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'tenor.com',
  'gph.is',
  'giphy.com',
  'media.giphy.com',
];
function isLinkInWhitelist(link) {
  try {
    const url = new URL(link);

    if (url.protocol !== 'https:') {
      return false;
    }

    if (!url.pathname || url.pathname.length < 2) {
      return false;
    }

    const lowercase = url.host.toLowerCase();
    if (!SUPPORTED_DOMAINS.includes(lowercase)) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

const SUPPORTED_MEDIA_DOMAINS = /^([^.]+\.)*(ytimg.com|cdninstagram.com|redd.it|imgur.com|fbcdn.net|giphy.com|tenor.com)$/i;
function isMediaLinkInWhitelist(link) {
  try {
    const url = new URL(link);

    if (url.protocol !== 'https:') {
      return false;
    }

    if (!url.pathname || url.pathname.length < 2) {
      return false;
    }

    if (!SUPPORTED_MEDIA_DOMAINS.test(url.host)) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

const META_TITLE = /<meta\s+(?:class="dynamic"\s+)?property="og:title"\s+content="([\s\S]+?)"\s*\/?\s*>/im;
const META_IMAGE = /<meta\s+(?:class="dynamic"\s+)?property="og:image"\s+content="([\s\S]+?)"\s*\/?\s*>/im;
function _getMetaTag(html, regularExpression) {
  const match = regularExpression.exec(html);
  if (match && match[1]) {
    return he.decode(match[1]).trim();
  }

  return null;
}

function getTitleMetaTag(html) {
  return _getMetaTag(html, META_TITLE);
}
function getImageMetaTag(html) {
  const tag = _getMetaTag(html, META_IMAGE);
  return typeof tag === 'string' ? tag.replace('http://', 'https://') : tag;
}

function findLinks(text, caretLocation) {
  const haveCaretLocation = isNumber(caretLocation);
  const textLength = text ? text.length : 0;

  const matches = linkify.match(text || '') || [];
  return compact(
    matches.map(match => {
      if (!haveCaretLocation) {
        return match.text;
      }

      if (match.lastIndex === textLength && caretLocation === textLength) {
        return match.text;
      }

      if (match.index > caretLocation || match.lastIndex < caretLocation) {
        return match.text;
      }

      return null;
    })
  );
}

function getDomain(url) {
  try {
    const urlObject = new URL(url);
    return urlObject.hostname;
  } catch (error) {
    return null;
  }
}

const MB = 1024 * 1024;
const KB = 1024;

function getChunkPattern(size) {
  if (size > MB) {
    return _getRequestPattern(size, MB);
  } else if (size > 500 * KB) {
    return _getRequestPattern(size, 500 * KB);
  } else if (size > 100 * KB) {
    return _getRequestPattern(size, 100 * KB);
  } else if (size > 50 * KB) {
    return _getRequestPattern(size, 50 * KB);
  } else if (size > 10 * KB) {
    return _getRequestPattern(size, 10 * KB);
  } else if (size > KB) {
    return _getRequestPattern(size, KB);
  }

  throw new Error(`getChunkPattern: Unsupported size: ${size}`);
}

function _getRequestPattern(size, increment) {
  const results = [];

  let offset = 0;
  while (size - offset > increment) {
    results.push({
      start: offset,
      end: offset + increment - 1,
      overlap: 0,
    });
    offset += increment;
  }

  if (size - offset > 0) {
    results.push({
      start: size - increment,
      end: size - 1,
      overlap: increment - (size - offset),
    });
  }

  return results;
}

function assembleChunks(chunkDescriptors) {
  const chunks = chunkDescriptors.map((chunk, index) => {
    if (index !== chunkDescriptors.length - 1) {
      return chunk.data;
    }

    if (!chunk.overlap) {
      return chunk.data;
    }

    return getViewOfArrayBuffer(
      chunk.data,
      chunk.overlap,
      chunk.data.byteLength
    );
  });

  return concatenateBytes(...chunks);
}

const LATIN_PATTERN = new RegExp(
  '[' +
    '\\u0041-\\u005A' +
    '\\u0061-\\u007A' +
    '\\u00AA' +
    '\\u00BA' +
    '\\u00C0-\\u00DC' +
    '\\u00D8-\\u00F6' +
    '\\u00F8-\\u01BA' +
    ']'
);

const CYRILLIC_PATTERN = new RegExp(
  '[' +
    '\\u0400-\\u0481' +
    '\\u0482' +
    '\\u0483-\\u0484' +
    '\\u0487' +
    '\\u0488-\\u0489' +
    '\\u048A-\\u052F' +
    '\\u1C80-\\u1C88' +
    '\\u1D2B' +
    '\\u1D78' +
    '\\u2DE0-\\u2DFF' +
    '\\uA640-\\uA66D' +
    '\\uA66E' +
    '\\uA66F' +
    '\\uA670-\\uA672' +
    '\\uA673' +
    '\\uA674-\\uA67D' +
    '\\uA67E' +
    '\\uA67F' +
    '\\uA680-\\uA69B' +
    '\\uA69C-\\uA69D' +
    '\\uA69E-\\uA69F' +
    '\\uFE2E-\\uFE2F' +
    ']'
);

const GREEK_PATTERN = new RegExp(
  '[' +
    '\\u0370-\\u0373' +
    '\\u0375' +
    '\\u0376-\\u0377' +
    '\\u037A' +
    '\\u037B-\\u037D' +
    '\\u037F' +
    '\\u0384' +
    '\\u0386' +
    '\\u0388-\\u038A' +
    '\\u038C' +
    '\\u038E-\\u03A1' +
    '\\u03A3-\\u03E1' +
    '\\u03F0-\\u03F5' +
    '\\u03F6' +
    '\\u03F7-\\u03FF' +
    '\\u1D26-\\u1D2A' +
    '\\u1D5D-\\u1D61' +
    '\\u1D66-\\u1D6A' +
    '\\u1DBF' +
    '\\u1F00-\\u1F15' +
    '\\u1F18-\\u1F1D' +
    '\\u1F20-\\u1F45' +
    '\\u1F48-\\u1F4D' +
    '\\u1F50-\\u1F57' +
    '\\u1F59' +
    '\\u1F5B' +
    '\\u1F5D' +
    '\\u1F5F-\\u1F7D' +
    '\\u1F80-\\u1FB4' +
    '\\u1FB6-\\u1FBC' +
    '\\u1FBD' +
    '\\u1FBE' +
    '\\u1FBF-\\u1FC1' +
    '\\u1FC2-\\u1FC4' +
    '\\u1FC6-\\u1FCC' +
    '\\u1FCD-\\u1FCF' +
    '\\u1FD0-\\u1FD3' +
    '\\u1FD6-\\u1FDB' +
    '\\u1FDD-\\u1FDF' +
    '\\u1FE0-\\u1FEC' +
    '\\u1FED-\\u1FEF' +
    '\\u1FF2-\\u1FF4' +
    '\\u1FF6-\\u1FFC' +
    '\\u1FFD-\\u1FFE' +
    '\\u2126' +
    '\\uAB65' +
    ']'
);

const HIGH_GREEK_PATTERN = new RegExp(
  '[' +
    `${String.fromCodePoint(0x10140)}-${String.fromCodePoint(0x10174)}` +
    `${String.fromCodePoint(0x10175)}-${String.fromCodePoint(0x10178)}` +
    `${String.fromCodePoint(0x10179)}-${String.fromCodePoint(0x10189)}` +
    `${String.fromCodePoint(0x1018a)}-${String.fromCodePoint(0x1018b)}` +
    `${String.fromCodePoint(0x1018c)}-${String.fromCodePoint(0x1018e)}` +
    `${String.fromCodePoint(0x101a0)}` +
    `${String.fromCodePoint(0x1d200)}-${String.fromCodePoint(0x1d241)}` +
    `${String.fromCodePoint(0x1d242)}-${String.fromCodePoint(0x1d244)}` +
    `${String.fromCodePoint(0x1d245)}` +
    ']',
  'u'
);

function isChunkSneaky(chunk) {
  const hasLatin = LATIN_PATTERN.test(chunk);
  if (!hasLatin) {
    return false;
  }

  const hasCyrillic = CYRILLIC_PATTERN.test(chunk);
  if (hasCyrillic) {
    return true;
  }

  const hasGreek = GREEK_PATTERN.test(chunk);
  if (hasGreek) {
    return true;
  }

  const hasHighGreek = HIGH_GREEK_PATTERN.test(chunk);
  if (hasHighGreek) {
    return true;
  }

  return false;
}

function isLinkSneaky(link) {
  const domain = getDomain(link);

  // This is necesary because getDomain returns domains in punycode form. We check whether
  //   it's available for the StyleGuide.
  const unicodeDomain = nodeUrl.domainToUnicode
    ? nodeUrl.domainToUnicode(domain)
    : domain;

  const chunks = unicodeDomain.split('.');
  for (let i = 0, max = chunks.length; i < max; i += 1) {
    const chunk = chunks[i];
    if (isChunkSneaky(chunk)) {
      return true;
    }
  }

  return false;
}
