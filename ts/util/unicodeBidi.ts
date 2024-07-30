// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isTestOrMockEnvironment } from '../environment';

/**
 * Left-to-Right Isolate
 * Sets direction to LTR and isolates the embedded content from the surrounding text
 * @example
 * ```html
 * <div dir="ltr">...</div>
 * ```
 */
export const LTR_ISOLATE = '\u2066';

/**
 * Right-to-Left Isolate
 * Sets direction to RTL and isolates the embedded content from the surrounding text
 * @example
 * ```html
 * <div dir="rtl">...</div>
 * ```
 */
export const RTL_ISOLATE = '\u2067';

/**
 * First Strong Isolate
 * Sets direction to the first strong directional character in the embedded
 * content and isolates it from the surrounding text
 * @example
 * ```html
 * <div dir="auto">...</div>
 * ```
 */
export const FIRST_STRONG_ISOLATE = '\u2068';

/**
 * Pop Directional Isolate
 * Terminates the scope of the last LRI, RLI, FSI, or PDI, and returns to the
 * embedding level of the surrounding text
 * @example
 * ```html
 * </div>
 * ```
 */
export const POP_DIRECTIONAL_ISOLATE = '\u2069';

/**
 * Left-to-Right Embedding
 * Sets direction to LTR but allows embedded text to interact with
 * surrounding text, so risk of spillover effects
 * @example
 * ```html
 * <bdo dir="ltr">...</bdo>
 * ```
 */
export const LTR_EMBEDDING = '\u202A';

/**
 * Right-to-Left Embedding
 * Sets direction to RTL but allows embedded text to interact with surrounding
 * text, so risk of spillover effects
 * @example
 * ```html
 * <bdo dir="rtl">...</bdo>
 * ```
 */
export const RTL_EMBEDDING = '\u202B';

/**
 * Pop Directional Formatting
 * Terminates the scope of the last LRE, RLE, LRI, RLI, FSI, or PDI, and
 * returns to the embedding level of the surrounding text
 * @example
 * ```html
 * </bdo>
 * ```
 */
export const POP_DIRECTIONAL_FORMATTING = '\u202C';

/**
 * Left-to-Right Override
 * Forces direction to LTR, even if the surrounding text is RTL
 * @example
 * ```html
 * <bdo dir="ltr">...</bdo>
 * ```
 */
export const LTR_OVERRIDE = '\u202D';

/**
 * Right-to-Left Override
 * Forces direction to RTL, even if the surrounding text is LTR
 * @example
 * ```html
 * <bdo dir="rtl">...</bdo>
 * ```
 */
export const RTL_OVERRIDE = '\u202E';

export const ANY_UNICODE_DIR_CONTROL_CHAR_REGEX = new RegExp(
  [
    LTR_ISOLATE,
    RTL_ISOLATE,
    FIRST_STRONG_ISOLATE,
    POP_DIRECTIONAL_ISOLATE,
    LTR_EMBEDDING,
    RTL_EMBEDDING,
    POP_DIRECTIONAL_FORMATTING,
    LTR_OVERRIDE,
    RTL_OVERRIDE,
  ].join('|'),
  'g'
);

export function hasAnyUnicodeDirControlChars(input: string): boolean {
  return input.match(ANY_UNICODE_DIR_CONTROL_CHAR_REGEX) != null;
}

/**
 * You probably want `bidiIsolate` instead of this function.
 *
 * Ensures that the input string has balanced Unicode directional control
 * characters. If the input string has unbalanced control characters, this
 * function will add the necessary characters to balance them.
 */
function balanceUnicodeDirControlChars(input: string): string {
  // This gets called by i18n code on many strings, so we want to avoid
  // as much work as possible
  if (!hasAnyUnicodeDirControlChars(input)) {
    return input;
  }

  let result = '';
  let formattingDepth = 0;
  let isolateDepth = 0;

  // We need to scan the entire input string and drop some characters as we
  // go in case they are closing something that was never opened.
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    switch (char) {
      case LTR_EMBEDDING:
      case RTL_EMBEDDING:
      case LTR_OVERRIDE:
      case RTL_OVERRIDE:
        formattingDepth += 1;
        result += char;
        break;
      case POP_DIRECTIONAL_FORMATTING:
        formattingDepth -= 1;
        // skip if its closing formatting that was never opened
        if (formattingDepth >= 0) {
          result += char;
        }
        break;
      case LTR_ISOLATE:
      case RTL_ISOLATE:
      case FIRST_STRONG_ISOLATE:
        isolateDepth += 1;
        result += char;
        break;
      case POP_DIRECTIONAL_ISOLATE:
        isolateDepth -= 1;
        // skip if its closing an isolate that was never opened
        if (isolateDepth >= 0) {
          result += char;
        }
        break;
      default:
        result += char;
        break;
    }
  }

  // Ensure everything is closed
  let suffix = '';
  if (formattingDepth > 0) {
    suffix += POP_DIRECTIONAL_FORMATTING.repeat(formattingDepth);
  }
  if (isolateDepth > 0) {
    suffix += POP_DIRECTIONAL_ISOLATE.repeat(isolateDepth);
  }

  return result + suffix;
}

/**
 * @private
 * Exported for testing
 */
export function _bidiIsolate(text: string): string {
  // Wrap with with first strong isolate so directional characters appear
  // correctly.
  return (
    FIRST_STRONG_ISOLATE +
    balanceUnicodeDirControlChars(text) +
    POP_DIRECTIONAL_ISOLATE
  );
}

/**
 * BEFORE YOU USE THIS, YOU PROBABLY WANT TO USE HTML ELEMENTS WITH `dir` ATTRIBUTES
 *
 * Wraps the input string with Unicode directional control characters to ensure
 * that the text is displayed correctly in a bidirectional context.
 *
 * @example
 * ```ts
 * bidiIsolate('Hello') === '\u2068Hello\u2069'
 * ```
 */
export function bidiIsolate(text: string): string {
  if (isTestOrMockEnvironment()) {
    // Turn this off in tests to make it easier to compare strings
    return text;
  }
  return _bidiIsolate(text);
}

export function bidiStrip(text: string): string {
  return text.replace(ANY_UNICODE_DIR_CONTROL_CHAR_REGEX, '');
}
