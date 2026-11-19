// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { soundFileFor } from '../../../app/MacNotifications.main.ts';
import { NotificationType } from '../../types/notifications.std.ts';

describe('MacNotifications', () => {
  describe('soundFileFor', () => {
    it('returns the pop sound for messages, reactions and unread reminders', () => {
      assert.strictEqual(
        soundFileFor(NotificationType.Message),
        'signal-pop.caf'
      );
      assert.strictEqual(
        soundFileFor(NotificationType.Reaction),
        'signal-pop.caf'
      );
      assert.strictEqual(
        soundFileFor(NotificationType.UnreadReminder),
        'signal-pop.caf'
      );
    });

    it('returns the tri-tone sound for calls and presenting', () => {
      assert.strictEqual(
        soundFileFor(NotificationType.IncomingCall),
        'signal-tri-tone.caf'
      );
      assert.strictEqual(
        soundFileFor(NotificationType.IncomingGroupCall),
        'signal-tri-tone.caf'
      );
      assert.strictEqual(
        soundFileFor(NotificationType.IsPresenting),
        'signal-tri-tone.caf'
      );
    });

    it('throws for an unknown type', () => {
      assert.throws(() => soundFileFor('unknown' as NotificationType));
    });
  });
});
