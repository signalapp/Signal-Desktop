/* global URL */

const { isNumber, compact, isEmpty } = require('lodash');
const he = require('he');
const nodeUrl = require('url');
const LinkifyIt = require('linkify-it');

const linkify = LinkifyIt();
const { concatenateBytes, getViewOfArrayBuffer } = require('../../ts/Crypto');

module.exports = {
  assembleChunks,
  findLinks,
  getChunkPattern,
  getDomain,
  getTitleMetaTag,
  getImageMetaTag,
  isLinkSafeToPreview,
  isLinkInWhitelist,
  isMediaLinkInWhitelist,
  isLinkSneaky,
  isStickerPack,
};

function isLinkSafeToPreview(link) {
  let url;
  try {
    url = new URL(link);
  } catch (err) {
    return false;
  }
  return url.protocol === 'https:' && !isLinkSneaky(link);
}

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
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'pinterest.com',
  'www.pinterest.com',
  'pin.it',
  'signal.art',
];

// This function will soon be removed in favor of `isLinkSafeToPreview`. It is
//   currently used because outbound-from-Desktop link previews only support a
//   few domains (see the list above). We will soon remove this restriction to
//   allow link previews from all domains, making this function obsolete.
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

function isStickerPack(link) {
  return (link || '').startsWith('https://signal.art/addstickers/');
}

const SUPPORTED_MEDIA_DOMAINS = /^([^.]+\.)*(ytimg\.com|cdninstagram\.com|redd\.it|imgur\.com|fbcdn\.net|pinimg\.com)$/i;

// This function will soon be removed. See the comment in `isLinkInWhitelist`
//   for more info.
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

const META_TITLE = /<meta\s+property="og:title"[^>]+?content="([\s\S]+?)"[^>]*>/im;
const META_IMAGE = /<meta\s+property="og:image"[^>]+?content="([\s\S]+?)"[^>]*>/im;
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
  return _getMetaTag(html, META_IMAGE);
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

function hasAuth(url) {
  try {
    const urlObject = new URL(url);
    return Boolean(urlObject.username);
  } catch (e) {
    return null;
  }
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

function getChunkPattern(size, initialOffset) {
  if (size > MB) {
    return _getRequestPattern(size, MB, initialOffset);
  } else if (size > 500 * KB) {
    return _getRequestPattern(size, 500 * KB, initialOffset);
  } else if (size > 100 * KB) {
    return _getRequestPattern(size, 100 * KB, initialOffset);
  } else if (size > 50 * KB) {
    return _getRequestPattern(size, 50 * KB, initialOffset);
  } else if (size > 10 * KB) {
    return _getRequestPattern(size, 10 * KB, initialOffset);
  } else if (size > KB) {
    return _getRequestPattern(size, KB, initialOffset);
  }

  return {
    start: {
      start: initialOffset,
      end: size - 1,
    },
  };
}

function _getRequestPattern(size, increment, initialOffset) {
  const results = [];

  let offset = initialOffset || 0;
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

const ASCII_PATTERN = new RegExp('[\\u0020-\\u007F]', 'g');

function isLinkSneaky(link) {
  // Any links which contain auth are considered sneaky
  if (hasAuth(link)) {
    return true;
  }

  const domain = getDomain(link);
  // If the domain is falsy, something fishy is going on
  if (!domain) {
    return true;
  }

  // To quote [RFC 1034][0]: "the total number of octets that represent a
  //   domain name [...] is limited to 255." To be extra careful, we set a
  //   maximum of 2048. (This also uses the string's `.length` property,
  //   which isn't exactly the same thing as the number of octets.)
  // [0]: https://tools.ietf.org/html/rfc1034
  if (domain.length > 2048) {
    return true;
  }

  // Domains cannot contain encoded characters
  if (domain.includes('%')) {
    return true;
  }

  // There must be at least 2 domain labels, and none of them can be empty.
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some(isEmpty)) {
    return true;
  }

  // This is necesary because getDomain returns domains in punycode form.
  const unicodeDomain = nodeUrl.domainToUnicode
    ? nodeUrl.domainToUnicode(domain)
    : domain;

  const withoutPeriods = unicodeDomain.replace(/\./g, '');

  const hasASCII = ASCII_PATTERN.test(withoutPeriods);
  const withoutASCII = withoutPeriods.replace(ASCII_PATTERN, '');

  const isMixed = hasASCII && withoutASCII.length > 0;
  if (isMixed) {
    return true;
  }

  return false;
}
