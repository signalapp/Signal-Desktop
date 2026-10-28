// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getNotificationRouteUrl } from '../../../app/getNotificationRouteUrl.std.ts';
import { NotificationType } from '../../types/notifications.std.ts';

describe('getNotificationRouteUrl', () => {
  it('returns the show-conversation route for messages', () => {
    assert.strictEqual(
      getNotificationRouteUrl(NotificationType.Message, 'token').href,
      'sgnl://show-conversation?token=token'
    );
  });

  it('returns the show-conversation route for reactions', () => {
    assert.strictEqual(
      getNotificationRouteUrl(NotificationType.Reaction, 'token').href,
      'sgnl://show-conversation?token=token'
    );
  });

  it('returns the show-conversation route for unread reminders', () => {
    assert.strictEqual(
      getNotificationRouteUrl(NotificationType.UnreadReminder, 'token').href,
      'sgnl://show-conversation?token=token'
    );
  });

  it('returns the start-call-lobby route for incoming group calls', () => {
    assert.strictEqual(
      getNotificationRouteUrl(NotificationType.IncomingGroupCall, 'token').href,
      'sgnl://start-call-lobby?token=token'
    );
  });

  it('returns the show-window route for incoming calls', () => {
    assert.strictEqual(
      getNotificationRouteUrl(NotificationType.IncomingCall, 'token').href,
      'sgnl://show-window'
    );
  });

  it('returns the cancel-presenting route when presenting', () => {
    assert.strictEqual(
      getNotificationRouteUrl(NotificationType.IsPresenting, 'token').href,
      'sgnl://cancel-presenting'
    );
  });
});
