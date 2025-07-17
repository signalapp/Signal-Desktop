let RULES: string;

// In a Webpack context, we can directly import files as strings
try {
  RULES = require('./url_param_filter.txt');
} catch {
  // If this fails, it's because we're in a Node context (probably for running tests). In this case,
  // load the file the Node way
  const fs = require('fs');
  const path = require('path');
  RULES = fs.readFileSync(path.join(__dirname, './url_param_filter.txt'), 'utf8');
}

// A separator is "any character, but a letter, a digit, or one of the following: _ - . %"
const SEPARATOR: string = "[^a-zA-Z0-9_\\-\\.\\%]";

// Contains all the positive (ie non-'@@') rules at the bottom of this file, parsed
var ALL_POSITIVE_RULES: RegExp[] = [];

// Contains all the negative (ie '@@') rules at the bottom of this file, parsed
var ALL_NEGATIVE_RULES: RegExp[] = [];

// Removes every instance of `to_remove` from `s`, unless the instance also matches an element of
// `exceptions`
function removeAllExcept(s: string, to_remove: URLFilter, exceptions: RegExp[]): string {
  // First make a copy of to_remove with the global flag so we can use replaceAll. Since replaceAll
  // mutates its regex, we don't wanna do this with our stored regexes
  var to_remove_copy = new RegExp(to_remove, "g");

  // Remove all instances of to_remove from s
  return s.replaceAll(to_remove_copy, (match) => {
    // If anything in exceptions matches this, then do not remove it. Just return the match
    // verbatim.
    for (const exception of exceptions) {
      if (exception.test(match)) {
        return match;
      }
    }
    // If nothing in exceptions matches, replace it with an empty string
    return "";
  });
}

// A class that contains the filter rules for a URL
class URLFilter {
  constructor(address_exp: RegExp, remove_exp: RegExp) {
    this.address_exp = address_exp;
    this.remove_exp = remove_exp;
  }

  // Checks if the address portion of the URL matches the address portion of the filter
  address_matches(url: URL): boolean {
    // Ensure it's HTTPS, then strip it from the URL
    if (url.protocol != "https:") {
      throw new Error("can only filter https URLs");
    }
    const string_to_match = url.toString().slice(8);

    return this.address_exp.test(string_to_match);
  }

  // Strips the given HTTPS URL params according to this filter. If a param is matched by any RegExp
  // in `exceptions`, it is not stripped.
  apply_with_exceptions(url: URL, exceptions: RegExp[]): URL {
    if (this.address_matches(url)) {
      // Apply the removeparam rule
      url.search = removeAllExcept(url.search, this.remove_exp, exceptions);
    }

    return url;
  }
}

// Returns the part of the string before `pat` and after `pat`. If `pat` does not occur, the second
// output is `null`
function split_at_first(s: string, pat: RegExp): string[] {
  let [first, ...rest] = s.split(pat);

  // The array size is 0 if there's no match
  if (rest.length == 0) {
    rest = null;
  } else {
    // If there was a match, join the elemetns of the array
    rest = rest.join(pat);
  }
  return [first, rest];
}

// Parses everything to the right of the '=' in a removeparam rule. Returns a matcher for the
// param(s) that we wish to remove
function parse_remove_rule(remove_pat: string): RegExp {
  // If there is no pattern, it's a naked remove, ie remove everything
  if (!remove_pat) {
    return ".*";
  } else if (remove_pat.startsWith("/") || remove_pat.startsWith("~")) {
    throw new Error("regex removeparam not supported");
  } else {
    // Otherwise the pattern is a literal
    // Match remove_pat followed by '=' then any number of non-'&' chars, then '&' or end of string
    return RegExp.escape(remove_pat) + "=[^&]*?" + "(?:&|$)";
  }
}

// Parses the address pattern, ie everything to the left of the '$' in the filter. Returns a regexp
// for everything in the URL except the protocol.
function parse_address_pattern(address_pat: string): RegExp {
  // Strip off the "||" if it's there. We only care about http(s) links anyway
  if (address_pat.startsWith("||")) {
    address_pat = address_pat.slice(2);
  }

  // Convert all asterisks into non-greedy "whatever" matches
  var address_exp = RegExp.escape(address_pat);
  address_exp = address_exp.replaceAll(/\\\*/g, ".*?");

  // Convert all carets into separators
  address_exp = address_exp.replaceAll(/\\\^/g, SEPARATOR);

  return address_exp;
}

// Parses a uBlock-encoded URL filter with `removeparam` rule and returns the corersponding
// `URLFilter` object
function parse_rule(s: string): URLFilter {
  // Split s into the part that comes before '$' and after
  const [address_pat, modifiers] = s.split("$");

  // Parse the modifiers

  // Find the `removeparam` modifier in the list of modifiers
  const remove_modifier = modifiers.split(",").filter((mod) => mod.startsWith("removeparam"))[0];
  // Get the pattern of the removeparam modifier if it exists
  const remove_pat = remove_modifier.split("=", 2)[1];
  const remove_exp = parse_remove_rule(remove_pat);

  // Now parse the address pattern

  // We don't handle negative patterns rn
  if (address_pat.startsWith("@@")) {
    throw new Error("cannot handle negative rule");
  }

  // If the address pattern doesn't exist, we have everything we need already
  if (!address_pat) {
    return new URLFilter(/.*/, new RegExp(remove_exp));
  }
  // Otherwise parse the pattern
  const address_exp = parse_address_pattern(address_pat);

  return new URLFilter(new RegExp(address_exp), new RegExp(remove_exp));
}

// Applies all the loaded filter rules to the given URL. Returns a new URL with tracking parameters
// stripped.
export function applyAllRules(url: URL): URL {
  // Gather negative rules first. Specifically the remove RegExps from the ones that match our path.
  const negative_filters = ALL_NEGATIVE_RULES.filter((filter) => filter.address_matches(url)).map(
    (f) => f.remove_exp,
  );

  for (const filter of ALL_POSITIVE_RULES) {
    url = filter.apply_with_exceptions(url, negative_filters);
  }
  return url;
}

// Parses all the rules from RULES and puts them in ALL_POSITIVE_RULES and ALL_NEGATIVE_RULES.
// This is called at the very bottom of this file.
function init() {
  // We ignore any lines between !#if and !#endif
  var in_ifelse_pragma = false;
  // We ignore the line after any !+ pragma
  var in_oneline_pragma = false;

  // Parse every line in RULES
  for (const line of RULES.split('\n')) {
    // See if this line is a parser pragma
    if (line.startsWith("!#if")) {
      // We're in an if-else pragma iff we're between an #!if and #!endif
      in_ifelse_pragma = true;
    } else if (line.startsWith("!#endif")) {
      in_ifelse_pragma = false;
    } else if (line.startsWith("!+")) {
      // This is a !+ pragma (eg "!+ PLATFORM" or "!+ NOT_PLATFORM")
      in_oneline_pragma = true;
    }

    // Now decide if we're gonna skip this line
    if (line.startsWith("!")) {
      // Skip comment/pragma lines
      continue;
    } else if (in_oneline_pragma) {
      in_oneline_pragma = false;
      continue;
    } else if (in_ifelse_pragma) {
      // Skip lines in an if-else pragma
      continue;
    } else if (line.includes("removeparam=/") || line.includes("removeparam=~")) {
      // We don't support regex removeparam rules yet
      continue;
    } else if (!line.includes("removeparam")) {
      // Some lines in the file aren't removeparam rules. Ignore them
      continue;
    }

    if (line.startsWith("@@")) {
      // Strip the @@ and parse
      const filter = parse_rule(line.slice(2));
      ALL_NEGATIVE_RULES.push(filter);
    } else {
      const filter = parse_rule(line);
      ALL_POSITIVE_RULES.push(filter);
    }
  }
}

init();
