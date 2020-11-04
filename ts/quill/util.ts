// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Delta from 'quill-delta';
import { DeltaOperation } from 'quill';

import { BodyRangeType } from '../types/Util';

export const getTextAndMentionsFromOps = (
  ops: Array<DeltaOperation>
): [string, Array<BodyRangeType>] => {
  const mentions: Array<BodyRangeType> = [];

  const text = ops.reduce((acc, { insert }, index) => {
    if (typeof insert === 'string') {
      let textToAdd;
      switch (index) {
        case 0: {
          textToAdd = insert.trimLeft();
          break;
        }
        case ops.length - 1: {
          textToAdd = insert.trimRight();
          break;
        }
        default: {
          textToAdd = insert;
          break;
        }
      }
      return acc + textToAdd;
    }

    if (insert.emoji) {
      return acc + insert.emoji;
    }

    if (insert.mention) {
      mentions.push({
        length: 1, // The length of `\uFFFC`
        mentionUuid: insert.mention.uuid,
        replacementText: insert.mention.title,
        start: acc.length,
      });

      return `${acc}\uFFFC`;
    }

    return acc;
  }, '');

  return [text, mentions];
};

export const getDeltaToRemoveStaleMentions = (
  ops: Array<DeltaOperation>,
  memberUuids: Array<string>
): Delta => {
  const newOps = ops.reduce((memo, op) => {
    if (op.insert) {
      if (op.insert.mention && !memberUuids.includes(op.insert.mention.uuid)) {
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
  }, Array<DeltaOperation>());

  return new Delta(newOps);
};
