/* global URL */

const { isNumber, compact, isEmpty } = require('lodash');
const { isIP } = require('net');
const nodeUrl = require('url');
const LinkifyIt = require('linkify-it');

const linkify = LinkifyIt();

module.exports = {
  findLinks,
  getDomain,
  isLinkSafeToPreview,
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

function isStickerPack(link) {
  return (link || '').startsWith('https://signal.art/addstickers/');
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

  // Domain cannot be an IP address.
  if (isIP(domain)) {
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
