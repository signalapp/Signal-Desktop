// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { ConversationType } from '../../state/ducks/conversations';
import { MemberRepository } from '../../quill/memberRepository';
import { getDefaultConversationWithUuid } from '../../test-both/helpers/getDefaultConversation';

const memberMahershala: ConversationType = getDefaultConversationWithUuid({
  id: '555444',
  title: 'Pal',
  firstName: 'Mahershala',
  profileName: 'Mr Ali',
  name: 'Friend',
  type: 'direct',
  lastUpdated: Date.now(),
  markedUnread: false,
  areWeAdmin: false,
});

const memberShia: ConversationType = getDefaultConversationWithUuid({
  id: '333222',
  title: 'Buddy',
  firstName: 'Shia',
  profileName: 'Sr LaBeouf',
  name: 'Duder',
  type: 'direct',
  lastUpdated: Date.now(),
  markedUnread: false,
  areWeAdmin: false,
});

const members: Array<ConversationType> = [memberMahershala, memberShia];

const singleMember: ConversationType = getDefaultConversationWithUuid({
  id: '666777',
  title: 'The Guy',
  firstName: 'Jeff',
  profileName: 'Jr Klaus',
  name: 'Him',
  type: 'direct',
  lastUpdated: Date.now(),
  markedUnread: false,
  areWeAdmin: false,
});

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
      assert.isDefined(memberRepository.getMemberByUuid(memberMahershala.uuid));
    });

    it('returns undefined when it does not have the member', () => {
      const memberRepository = new MemberRepository(members);
      assert.isUndefined(memberRepository.getMemberByUuid('nope'));
    });
  });

  describe('#search', () => {
    describe('given a prefix-matching string on last name', () => {
      it('returns the match', () => {
        const memberRepository = new MemberRepository(members);
        const results = memberRepository.search('a');
        assert.deepEqual(results, [memberMahershala]);
      });
    });

    describe('given a prefix-matching string on first name', () => {
      it('returns the match', () => {
        const memberRepository = new MemberRepository(members);
        const results = memberRepository.search('ma');
        assert.deepEqual(results, [memberMahershala]);
      });
    });

    describe('given a prefix-matching string on profile name', () => {
      it('returns the match', () => {
        const memberRepository = new MemberRepository(members);
        const results = memberRepository.search('sr');
        assert.deepEqual(results, [memberShia]);
      });
    });

    describe('given a prefix-matching string on name', () => {
      it('returns the match', () => {
        const memberRepository = new MemberRepository(members);
        const results = memberRepository.search('dude');
        assert.deepEqual(results, [memberShia]);
      });
    });

    describe('given a prefix-matching string on title', () => {
      it('returns the match', () => {
        const memberRepository = new MemberRepository(members);
        const results = memberRepository.search('bud');
        assert.deepEqual(results, [memberShia]);
      });

      it('handles titles with Unicode bidi characters, which some contacts have', () => {
        const memberShiaBidi: ConversationType = {
          ...memberShia,
          title: '\u2086Buddyo\u2069',
        };
        const memberRepository = new MemberRepository([
          memberMahershala,
          memberShiaBidi,
        ]);
        const results = memberRepository.search('bud');
        assert.deepEqual(results, [memberShiaBidi]);
      });
    });

    describe('given a match in the middle of a name', () => {
      it('returns zero matches', () => {
        const memberRepository = new MemberRepository(members);
        const results = memberRepository.search('e');
        assert.deepEqual(results, []);
      });
    });
  });
});
