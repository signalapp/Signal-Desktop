// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { ConversationDiffer } from '../../externalClient/conversationDiff.std.ts';
import type { ConversationSourceType } from '../../externalClient/conversationDto.std.ts';

function conversation(
  id: string,
  overrides: Partial<ConversationSourceType> = {}
): ConversationSourceType {
  return {
    id,
    type: 'direct',
    title: id,
    activeAt: 100,
    isMe: false,
    acceptedMessageRequest: true,
    ...overrides,
  };
}

describe('externalClient/conversationDiff', () => {
  it('reports nothing for the baseline or an unchanged lookup', () => {
    const differ = new ConversationDiffer();
    const lookup = { a: conversation('a') };
    differ.reset(lookup);
    assert.deepEqual(differ.diff(lookup), []);
    assert.deepEqual(differ.diff({ ...lookup }), []);
  });

  it('reports visible changes as updates', () => {
    const differ = new ConversationDiffer();
    const a = conversation('a');
    differ.reset({ a });
    const changes = differ.diff({ a: { ...a, unreadCount: 2 } });
    assert.strictEqual(changes.length, 1);
    const [change] = changes;
    assert.strictEqual(change?.type, 'updated');
    assert.strictEqual(
      change?.type === 'updated' ? change.conversation.unreadCount : null,
      2
    );
  });

  it('ignores changes clients cannot see', () => {
    const differ = new ConversationDiffer();
    const a = conversation('a');
    differ.reset({ a });
    const internal = { ...a, e164: '+15555550100' } as ConversationSourceType;
    assert.deepEqual(differ.diff({ a: internal }), []);
  });

  it('reports a conversation that becomes listed', () => {
    const differ = new ConversationDiffer();
    const hidden = conversation('a', { activeAt: undefined });
    differ.reset({ a: hidden });
    const changes = differ.diff({ a: { ...hidden, activeAt: 200 } });
    assert.deepEqual(
      changes.map(c => c.type),
      ['updated']
    );
  });

  it('reports removal when a conversation is unlisted or deleted', () => {
    const differ = new ConversationDiffer();
    const a = conversation('a');
    const b = conversation('b');
    differ.reset({ a, b });
    assert.deepEqual(differ.diff({ a: { ...a, activeAt: undefined }, b }), [
      { type: 'removed', conversationId: 'a' },
    ]);
    assert.deepEqual(differ.diff({}), [
      { type: 'removed', conversationId: 'b' },
    ]);
  });

  it('never reports a conversation clients were not told about', () => {
    const differ = new ConversationDiffer();
    const hidden = conversation('a', { activeAt: undefined });
    differ.reset({ a: hidden });
    assert.deepEqual(differ.diff({ a: { ...hidden, title: 'x' } }), []);
    assert.deepEqual(differ.diff({}), []);
  });
});
