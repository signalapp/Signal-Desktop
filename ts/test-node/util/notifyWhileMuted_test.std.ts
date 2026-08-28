// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  getNotifyWhileMuted,
  resolveLegacyNotifyForMentionsIfMuted,
} from '../../util/notifyWhileMuted.std.ts';

describe('getNotifyWhileMuted', () => {
  it('falls back to the defaults when nothing is set', () => {
    assert.deepEqual(getNotifyWhileMuted({}), {
      calls: true,
      mentions: true,
      replies: true,
    });
  });

  it('honors each setting once it is set', () => {
    assert.deepEqual(
      getNotifyWhileMuted({
        notifyForCallsIfMuted: true,
        notifyForMentionsIfMuted: false,
        notifyForRepliesIfMuted: false,
      }),
      { calls: true, mentions: false, replies: false }
    );
  });

  it('defaults each setting independently', () => {
    assert.deepEqual(getNotifyWhileMuted({ notifyForMentionsIfMuted: false }), {
      calls: true,
      mentions: false,
      replies: true,
    });

    assert.deepEqual(getNotifyWhileMuted({ notifyForCallsIfMuted: true }), {
      calls: true,
      mentions: true,
      replies: true,
    });
  });
});

describe('resolveLegacyNotifyForMentionsIfMuted', () => {
  it('uses the new field when the two agree', () => {
    // Written by a client that knows both fields.
    assert.strictEqual(
      resolveLegacyNotifyForMentionsIfMuted(false, undefined)
        .notifyForMentionsIfMuted,
      undefined
    );
    assert.strictEqual(
      resolveLegacyNotifyForMentionsIfMuted(false, true)
        .notifyForMentionsIfMuted,
      true
    );
    assert.strictEqual(
      resolveLegacyNotifyForMentionsIfMuted(true, false)
        .notifyForMentionsIfMuted,
      false
    );
  });

  it('falls back to the deprecated field when the new one is absent', () => {
    // Written by a client that only knows the deprecated field.
    assert.strictEqual(
      resolveLegacyNotifyForMentionsIfMuted(true, undefined)
        .notifyForMentionsIfMuted,
      false
    );
    assert.strictEqual(
      resolveLegacyNotifyForMentionsIfMuted(false, undefined)
        .notifyForMentionsIfMuted,
      undefined
    );
  });

  it('prefers the deprecated field when they disagree', () => {
    // A legacy client edited the deprecated field and round-tripped a stale
    // value for the new one, so the deprecated field is the fresh edit.
    assert.strictEqual(
      resolveLegacyNotifyForMentionsIfMuted(true, true)
        .notifyForMentionsIfMuted,
      false
    );
    assert.strictEqual(
      resolveLegacyNotifyForMentionsIfMuted(false, false)
        .notifyForMentionsIfMuted,
      true
    );
  });
});
