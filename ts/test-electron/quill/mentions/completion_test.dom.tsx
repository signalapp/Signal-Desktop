// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Delta } from '@signalapp/quill-cjs';
import Emitter from '@signalapp/quill-cjs/core/emitter.js';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import type Quill from '@signalapp/quill-cjs';
import type Keyboard from '@signalapp/quill-cjs/modules/keyboard.js';

import type { MutableRefObject } from 'react';
import type { MentionCompletionOptions } from '../../../quill/mentions/completion.dom.tsx';
import { MentionCompletion } from '../../../quill/mentions/completion.dom.tsx';
import type { ConversationType } from '../../../state/ducks/conversations.preload.ts';
import {
  MemberRepository,
  _toMembers,
} from '../../../quill/memberRepository.std.ts';
import type { MemberType } from '../../../quill/memberRepository.std.ts';
import { ThemeType } from '../../../types/Util.std.ts';
import { getDefaultConversationWithServiceId } from '../../../test-helpers/getDefaultConversation.std.ts';
import { setupI18n } from '../../../util/setupI18n.dom.tsx';

type MiniLeafBlot = {
  value: () => string;
};

const me: ConversationType = getDefaultConversationWithServiceId({
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

const conversations: Array<ConversationType> = [
  getDefaultConversationWithServiceId({
    id: '555444',
    title: 'Mahershala Ali',
    firstName: 'Mahershala',
    profileName: 'Mahershala A.',
    type: 'direct',
    lastUpdated: Date.now(),
    markedUnread: false,
    areWeAdmin: false,
  }),
  getDefaultConversationWithServiceId({
    id: '333222',
    title: 'Shia LaBeouf',
    firstName: 'Shia',
    profileName: 'Shia L.',
    type: 'direct',
    lastUpdated: Date.now(),
    markedUnread: false,
    areWeAdmin: false,
  }),
  getDefaultConversationWithServiceId({
    areWeAdmin: false,
    firstName: 'Zoë',
    id: '999977',
    lastUpdated: Date.now(),
    markedUnread: false,
    profileName: 'Zoë A',
    title: 'Zoë Aurélien',
    type: 'direct',
  }),
  me,
  getDefaultConversationWithServiceId({
    areWeAdmin: false,
    firstName: '길동',
    id: '888111',
    lastUpdated: Date.now(),
    markedUnread: false,
    profileName: '홍길동',
    title: '홍길동',
    type: 'direct',
  }),
];

const members = _toMembers(conversations);

describe('MentionCompletion', () => {
  let mockQuill: Omit<
    Partial<{ [K in keyof Quill]: SinonStub }>,
    'keyboard' | 'root'
  > & {
    keyboard: Partial<{ [K in keyof Keyboard]: SinonStub }>;
    root: HTMLDivElement;
  };
  let mentionCompletion: MentionCompletion;

  beforeEach(() => {
    const memberRepositoryRef: MutableRefObject<MemberRepository> = {
      current: new MemberRepository(conversations),
    };

    const options: MentionCompletionOptions = {
      getPreferredBadge: () => undefined,
      i18n: setupI18n('en', {}),
      ourConversationId: me.id,
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
      root: document.createElement('div'),
      setSelection: sinon.stub(),
      updateContents: sinon.stub(),
    };

    mentionCompletion = new MentionCompletion(
      mockQuill as unknown as Quill,
      options
    );

    sinon.stub(mentionCompletion, 'render');
  });

  afterEach(() => {
    mentionCompletion.destroy();
    mockQuill.root.remove();
  });

  describe('onSelectionChange', () => {
    function emitQuillEvent(event: string) {
      const call = mockQuill.on
        ?.getCalls()
        .find(({ args }) => args[0] === event);
      assert.exists(call, `no handler for ${event}`);
      call?.args[1]();
    }

    beforeEach(() => {
      mentionCompletion.results = members;
    });

    it('clears results when the selection changes', () => {
      mentionCompletion.onSelectionChange();

      assert.isEmpty(mentionCompletion.results);
    });

    it('keeps results when the selection changes as a composition ends', () => {
      emitQuillEvent(Emitter.events.COMPOSITION_BEFORE_END);
      mentionCompletion.onSelectionChange();

      assert.equal(mentionCompletion.results, members);

      emitQuillEvent(Emitter.events.COMPOSITION_END);
      mentionCompletion.onSelectionChange();

      assert.isEmpty(mentionCompletion.results);
    });
  });

  describe('onCompositionInput', () => {
    const getTitles = () =>
      mentionCompletion.results.map(member => member.title);

    function compose(text: string, data: string, isComposing = true) {
      const textNode = document.createTextNode(text);
      mockQuill.root.replaceChildren(textNode);
      document.body.appendChild(mockQuill.root);
      window.getSelection()?.collapse(textNode, text.length);

      mockQuill.root.dispatchEvent(
        new InputEvent('input', { data, isComposing })
      );
    }

    it('shows matching members while composing', () => {
      compose('@홍', '홍');

      assert.deepEqual(getTitles(), ['홍길동']);
    });

    it('updates results as composition continues', () => {
      compose('@홍길', '길');

      assert.deepEqual(getTitles(), ['홍길동']);
    });

    it('falls back to the committed query for an incomplete character', () => {
      compose('@ㅎ', 'ㅎ');

      assert.include(getTitles(), '홍길동');
      assert.isAbove(mentionCompletion.results.length, 1);
    });

    it('clears results when not composing a mention', () => {
      mentionCompletion.results = members;

      compose('홍', '홍');

      assert.isEmpty(mentionCompletion.results);
    });

    it('ignores input events outside of composition', () => {
      compose('@홍', '홍', false);

      assert.isEmpty(mentionCompletion.results);
    });
  });

  describe('onTextChange', () => {
    let possiblyShowMemberResultsStub: sinon.SinonStub<
      [],
      ReadonlyArray<MemberType>
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
        [MemberType, number, number, (boolean | undefined)?],
        void
      >;

      beforeEach(() => {
        mentionCompletion.results = members;
        mockQuill.getSelection?.returns({ index: 5 });
        const blot: MiniLeafBlot = {
          value: () => '@shia',
        };
        mockQuill.getLeaf?.returns([blot, 5]);

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
          const blot: MiniLeafBlot = {
            value: () => 'foo @shia bar',
          };
          mockQuill.getLeaf?.returns([blot, 9]);
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

        beforeEach(() => {
          mockQuill.getSelection?.returns({ index });

          const blot: MiniLeafBlot = {
            value: () => text,
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

      describe('diacritics', () => {
        it('finds a member with diacritics using non-diacritic chars', () => {
          const text = '@zoe';
          const index = text.length;
          mockQuill.getSelection?.returns({ index });
          const blot: MiniLeafBlot = {
            value: () => text,
          };
          mockQuill.getLeaf?.returns([blot, index]);
          mentionCompletion.completeMention(2);

          const [member] = insertMentionStub.getCall(0).args;

          assert.equal(member, members[2]);
        });
      });
    });
  });
});
