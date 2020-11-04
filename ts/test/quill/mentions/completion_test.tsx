// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { expect } from 'chai';
import sinon from 'sinon';

import { MutableRefObject } from 'react';
import {
  MentionCompletion,
  MentionCompletionOptions,
} from '../../../quill/mentions/completion';
import { ConversationType } from '../../../state/ducks/conversations';
import { MemberRepository } from '../../../quill/memberRepository';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalAsAny = global as any;

const me: ConversationType = {
  id: '666777',
  uuid: 'pqrstuv',
  title: 'Fred Savage',
  firstName: 'Fred',
  profileName: 'Fred S.',
  type: 'direct',
  lastUpdated: Date.now(),
  markedUnread: false,
};

const members: Array<ConversationType> = [
  {
    id: '555444',
    uuid: 'abcdefg',
    title: 'Mahershala Ali',
    firstName: 'Mahershala',
    profileName: 'Mahershala A.',
    type: 'direct',
    lastUpdated: Date.now(),
    markedUnread: false,
  },
  {
    id: '333222',
    uuid: 'hijklmno',
    title: 'Shia LaBeouf',
    firstName: 'Shia',
    profileName: 'Shia L.',
    type: 'direct',
    lastUpdated: Date.now(),
    markedUnread: false,
  },
  me,
];

describe('mentionCompletion', () => {
  let mentionCompletion: MentionCompletion;
  const mockSetMentionPickerElement = sinon.spy();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQuill: any;

  beforeEach(function beforeEach() {
    this.oldDocument = globalAsAny.document;
    globalAsAny.document = {
      body: {
        appendChild: () => null,
      },
      createElement: () => null,
    };

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

    const memberRepositoryRef: MutableRefObject<MemberRepository> = {
      current: new MemberRepository(members),
    };

    const options: MentionCompletionOptions = {
      i18n: sinon.stub(),
      me,
      memberRepositoryRef,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMentionPickerElement: mockSetMentionPickerElement as any,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mentionCompletion = new MentionCompletion(mockQuill as any, options);

    // Stub rendering to avoid missing DOM until we bring in Enzyme
    mentionCompletion.render = sinon.stub();
  });

  afterEach(function afterEach() {
    mockSetMentionPickerElement.resetHistory();
    (mentionCompletion.render as sinon.SinonStub).resetHistory();

    if (this.oldDocument === undefined) {
      delete globalAsAny.document;
    } else {
      globalAsAny.document = this.oldDocument;
    }
  });

  describe('getCurrentLeafTextPartitions', () => {
    it('returns left and right text', () => {
      mockQuill.getSelection.returns({ index: 0, length: 0 });
      const blot = {
        text: '@shia',
      };
      mockQuill.getLeaf.returns([blot, 3]);
      const [
        leftLeafText,
        rightLeafText,
      ] = mentionCompletion.getCurrentLeafTextPartitions();
      expect(leftLeafText).to.equal('@sh');
      expect(rightLeafText).to.equal('ia');
    });
  });

  describe('onTextChange', () => {
    let insertMentionStub: sinon.SinonStub<
      [ConversationType, number, number, (boolean | undefined)?],
      void
    >;

    beforeEach(function beforeEach() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mentionCompletion.results = [{ title: 'Mahershala Ali' } as any];
      mentionCompletion.index = 5;
      insertMentionStub = sinon
        .stub(mentionCompletion, 'insertMention')
        .callThrough();
    });

    afterEach(function afterEach() {
      insertMentionStub.restore();
    });

    describe('given a mention is not starting (no @)', () => {
      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index: 3,
          length: 0,
        });

        const blot = {
          text: 'smi',
        };
        mockQuill.getLeaf.returns([blot, 3]);

        mentionCompletion.onTextChange();
      });

      it('resets the completion', () => {
        expect(mentionCompletion.results).to.have.lengthOf(0);
        expect(mentionCompletion.index).to.equal(0);
      });
    });

    describe('given an mention is starting but does not match a member', () => {
      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index: 4,
          length: 0,
        });

        const blot = {
          text: '@nope',
        };
        mockQuill.getLeaf.returns([blot, 5]);

        mentionCompletion.onTextChange();
      });

      it('resets the completion', () => {
        expect(mentionCompletion.results).to.have.lengthOf(0);
        expect(mentionCompletion.index).to.equal(0);
      });
    });

    describe('given an mention is started without text', () => {
      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index: 4,
          length: 0,
        });

        const blot = {
          text: '@',
        };
        mockQuill.getLeaf.returns([blot, 2]);

        mentionCompletion.onTextChange();
      });

      it('stores all results, omitting `me`, and renders', () => {
        expect(mentionCompletion.results).to.have.lengthOf(2);
        expect((mentionCompletion.render as sinon.SinonStub).called).to.equal(
          true
        );
      });
    });

    describe('given a mention is started and matches members', () => {
      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index: 4,
          length: 0,
        });

        const blot = {
          text: '@sh',
        };
        mockQuill.getLeaf.returns([blot, 3]);

        mentionCompletion.onTextChange();
      });

      it('stores the results, omitting `me`, and renders', () => {
        expect(mentionCompletion.results).to.have.lengthOf(1);
        expect((mentionCompletion.render as sinon.SinonStub).called).to.equal(
          true
        );
      });
    });
  });

  describe('completeMention', () => {
    let insertMentionStub: sinon.SinonStub<
      [ConversationType, number, number, (boolean | undefined)?],
      void
    >;

    beforeEach(function beforeEach() {
      mentionCompletion.results = [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { title: 'Mahershala Ali' } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { title: 'Shia LaBeouf' } as any,
      ];
      mentionCompletion.index = 1;
      insertMentionStub = sinon.stub(mentionCompletion, 'insertMention');
    });

    describe('given a valid mention', () => {
      const text = '@sh';
      const index = text.length;

      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index,
          length: 0,
        });

        const blot = {
          text,
        };
        mockQuill.getLeaf.returns([blot, index]);

        mentionCompletion.completeMention();
      });

      it('inserts the currently selected mention at the current cursor position', () => {
        const [mention, insertIndex, range] = insertMentionStub.args[0];

        expect(mention.title).to.equal('Shia LaBeouf');
        expect(insertIndex).to.equal(0);
        expect(range).to.equal(text.length);
      });
    });

    describe('given a valid mention starting with a capital letter', () => {
      const text = '@Sh';
      const index = text.length;

      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index,
          length: 0,
        });

        const blot = {
          text,
        };
        mockQuill.getLeaf.returns([blot, index]);

        mentionCompletion.completeMention();
      });

      it('inserts the currently selected mention at the current cursor position', () => {
        const [mention, insertIndex, range] = insertMentionStub.args[0];

        expect(mention.title).to.equal('Shia LaBeouf');
        expect(insertIndex).to.equal(0);
        expect(range).to.equal(text.length);
      });
    });

    describe('given a valid mention inside a string', () => {
      const text = 'foo @shia bar';
      const index = 9;

      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index,
          length: 0,
        });

        const blot = {
          text,
        };
        mockQuill.getLeaf.returns([blot, index]);

        mentionCompletion.completeMention();
      });

      it('inserts the currently selected mention at the current cursor position, replacing all mention text', () => {
        const [mention, insertIndex, range] = insertMentionStub.args[0];

        expect(mention.title).to.equal('Shia LaBeouf');
        expect(insertIndex).to.equal(4);
        expect(range).to.equal(5);
      });
    });

    describe('given a valid mention is not present', () => {
      const text = 'sh';
      const index = text.length;

      beforeEach(function beforeEach() {
        mockQuill.getSelection.returns({
          index,
          length: 0,
        });

        const blot = {
          text,
        };
        mockQuill.getLeaf.returns([blot, index]);

        mentionCompletion.completeMention();
      });

      it('does not insert anything', () => {
        expect(insertMentionStub.called).to.equal(false);
      });
    });
  });
});
