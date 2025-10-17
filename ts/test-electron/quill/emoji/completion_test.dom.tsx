// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import sinon from 'sinon';

import { EmojiCompletion } from '../../../quill/emoji/completion.dom.js';
import type {
  EmojiCompletionOptions,
  InsertEmojiOptionsType,
} from '../../../quill/emoji/completion.dom.js';
import {
  EMOJI_VARIANT_KEY_CONSTANTS,
  EmojiSkinTone,
  getEmojiParentKeyByVariantKey,
  getEmojiVariantByKey,
} from '../../../components/fun/data/emojis.std.js';
import {
  _createFunEmojiSearch,
  createFunEmojiSearchIndex,
} from '../../../components/fun/useFunEmojiSearch.dom.js';
import {
  _createFunEmojiLocalizer,
  createFunEmojiLocalizerIndex,
} from '../../../components/fun/useFunEmojiLocalizer.dom.js';
import type { LocaleEmojiListType } from '../../../types/emoji.std.js';

const EMOJI_VARIANTS = {
  SMILE: getEmojiVariantByKey(
    EMOJI_VARIANT_KEY_CONSTANTS.GRINNING_FACE_WITH_SMILING_EYES
  ),
  SMILE_CAT: getEmojiVariantByKey(
    EMOJI_VARIANT_KEY_CONSTANTS.GRINNING_CAT_WITH_SMILING_EYES
  ),
  FRIEND_SHRIMP: getEmojiVariantByKey(EMOJI_VARIANT_KEY_CONSTANTS.FRIED_SHRIMP),
} as const;

const PARENT_KEYS = {
  SMILE: getEmojiParentKeyByVariantKey(EMOJI_VARIANTS.SMILE.key),
  SMILE_CAT: getEmojiParentKeyByVariantKey(EMOJI_VARIANTS.SMILE_CAT.key),
  FRIED_SHRIMP: getEmojiParentKeyByVariantKey(EMOJI_VARIANTS.FRIEND_SHRIMP.key),
} as const;

const EMOJI_LIST: LocaleEmojiListType = [
  {
    emoji: EMOJI_VARIANTS.SMILE.value,
    shortName: 'smile',
    tags: [],
    rank: 0,
  },
  {
    emoji: EMOJI_VARIANTS.SMILE_CAT.value,
    shortName: 'smile_cat',
    tags: [],
    rank: 0,
  },
  {
    emoji: EMOJI_VARIANTS.FRIEND_SHRIMP.value,
    shortName: 'fried_shrimp',
    tags: [],
    rank: 0,
  },
];

describe('emojiCompletion', () => {
  let emojiCompletion: EmojiCompletion;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQuill: any;

  beforeEach(function (this: Mocha.Context) {
    mockQuill = {
      getLeaf: sinon.stub(),
      getText: sinon.stub(),
      getSelection: sinon.stub(),
      keyboard: {
        addBinding: sinon.stub(),
      },
      on: sinon.stub(),
      setSelection: sinon.stub(),
      updateContents: sinon.stub(),
    };

    const searchIndex = createFunEmojiSearchIndex(EMOJI_LIST);
    const localizerIndex = createFunEmojiLocalizerIndex(EMOJI_LIST);

    const emojiSearch = _createFunEmojiSearch(searchIndex);
    const emojiLocalizer = _createFunEmojiLocalizer(localizerIndex);

    const options: EmojiCompletionOptions = {
      onSelectEmoji: sinon.stub(),
      setEmojiPickerElement: sinon.stub(),
      emojiSkinToneDefault: EmojiSkinTone.None,
      emojiSearch,
      emojiLocalizer,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emojiCompletion = new EmojiCompletion(mockQuill as any, options);

    // Stub rendering to avoid missing DOM until we bring in Enzyme
    emojiCompletion.render = sinon.stub();
  });

  describe('getCurrentLeafTextPartitions', () => {
    it('returns left and right text', () => {
      mockQuill.getSelection.returns({ index: 0, length: 0 });
      const blot = {
        value: () => ':smile:',
      };
      mockQuill.getLeaf.returns([blot, 2]);
      const [leftLeafText, rightLeafText] =
        emojiCompletion.getCurrentLeafTextPartitions();
      assert.equal(leftLeafText, ':s');
      assert.equal(rightLeafText, 'mile:');
    });
  });

  describe('onTextChange', () => {
    let insertEmojiStub: sinon.SinonStub<[InsertEmojiOptionsType], void>;

    beforeEach(() => {
      emojiCompletion.results = [{ parentKey: PARENT_KEYS.SMILE }];
      emojiCompletion.index = 5;
      insertEmojiStub = sinon
        .stub(emojiCompletion, 'insertEmoji')
        .callThrough();
    });

    afterEach(() => {
      insertEmojiStub.restore();
    });

    describe('given an emoji is not starting (no colon)', () => {
      beforeEach(() => {
        mockQuill.getSelection.returns({
          index: 3,
          length: 0,
        });

        const blot = {
          value: () => 'smi',
        };
        mockQuill.getLeaf.returns([blot, 3]);

        emojiCompletion.onTextChange();
      });

      it('does not show results', () => {
        assert.equal(emojiCompletion.results.length, 0);
      });
    });

    describe('given a colon in a string (but not an emoji)', () => {
      beforeEach(() => {
        mockQuill.getSelection.returns({
          index: 5,
          length: 0,
        });

        const blot = {
          value: () => '10:30',
        };
        mockQuill.getLeaf.returns([blot, 5]);

        emojiCompletion.onTextChange();
      });

      it('does not show results', () => {
        assert.equal(emojiCompletion.results.length, 0);
      });
    });

    describe('given an emoji is starting but does not have 2 characters', () => {
      beforeEach(() => {
        mockQuill.getSelection.returns({
          index: 2,
          length: 0,
        });

        const blot = {
          value: () => ':s',
        };
        mockQuill.getLeaf.returns([blot, 2]);

        emojiCompletion.onTextChange();
      });

      it('does not show results', () => {
        assert.equal(emojiCompletion.results.length, 0);
      });
    });

    describe('given an emoji is starting but does not match a short name', () => {
      beforeEach(() => {
        mockQuill.getSelection.returns({
          index: 4,
          length: 0,
        });

        const blot = {
          value: () => ':smy',
        };
        mockQuill.getLeaf.returns([blot, 4]);

        emojiCompletion.onTextChange();
      });

      it('does not show results', () => {
        assert.equal(emojiCompletion.results.length, 0);
      });
    });

    describe('given an emoji is starting and matches short names', () => {
      beforeEach(() => {
        mockQuill.getSelection.returns({
          index: 4,
          length: 0,
        });

        const blot = {
          value: () => ':smi',
        };
        mockQuill.getLeaf.returns([blot, 4]);

        emojiCompletion.onTextChange();
      });

      it('stores the results and renders', () => {
        assert.equal(emojiCompletion.results.length, 2);
        assert.equal((emojiCompletion.render as sinon.SinonStub).called, true);
      });
    });

    describe('given an emoji was just completed', () => {
      beforeEach(() => {
        mockQuill.getSelection.returns({
          index: 7,
          length: 0,
        });
      });

      describe('and given it matches a short name', () => {
        const text = ':smile:';

        beforeEach(() => {
          const blot = {
            value: () => text,
          };
          mockQuill.getLeaf.returns([blot, 7]);

          emojiCompletion.onTextChange();
        });

        it('inserts the emoji at the current cursor position', () => {
          const [{ emojiParentKey, index, range }] = insertEmojiStub.args[0];

          assert.equal(emojiParentKey, PARENT_KEYS.SMILE);
          assert.equal(index, 0);
          assert.equal(range, 7);
        });

        it('does not show results', () => {
          assert.equal(emojiCompletion.results.length, 0);
        });
      });

      describe('and given it matches a short name inside a larger string', () => {
        const text = 'have a :smile: nice day';

        beforeEach(() => {
          const blot = {
            value: () => text,
          };
          mockQuill.getSelection.returns({
            index: 13,
            length: 0,
          });
          mockQuill.getLeaf.returns([blot, 13]);

          emojiCompletion.onTextChange();
        });

        it('inserts the emoji at the current cursor position', () => {
          const [{ emojiParentKey, index, range }] = insertEmojiStub.args[0];

          assert.equal(emojiParentKey, PARENT_KEYS.SMILE);
          assert.equal(index, 7);
          assert.equal(range, 7);
        });

        it('does not show results', () => {
          assert.equal(emojiCompletion.results.length, 0);
        });

        it('sets the quill selection to the right cursor position', () => {
          const [index, range] = mockQuill.setSelection.args[0];

          assert.equal(index, 8);
          assert.equal(range, 0);
        });
      });

      describe('and given it does not match a short name', () => {
        const text = ':smyle:';

        beforeEach(() => {
          const blot = {
            value: () => text,
          };
          mockQuill.getLeaf.returns([blot, 7]);

          emojiCompletion.onTextChange();
        });

        it('does not show results', () => {
          assert.equal(emojiCompletion.results.length, 0);
        });
      });
    });

    describe('given an emoji was just completed from inside the colons', () => {
      const validEmoji = ':smile:';
      const invalidEmoji = ':smyle:';
      const middleCursorIndex = validEmoji.length - 3;

      beforeEach(() => {
        mockQuill.getSelection.returns({
          index: middleCursorIndex,
          length: 0,
        });
      });

      describe('and given it matches a short name', () => {
        beforeEach(() => {
          const blot = {
            value: () => validEmoji,
          };
          mockQuill.getLeaf.returns([blot, middleCursorIndex]);

          emojiCompletion.onTextChange();
        });

        it('inserts the emoji at the current cursor position', () => {
          const [{ emojiParentKey, index, range }] = insertEmojiStub.args[0];

          assert.equal(emojiParentKey, PARENT_KEYS.SMILE);
          assert.equal(index, 0);
          assert.equal(range, validEmoji.length);
        });

        it('does not show results', () => {
          assert.equal(emojiCompletion.results.length, 0);
        });
      });

      describe('and given it does not match a short name', () => {
        beforeEach(() => {
          const blot = {
            value: () => invalidEmoji,
          };
          mockQuill.getLeaf.returns([blot, middleCursorIndex]);

          emojiCompletion.onTextChange();
        });

        it('does not show results', () => {
          assert.equal(emojiCompletion.results.length, 0);
        });
      });
    });

    describe('given a completeable emoji and colon was just pressed', () => {
      beforeEach(() => {
        mockQuill.getSelection.returns({
          index: 6,
          length: 0,
        });
      });

      describe('and given it matches a short name', () => {
        const text = ':smile';

        beforeEach(() => {
          const blot = {
            value: () => text,
          };
          mockQuill.getLeaf.returns([blot, 6]);

          emojiCompletion.onTextChange(true);
        });

        it('inserts the emoji at the current cursor position', () => {
          const [{ emojiParentKey, index, range }] = insertEmojiStub.args[0];

          assert.equal(emojiParentKey, PARENT_KEYS.SMILE);
          assert.equal(index, 0);
          assert.equal(range, 6);
        });

        it('does not show results', () => {
          assert.equal(emojiCompletion.results.length, 0);
        });
      });
    });
  });

  describe('completeEmoji', () => {
    let insertEmojiStub: sinon.SinonStub<[InsertEmojiOptionsType], void>;

    beforeEach(() => {
      emojiCompletion.results = [
        { parentKey: PARENT_KEYS.SMILE },
        { parentKey: PARENT_KEYS.SMILE_CAT },
      ];
      emojiCompletion.index = 1;
      insertEmojiStub = sinon.stub(emojiCompletion, 'insertEmoji');
    });

    describe('given a valid token', () => {
      const text = ':smi';
      const index = text.length;

      beforeEach(() => {
        mockQuill.getSelection.returns({
          index,
          length: 0,
        });

        const blot = {
          value: () => text,
        };
        mockQuill.getLeaf.returns([blot, index]);

        emojiCompletion.completeEmoji();
      });

      it('inserts the currently selected emoji at the current cursor position', () => {
        const [{ emojiParentKey, index: insertIndex, range }] =
          insertEmojiStub.args[0];

        assert.equal(emojiParentKey, PARENT_KEYS.SMILE_CAT);
        assert.equal(insertIndex, 0);
        assert.equal(range, text.length);
      });
    });

    describe('given a valid token is not present', () => {
      const text = 'smi';
      const index = text.length;

      beforeEach(() => {
        mockQuill.getSelection.returns({
          index,
          length: 0,
        });

        const blot = {
          value: () => text,
        };
        mockQuill.getLeaf.returns([blot, index]);

        emojiCompletion.completeEmoji();
      });

      it('does not insert anything', () => {
        assert.equal(insertEmojiStub.called, false);
      });
    });
  });
});
