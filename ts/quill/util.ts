// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Delta from 'quill-delta';
import { LeafBlot } from 'quill';
import Op from 'quill-delta/dist/Op';

import { BodyRangeType } from '../types/Util';
import { MentionBlot } from './mentions/blot';

export interface MentionBlotValue {
  uuid: string;
  title: string;
}

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

export const getTextAndMentionsFromOps = (
  ops: Array<Op>
): [string, Array<BodyRangeType>] => {
  const mentions: Array<BodyRangeType> = [];

  const text = ops.reduce((acc, op, index) => {
    if (typeof op.insert === 'string') {
      let textToAdd;
      switch (index) {
        case 0: {
          textToAdd = op.insert.trimLeft();
          break;
        }
        case ops.length - 1: {
          textToAdd = op.insert.trimRight();
          break;
        }
        default: {
          textToAdd = op.insert;
          break;
        }
      }
      return acc + textToAdd;
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
  }, '');

  return [text, mentions];
};

export const getBlotTextPartitions = (
  blot: LeafBlot,
  index: number
): [string, string] => {
  if (blot !== undefined && blot.text !== undefined) {
    const leftLeafText = blot.text.substr(0, index);
    const rightLeafText = blot.text.substr(index);

    return [leftLeafText, rightLeafText];
  }

  return ['', ''];
};

export const matchBlotTextPartitions = (
  blot: LeafBlot,
  index: number,
  leftRegExp: RegExp,
  rightRegExp?: RegExp
): Array<RegExpMatchArray | null> => {
  const [leftText, rightText] = getBlotTextPartitions(blot, index);

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
