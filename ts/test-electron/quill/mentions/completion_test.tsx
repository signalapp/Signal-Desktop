// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import Delta from 'quill-delta';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import type { Quill, KeyboardStatic } from 'quill';

import type { MutableRefObject } from 'react';
import type { MentionCompletionOptions } from '../../../quill/mentions/completion';
import { MentionCompletion } from '../../../quill/mentions/completion';
import type { ConversationType } from '../../../state/ducks/conversations';
import { MemberRepository } from '../../../quill/memberRepository';
import { ThemeType } from '../../../types/Util';
import { getDefaultConversationWithUuid } from '../../../test-both/helpers/getDefaultConversation';

const me: ConversationType = getDefaultConversationWithUuid({
  id: '666777',
  title: 'Fred Savage',
  firstName: 'Fred',
  profileName: 'Fred S.',
  type: 'direct',
  lastUpdated: Date.now(),
  markedUnread: false,
  areWeAdmin: false,
  isMe: true,
});

const members: Array<ConversationType> = [
  getDefaultConversationWithUuid({
    id: '555444',
    title: 'Mahershala Ali',
    firstName: 'Mahershala',
    profileName: 'Mahershala A.',
    type: 'direct',
    lastUpdated: Date.now(),
    markedUnread: false,
    areWeAdmin: false,
  }),
  getDefaultConversationWithUuid({
    id: '333222',
    title: 'Shia LaBeouf',
    firstName: 'Shia',
    profileName: 'Shia L.',
    type: 'direct',
    lastUpdated: Date.now(),
    markedUnread: false,
    areWeAdmin: false,
  }),
  me,
];

describe('MentionCompletion', () => {
  let mockQuill: Omit<
    Partial<{ [K in keyof Quill]: SinonStub }>,
    'keyboard'
  > & {
    keyboard: Partial<{ [K in keyof KeyboardStatic]: SinonStub }>;
  };
  let mentionCompletion: MentionCompletion;

  beforeEach(function beforeEach() {
    const memberRepositoryRef: MutableRefObject<MemberRepository> = {
      current: new MemberRepository(members),
    };

    const options: MentionCompletionOptions = {
      getPreferredBadge: () => undefined,
      i18n: Object.assign(sinon.stub(), { getLocale: sinon.stub() }),
      me,
      memberRepositoryRef,
      setMentionPickerElement: sinon.stub(),
      theme: ThemeType.dark,
    };

    mockQuill = {
      getContents: sinon.stub(),
      getLeaf: sinon.stub(),
      getSelection: sinon.stub(),
      keyboard: { addBinding: sinon.stub() },
      on: sinon.stub(),
      setSelection: sinon.stub(),
      updateContents: sinon.stub(),
    };

    mentionCompletion = new MentionCompletion(
      mockQuill as unknown as Quill,
      options
    );

    sinon.stub(mentionCompletion, 'render');
  });

  describe('onTextChange', () => {
    let possiblyShowMemberResultsStub: sinon.SinonStub<
      [],
      Array<ConversationType>
    >;

    beforeEach(() => {
      possiblyShowMemberResultsStub = sinon.stub(
        mentionCompletion,
        'possiblyShowMemberResults'
      );
    });

    describe('given a change that should show members', () => {
      const newContents = new Delta().insert('@a');

      beforeEach(() => {
        mockQuill.getContents?.returns(newContents);

        possiblyShowMemberResultsStub.returns(members);
      });

      it('shows member results', () => {
        mentionCompletion.onTextChange();

        assert.equal(mentionCompletion.results, members);
        assert.equal(mentionCompletion.index, 0);
      });
    });

    describe('given a change that should clear results', () => {
      const newContents = new Delta().insert('foo ');

      let clearResultsStub: SinonStub<[], void>;

      beforeEach(() => {
        mentionCompletion.results = members;

        mockQuill.getContents?.returns(newContents);

        possiblyShowMemberResultsStub.returns([]);

        clearResultsStub = sinon.stub(mentionCompletion, 'clearResults');
      });

      it('clears member results', () => {
        mentionCompletion.onTextChange();

        assert.equal(clearResultsStub.called, true);
      });
    });
  });

  describe('completeMention', () => {
    describe('given a completable mention', () => {
      let insertMentionStub: SinonStub<
        [ConversationType, number, number, (boolean | undefined)?],
        void
      >;

      beforeEach(() => {
        mentionCompletion.results = members;
        mockQuill.getSelection?.returns({ index: 5 });
        mockQuill.getLeaf?.returns([{ text: '@shia' }, 5]);

        insertMentionStub = sinon.stub(mentionCompletion, 'insertMention');
      });

      it('inserts the currently selected mention at the current cursor position', () => {
        mentionCompletion.completeMention(1);

        const [
          member,
          distanceFromCursor,
          adjustCursorAfterBy,
          withTrailingSpace,
        ] = insertMentionStub.getCall(0).args;

        assert.equal(member, members[1]);
        assert.equal(distanceFromCursor, 0);
        assert.equal(adjustCursorAfterBy, 5);
        assert.equal(withTrailingSpace, true);
      });

      it('can infer the member to complete with', () => {
        mentionCompletion.index = 1;
        mentionCompletion.completeMention();

        const [
          member,
          distanceFromCursor,
          adjustCursorAfterBy,
          withTrailingSpace,
        ] = insertMentionStub.getCall(0).args;

        assert.equal(member, members[1]);
        assert.equal(distanceFromCursor, 0);
        assert.equal(adjustCursorAfterBy, 5);
        assert.equal(withTrailingSpace, true);
      });

      describe('from the middle of a string', () => {
        beforeEach(() => {
          mockQuill.getSelection?.returns({ index: 9 });
          mockQuill.getLeaf?.returns([{ text: 'foo @shia bar' }, 9]);
        });

        it('inserts correctly', () => {
          mentionCompletion.completeMention(1);

          const [
            member,
            distanceFromCursor,
            adjustCursorAfterBy,
            withTrailingSpace,
          ] = insertMentionStub.getCall(0).args;

          assert.equal(member, members[1]);
          assert.equal(distanceFromCursor, 4);
          assert.equal(adjustCursorAfterBy, 5);
          assert.equal(withTrailingSpace, true);
        });
      });

      describe('given a completable mention starting with a capital letter', () => {
        const text = '@Sh';
        const index = text.length;

        beforeEach(function beforeEach() {
          mockQuill.getSelection?.returns({ index });

          const blot = {
            text,
          };
          mockQuill.getLeaf?.returns([blot, index]);

          mentionCompletion.completeMention(1);
        });

        it('inserts the currently selected mention at the current cursor position', () => {
          const [
            member,
            distanceFromCursor,
            adjustCursorAfterBy,
            withTrailingSpace,
          ] = insertMentionStub.getCall(0).args;

          assert.equal(member, members[1]);
          assert.equal(distanceFromCursor, 0);
          assert.equal(adjustCursorAfterBy, 3);
          assert.equal(withTrailingSpace, true);
        });
      });
    });
  });
});
