// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import Delta from 'quill-delta';
import sinon from 'sinon';

import { convertShortName, EmojiData } from '../../components/emoji/lib';
import { AutoSubstituteAsciiEmojis } from '../../quill/auto-substitute-ascii-emojis';

describe('autoSubstituteAsciiEmojis', () => {
  let emojiSubstitution: AutoSubstituteAsciiEmojis;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQuill: any;
  let options: any;

  beforeEach(function beforeEach() {
    mockQuill = {
      getLeaf: sinon.stub(),
      getSelection: sinon.stub(),
      keyboard: {
        addBinding: sinon.stub(),
      },
      on: sinon.stub(),
      setSelection: sinon.stub(),
      updateContents: sinon.stub(),
    };
    options = {
      skinTone: 0,
    };

    window.Events = {
      getAutoSubstituteAsciiEmojis: () => true,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emojiSubstitution = new AutoSubstituteAsciiEmojis(
      mockQuill as any,
      options
    );
  });

  describe('onTextChange', () => {
    let insertEmojiStub: sinon.SinonStub<[EmojiData, number, number], void>;

    beforeEach(function beforeEach() {
      insertEmojiStub = sinon
        .stub(emojiSubstitution, 'insertEmoji')
        .callThrough();
    });

    afterEach(function afterEach() {
      insertEmojiStub.restore();
    });

    describe('given there is no valid ascii emoji', () => {
      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index: 2,
          length: 0,
        });

        const blot = {
          text: '-)',
        };
        mockQuill.getLeaf.returns([blot, 2]);

        emojiSubstitution.onTextChange();
      });

      it('does not substitute with emoji', () => {
        assert.equal(insertEmojiStub.notCalled, true);
      });
    });

    describe('given a colon in a string (but not an emoji)', () => {
      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index: 5,
          length: 0,
        });

        const blot = {
          text: '10:Z)',
        };
        mockQuill.getLeaf.returns([blot, 5]);

        emojiSubstitution.onTextChange();
      });

      it('does not substitute', () => {
        assert.equal(insertEmojiStub.notCalled, true);
      });
    });

    describe('given an emoji is starting but does not have 3 characters', () => {
      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index: 2,
          length: 0,
        });

        const blot = {
          text: ':-',
        };
        mockQuill.getLeaf.returns([blot, 2]);

        emojiSubstitution.onTextChange();
      });

      it('does not substitute', () => {
        assert.equal(insertEmojiStub.notCalled, true);
      });
    });

    describe('given an emoji is starting but does not match a known ascii emoji', () => {
      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index: 3,
          length: 0,
        });

        const blot = {
          text: ':-Q',
        };
        mockQuill.getLeaf.returns([blot, 3]);

        emojiSubstitution.onTextChange();
      });

      it('does not substitute', () => {
        assert.equal(insertEmojiStub.notCalled, true);
      });
    });

    describe('given a entered text matches a known 3-char ascii emoji', () => {
      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index: 3,
          length: 0,
        });

        const blot = {
          text: ':-)',
        };
        mockQuill.getLeaf.returns([blot, 3]);

        emojiSubstitution.onTextChange();
      });

      it('replaces the ascii-text with the emoji', () => {
        assert.equal(insertEmojiStub.called, true);
        const emoji = convertShortName(
          'slightly_smiling_face',
          options.skinTone
        );
        const delta = new Delta().delete(3).insert({ emoji });
        sinon.assert.calledOnceWithMatch(mockQuill.updateContents, delta);
      });
    });

    describe('given a entered text matches a known 2-char ascii emoji', () => {
      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index: 2,
          length: 0,
        });

        const blot = {
          text: ':)',
        };
        mockQuill.getLeaf.returns([blot, 2]);

        emojiSubstitution.onTextChange();
      });

      it('replaces the ascii-text with the emoji', () => {
        assert.equal(insertEmojiStub.called, true);
        const emoji = convertShortName(
          'slightly_smiling_face',
          options.skinTone
        );
        const delta = new Delta().delete(2).insert({ emoji });
        sinon.assert.calledOnceWithMatch(mockQuill.updateContents, delta);
      });
    });

    describe('given it matches a ascii emoji inside a larger string', () => {
      beforeEach(function beforeEach() {
        const blot = {
          text: ':-)',
        };
        mockQuill.getSelection.returns({
          index: 10,
          length: 0,
        });
        mockQuill.getLeaf.returns([blot, 3]);

        emojiSubstitution.onTextChange();
      });

      it('inserts the emoji at the current cursor position', () => {
        assert.equal(insertEmojiStub.called, true);
        const emoji = convertShortName(
          'slightly_smiling_face',
          options.skinTone
        );
        const delta = new Delta().retain(7).delete(3).insert({ emoji });
        sinon.assert.calledOnceWithMatch(mockQuill.updateContents, delta);
      });

      it('sets the quill selection to the right cursor position', () => {
        sinon.assert.calledOnceWithMatch(mockQuill.setSelection, 8, 0);
      });
    });
  });
});
