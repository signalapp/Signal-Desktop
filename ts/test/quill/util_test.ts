// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  MemberRepository,
  getDeltaToRemoveStaleMentions,
} from '../../quill/util';
import { ConversationType } from '../../state/ducks/conversations';

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
];

const singleMember: ConversationType = {
  id: '666777',
  uuid: 'pqrstuv',
  title: 'Fred Savage',
  firstName: 'Fred',
  profileName: 'Fred S.',
  type: 'direct',
  lastUpdated: Date.now(),
  markedUnread: false,
};

describe('MemberRepository', () => {
  describe('#updateMembers', () => {
    it('updates with given members', () => {
      const memberRepository = new MemberRepository(members);
      assert.deepEqual(memberRepository.getMembers(), members);

      const updatedMembers = [...members, singleMember];
      memberRepository.updateMembers(updatedMembers);
      assert.deepEqual(memberRepository.getMembers(), updatedMembers);
    });
  });

  describe('#getMemberById', () => {
    it('returns undefined when there is no search id', () => {
      const memberRepository = new MemberRepository(members);
      assert.isUndefined(memberRepository.getMemberById());
    });

    it('returns a matched member', () => {
      const memberRepository = new MemberRepository(members);
      assert.isDefined(memberRepository.getMemberById('555444'));
    });

    it('returns undefined when it does not have the member', () => {
      const memberRepository = new MemberRepository(members);
      assert.isUndefined(memberRepository.getMemberById('nope'));
    });
  });

  describe('#getMemberByUuid', () => {
    it('returns undefined when there is no search uuid', () => {
      const memberRepository = new MemberRepository(members);
      assert.isUndefined(memberRepository.getMemberByUuid());
    });

    it('returns a matched member', () => {
      const memberRepository = new MemberRepository(members);
      assert.isDefined(memberRepository.getMemberByUuid('abcdefg'));
    });

    it('returns undefined when it does not have the member', () => {
      const memberRepository = new MemberRepository(members);
      assert.isUndefined(memberRepository.getMemberByUuid('nope'));
    });
  });
});

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
