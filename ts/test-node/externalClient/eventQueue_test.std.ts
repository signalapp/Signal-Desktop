// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { EventQueue } from '../../externalClient/eventQueue.std.ts';
import { SentPayloadCache } from '../../externalClient/sentPayloadCache.std.ts';

describe('externalClient/eventQueue', () => {
  it('keeps one event per object, the newest', () => {
    const queue = new EventQueue<number>(10);
    queue.push('m:1', 'message.updated', 1);
    queue.push('m:2', 'message.updated', 2);
    queue.push('m:1', 'message.updated', 3);
    assert.deepEqual(queue.take(10), [
      { key: 'm:2', event: 'message.updated', data: 2 },
      { key: 'm:1', event: 'message.updated', data: 3 },
    ]);
    assert.strictEqual(queue.size, 0);
  });

  it('keeps an unsent add as an add', () => {
    const queue = new EventQueue<string>(10);
    queue.push('m:1', 'message.added', 'first');
    queue.push('m:1', 'message.updated', 'second');
    assert.deepEqual(queue.take(10), [
      { key: 'm:1', event: 'message.added', data: 'second' },
    ]);
  });

  it('lets a removal replace a pending add', () => {
    const queue = new EventQueue<string>(10);
    queue.push('m:1', 'message.added', 'first');
    queue.push('m:1', 'message.removed', 'gone');
    assert.deepEqual(queue.take(10), [
      { key: 'm:1', event: 'message.removed', data: 'gone' },
    ]);
  });

  it('takes in batches', () => {
    const queue = new EventQueue<number>(10);
    for (let i = 0; i < 5; i += 1) {
      queue.push(`c:${i}`, 'conversation.updated', i);
    }
    assert.deepEqual(
      queue.take(3).map(e => e.data),
      [0, 1, 2]
    );
    assert.deepEqual(
      queue.take(3).map(e => e.data),
      [3, 4]
    );
  });

  it('refuses new objects when full but still coalesces', () => {
    const queue = new EventQueue<number>(2);
    assert.isTrue(queue.push('c:1', 'conversation.updated', 1));
    assert.isTrue(queue.push('c:2', 'conversation.updated', 2));
    assert.isFalse(queue.push('c:3', 'conversation.updated', 3));
    assert.isTrue(queue.push('c:1', 'conversation.updated', 4));
    assert.strictEqual(queue.size, 2);
  });

  it('remembers sent payloads to skip unchanged updates', () => {
    const cache = new SentPayloadCache(2);
    assert.isFalse(cache.has('m:1'));
    assert.isTrue(cache.record('m:1', 'a'));
    assert.isTrue(cache.has('m:1'));
    assert.isFalse(cache.record('m:1', 'a'));
    assert.isTrue(cache.record('m:1', 'b'));
    cache.forget('m:1');
    assert.isTrue(cache.record('m:1', 'b'));
  });

  it('evicts the least recently sent payload', () => {
    const cache = new SentPayloadCache(2);
    cache.record('m:1', 'a');
    cache.record('m:2', 'a');
    cache.record('m:1', 'a');
    cache.record('m:3', 'a');
    assert.isFalse(cache.record('m:1', 'a'));
    assert.isTrue(cache.record('m:2', 'a'));
  });
});
