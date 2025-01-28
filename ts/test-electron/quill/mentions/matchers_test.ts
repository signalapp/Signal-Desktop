// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { RefObject } from 'react';
import { Delta } from '@signalapp/quill-cjs';

import type { AciString } from '../../../types/ServiceId';
import { generateAci } from '../../../types/ServiceId';
import { matchMention } from '../../../quill/mentions/matchers';
import { MemberRepository } from '../../../quill/memberRepository';
import type { ConversationType } from '../../../state/ducks/conversations';
import { getDefaultConversationWithServiceId } from '../../../test-both/helpers/getDefaultConversation';

const ACI_1 = generateAci();

class FakeTokenList<T> extends Array<T> {
  constructor(elements: Array<T>) {
    super();
    elements.forEach(element => this.push(element));
  }

  contains(searchElement: T) {
    return this.includes(searchElement);
  }
}

const createMockElement = (
  className: string,
  dataset: Record<string, string>
): HTMLElement =>
  ({
    classList: new FakeTokenList([className]),
    dataset,
  }) as unknown as HTMLElement;

const createMockAtMentionElement = (
  dataset: Record<string, string>
): HTMLElement => createMockElement('MessageBody__at-mention', dataset);

const createMockMentionBlotElement = (
  dataset: Record<string, string>
): HTMLElement => createMockElement('mention-blot', dataset);

const memberMahershala: ConversationType = getDefaultConversationWithServiceId({
  id: '555444',
  title: 'Mahershala Ali',
  firstName: 'Mahershala',
  profileName: 'Mahershala A.',
  type: 'direct',
  lastUpdated: Date.now(),
  markedUnread: false,
  areWeAdmin: false,
});

const memberShia: ConversationType = getDefaultConversationWithServiceId({
  id: '333222',
  title: 'Shia LaBeouf',
  firstName: 'Shia',
  profileName: 'Shia L.',
  type: 'direct',
  lastUpdated: Date.now(),
  markedUnread: false,
  areWeAdmin: false,
});

const members: Array<ConversationType> = [memberMahershala, memberShia];

const memberRepositoryRef: RefObject<MemberRepository> = {
  current: new MemberRepository(members),
};

const matcher = matchMention(memberRepositoryRef);

type Mention = {
  aci: AciString;
  title: string;
};

type MentionInsert = {
  mention: Mention;
};

const isMention = (insert?: unknown): insert is MentionInsert => {
  if (insert) {
    if (Object.getOwnPropertyNames(insert).includes('mention')) {
      return true;
    }
  }
  return false;
};

const EMPTY_DELTA = new Delta();

describe('matchMention', () => {
  it('handles an AtMentionify from clipboard', () => {
    const existingAttributes = { italic: true };
    const result = matcher(
      createMockAtMentionElement({
        id: memberMahershala.id,
        title: memberMahershala.title,
      }),
      EMPTY_DELTA,
      {},
      existingAttributes
    );
    const { ops } = result;

    assert.isNotEmpty(ops);

    const [op] = ops;
    const { insert, attributes } = op;

    if (isMention(insert)) {
      const { title, aci } = insert.mention;

      assert.equal(title, memberMahershala.title);
      assert.equal(aci, memberMahershala.serviceId);

      assert.deepEqual(existingAttributes, attributes, 'attributes');
    } else {
      assert.fail('insert is invalid');
    }
  });

  it('handles an MentionBlot from clipboard', () => {
    const result = matcher(
      createMockMentionBlotElement({
        aci: memberMahershala.serviceId || '',
        title: memberMahershala.title,
      }),
      EMPTY_DELTA,
      {},
      {}
    );
    const { ops } = result;

    assert.isNotEmpty(ops);

    const [op] = ops;
    const { insert } = op;

    if (isMention(insert)) {
      const { title, aci } = insert.mention;

      assert.equal(title, memberMahershala.title);
      assert.equal(aci, memberMahershala.serviceId);
    } else {
      assert.fail('insert is invalid');
    }
  });

  it('converts a missing AtMentionify to string', () => {
    const result = matcher(
      createMockAtMentionElement({
        id: 'florp',
        title: 'Nonexistent',
      }),
      EMPTY_DELTA,
      {},
      {}
    );
    const { ops } = result;

    assert.isNotEmpty(ops);

    const [op] = ops;
    const { insert } = op;

    if (isMention(insert)) {
      assert.fail('insert is invalid');
    } else {
      assert.equal(insert, '@Nonexistent');
    }
  });

  it('converts a missing MentionBlot to string', () => {
    const result = matcher(
      createMockMentionBlotElement({
        aci: ACI_1,
        title: 'Nonexistent',
      }),
      EMPTY_DELTA,
      {},
      {}
    );
    const { ops } = result;

    assert.isNotEmpty(ops);

    const [op] = ops;
    const { insert } = op;

    if (isMention(insert)) {
      assert.fail('insert is invalid');
    } else {
      assert.equal(insert, '@Nonexistent');
    }
  });

  it('passes other clipboard elements through', () => {
    const result = matcher(
      createMockElement('ignore', {}),
      EMPTY_DELTA,
      {},
      {}
    );
    assert.equal(result, EMPTY_DELTA);
  });
});
