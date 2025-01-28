// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import sinon from 'sinon';

import { EmojiCompletion } from '../../../quill/emoji/completion';
import type { InsertEmojiOptionsType } from '../../../quill/emoji/completion';
import { createSearch } from '../../../components/emoji/lib';

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
    const options = {
      onPickEmoji: sinon.stub(),
      setEmojiPickerElement: sinon.stub(),
      skinTone: 0,
      search: createSearch([
        { shortName: 'smile', tags: [], rank: 0 },
        { shortName: 'smile_cat', tags: [], rank: 0 },
      ]),
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
      emojiCompletion.results = ['joy'];
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
        assert.equal(emojiCompletion.results.length, 10);
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
          const [{ shortName, index, range }] = insertEmojiStub.args[0];

          assert.equal(shortName, 'smile');
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
          const [{ shortName, index, range }] = insertEmojiStub.args[0];

          assert.equal(shortName, 'smile');
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
          const [{ shortName, index, range }] = insertEmojiStub.args[0];

          assert.equal(shortName, 'smile');
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
          const [{ shortName, index, range }] = insertEmojiStub.args[0];

          assert.equal(shortName, 'smile');
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
      emojiCompletion.results = ['smile', 'smile_cat'];
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
        const [{ shortName, index: insertIndex, range }] =
          insertEmojiStub.args[0];

        assert.equal(shortName, 'smile_cat');
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
