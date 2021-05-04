/* global URL */

const { isNumber, compact, isEmpty, range } = require('lodash');
const nodeUrl = require('url');
const LinkifyIt = require('linkify-it');

const linkify = LinkifyIt();

module.exports = {
  findLinks,
  getDomain,
  isLinkSafeToPreview,
  isLinkSneaky,
};

function maybeParseHref(href) {
  try {
    return new URL(href);
  } catch (err) {
    return null;
  }
}

function isLinkSafeToPreview(href) {
  const url = maybeParseHref(href);
  return Boolean(url && url.protocol === 'https:' && !isLinkSneaky(href));
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

function getDomain(href) {
  const url = maybeParseHref(href);
  return url ? url.hostname : null;
}

// See <https://tools.ietf.org/html/rfc3986>.
const VALID_URI_CHARACTERS = new Set([
  '%',
  // "gen-delims"
  ':',
  '/',
  '?',
  '#',
  '[',
  ']',
  '@',
  // "sub-delims"
  '!',
  '$',
  '&',
  "'",
  '(',
  ')',
  '*',
  '+',
  ',',
  ';',
  '=',
  // unreserved
  ...String.fromCharCode(...range(65, 91), ...range(97, 123)),
  ...range(10).map(String),
  '-',
  '.',
  '_',
  '~',
]);
const ASCII_PATTERN = new RegExp('[\\u0020-\\u007F]', 'g');
const MAX_HREF_LENGTH = 2 ** 12;

function isLinkSneaky(href) {
  // This helps users avoid extremely long links (which could be hiding something
  //   sketchy) and also sidesteps the performance implications of extremely long hrefs.
  if (href.length > MAX_HREF_LENGTH) {
    return true;
  }

  const url = maybeParseHref(href);

  // If we can't parse it, it's sneaky.
  if (!url) {
    return true;
  }

  // Any links which contain auth are considered sneaky
  if (url.username) {
    return true;
  }

  // If the domain is falsy, something fishy is going on
  if (!url.hostname) {
    return true;
  }

  // To quote [RFC 1034][0]: "the total number of octets that represent a
  //   domain name [...] is limited to 255." To be extra careful, we set a
  //   maximum of 2048. (This also uses the string's `.length` property,
  //   which isn't exactly the same thing as the number of octets.)
  // [0]: https://tools.ietf.org/html/rfc1034
  if (url.hostname.length > 2048) {
    return true;
  }

  // Domains cannot contain encoded characters
  if (url.hostname.includes('%')) {
    return true;
  }

  // There must be at least 2 domain labels, and none of them can be empty.
  const labels = url.hostname.split('.');
  if (labels.length < 2 || labels.some(isEmpty)) {
    return true;
  }

  // This is necesary because getDomain returns domains in punycode form.
  const unicodeDomain = nodeUrl.domainToUnicode
    ? nodeUrl.domainToUnicode(url.hostname)
    : url.hostname;

  const withoutPeriods = unicodeDomain.replace(/\./g, '');

  const hasASCII = ASCII_PATTERN.test(withoutPeriods);
  const withoutASCII = withoutPeriods.replace(ASCII_PATTERN, '');

  const isMixed = hasASCII && withoutASCII.length > 0;
  if (isMixed) {
    return true;
  }

  // We can't use `url.pathname` (and so on) because it automatically encodes strings.
  //   For example, it turns `/aquí` into `/aqu%C3%AD`.
  const startOfPathAndHash = href.indexOf('/', url.protocol.length + 4);
  const pathAndHash = startOfPathAndHash === -1 ? '' : href.substr(startOfPathAndHash);
  return [...pathAndHash].some(character => !VALID_URI_CHARACTERS.has(character));
}
