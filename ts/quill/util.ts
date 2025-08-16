// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import emojiRegex from 'emoji-regex';
import { Delta } from '@signalapp/quill-cjs';
import type { AttributeMap, Op, Parchment } from '@signalapp/quill-cjs';

import type {
  DisplayNode,
  DraftBodyRange,
  DraftBodyRanges,
} from '../types/BodyRange';
import { BodyRange } from '../types/BodyRange';
import type { MentionBlot } from './mentions/blot';
import type { EmojiBlot } from './emoji/blot';
import { isNewlineOnlyOp, QuillFormattingStyle } from './formatting/menu';
import { isNotNil } from '../util/isNotNil';
import type { AciString } from '../types/ServiceId';
import { emojiToData } from '../components/emoji/lib';

export type Matcher = (
  node: HTMLElement,
  delta: Delta,
  _scroll: Record<string, unknown>,
  // Note: this field is added in our fork
  attributes: AttributeMap
) => Delta;

export type MentionBlotValue = {
  aci: AciString;
  title: string;
};

export type FormattingBlotValue = {
  style: BodyRange.Style;
};

export const isEmojiBlot = (blot: Parchment.LeafBlot): blot is EmojiBlot =>
  blot.value() && blot.value().emoji;

export const isMentionBlot = (blot: Parchment.LeafBlot): blot is MentionBlot =>
  blot.value() && blot.value().mention;

export const isFormatting = (blot: Parchment.LeafBlot): blot is MentionBlot =>
  blot.value() && blot.value().style;

export type RetainOp = Op & { retain: number };
export type InsertOp<K extends string, T> = Op & { insert: { [V in K]: T } };

export type InsertMentionOp = InsertOp<'mention', MentionBlotValue>;
export type InsertEmojiOp = InsertOp<
  'emoji',
  { value: string; source?: string }
>;

export const isRetainOp = (op?: Op): op is RetainOp =>
  op !== undefined && op.retain !== undefined;

export const isSpecificInsertOp = (op: Op, type: string): boolean => {
  return (
    op.insert !== undefined &&
    typeof op.insert === 'object' &&
    Object.hasOwnProperty.call(op.insert, type)
  );
};

export const isInsertEmojiOp = (op: Op): op is InsertEmojiOp =>
  isSpecificInsertOp(op, 'emoji');

export const isInsertMentionOp = (op: Op): op is InsertMentionOp =>
  isSpecificInsertOp(op, 'mention');

export const getTextFromOps = (ops: Array<Op>): string =>
  ops
    .reduce((acc, op) => {
      if (typeof op.insert === 'string') {
        return acc + op.insert;
      }

      if (isInsertEmojiOp(op)) {
        return acc + op.insert.emoji.value;
      }

      if (isInsertMentionOp(op)) {
        return `${acc}@${op.insert.mention.title}`;
      }

      return acc;
    }, '')
    .trim();

const { BOLD, ITALIC, MONOSPACE, SPOILER, STRIKETHROUGH, NONE } =
  BodyRange.Style;

function extractFormatRange({
  bodyRanges,
  index,
  previousData,
  hasStyle,
  style,
}: {
  bodyRanges: Array<DraftBodyRange>;
  index: number;
  previousData: { start: number } | undefined;
  hasStyle: boolean;
  style: BodyRange.Style;
}) {
  if (hasStyle && !previousData) {
    return { start: index };
  }
  if (!hasStyle && previousData) {
    const { start } = previousData;
    bodyRanges.push({
      length: index - start,
      start,
      style,
    });
    return undefined;
  }

  return previousData;
}

function extractAllFormats(
  bodyRanges: Array<DraftBodyRange>,
  formats: Record<BodyRange.Style, { start: number } | undefined>,
  index: number,
  op?: Op
): Record<BodyRange.Style, { start: number } | undefined> {
  const result = { ...formats };
  const params = {
    bodyRanges,
    index,
  };

  result[BOLD] = extractFormatRange({
    ...params,
    style: BOLD,
    previousData: result[BOLD],
    hasStyle: Boolean(op?.attributes?.[QuillFormattingStyle.bold]),
  });
  result[ITALIC] = extractFormatRange({
    ...params,
    style: ITALIC,
    previousData: result[ITALIC],
    hasStyle: Boolean(op?.attributes?.[QuillFormattingStyle.italic]),
  });
  result[MONOSPACE] = extractFormatRange({
    ...params,
    style: MONOSPACE,
    previousData: result[MONOSPACE],
    hasStyle: Boolean(op?.attributes?.[QuillFormattingStyle.monospace]),
  });
  result[SPOILER] = extractFormatRange({
    ...params,
    style: SPOILER,
    previousData: result[SPOILER],
    hasStyle: Boolean(op?.attributes?.[QuillFormattingStyle.spoiler]),
  });
  result[STRIKETHROUGH] = extractFormatRange({
    ...params,
    style: STRIKETHROUGH,
    previousData: result[STRIKETHROUGH],
    hasStyle: Boolean(op?.attributes?.[QuillFormattingStyle.strike]),
  });

  return result;
}

export const getTextAndRangesFromOps = (
  ops: Array<Op>
): { text: string; bodyRanges: DraftBodyRanges } => {
  const startingBodyRanges: Array<DraftBodyRange> = [];
  let earliestMonospaceIndex = Number.MAX_SAFE_INTEGER;
  let formats: Record<BodyRange.Style, { start: number } | undefined> = {
    [BOLD]: undefined,
    [ITALIC]: undefined,
    [MONOSPACE]: undefined,
    [SPOILER]: undefined,
    [STRIKETHROUGH]: undefined,
    [NONE]: undefined,
  };

  const preTrimText = ops.reduce((acc, op) => {
    // We special-case all-newline ops because Quill doesn't apply styles to them
    if (isNewlineOnlyOp(op)) {
      return acc + op.insert;
    }

    // Start or finish format sections as needed
    formats = extractAllFormats(startingBodyRanges, formats, acc.length, op);

    const newMonospaceStart =
      formats[MONOSPACE]?.start ?? earliestMonospaceIndex;
    if (newMonospaceStart < earliestMonospaceIndex) {
      earliestMonospaceIndex = newMonospaceStart;
    }

    if (typeof op.insert === 'string') {
      return acc + op.insert;
    }

    if (isInsertEmojiOp(op)) {
      return acc + op.insert.emoji.value;
    }

    if (isInsertMentionOp(op)) {
      startingBodyRanges.push({
        length: 1, // The length of `\uFFFC`
        mentionAci: op.insert.mention.aci,
        replacementText: op.insert.mention.title,
        start: acc.length,
      });

      return `${acc}\uFFFC`;
    }

    return acc;
  }, '');

  // Close off any pending formats
  extractAllFormats(startingBodyRanges, formats, preTrimText.length);

  // Now repair bodyRanges after trimming
  let trimStart = preTrimText.trimStart();
  let trimmedFromStart = preTrimText.length - trimStart.length;

  // We don't want to trim leading monospace text
  if (earliestMonospaceIndex < trimmedFromStart) {
    trimStart = preTrimText.slice(earliestMonospaceIndex);
    trimmedFromStart = earliestMonospaceIndex;
  }

  const text = trimStart.trimEnd();
  const textLength = text.length;

  const bodyRanges = startingBodyRanges
    .map(startingRange => {
      let range = {
        ...startingRange,
        start: startingRange.start - trimmedFromStart,
      };

      if (range.start >= text.length) {
        return null;
      }

      const underStartBy = -range.start;
      if (underStartBy > 0) {
        const length = range.length - underStartBy;
        if (length <= 0) {
          return null;
        }

        range = {
          ...range,
          start: 0,
          length,
        };
      }

      const end = range.start + range.length;
      const overEndBy = end - textLength;
      if (overEndBy > 0) {
        range = {
          ...range,
          length: range.length - overEndBy,
        };
      }

      return range;
    })
    .filter(isNotNil);

  return { text, bodyRanges };
};

export const getBlotTextPartitions = (
  blotText: string | undefined,
  index: number
): [string, string] => {
  const lowerCaseBlotText = (blotText || '').toLowerCase();
  const leftLeafText = lowerCaseBlotText.substr(0, index);
  const rightLeafText = lowerCaseBlotText.substr(index);

  return [leftLeafText, rightLeafText];
};

export const matchBlotTextPartitions = (
  blot: Parchment.LeafBlot | null,
  index: number,
  leftRegExp: RegExp,
  rightRegExp?: RegExp
): Array<RegExpMatchArray | null> => {
  const text = blot?.value();
  if (text && typeof text !== 'string') {
    // This can be an EmojiBlot, for example
    return [];
  }

  const [leftText, rightText] = getBlotTextPartitions(text, index);

  const leftMatch = leftRegExp.exec(leftText);
  let rightMatch = null;

  if (rightRegExp) {
    rightMatch = rightRegExp.exec(rightText);
  }

  return [leftMatch, rightMatch];
};

export const getDeltaToRestartMention = (ops: Array<Op>): Delta => {
  const changes = ops.reduce((acc, op): Array<Op> => {
    if (op.insert && typeof op.insert === 'string') {
      acc.push({ retain: op.insert.length });
    } else {
      acc.push({ retain: 1 });
    }
    return acc;
  }, Array<Op>());
  changes.push({ delete: 1 });
  changes.push({ insert: '@' });
  return new Delta(changes);
};

export const getDeltaToRestartEmoji = (ops: Array<Op>): Delta => {
  const changes = new Array<Op>();
  for (const op of ops.slice(0, -1)) {
    if (op.insert && typeof op.insert === 'string') {
      changes.push({ retain: op.insert.length });
    } else {
      changes.push({ retain: 1 });
    }
  }
  const last = ops.at(-1);
  if (!last || !last.insert) {
    throw new Error('No emoji to delete');
  }

  changes.push({ delete: 1 });
  if ((last as InsertEmojiOp).insert.emoji?.source) {
    changes.push({ insert: (last as InsertEmojiOp).insert.emoji?.source });
  }
  return new Delta(changes);
};

export const getDeltaToRemoveStaleMentions = (
  ops: Array<Op>,
  memberAcis: Array<AciString>
): Delta => {
  const newOps = ops.reduce((memo, op) => {
    if (op.insert) {
      if (
        isInsertMentionOp(op) &&
        !memberAcis.includes(op.insert.mention.aci)
      ) {
        const deleteOp = { delete: 1 };
        const textOp = { insert: `@${op.insert.mention.title}` };
        return [...memo, deleteOp, textOp];
      }

      if (typeof op.insert === 'string') {
        const retainStringOp = { retain: op.insert.length };
        return [...memo, retainStringOp];
      }

      const retainEmbedOp = { retain: 1 };
      return [...memo, retainEmbedOp];
    }

    return [...memo, op];
  }, Array<Op>());

  return new Delta(newOps);
};

export const insertFormattingAndMentionsOps = (
  nodes: ReadonlyArray<DisplayNode>
): ReadonlyArray<Op> => {
  let ops: Array<Op> = [];

  nodes.forEach(node => {
    const startingOp: Op = {
      insert: node.text,
      attributes: {
        [QuillFormattingStyle.bold]: node.isBold,
        [QuillFormattingStyle.italic]: node.isItalic,
        [QuillFormattingStyle.monospace]: node.isMonospace,
        [QuillFormattingStyle.spoiler]: node.isSpoiler,
        [QuillFormattingStyle.strike]: node.isStrikethrough,
      },
    };
    ops = ops.concat(insertMentionOps([startingOp], node.mentions));
  });

  return ops;
};

export const insertMentionOps = (
  incomingOps: Array<Op>,
  bodyRanges: DraftBodyRanges
): Array<Op> => {
  const ops = [...incomingOps];

  const sortableBodyRanges: Array<DraftBodyRange> = bodyRanges.slice();

  // Working backwards through bodyRanges (to avoid offsetting later mentions),
  // Shift off the op with the text to the left of the last mention,
  // Insert a mention based on the current bodyRange,
  // Unshift the mention and surrounding text to leave the ops ready for the next range
  sortableBodyRanges
    .sort((a, b) => b.start - a.start)
    .forEach(bodyRange => {
      if (!BodyRange.isMention(bodyRange)) {
        return;
      }

      const { start, length, mentionAci, replacementText } = bodyRange;

      const op = ops.shift();

      if (op) {
        const { insert, attributes } = op;

        if (typeof insert === 'string') {
          const left = insert.slice(0, start);
          const right = insert.slice(start + length);

          const mention = {
            aci: mentionAci,
            title: replacementText,
          };

          ops.unshift({ insert: right, attributes });
          ops.unshift({ insert: { mention }, attributes });
          ops.unshift({ insert: left, attributes });
        } else {
          ops.unshift(op);
        }
      }
    });

  return ops;
};

export const insertEmojiOps = (
  incomingOps: ReadonlyArray<Op>,
  existingAttributes: AttributeMap
): Array<Op> => {
  return incomingOps.reduce((ops, op) => {
    if (typeof op.insert === 'string') {
      const text = op.insert;
      const { attributes } = op;
      const re = emojiRegex();
      let index = 0;
      let match: RegExpExecArray | null;

      // eslint-disable-next-line no-cond-assign
      while ((match = re.exec(text))) {
        const [emoji] = match;
        const emojiData = emojiToData(emoji);
        if (emojiData) {
          ops.push({ insert: text.slice(index, match.index), attributes });
          ops.push({
            insert: { emoji: { value: emoji } },
            attributes: { ...existingAttributes, ...attributes },
          });
          index = match.index + emoji.length;
        }
      }

      ops.push({ insert: text.slice(index, text.length), attributes });
    } else {
      ops.push(op);
    }

    return ops;
  }, [] as Array<Op>);
};
