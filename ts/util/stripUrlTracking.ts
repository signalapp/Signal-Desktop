let RULES: string;

/* eslint-disable global-require, @typescript-eslint/no-var-requires */
// In a Webpack context, we can directly import files as strings
try {
  RULES = require('./url_param_filter.txt');
} catch {
  // If this fails, it's because we're in a Node context (probably for running tests). In
  // this case, load the file the Node way
  const fs = require('fs');
  const path = require('path');
  RULES = fs.readFileSync(
    path.join(__dirname, './url_param_filter.txt'),
    'utf8'
  );
}

// Placeholder value we use to represent a naked removeparam modifier, ie one that
// indicates to remove all parameters. The '=' here make it so it's impossible that this
// collides with a real rule in a filter file.
const WILDCARD_REMOVEPARAM = '=REMOVE ALL=';

// A separator is "any character, but a letter, a digit, or one of the following: _ - . %"
const SEPARATOR: string = '[^a-zA-Z0-9_\\-\\.\\%]';

// Contains all the positive (ie non-'@@') rules at the bottom of this file, parsed
const ALL_POSITIVE_RULES: Array<URLFilter> = [];

// Contains all the negative (ie '@@') rules at the bottom of this file, parsed
const ALL_NEGATIVE_RULES: Array<URLFilter> = [];

// Removes the parameter `toRemove` from `url` unless there is also a match in
// `exceptions`
function removeParamsExcept(
  url: URL,
  paramToRemove: string,
  exceptions: Set<string>
): URL {
  // If the exception is literally every param, then return the URL unchanged
  if (exceptions.has(WILDCARD_REMOVEPARAM)) {
    return url;
  }

  // Otherwise see what we can remove

  if (paramToRemove === WILDCARD_REMOVEPARAM) {
    // If it's a wildcard, delete all the search params except those that appear in
    // exceptions
    for (const param of url.searchParams.keys()) {
      if (!exceptions.has(param)) {
        url.searchParams.delete(param);
      }
    }
  } else if (!exceptions.has(paramToRemove)) {
    // If it's a literal and none of the exceptions have the same literal, we're good to
    // delete
    url.searchParams.delete(paramToRemove);
  }
  // Otherwise don't delete anything

  return url;
}

// A class that contains the filter rules for a URL
class URLFilter {
  private addressExp: RegExp;
  public removeExp: string;

  constructor(addressExp: RegExp, removeExp: string) {
    this.addressExp = addressExp;
    this.removeExp = removeExp;
  }

  // Checks if the address portion of the URL matches the address portion of the filter
  addressMatches(url: URL): boolean {
    // Ensure it's HTTPS, then strip it from the URL
    if (url.protocol !== 'https:') {
      throw new Error('can only filter https URLs');
    }
    const stringToMatch = url.toString().slice(8);

    return this.addressExp.test(stringToMatch);
  }

  // Strips the given HTTPS URL params according to this filter. If a param is matched by
  // any matcher in `exceptions`, it is not stripped.
  applyWithExceptions(url: URL, exceptions: Set<string>): URL {
    if (this.addressMatches(url)) {
      // Apply the removeparam rule
      return removeParamsExcept(url, this.removeExp, exceptions);
    }
    return url;
  }
}

// Escapes the given string so it can be used as a literal in a RegExp
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Parses everything to the right of the '=' in a removeparam rule. Returns either a
// literal string for the parameter to be removed, or WILDCARD_REMOVEPARAM if it's a naked
// removeparam, ie one that matches everything.
function parseRemoveRule(removePat: string): string {
  if (!removePat) {
    // If there is no pattern, it's a naked remove, ie remove everything
    return WILDCARD_REMOVEPARAM;
  }
  if (removePat.startsWith('/') || removePat.startsWith('~')) {
    throw new Error('regex removeparam not supported');
  }
  // Otherwise the pattern is a literal
  return removePat;
}

// Parses the address pattern, ie everything to the left of the '$' in the filter. Returns
// a regexp for everything in the URL except the protocol.
function parseAddressPattern(addressPat: string): RegExp {
  // Strip off the "||" if it's there. We only care about http(s) links anyway
  const pat = addressPat.startsWith('||') ? addressPat.slice(2) : addressPat;

  // Convert all asterisks into wildcard matches
  let addressExp = escapeRegExp(pat);
  addressExp = addressExp.replaceAll(/\\\*/g, '.*');

  // Convert all carets into separators
  addressExp = addressExp.replaceAll(/\\\^/g, SEPARATOR);

  return new RegExp(addressExp);
}

// Parses a uBlock-encoded URL filter with `removeparam` rule and returns the
// corersponding `URLFilter` object
function parseRule(s: string): URLFilter {
  // Split s into the part that comes before '$' and after
  const [addressPat, modifiers] = s.split('$');

  // Parse the modifiers

  // Find the `removeparam` modifier in the list of modifiers
  const removeModifier = modifiers
    .split(',')
    .filter(mod => mod.startsWith('removeparam'))[0];
  // Get the pattern of the removeparam modifier if it exists
  const removePat = removeModifier.split('=', 2)[1];
  const removeExp = parseRemoveRule(removePat);

  // Now parse the address pattern

  // We don't handle negative patterns rn
  if (addressPat.startsWith('@@')) {
    throw new Error('cannot handle negative rule');
  }

  // If the address pattern doesn't exist, we have everything we need already
  if (!addressPat) {
    return new URLFilter(/.*/, removeExp);
  }
  // Otherwise parse the pattern
  const addressExp = parseAddressPattern(addressPat);

  return new URLFilter(addressExp, removeExp);
}

// Applies all the loaded filter rules to the given URL. Returns a new URL with tracking
// parameters stripped.
export function applyAllRules(url: URL): URL {
  // Gather negative rules first. Specifically the remove RegExps from the ones that match
  // our path.
  const negativeFilters = ALL_NEGATIVE_RULES.filter(filter =>
    filter.addressMatches(url)
  ).map(f => f.removeExp);
  const negativeFiltersSet = new Set(negativeFilters);

  // Apply all the rules to the URL
  let newUrl = url;
  for (const filter of ALL_POSITIVE_RULES) {
    newUrl = filter.applyWithExceptions(newUrl, negativeFiltersSet);
  }
  return newUrl;
}

// Parses all the rules from RULES and puts them in ALL_POSITIVE_RULES and
// ALL_NEGATIVE_RULES. This is called at the very bottom of this file.
function init() {
  // We ignore any lines between !#if and !#endif. Most of these are temp fixes for a bug
  // that this impl doesn't have, namely
  // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3076
  let inIfelsePragma = false;
  // We ignore the line after any !+ pragma
  let inOnelinePragma = false;

  // Parse every line in RULES
  for (const line of RULES.split('\n')) {
    // See if this line is a parser pragma
    if (line.startsWith('!#if')) {
      // We're in an if-else pragma iff we're between an #!if and #!endif
      inIfelsePragma = true;
    } else if (line.startsWith('!#endif')) {
      inIfelsePragma = false;
    } else if (line.startsWith('!+')) {
      // This is a !+ pragma (eg "!+ PLATFORM" or "!+ NOT_PLATFORM")
      inOnelinePragma = true;
    }

    // Now decide if we're gonna skip this line
    if (line.startsWith('!')) {
      // Skip comment/pragma lines
      continue;
    } else if (inOnelinePragma) {
      inOnelinePragma = false;
      continue;
    } else if (inIfelsePragma) {
      // Skip lines in an if-else pragma
      continue;
    } else if (
      line.includes('removeparam=/') ||
      line.includes('removeparam=~')
    ) {
      // We don't support regex removeparam rules yet
      continue;
    } else if (!line.includes('removeparam')) {
      // Some lines in the file aren't removeparam rules. Ignore them
      continue;
    }

    if (line.startsWith('@@')) {
      // Strip the @@ and parse
      const filter = parseRule(line.slice(2));
      ALL_NEGATIVE_RULES.push(filter);
    } else {
      const filter = parseRule(line);
      ALL_POSITIVE_RULES.push(filter);
    }
  }
}

init();
