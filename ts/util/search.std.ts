// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const SNIPPET_LEFT_PLACEHOLDER = '<<left>>';
export const SNIPPET_RIGHT_PLACEHOLDER = '<<right>>';
export const SNIPPET_TRUNCATION_PLACEHOLDER = '<<truncation>>';

/**
 * Generate a snippet suitable for rendering search results, in the style returned from
 * FTS's snippet() function.
 *
 * If generating a snippet from a mention, will not truncate in the middle of a word.
 *
 * @returns Return a snippet suitable for rendering search results, e.g.
 * `<<truncation>>some text with a <<left>>highlight<<right>>.`
 */
export function generateSnippetAroundMention({
  body,
  mentionStart,
  mentionLength,
}: {
  body: string;
  mentionStart: number;
  mentionLength: number;
}): string {
  const segmenter = new Intl.Segmenter([], { granularity: 'word' });

  // Grab a substring of the body around the mention, larger than the desired snippet
  const bodyAroundMention = body.substring(
    mentionStart - 2 * 50,
    mentionStart + mentionLength + 2 * 50
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
    // oxlint-disable-next-line typescript/no-non-null-assertion
    const leftWord = words[leftWordIdx]!;
    // oxlint-disable-next-line typescript/no-non-null-assertion
    const rightWord = words[rightWordIdx]!;

    snippetStartIdx = Math.min(leftWord.index, mentionStart);
    snippetEndIdx = Math.max(
      rightWord.index + rightWord.segment.length,
      mentionStart + mentionLength
    );

    const lengthBeforeMention = mentionStart - snippetStartIdx;
    const lengthAfterMention = snippetEndIdx - mentionStart - mentionLength;

    if (
      lengthBeforeMention + lengthAfterMention <= 50 &&
      lengthBeforeMention <= 30
    ) {
      break;
    }

    if (lengthBeforeMention > 30) {
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
