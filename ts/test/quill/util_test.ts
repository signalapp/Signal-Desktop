// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  getDeltaToRemoveStaleMentions,
  getTextAndMentionsFromOps,
  getDeltaToRestartMention,
} from '../../quill/util';

describe('getDeltaToRemoveStaleMentions', () => {
  const memberUuids = ['abcdef', 'ghijkl'];

  describe('given text', () => {
    it('retains the text', () => {
      const originalOps = [
        {
          insert: 'whoa, nobody here',
        },
      ];

      const { ops } = getDeltaToRemoveStaleMentions(originalOps, memberUuids);

      assert.deepEqual(ops, [{ retain: 17 }]);
    });
  });

  describe('given stale and valid mentions', () => {
    it('retains the valid and replaces the stale', () => {
      const originalOps = [
        {
          insert: {
            mention: { uuid: '12345', title: 'Klaus' },
          },
        },
        { insert: { mention: { uuid: 'abcdef', title: 'Werner' } } },
      ];

      const { ops } = getDeltaToRemoveStaleMentions(originalOps, memberUuids);

      assert.deepEqual(ops, [
        { delete: 1 },
        { insert: '@Klaus' },
        { retain: 1 },
      ]);
    });
  });

  describe('given emoji embeds', () => {
    it('retains the embeds', () => {
      const originalOps = [
        {
          insert: {
            emoji: '😂',
          },
        },
        {
          insert: {
            emoji: '🍋',
          },
        },
      ];

      const { ops } = getDeltaToRemoveStaleMentions(originalOps, memberUuids);

      assert.deepEqual(ops, [{ retain: 1 }, { retain: 1 }]);
    });
  });

  describe('given other ops', () => {
    it('passes them through', () => {
      const originalOps = [
        {
          delete: 5,
        },
      ];

      const { ops } = getDeltaToRemoveStaleMentions(originalOps, memberUuids);

      assert.deepEqual(ops, originalOps);
    });
  });
});

describe('getTextAndMentionsFromOps', () => {
  describe('given only text', () => {
    it('returns only text trimmed', () => {
      const ops = [{ insert: ' The ' }, { insert: ' text \n' }];
      const [resultText, resultMentions] = getTextAndMentionsFromOps(ops);
      assert.equal(resultText, 'The  text');
      assert.equal(resultMentions.length, 0);
    });

    it('returns trimmed of trailing newlines', () => {
      const ops = [{ insert: ' The\ntext\n\n\n' }];
      const [resultText, resultMentions] = getTextAndMentionsFromOps(ops);
      assert.equal(resultText, 'The\ntext');
      assert.equal(resultMentions.length, 0);
    });
  });

  describe('given text, emoji, and mentions', () => {
    it('returns the trimmed text with placeholders and mentions', () => {
      const ops = [
        {
          insert: {
            emoji: '😂',
          },
        },
        {
          insert: ' wow, funny, ',
        },
        {
          insert: {
            mention: {
              uuid: 'abcdef',
              title: '@fred',
            },
          },
        },
      ];
      const [resultText, resultMentions] = getTextAndMentionsFromOps(ops);
      assert.equal(resultText, '😂 wow, funny, \uFFFC');
      assert.deepEqual(resultMentions, [
        {
          length: 1,
          mentionUuid: 'abcdef',
          replacementText: '@fred',
          start: 15,
        },
      ]);
    });
  });

  describe('given only mentions', () => {
    it('returns the trimmed text with placeholders and mentions', () => {
      const ops = [
        {
          insert: {
            mention: {
              uuid: 'abcdef',
              title: '@fred',
            },
          },
        },
      ];
      const [resultText, resultMentions] = getTextAndMentionsFromOps(ops);
      assert.equal(resultText, '\uFFFC');
      assert.deepEqual(resultMentions, [
        {
          length: 1,
          mentionUuid: 'abcdef',
          replacementText: '@fred',
          start: 0,
        },
      ]);
    });

    it('does not trim newlines padding mentions', () => {
      const ops = [
        { insert: 'test \n' },
        {
          insert: {
            mention: {
              uuid: 'abcdef',
              title: '@fred',
            },
          },
        },
        { insert: '\n test' },
      ];
      const [resultText, resultMentions] = getTextAndMentionsFromOps(ops);
      assert.equal(resultText, 'test \n\uFFFC\n test');
      assert.deepEqual(resultMentions, [
        {
          length: 1,
          mentionUuid: 'abcdef',
          replacementText: '@fred',
          start: 6,
        },
      ]);
    });
  });
});

describe('getDeltaToRestartMention', () => {
  describe('given text and emoji', () => {
    it('returns the correct retains, a delete, and an @', () => {
      const originalOps = [
        {
          insert: {
            emoji: '😂',
          },
        },
        {
          insert: {
            mention: {
              uuid: 'ghijkl',
              title: '@sam',
            },
          },
        },
        {
          insert: ' wow, funny, ',
        },
        {
          insert: {
            mention: {
              uuid: 'abcdef',
              title: '@fred',
            },
          },
        },
      ];

      const { ops } = getDeltaToRestartMention(originalOps);

      assert.deepEqual(ops, [
        {
          retain: 1,
        },
        {
          retain: 1,
        },
        {
          retain: 13,
        },
        {
          retain: 1,
        },
        {
          delete: 1,
        },
        {
          insert: '@',
        },
      ]);
    });
  });
});
