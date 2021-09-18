// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getCallingNotificationText } from '../../util/callingNotification';
import { CallMode } from '../../types/Calling';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

describe('calling notification helpers', () => {
  const i18n = setupI18n('en', enMessages);

  describe('getCallingNotificationText', () => {
    // Direct call behavior is not tested here.

    it('says that the call has ended', () => {
      assert.strictEqual(
        getCallingNotificationText(
          {
            callMode: CallMode.Group,
            conversationId: 'abc123',
            ended: true,
            deviceCount: 1,
            maxDevices: 23,
            startedTime: Date.now(),
          },
          i18n
        ),
        'The group call has ended'
      );
    });

    it("includes the creator's first name when describing a call", () => {
      assert.strictEqual(
        getCallingNotificationText(
          {
            callMode: CallMode.Group,
            conversationId: 'abc123',
            creator: {
              firstName: 'Luigi',
              isMe: false,
              title: 'Luigi Mario',
            },
            ended: false,
            deviceCount: 1,
            maxDevices: 23,
            startedTime: Date.now(),
          },
          i18n
        ),
        'Luigi started a group call'
      );
    });

    it("if the creator doesn't have a first name, falls back to their title", () => {
      assert.strictEqual(
        getCallingNotificationText(
          {
            callMode: CallMode.Group,
            conversationId: 'abc123',
            creator: {
              isMe: false,
              title: 'Luigi Mario',
            },
            ended: false,
            deviceCount: 1,
            maxDevices: 23,
            startedTime: Date.now(),
          },
          i18n
        ),
        'Luigi Mario started a group call'
      );
    });

    it('has a special message if you were the one to start the call', () => {
      assert.strictEqual(
        getCallingNotificationText(
          {
            callMode: CallMode.Group,
            conversationId: 'abc123',
            creator: {
              firstName: 'ShouldBeIgnored',
              isMe: true,
              title: 'ShouldBeIgnored Smith',
            },
            ended: false,
            deviceCount: 1,
            maxDevices: 23,
            startedTime: Date.now(),
          },
          i18n
        ),
        'You started a group call'
      );
    });

    it('handles an unknown creator', () => {
      assert.strictEqual(
        getCallingNotificationText(
          {
            callMode: CallMode.Group,
            conversationId: 'abc123',
            ended: false,
            deviceCount: 1,
            maxDevices: 23,
            startedTime: Date.now(),
          },
          i18n
        ),
        'A group call was started'
      );
    });
  });
});
