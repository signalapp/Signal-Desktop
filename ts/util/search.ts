// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const SNIPPET_LEFT_PLACEHOLDER = '<<left>>';
export const SNIPPET_RIGHT_PLACEHOLDER = '<<right>>';
export const SNIPPET_TRUNCATION_PLACEHOLDER = '<<truncation>>';

/**
 * Generate a snippet suitable for rendering search results, in the style returned from
 * FTS's snippet() function.
 *
 * @param approxSnippetLength - If generating a snippet from a mention, the approximate
 * length of snippet (not including any hydrated mentions that might occur when rendering)
 * @param maxCharsBeforeHighlight - Max chars to show before the highlight, to ensure the
 * highlight is visible even at narrow search result pane widths
 *
 * If generating a snippet from a mention, will not truncate in the middle of a word.
 *
 * @returns Return a snippet suitable for rendering search results, e.g.
 * `<<truncation>>some text with a <<left>>highlight<<right>>.`
 */
export function generateSnippetAroundMention({
  body,
  mentionStart,
  mentionLength = 1,
  approxSnippetLength = 50,
  maxCharsBeforeHighlight = 30,
}: {
  body: string;
  mentionStart: number;
  mentionLength: number;
  approxSnippetLength?: number;
  maxCharsBeforeHighlight?: number;
}): string {
  const segmenter = new Intl.Segmenter([], { granularity: 'word' });

  // Grab a substring of the body around the mention, larger than the desired snippet
  const bodyAroundMention = body.substring(
    mentionStart - 2 * approxSnippetLength,
    mentionStart + mentionLength + 2 * approxSnippetLength
  );

  const words = [...segmenter.segment(bodyAroundMention)].filter(
    word => word.isWordLike
  );

  let snippetStartIdx = 0;
  let snippetEndIdx = body.length;

  let leftWordIdx = 0;
  let rightWordIdx = words.length - 1;

  // Gradually narrow the substring, word by word, until a snippet of appropriate length
  // is found
  while (leftWordIdx <= rightWordIdx) {
    const leftWord = words[leftWordIdx];
    const rightWord = words[rightWordIdx];

    snippetStartIdx = Math.min(leftWord.index, mentionStart);
    snippetEndIdx = Math.max(
      rightWord.index + rightWord.segment.length,
      mentionStart + mentionLength
    );

    const lengthBeforeMention = mentionStart - snippetStartIdx;
    const lengthAfterMention = snippetEndIdx - mentionStart - mentionLength;

    if (
      lengthBeforeMention + lengthAfterMention <= approxSnippetLength &&
      lengthBeforeMention <= maxCharsBeforeHighlight
    ) {
      break;
    }

    if (lengthBeforeMention > maxCharsBeforeHighlight) {
      leftWordIdx += 1;
    } else if (lengthBeforeMention > lengthAfterMention) {
      leftWordIdx += 1;
    } else {
      rightWordIdx -= 1;
    }
  }

  const mentionStartInSnippet = mentionStart - snippetStartIdx;
  const snippedBody = body.substring(snippetStartIdx, snippetEndIdx);

  const snippedBodyWithPlaceholders =
    (snippetStartIdx > 0 ? SNIPPET_TRUNCATION_PLACEHOLDER : '') +
    snippedBody.substring(0, mentionStartInSnippet) +
    SNIPPET_LEFT_PLACEHOLDER +
    snippedBody.substring(
      mentionStartInSnippet,
      mentionStartInSnippet + mentionLength
    ) +
    SNIPPET_RIGHT_PLACEHOLDER +
    snippedBody.substring(mentionStartInSnippet + mentionLength) +
    (snippetEndIdx < body.length ? SNIPPET_TRUNCATION_PLACEHOLDER : '');

  return snippedBodyWithPlaceholders;
}
