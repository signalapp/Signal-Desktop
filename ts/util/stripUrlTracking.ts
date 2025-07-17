let RULES: string;

// In a Webpack context, we can directly import files as strings
try {
  RULES = require('./url_param_filter.txt');
} catch {
  // If this fails, it's because we're in a Node context (probably for running tests). In this case,
  // load the file the Node way
  const fs = require('fs');
  const path = require('path');
  RULES = fs.readFileSync(
    path.join(__dirname, './url_param_filter.txt'),
    'utf8'
  );
}

// A separator is "any character, but a letter, a digit, or one of the following: _ - . %"
const SEPARATOR: string = '[^a-zA-Z0-9_\\-\\.\\%]';

// Contains all the positive (ie non-'@@') rules at the bottom of this file, parsed
var ALL_POSITIVE_RULES: RegExp[] = [];

// Contains all the negative (ie '@@') rules at the bottom of this file, parsed
var ALL_NEGATIVE_RULES: RegExp[] = [];

// Removes every instance of `toRemove` from `s`, unless the instance also matches an element of
// `exceptions`
function removeAllExcept(
  s: string,
  toRemove: URLFilter,
  exceptions: RegExp[]
): string {
  // First make a copy of toRemove with the global flag so we can use replaceAll. Since replaceAll
  // mutates its regex, we don't wanna do this with our stored regexes
  var toRemoveCopy = new RegExp(toRemove, 'g');

  // Remove all instances of toRemove from s
  return s.replaceAll(toRemoveCopy, match => {
    // If anything in exceptions matches this, then do not remove it. Just return the match
    // verbatim.
    for (const exception of exceptions) {
      if (exception.test(match)) {
        return match;
      }
    }
    // If nothing in exceptions matches, replace it with an empty string
    return '';
  });
}

// A class that contains the filter rules for a URL
class URLFilter {
  constructor(addressExp: RegExp, removeExp: RegExp) {
    this.addressExp = addressExp;
    this.removeExp = removeExp;
  }

  // Checks if the address portion of the URL matches the address portion of the filter
  addressMatches(url: URL): boolean {
    // Ensure it's HTTPS, then strip it from the URL
    if (url.protocol != 'https:') {
      throw new Error('can only filter https URLs');
    }
    const stringToMatch = url.toString().slice(8);

    return this.addressExp.test(stringToMatch);
  }

  // Strips the given HTTPS URL params according to this filter. If a param is matched by any RegExp
  // in `exceptions`, it is not stripped.
  applyWithExceptions(url: URL, exceptions: RegExp[]): URL {
    if (this.addressMatches(url)) {
      // Apply the removeparam rule
      url.search = removeAllExcept(url.search, this.removeExp, exceptions);
    }

    return url;
  }
}

// Parses everything to the right of the '=' in a removeparam rule. Returns a matcher for the
// param(s) that we wish to remove
function parseRemoveRule(removePat: string): RegExp {
  // If there is no pattern, it's a naked remove, ie remove everything
  if (!removePat) {
    return '.*';
  } else if (removePat.startsWith('/') || removePat.startsWith('~')) {
    throw new Error('regex removeparam not supported');
  } else {
    // Otherwise the pattern is a literal
    // Match removePat followed by '=' then any number of non-'&' chars, then '&' or end of string
    return RegExp.escape(removePat) + '=[^&]*?' + '(?:&|$)';
  }
}

// Parses the address pattern, ie everything to the left of the '$' in the filter. Returns a regexp
// for everything in the URL except the protocol.
function parse_addressPattern(addressPat: string): RegExp {
  // Strip off the "||" if it's there. We only care about http(s) links anyway
  if (addressPat.startsWith('||')) {
    addressPat = addressPat.slice(2);
  }

  // Convert all asterisks into non-greedy "whatever" matches
  var addressExp = RegExp.escape(addressPat);
  addressExp = addressExp.replaceAll(/\\\*/g, '.*?');

  // Convert all carets into separators
  addressExp = addressExp.replaceAll(/\\\^/g, SEPARATOR);

  return addressExp;
}

// Parses a uBlock-encoded URL filter with `removeparam` rule and returns the corersponding
// `URLFilter` object
function parseRule(s: string): URLFilter {
  // Split s into the part that comes before '$' and after
  const [addressPat, modifiers] = s.split('$');

  // Parse the modifiers

  // Find the `removeparam` modifier in the list of modifiers
  const remove_modifier = modifiers
    .split(',')
    .filter(mod => mod.startsWith('removeparam'))[0];
  // Get the pattern of the removeparam modifier if it exists
  const removePat = remove_modifier.split('=', 2)[1];
  const removeExp = parseRemoveRule(removePat);

  // Now parse the address pattern

  // We don't handle negative patterns rn
  if (addressPat.startsWith('@@')) {
    throw new Error('cannot handle negative rule');
  }

  // If the address pattern doesn't exist, we have everything we need already
  if (!addressPat) {
    return new URLFilter(/.*/, new RegExp(removeExp));
  }
  // Otherwise parse the pattern
  const addressExp = parse_addressPattern(addressPat);

  return new URLFilter(new RegExp(addressExp), new RegExp(removeExp));
}

// Applies all the loaded filter rules to the given URL. Returns a new URL with tracking parameters
// stripped.
export function applyAllRules(url: URL): URL {
  // Gather negative rules first. Specifically the remove RegExps from the ones that match our path.
  const negativeFilters = ALL_NEGATIVE_RULES.filter(filter =>
    filter.addressMatches(url)
  ).map(f => f.removeExp);

  for (const filter of ALL_POSITIVE_RULES) {
    url = filter.applyWithExceptions(url, negativeFilters);
  }
  return url;
}

// Parses all the rules from RULES and puts them in ALL_POSITIVE_RULES and ALL_NEGATIVE_RULES.
// This is called at the very bottom of this file.
function init() {
  // We ignore any lines between !#if and !#endif
  var inIfelsePragma = false;
  // We ignore the line after any !+ pragma
  var inOnelinePragma = false;

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
