// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as uuid } from 'uuid';
import lodash from 'lodash';
import type { MessageReactionType } from '../../model-types.d.ts';
import { isEmpty } from '../../util/iterables.std.js';

import {
  addOutgoingReaction,
  getNewestPendingOutgoingReaction,
  getUnsentConversationIds,
  markOutgoingReactionFailed,
  markOutgoingReactionSent,
} from '../../reactions/util.std.js';

const { omit } = lodash;

describe('reaction utilities', () => {
  const OUR_CONVO_ID = uuid();

  const rxn = (
    emoji: undefined | string,
    { isPending = false }: Readonly<{ isPending?: boolean }> = {}
  ): MessageReactionType => ({
    emoji,
    fromId: OUR_CONVO_ID,
    targetTimestamp: Date.now(),
    timestamp: Date.now(),
    ...(isPending ? { isSentByConversationId: { [uuid()]: false } } : {}),
  });

  describe('addOutgoingReaction', () => {
    it('adds the reaction to the end of an empty list', () => {
      const reaction = rxn('💅');
      const result = addOutgoingReaction([], reaction);
      assert.deepStrictEqual(result, [reaction]);
    });

    it('removes all pending reactions', () => {
      const oldReactions = [
        { ...rxn('😭', { isPending: true }), timestamp: 3 },
        { ...rxn('💬'), fromId: uuid() },
        { ...rxn('🥀', { isPending: true }), timestamp: 1 },
        { ...rxn('🌹', { isPending: true }), timestamp: 2 },
      ];
      const reaction = rxn('😀');
      const newReactions = addOutgoingReaction(oldReactions, reaction);
      assert.deepStrictEqual(newReactions, [oldReactions[1], reaction]);
    });
  });

  describe('getNewestPendingOutgoingReaction', () => {
    it('returns undefined if there are no pending outgoing reactions', () => {
      [[], [rxn('🔔')], [rxn('😭'), { ...rxn('💬'), fromId: uuid() }]].forEach(
        oldReactions => {
          assert.deepStrictEqual(
            getNewestPendingOutgoingReaction(oldReactions, OUR_CONVO_ID),
            {}
          );
        }
      );
    });

    it("returns undefined if there's a pending reaction before a fully sent one", () => {
      const oldReactions = [
        { ...rxn('⭐️'), timestamp: 2 },
        { ...rxn('🔥', { isPending: true }), timestamp: 1 },
      ];
      const { pendingReaction, emojiToRemove } =
        getNewestPendingOutgoingReaction(oldReactions, OUR_CONVO_ID);

      assert.isUndefined(pendingReaction);
      assert.isUndefined(emojiToRemove);
    });

    it('returns the newest pending reaction', () => {
      [
        [rxn('⭐️', { isPending: true })],
        [
          { ...rxn('🥀', { isPending: true }), timestamp: 1 },
          { ...rxn('⭐️', { isPending: true }), timestamp: 2 },
        ],
      ].forEach(oldReactions => {
        const { pendingReaction, emojiToRemove } =
          getNewestPendingOutgoingReaction(oldReactions, OUR_CONVO_ID);

        assert.strictEqual(pendingReaction?.emoji, '⭐️');
        assert.isUndefined(emojiToRemove);
      });
    });

    it('makes its best guess of an emoji to remove, if applicable', () => {
      const oldReactions = [
        { ...rxn('⭐️'), timestamp: 1 },
        { ...rxn(undefined, { isPending: true }), timestamp: 3 },
        { ...rxn('🔥', { isPending: true }), timestamp: 2 },
      ];
      const { pendingReaction, emojiToRemove } =
        getNewestPendingOutgoingReaction(oldReactions, OUR_CONVO_ID);

      assert.isDefined(pendingReaction);
      assert.isUndefined(pendingReaction?.emoji);
      assert.strictEqual(emojiToRemove, '⭐️');
    });
  });

  describe('getUnsentConversationIds', () => {
    it("returns an empty iterable if there's nothing to send", () => {
      assert(isEmpty(getUnsentConversationIds({})));
      assert(
        isEmpty(
          getUnsentConversationIds({
            isSentByConversationId: { [uuid()]: true },
          })
        )
      );
    });

    it('returns an iterable of all unsent conversation IDs', () => {
      const unsent1 = uuid();
      const unsent2 = uuid();
      const fakeReaction = {
        isSentByConversationId: {
          [unsent1]: false,
          [unsent2]: false,
          [uuid()]: true,
          [uuid()]: true,
        },
      };

      assert.sameMembers(
        [...getUnsentConversationIds(fakeReaction)],
        [unsent1, unsent2]
      );
    });
  });

  describe('markReactionFailed', () => {
    const fullySent = rxn('⭐️');
    const partiallySent = {
      ...rxn('🔥'),
      isSentByConversationId: { [uuid()]: true, [uuid()]: false },
    };
    const unsent = rxn('🤫', { isPending: true });

    const reactions = [fullySent, partiallySent, unsent];

    it('removes the pending state if the reaction, with emoji, was partially sent', () => {
      assert.deepStrictEqual(
        markOutgoingReactionFailed(reactions, partiallySent),
        [fullySent, omit(partiallySent, 'isSentByConversationId'), unsent]
      );
    });

    it('removes the removal reaction', () => {
      const none = rxn(undefined, { isPending: true });
      assert.isEmpty(markOutgoingReactionFailed([none], none));
    });

    it('does nothing if the reaction is not in the list', () => {
      assert.deepStrictEqual(
        markOutgoingReactionFailed(reactions, rxn('🥀', { isPending: true })),
        reactions
      );
    });

    it('removes the completely-unsent emoji reaction', () => {
      assert.deepStrictEqual(markOutgoingReactionFailed(reactions, unsent), [
        fullySent,
        partiallySent,
      ]);
    });
  });

  describe('markOutgoingReactionSent', () => {
    const uuid1 = uuid();
    const uuid2 = uuid();
    const uuid3 = uuid();

    const star = {
      ...rxn('⭐️'),
      timestamp: 2,
      isSentByConversationId: {
        [uuid1]: false,
        [uuid2]: false,
        [uuid3]: false,
      },
    };
    const none = {
      ...rxn(undefined),
      timestamp: 3,
      isSentByConversationId: {
        [uuid1]: false,
        [uuid2]: false,
        [uuid3]: false,
      },
    };

    const reactions = [star, none, { ...rxn('🔕'), timestamp: 1 }];

    it("does nothing if the reaction isn't in the list", () => {
      const result = markOutgoingReactionSent(
        reactions,
        rxn('🥀', { isPending: true }),
        [uuid()]
      );
      assert.deepStrictEqual(result, reactions);
    });

    it('updates reactions to be partially sent', () => {
      [star, none].forEach(reaction => {
        const result = markOutgoingReactionSent(reactions, reaction, [
          uuid1,
          uuid2,
        ]);
        assert.deepStrictEqual(
          result.find(re => re.emoji === reaction.emoji)
            ?.isSentByConversationId,
          {
            [uuid1]: true,
            [uuid2]: true,
            [uuid3]: false,
          }
        );
      });
    });

    it('removes sent state if a reaction with emoji is fully sent', () => {
      const result = markOutgoingReactionSent(reactions, star, [
        uuid1,
        uuid2,
        uuid3,
      ]);

      const newReaction = result.find(re => re.emoji === '⭐️');
      assert.isDefined(newReaction);
      assert.isUndefined(newReaction?.isSentByConversationId);
    });

    it('removes a fully-sent reaction removal', () => {
      const result = markOutgoingReactionSent(reactions, none, [
        uuid1,
        uuid2,
        uuid3,
      ]);

      assert(
        result.every(({ emoji }) => typeof emoji === 'string'),
        'Expected the emoji removal to be gone'
      );
    });

    it('removes older reactions of mine', () => {
      const result = markOutgoingReactionSent(reactions, star, [
        uuid1,
        uuid2,
        uuid3,
      ]);

      assert.isUndefined(result.find(re => re.emoji === '🔕'));
    });
  });
});
