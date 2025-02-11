// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-namespace */

import { isEqual, isNumber, omit, orderBy, partition } from 'lodash';

import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import { missingCaseError } from '../util/missingCaseError';
import { isNotNil } from '../util/isNotNil';
import type { ConversationType } from '../state/ducks/conversations';
import {
  SNIPPET_LEFT_PLACEHOLDER,
  SNIPPET_RIGHT_PLACEHOLDER,
  SNIPPET_TRUNCATION_PLACEHOLDER,
} from '../util/search';
import { assertDev } from '../util/assert';
import type { AciString } from './ServiceId';
import { normalizeAci } from '../util/normalizeAci';

// Cold storage of body ranges

export type BodyRange<T extends object> = {
  start: number;
  length: number;
} & T;

/** Body range as parsed from proto (No "Link" since those don't come from proto) */
export type RawBodyRange = BodyRange<BodyRange.Mention | BodyRange.Formatting>;

export enum DisplayStyle {
  SearchKeywordHighlight = 'SearchKeywordHighlight',
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace BodyRange {
  // re-export for convenience
  export type Style = Proto.BodyRange.Style;
  export const { Style } = Proto.BodyRange;

  export type Mention = {
    mentionAci: AciString;
  };
  export type Link = {
    url: string;
  };
  export type Formatting = {
    style: Style;
    spoilerId?: number;
  };
  export type DisplayOnly = {
    displayStyle: DisplayStyle;
  };

  export function isRawRange(range: BodyRange<object>): range is RawBodyRange {
    return isMention(range) || isFormatting(range);
  }

  // these overloads help inference along
  export function isMention(
    bodyRange: HydratedBodyRangeType
  ): bodyRange is HydratedBodyRangeMention;
  export function isMention(
    bodyRange: BodyRange<object>
  ): bodyRange is BodyRange<Mention>;
  export function isMention<T extends object, X extends BodyRange<Mention> & T>(
    bodyRange: BodyRange<T>
  ): bodyRange is X {
    // satisfies keyof Mention
    return ('mentionAci' as const) in bodyRange;
  }
  export function isFormatting(
    bodyRange: BodyRange<object>
  ): bodyRange is BodyRange<Formatting> {
    // satisfies keyof Formatting
    return ('style' as const) in bodyRange;
  }

  export function isLink<T extends Mention | Link | Formatting | DisplayOnly>(
    node: T
  ): node is T & Link {
    // satisfies keyof Link
    return ('url' as const) in node;
  }
  export function isDisplayOnly<
    T extends Mention | Link | Formatting | DisplayOnly,
  >(node: T): node is T & DisplayOnly {
    // satisfies keyof DisplayOnly
    return ('displayStyle' as const) in node;
  }
}

// Used exclusive in CompositionArea and related conversation_view.tsx calls.

export type DraftBodyRangeMention = BodyRange<
  BodyRange.Mention & {
    replacementText: string;
  }
>;
export type DraftBodyRange =
  | DraftBodyRangeMention
  | BodyRange<BodyRange.Formatting>;
export type DraftBodyRanges = ReadonlyArray<DraftBodyRange>;

// Fully hydrated body range to be used in UI components.

export type HydratedBodyRangeMention = DraftBodyRangeMention & {
  conversationID: string;
};

export type HydratedBodyRangeType =
  | HydratedBodyRangeMention
  | BodyRange<BodyRange.Formatting>;

export type HydratedBodyRangesType = ReadonlyArray<HydratedBodyRangeType>;

export type DisplayBodyRangeType =
  | HydratedBodyRangeType
  | BodyRange<BodyRange.DisplayOnly>;
export type BodyRangesForDisplayType = ReadonlyArray<DisplayBodyRangeType>;

type HydratedMention = BodyRange.Mention & {
  conversationID: string;
  replacementText: string;
};

/**
 * A range that can contain other nested ranges
 * Inner range start fields are relative to the start of the containing range
 */
export type RangeNode = BodyRange<
  (
    | HydratedMention
    | BodyRange.Link
    | BodyRange.Formatting
    | BodyRange.DisplayOnly
  ) & {
    ranges: ReadonlyArray<RangeNode>;
  }
>;

const { BOLD, ITALIC, MONOSPACE, SPOILER, STRIKETHROUGH, NONE } =
  BodyRange.Style;
const MAX_PER_TYPE = 250;
const MENTION_NAME = 'mention';

// We drop unknown bodyRanges and remove extra stuff so they serialize properly
export function filterAndClean(
  ranges: ReadonlyArray<Proto.IBodyRange | RawBodyRange> | undefined | null
): ReadonlyArray<RawBodyRange> | undefined {
  if (!ranges) {
    return undefined;
  }

  const countByTypeRecord: Record<
    BodyRange.Style | typeof MENTION_NAME,
    number
  > = {
    [MENTION_NAME]: 0,
    [BOLD]: 0,
    [ITALIC]: 0,
    [MONOSPACE]: 0,
    [SPOILER]: 0,
    [STRIKETHROUGH]: 0,
    [NONE]: 0,
  };

  return ranges
    .map(range => {
      const { start: startFromRange, length, ...restOfRange } = range;

      const start = startFromRange ?? 0;
      if (!isNumber(length)) {
        log.warn('filterAndClean: Dropping bodyRange with non-number length');
        return undefined;
      }

      let mentionAci: AciString | undefined;
      if ('mentionAci' in range && range.mentionAci) {
        mentionAci = normalizeAci(range.mentionAci, 'BodyRange.mentionAci');
      }

      if (mentionAci) {
        countByTypeRecord[MENTION_NAME] += 1;
        if (countByTypeRecord[MENTION_NAME] > MAX_PER_TYPE) {
          return undefined;
        }

        return {
          ...restOfRange,
          start,
          length,
          mentionAci,
        };
      }
      if ('style' in range && range.style) {
        countByTypeRecord[range.style] += 1;
        if (countByTypeRecord[range.style] > MAX_PER_TYPE) {
          return undefined;
        }
        return {
          ...restOfRange,
          start,
          length,
          style: range.style,
        };
      }

      log.warn('filterAndClean: Dropping unknown bodyRange');
      return undefined;
    })
    .filter(isNotNil);
}

export function hydrateRanges(
  ranges: ReadonlyArray<BodyRange<object>> | undefined,
  conversationSelector: (id: string) => ConversationType
): Array<HydratedBodyRangeType> | undefined {
  if (!ranges) {
    return undefined;
  }

  return filterAndClean(ranges)?.map(range => {
    if (BodyRange.isMention(range)) {
      const conversation = conversationSelector(range.mentionAci);

      return {
        ...range,
        conversationID: conversation.id,
        replacementText: conversation.title,
      };
    }

    return range;
  });
}

/**
 * Insert a range into an existing range tree, splitting up the range if it intersects
 * with an existing range
 *
 * @param range The range to insert the tree
 * @param rangeTree A list of nested non-intersecting range nodes, these starting ranges
 *  will not be split up
 */
export function insertRange(
  range: BodyRange<
    | HydratedMention
    | BodyRange.Link
    | BodyRange.Formatting
    | BodyRange.DisplayOnly
  >,
  rangeTree: ReadonlyArray<RangeNode>
): ReadonlyArray<RangeNode> {
  const [current, ...rest] = rangeTree;

  if (!current) {
    return [{ ...range, ranges: [] }];
  }
  const rangeEnd = range.start + range.length;
  const currentEnd = current.start + current.length;

  // ends before current starts
  if (rangeEnd <= current.start) {
    return [{ ...range, ranges: [] }, current, ...rest];
  }

  // starts after current one ends
  if (range.start >= currentEnd) {
    return [current, ...insertRange(range, rest)];
  }

  // range is contained by first
  if (range.start >= current.start && rangeEnd <= currentEnd) {
    return [
      {
        ...current,
        ranges: insertRange(
          { ...range, start: range.start - current.start },
          current.ranges
        ),
      },
      ...rest,
    ];
  }

  // range contains first (but might contain more)
  // split range into 3
  if (range.start < current.start && rangeEnd > currentEnd) {
    return [
      { ...range, length: current.start - range.start, ranges: [] },
      {
        ...current,
        ranges: insertRange(
          { ...range, start: 0, length: current.length },
          current.ranges
        ),
      },
      ...insertRange(
        { ...range, start: currentEnd, length: rangeEnd - currentEnd },
        rest
      ),
    ];
  }

  // range intersects beginning
  // split range into 2
  if (range.start < current.start && rangeEnd <= currentEnd) {
    return [
      { ...range, length: current.start - range.start, ranges: [] },
      {
        ...current,
        ranges: insertRange(
          {
            ...range,
            start: 0,
            length: range.length - (current.start - range.start),
          },
          current.ranges
        ),
      },
      ...rest,
    ];
  }

  // range intersects ending
  // split range into 2
  if (range.start >= current.start && rangeEnd > currentEnd) {
    return [
      {
        ...current,
        ranges: insertRange(
          {
            ...range,
            start: range.start - current.start,
            length: currentEnd - range.start,
          },
          current.ranges
        ),
      },
      ...insertRange(
        {
          ...range,
          start: currentEnd,
          length: range.length - (currentEnd - range.start),
        },
        rest
      ),
    ];
  }

  log.error(`MessageTextRenderer: unhandled range ${range}`);
  throw new Error('unhandled range');
}

// A flat list, ready for display

export type DisplayNode = {
  text: string;
  start: number;
  length: number;
  mentions: ReadonlyArray<BodyRange<HydratedMention>>;

  // Formatting
  isBold?: boolean;
  isItalic?: boolean;
  isMonospace?: boolean;
  isSpoiler?: boolean;
  isStrikethrough?: boolean;

  // Link
  url?: string;

  // DisplayOnly
  isKeywordHighlight?: boolean;

  // Only for spoilers, only to make sure we honor original spoiler breakdown
  spoilerId?: number;
  spoilerChildren?: ReadonlyArray<DisplayNode>;
};
type PartialDisplayNode = Omit<
  DisplayNode,
  'mentions' | 'text' | 'start' | 'length'
>;

function rangeToPartialNode(
  range: BodyRange<
    BodyRange.Link | BodyRange.Formatting | BodyRange.DisplayOnly
  >
): PartialDisplayNode {
  if (BodyRange.isFormatting(range)) {
    if (range.style === BodyRange.Style.BOLD) {
      return { isBold: true };
    }
    if (range.style === BodyRange.Style.ITALIC) {
      return { isItalic: true };
    }
    if (range.style === BodyRange.Style.MONOSPACE) {
      return { isMonospace: true };
    }
    if (range.style === BodyRange.Style.SPOILER) {
      return { isSpoiler: true, spoilerId: range.spoilerId };
    }
    if (range.style === BodyRange.Style.STRIKETHROUGH) {
      return { isStrikethrough: true };
    }
    if (range.style === BodyRange.Style.NONE) {
      return {};
    }
    return {};
  }
  if (BodyRange.isLink(range)) {
    return {
      url: range.url,
    };
  }
  if (BodyRange.isDisplayOnly(range)) {
    if (range.displayStyle === DisplayStyle.SearchKeywordHighlight) {
      return { isKeywordHighlight: true };
    }
    throw missingCaseError(range.displayStyle);
  }

  throw missingCaseError(range);
}

/**
 * Turns a range tree into a flat list that can be rendered, with a walk across the tree.
 *
 *  * @param rangeTree A list of nested non-intersecting ranges.
 */
export function collapseRangeTree({
  parentData,
  parentOffset = 0,
  text,
  tree,
}: {
  parentData?: PartialDisplayNode;
  parentOffset?: number;
  text: string;
  tree: ReadonlyArray<RangeNode>;
}): ReadonlyArray<DisplayNode> {
  let collapsed: Array<DisplayNode> = [];

  let offset = 0;
  let mentions: Array<HydratedBodyRangeMention> = [];

  tree.forEach(range => {
    if (BodyRange.isMention(range)) {
      mentions.push({
        ...omit(range, ['ranges']),
        start: range.start - offset,
      });
      return;
    }

    // Empty space between start of current
    if (range.start > offset) {
      collapsed.push({
        ...parentData,
        text: text.slice(offset, range.start),
        start: offset + parentOffset,
        length: range.start - offset,
        mentions,
      });
      mentions = [];
    }

    // What sub-breaks can we make within this node?
    const partialNode = { ...parentData, ...rangeToPartialNode(range) };
    collapsed = collapsed.concat(
      collapseRangeTree({
        parentData: partialNode,
        parentOffset: range.start + parentOffset,
        text: text.slice(range.start, range.start + range.length),
        tree: range.ranges,
      })
    );

    offset = range.start + range.length;
  });

  // Empty space after the last range
  if (text.length > offset) {
    collapsed.push({
      ...parentData,
      text: text.slice(offset, text.length),
      start: offset + parentOffset,
      length: text.length - offset,
      mentions,
    });
  }

  return collapsed;
}

export function groupContiguousSpoilers(
  nodes: ReadonlyArray<DisplayNode>
): ReadonlyArray<DisplayNode> {
  const result: Array<DisplayNode> = [];

  let spoilerContainer: DisplayNode | undefined;

  nodes.forEach(node => {
    if (node.isSpoiler) {
      if (
        spoilerContainer &&
        isNumber(spoilerContainer.spoilerId) &&
        spoilerContainer.spoilerId === node.spoilerId
      ) {
        spoilerContainer.spoilerChildren = [
          ...(spoilerContainer.spoilerChildren || []),
          node,
        ];
      } else {
        spoilerContainer = undefined;
      }

      if (!spoilerContainer) {
        spoilerContainer = {
          ...node,
          isSpoiler: true,
          spoilerChildren: [node],
        };
        result.push(spoilerContainer);
      }
    } else {
      spoilerContainer = undefined;
      result.push(node);
    }
  });

  return result;
}

const TRUNCATION_CHAR = '...';
const TRUNCATION_START = new RegExp(`^${SNIPPET_TRUNCATION_PLACEHOLDER}`);
const TRUNCATION_END = new RegExp(`${SNIPPET_TRUNCATION_PLACEHOLDER}$`);
// This function exists because bodyRanges tells us the character position
// where the at-mention starts at according to the full body text. The snippet
// we get back is a portion of the text and we don't know where it starts. This
// function will find the relevant bodyRanges that apply to the snippet and
// then update the proper start position of each body range.
export function processBodyRangesForSearchResult({
  snippet,
  body,
  bodyRanges,
}: {
  snippet: string;
  body: string;
  bodyRanges: BodyRangesForDisplayType;
}): {
  cleanedSnippet: string;
  bodyRanges: BodyRangesForDisplayType;
} {
  // Find where the snippet starts in the full text
  const cleanedSnippet = snippet
    .replace(new RegExp(SNIPPET_LEFT_PLACEHOLDER, 'g'), '')
    .replace(new RegExp(SNIPPET_RIGHT_PLACEHOLDER, 'g'), '');
  const withNoStartTruncation = cleanedSnippet.replace(TRUNCATION_START, '');
  const withNoEndTruncation = withNoStartTruncation.replace(TRUNCATION_END, '');
  const finalSnippet = cleanedSnippet
    .replace(TRUNCATION_START, TRUNCATION_CHAR)
    .replace(TRUNCATION_END, TRUNCATION_CHAR);
  const truncationDelta =
    withNoStartTruncation.length !== cleanedSnippet.length
      ? TRUNCATION_CHAR.length
      : 0;

  let startOfSnippet = body.indexOf(withNoEndTruncation);
  if (startOfSnippet === -1) {
    assertDev(false, `No match found for "${snippet}" inside "${body}"`);
    startOfSnippet = 0;
  }

  const endOfSnippet = startOfSnippet + withNoEndTruncation.length;

  // We want only the ranges that include the snippet
  const filteredBodyRanges = bodyRanges.filter(range => {
    const { start } = range;
    const end = range.start + range.length;
    return end > startOfSnippet && start < endOfSnippet;
  });

  // Adjust ranges, with numbers for the original message body, to work with snippet
  const adjustedBodyRanges: Array<DisplayBodyRangeType> =
    filteredBodyRanges.map(range => {
      const normalizedStart = range.start - startOfSnippet + truncationDelta;
      const start = Math.max(normalizedStart, truncationDelta);
      const end = Math.min(
        normalizedStart + range.length,
        withNoEndTruncation.length + truncationDelta
      );

      return {
        ...range,
        start,
        length: end - start,
      };
    });

  // To format the matches identified by FTS, we create synthetic BodyRanges to mix in
  // with all the other formatting embedded in this message.
  const highlightMatches = snippet.matchAll(
    new RegExp(
      `${SNIPPET_LEFT_PLACEHOLDER}(.*?)${SNIPPET_RIGHT_PLACEHOLDER}`,
      'dg'
    )
  );

  let placeholderCharsSkipped = 0;
  for (const highlightMatch of highlightMatches) {
    // TS < 5 does not have types for RegExpIndicesArray
    const { indices } = highlightMatch as RegExpMatchArray & {
      indices: Array<Array<number>>;
    };
    const [wholeMatchStartIdx] = indices[0];
    const [matchedWordStartIdx, matchedWordEndIdx] = indices[1];
    adjustedBodyRanges.push({
      start:
        wholeMatchStartIdx +
        -placeholderCharsSkipped +
        (truncationDelta
          ? TRUNCATION_CHAR.length - SNIPPET_TRUNCATION_PLACEHOLDER.length
          : 0),
      length: matchedWordEndIdx - matchedWordStartIdx,
      displayStyle: DisplayStyle.SearchKeywordHighlight,
    });
    placeholderCharsSkipped +=
      SNIPPET_LEFT_PLACEHOLDER.length + SNIPPET_RIGHT_PLACEHOLDER.length;
  }

  return {
    cleanedSnippet: finalSnippet,
    bodyRanges: adjustedBodyRanges,
  };
}

export const SPOILER_REPLACEMENT = '■■■■';

/**
 * Replace text in a string at a given range, returning the new string. The
 * replacement can be a different length than the text it's replacing.
 * @example
 * ```ts
 * replaceText('hello world!!!', 'jamie', 6, 11) === 'hello jamie!!!'
 * ```
 */
function replaceText(
  input: string,
  insert: string,
  start: number,
  end: number
): string {
  return input.slice(0, start) + insert + input.slice(end);
}

export type BodyWithBodyRanges = {
  body: string;
  bodyRanges: HydratedBodyRangesType;
};

type Span = {
  start: number;
  end: number;
};

function snapSpanToEdgesOfReplacement(
  span: Span,
  replacement: Span
): Span | null {
  // If the span is empty, we can just remove it
  if (span.start >= span.end) {
    return null;
  }

  // If the span is inside the replacement (not exactly the same), we remove it
  if (
    (span.start > replacement.start && span.end <= replacement.end) ||
    (span.start >= replacement.start && span.end < replacement.end)
  ) {
    return null;
  }

  let start: number;
  if (span.start < replacement.start) {
    start = span.start;
  } else if (span.start === replacement.start) {
    start = replacement.start;
  } else if (span.start < replacement.end) {
    start = replacement.start; // snap to the start of the replacement
  } else if (span.start === replacement.end) {
    start = replacement.end; // snap to the end of the replacement
  } else {
    start = span.start;
  }

  let end: number;
  if (span.end < replacement.start) {
    end = span.end;
  } else if (span.end === replacement.start) {
    end = replacement.start;
  } else if (span.end < replacement.end) {
    end = replacement.end; // snap to the start of the replacement
  } else if (span.end === replacement.end) {
    end = replacement.end; // snap to the end of the replacement
  } else {
    end = span.end;
  }

  // If this made the span empty, we can remove it
  if (start === end) {
    return null;
  }

  return { start, end };
}

function toSpan(range: HydratedBodyRangeType) {
  return { start: range.start, end: range.start + range.length };
}

/**
 * Apply a single replacement range to a string, returning the new string and
 * updated ranges. This only works for mentions and spoilers. The other ranges
 * are updated to stay outside of the replaced text, or removed if are only
 * inside the replaced text.
 */
export function applyRangeToText(
  input: BodyWithBodyRanges,
  // mention or spoiler
  replacement: HydratedBodyRangeType
): BodyWithBodyRanges {
  let insert: string;

  if (BodyRange.isMention(replacement)) {
    insert = `@${replacement.replacementText}`;
  } else if (
    BodyRange.isFormatting(replacement) &&
    replacement.style === BodyRange.Style.SPOILER
  ) {
    insert = SPOILER_REPLACEMENT;
  } else {
    throw new Error('Invalid range');
  }

  const updatedBody = replaceText(
    input.body,
    insert,
    replacement.start,
    replacement.start + replacement.length
  );

  const updatedRanges = input.bodyRanges
    .map((otherRange): HydratedBodyRangeType | null => {
      // It is easier to work with a `start-end` here because we can easily
      // adjust it at the end based on the diff of the inserted text
      const otherRangeSpan = toSpan(otherRange);
      const replacementSpan = toSpan(replacement);

      const result = snapSpanToEdgesOfReplacement(
        otherRangeSpan,
        replacementSpan
      );
      if (result == null) {
        return null;
      }

      let { start, end } = result;

      // The difference between the length of the range we're inserting and the
      // length of the inserted text
      // - "\uFFFC".length == 1 -> "@jamie".length == 6, so diff == 5
      // - "spoiler".length == 7 -> "■■■■".length == 4, so diff == -3
      const insertionDiff = insert.length - replacement.length;
      // We only need to adjust positions at or after the end of the replacement
      if (start >= replacementSpan.end) {
        start += insertionDiff;
      }
      if (end >= replacementSpan.end) {
        end += insertionDiff;
      }

      return { ...otherRange, start, length: end - start };
    })
    .filter((r): r is HydratedBodyRangeType => {
      return r != null;
    });

  return { body: updatedBody, bodyRanges: updatedRanges };
}

function _applyRangeOfType(
  input: BodyWithBodyRanges,
  condition: (bodyRange: HydratedBodyRangeType) => boolean
) {
  const [matchedRanges, otherRanges] = partition(input.bodyRanges, condition);
  return matchedRanges
    .sort((a, b) => {
      return b.start - a.start;
    })
    .reduce<BodyWithBodyRanges>(
      (prev, matchedRange) => {
        return applyRangeToText(prev, matchedRange);
      },
      { body: input.body, bodyRanges: otherRanges }
    );
}

/**
 * Apply some body ranges to body, returning the new string and updated ranges.
 * This only works for mentions and spoilers. The other ranges are updated to
 * stay outside of the replaced text, or removed if are only inside the
 * replaced text.
 *
 * You can optionally enable/disable replacing mentions and spoilers.
 */
export function applyRangesToText(
  input: BodyWithBodyRanges,
  options: {
    replaceMentions: boolean; // "@jamie"
    replaceSpoilers: boolean; // "■■■■"
  }
): BodyWithBodyRanges {
  let state = input;

  // Short-circuit if there are no ranges
  if (state.bodyRanges.length === 0) {
    return state;
  }

  if (options.replaceSpoilers) {
    state = _applyRangeOfType(state, bodyRange => {
      return BodyRange.isFormatting(bodyRange) && bodyRange.style === SPOILER;
    });
  }

  if (options.replaceMentions) {
    state = _applyRangeOfType(state, bodyRange => {
      return BodyRange.isMention(bodyRange);
    });
  }

  return state;
}

export function trimMessageWhitespace(input: {
  body?: string;
  bodyRanges?: ReadonlyArray<RawBodyRange>;
}): { body?: string; bodyRanges?: ReadonlyArray<RawBodyRange> } {
  if (input.body == null) {
    return input;
  }

  let trimmedAtStart = input.body.trimStart();
  let minimumIndex = input.body.length - trimmedAtStart.length;

  let allTrimmed = trimmedAtStart.trimEnd();
  let maximumIndex = allTrimmed.length;

  if (minimumIndex === 0 && trimmedAtStart.length === maximumIndex) {
    return input;
  }

  let earliestMonospaceIndex = Number.MAX_SAFE_INTEGER;
  input.bodyRanges?.forEach(range => {
    if (earliestMonospaceIndex === 0) {
      return;
    }
    if (
      !BodyRange.isFormatting(range) ||
      range.style !== BodyRange.Style.MONOSPACE
    ) {
      return;
    }

    if (range.start < earliestMonospaceIndex) {
      earliestMonospaceIndex = range.start;
    }
  });
  if (earliestMonospaceIndex < minimumIndex) {
    trimmedAtStart = input.body.slice(earliestMonospaceIndex);
    minimumIndex = input.body.length - trimmedAtStart.length;
    allTrimmed = trimmedAtStart.trimEnd();
    maximumIndex = allTrimmed.length;
  }

  if (earliestMonospaceIndex === 0 && trimmedAtStart.length === maximumIndex) {
    return input;
  }

  const bodyRanges = input.bodyRanges
    ?.map(range => {
      let workingRange = range;

      const rangeEnd = workingRange.start + workingRange.length;
      if (rangeEnd <= minimumIndex) {
        return undefined;
      }

      if (workingRange.start < minimumIndex) {
        const underMinimum = workingRange.start - minimumIndex;
        workingRange = {
          ...workingRange,
          start: Math.max(underMinimum, 0),
          length: workingRange.length + underMinimum,
        };
      } else {
        workingRange = {
          ...workingRange,
          start: workingRange.start - minimumIndex,
        };
      }

      const newRangeEnd = workingRange.start + workingRange.length;

      if (workingRange.start >= maximumIndex) {
        return undefined;
      }

      const overMaximum = newRangeEnd - maximumIndex;
      if (overMaximum > 0) {
        workingRange = {
          ...workingRange,
          length: workingRange.length - overMaximum,
        };
      }

      return workingRange;
    })
    .filter(isNotNil);

  return {
    body: allTrimmed,
    bodyRanges,
  };
}

// For ease of working with draft mentions in Quill, a conversationID field is present.
function normalizeBodyRanges(bodyRanges: DraftBodyRanges) {
  return orderBy(bodyRanges, ['start', 'length']).map(item => {
    if (BodyRange.isMention(item)) {
      return { ...item, conversationID: undefined };
    }
    return item;
  });
}

export function areBodyRangesEqual(
  left: DraftBodyRanges,
  right: DraftBodyRanges
): boolean {
  const normalizedLeft = normalizeBodyRanges(left);
  const sortedRight = normalizeBodyRanges(right);

  if (normalizedLeft.length !== sortedRight.length) {
    return false;
  }

  return isEqual(normalizedLeft, sortedRight);
}
