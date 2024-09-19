// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getCallingNotificationText } from '../../util/callingNotification';
import {
  CallMode,
  CallDirection,
  CallType,
  GroupCallStatus,
} from '../../types/CallDisposition';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../helpers/getDefaultConversation';
import { getPeerIdFromConversation } from '../../util/callDisposition';
import { HOUR } from '../../util/durations';

describe('calling notification helpers', () => {
  const i18n = setupI18n('en', enMessages);

  describe('getCallingNotificationText', () => {
    // Direct call behavior is not tested here.

    it('says that the incoming call has ended', () => {
      const callCreator = getDefaultConversation();
      assert.strictEqual(
        getCallingNotificationText(
          {
            callHistory: {
              callId: '123',
              peerId: getPeerIdFromConversation(getDefaultGroup()),
              ringerId: callCreator.serviceId ?? null,
              startedById: null,
              mode: CallMode.Group,
              type: CallType.Group,
              direction: CallDirection.Incoming,
              timestamp: Date.now(),
              endedTimestamp: null,
              status: GroupCallStatus.Joined,
            },
            callCreator,
            activeConversationId: null,
            groupCallEnded: true,
            deviceCount: 1,
            maxDevices: 23,
            isSelectMode: false,
            isTargeted: false,
          },
          i18n
        ),
        'The video call has ended'
      );
    });

    it('says that the outgoing call has ended', () => {
      const callCreator = getDefaultConversation();
      assert.strictEqual(
        getCallingNotificationText(
          {
            callHistory: {
              callId: '123',
              peerId: getPeerIdFromConversation(getDefaultGroup()),
              ringerId: callCreator.serviceId ?? null,
              startedById: null,
              mode: CallMode.Group,
              type: CallType.Group,
              direction: CallDirection.Outgoing,
              timestamp: Date.now(),
              endedTimestamp: null,
              status: GroupCallStatus.Joined,
            },
            callCreator,
            activeConversationId: null,
            groupCallEnded: true,
            deviceCount: 1,
            maxDevices: 23,
            isSelectMode: false,
            isTargeted: false,
          },
          i18n
        ),
        'The video call has ended'
      );
    });

    it('says declined incoming calls', () => {
      const callCreator = getDefaultConversation();
      assert.strictEqual(
        getCallingNotificationText(
          {
            callHistory: {
              callId: '123',
              peerId: getPeerIdFromConversation(getDefaultGroup()),
              ringerId: callCreator.serviceId ?? null,
              startedById: null,
              mode: CallMode.Group,
              type: CallType.Group,
              direction: CallDirection.Incoming,
              timestamp: Date.now(),
              endedTimestamp: null,
              status: GroupCallStatus.Declined,
            },
            callCreator,
            activeConversationId: null,
            groupCallEnded: true,
            deviceCount: 1,
            maxDevices: 23,
            isSelectMode: false,
            isTargeted: false,
          },
          i18n
        ),
        'Declined video call'
      );
    });

    it('says older ended incoming calls', () => {
      const callCreator = getDefaultConversation();
      assert.strictEqual(
        getCallingNotificationText(
          {
            callHistory: {
              callId: '123',
              peerId: getPeerIdFromConversation(getDefaultGroup()),
              ringerId: callCreator.serviceId ?? null,
              startedById: null,
              mode: CallMode.Group,
              type: CallType.Group,
              direction: CallDirection.Incoming,
              timestamp: Date.now() - HOUR,
              endedTimestamp: null,
              status: GroupCallStatus.Joined,
            },
            callCreator,
            activeConversationId: null,
            groupCallEnded: true,
            deviceCount: 1,
            maxDevices: 23,
            isSelectMode: false,
            isTargeted: false,
          },
          i18n
        ),
        'Incoming video call'
      );
    });

    it('says older ended incoming missed calls', () => {
      const callCreator = getDefaultConversation();
      assert.strictEqual(
        getCallingNotificationText(
          {
            callHistory: {
              callId: '123',
              peerId: getPeerIdFromConversation(getDefaultGroup()),
              ringerId: callCreator.serviceId ?? null,
              startedById: null,
              mode: CallMode.Group,
              type: CallType.Group,
              direction: CallDirection.Incoming,
              timestamp: Date.now() - HOUR,
              endedTimestamp: null,
              status: GroupCallStatus.Missed,
            },
            callCreator,
            activeConversationId: null,
            groupCallEnded: true,
            deviceCount: 1,
            maxDevices: 23,
            isSelectMode: false,
            isTargeted: false,
          },
          i18n
        ),
        'Missed video call'
      );
    });

    it('says older ended outgoing calls', () => {
      const callCreator = getDefaultConversation();
      assert.strictEqual(
        getCallingNotificationText(
          {
            callHistory: {
              callId: '123',
              peerId: getPeerIdFromConversation(getDefaultGroup()),
              ringerId: callCreator.serviceId ?? null,
              startedById: null,
              mode: CallMode.Group,
              type: CallType.Group,
              direction: CallDirection.Outgoing,
              timestamp: Date.now() - HOUR,
              endedTimestamp: null,
              status: GroupCallStatus.Joined,
            },
            callCreator,
            activeConversationId: null,
            groupCallEnded: true,
            deviceCount: 1,
            maxDevices: 23,
            isSelectMode: false,
            isTargeted: false,
          },
          i18n
        ),
        'Outgoing video call'
      );
    });

    it("includes the creator's first name when describing a call", () => {
      const callCreator = getDefaultConversation({
        systemGivenName: 'Luigi',
      });
      assert.strictEqual(
        getCallingNotificationText(
          {
            callHistory: {
              callId: '123',
              peerId: getPeerIdFromConversation(getDefaultGroup()),
              ringerId: callCreator.serviceId ?? null,
              startedById: null,
              mode: CallMode.Group,
              type: CallType.Group,
              direction: CallDirection.Incoming,
              timestamp: Date.now(),
              endedTimestamp: null,
              status: GroupCallStatus.Ringing,
            },
            callCreator,
            activeConversationId: null,
            groupCallEnded: false,
            deviceCount: 1,
            maxDevices: 23,
            isSelectMode: false,
            isTargeted: false,
          },
          i18n
        ),
        'Luigi started a video call'
      );
    });

    it("if the creator doesn't have a first name, falls back to their title", () => {
      const callCreator = getDefaultConversation({
        systemGivenName: undefined,
        title: 'Luigi Mario',
      });
      assert.strictEqual(
        getCallingNotificationText(
          {
            callHistory: {
              callId: '123',
              peerId: getPeerIdFromConversation(getDefaultGroup()),
              ringerId: callCreator.serviceId ?? null,
              startedById: null,
              mode: CallMode.Group,
              type: CallType.Group,
              direction: CallDirection.Incoming,
              timestamp: Date.now(),
              endedTimestamp: null,
              status: GroupCallStatus.Ringing,
            },
            callCreator,
            activeConversationId: null,
            groupCallEnded: false,
            deviceCount: 1,
            maxDevices: 23,
            isSelectMode: false,
            isTargeted: false,
          },
          i18n
        ),
        'Luigi Mario started a video call'
      );
    });

    it('has a special message if you were the one to start the call', () => {
      const callCreator = getDefaultConversation({
        isMe: true,
      });
      assert.strictEqual(
        getCallingNotificationText(
          {
            callHistory: {
              callId: '123',
              peerId: getPeerIdFromConversation(getDefaultGroup()),
              ringerId: callCreator.serviceId ?? null,
              startedById: null,
              mode: CallMode.Group,
              type: CallType.Group,
              direction: CallDirection.Outgoing,
              timestamp: Date.now(),
              endedTimestamp: null,
              status: GroupCallStatus.Ringing,
            },
            callCreator,
            activeConversationId: null,
            groupCallEnded: false,
            deviceCount: 1,
            maxDevices: 23,
            isSelectMode: false,
            isTargeted: false,
          },
          i18n
        ),
        'You started a video call'
      );
    });

    it('handles an unknown creator', () => {
      assert.strictEqual(
        getCallingNotificationText(
          {
            callHistory: {
              callId: '123',
              peerId: getPeerIdFromConversation(getDefaultGroup()),
              ringerId: null,
              startedById: null,
              mode: CallMode.Group,
              type: CallType.Group,
              direction: CallDirection.Outgoing,
              timestamp: Date.now(),
              endedTimestamp: null,
              status: GroupCallStatus.Ringing,
            },
            callCreator: null,
            activeConversationId: null,
            groupCallEnded: false,
            deviceCount: 1,
            maxDevices: 23,
            isSelectMode: false,
            isTargeted: false,
          },
          i18n
        ),
        'A video call was started'
      );
    });
  });
});
