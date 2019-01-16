/* global URL */

const he = require('he');
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
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
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

const SUPPORTED_MEDIA_DOMAINS = /^([^.]+\.)*(ytimg.com|cdninstagram.com|redd.it|imgur.com)$/i;
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

const META_TITLE = /<meta\s+property="og:title"\s+content="([\s\S]+?)"\s*\/?\s*>/im;
const META_IMAGE = /<meta\s+property="og:image"\s+content="([\s\S]+?)"\s*\/?\s*>/im;
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

function findLinks(text) {
  const matches = linkify.match(text || '') || [];
  return matches.map(match => match.text);
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
