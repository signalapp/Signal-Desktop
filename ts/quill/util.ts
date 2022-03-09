// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import emojiRegex from 'emoji-regex';
import Delta from 'quill-delta';
import type { LeafBlot, DeltaOperation } from 'quill';
import type Op from 'quill-delta/dist/Op';

import type { BodyRangeType } from '../types/Util';
import type { MentionBlot } from './mentions/blot';

export type MentionBlotValue = {
  uuid: string;
  title: string;
};

export const isMentionBlot = (blot: LeafBlot): blot is MentionBlot =>
  blot.value() && blot.value().mention;

export type RetainOp = Op & { retain: number };
export type InsertOp<K extends string, T> = Op & { insert: { [V in K]: T } };

export type InsertMentionOp = InsertOp<'mention', MentionBlotValue>;
export type InsertEmojiOp = InsertOp<'emoji', string>;

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

export const getTextFromOps = (ops: Array<DeltaOperation>): string =>
  ops
    .reduce((acc, op) => {
      if (typeof op.insert === 'string') {
        return acc + op.insert;
      }

      if (isInsertEmojiOp(op)) {
        return acc + op.insert.emoji;
      }

      if (isInsertMentionOp(op)) {
        return `${acc}@${op.insert.mention.title}`;
      }

      return acc;
    }, '')
    .trim();

export const getTextAndMentionsFromOps = (
  ops: Array<Op>
): [string, Array<BodyRangeType>] => {
  const mentions: Array<BodyRangeType> = [];

  const text = ops
    .reduce((acc, op, index) => {
      if (typeof op.insert === 'string') {
        const toAdd = index === 0 ? op.insert.trimStart() : op.insert;
        return acc + toAdd;
      }

      if (isInsertEmojiOp(op)) {
        return acc + op.insert.emoji;
      }

      if (isInsertMentionOp(op)) {
        mentions.push({
          length: 1, // The length of `\uFFFC`
          mentionUuid: op.insert.mention.uuid,
          replacementText: op.insert.mention.title,
          start: acc.length,
        });

        return `${acc}\uFFFC`;
      }

      return acc;
    }, '')
    .trimEnd(); // Trimming the start of this string will mess up mention indices

  return [text, mentions];
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
  blot: LeafBlot,
  index: number,
  leftRegExp: RegExp,
  rightRegExp?: RegExp
): Array<RegExpMatchArray | null> => {
  const [leftText, rightText] = getBlotTextPartitions(blot.text, index);

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

export const getDeltaToRemoveStaleMentions = (
  ops: Array<Op>,
  memberUuids: Array<string>
): Delta => {
  const newOps = ops.reduce((memo, op) => {
    if (op.insert) {
      if (
        isInsertMentionOp(op) &&
        !memberUuids.includes(op.insert.mention.uuid)
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

export const insertMentionOps = (
  incomingOps: Array<Op>,
  bodyRanges: Array<BodyRangeType>
): Array<Op> => {
  const ops = [...incomingOps];

  // Working backwards through bodyRanges (to avoid offsetting later mentions),
  // Shift off the op with the text to the left of the last mention,
  // Insert a mention based on the current bodyRange,
  // Unshift the mention and surrounding text to leave the ops ready for the next range
  bodyRanges
    .sort((a, b) => b.start - a.start)
    .forEach(({ start, length, mentionUuid, replacementText }) => {
      const op = ops.shift();

      if (op) {
        const { insert } = op;

        if (typeof insert === 'string') {
          const left = insert.slice(0, start);
          const right = insert.slice(start + length);

          const mention = {
            uuid: mentionUuid,
            title: replacementText,
          };

          ops.unshift({ insert: right });
          ops.unshift({ insert: { mention } });
          ops.unshift({ insert: left });
        } else {
          ops.unshift(op);
        }
      }
    });

  return ops;
};

export const insertEmojiOps = (incomingOps: Array<Op>): Array<Op> => {
  return incomingOps.reduce((ops, op) => {
    if (typeof op.insert === 'string') {
      const text = op.insert;
      const re = emojiRegex();
      let index = 0;
      let match: RegExpExecArray | null;

      // eslint-disable-next-line no-cond-assign
      while ((match = re.exec(text))) {
        const [emoji] = match;
        ops.push({ insert: text.slice(index, match.index) });
        ops.push({ insert: { emoji } });
        index = match.index + emoji.length;
      }

      ops.push({ insert: text.slice(index, text.length) });
    } else {
      ops.push(op);
    }

    return ops;
  }, [] as Array<Op>);
};
