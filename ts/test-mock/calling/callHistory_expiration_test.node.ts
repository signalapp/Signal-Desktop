// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import type { Page } from 'playwright';
import { expect } from 'playwright/test';
import type { Group, PrimaryDevice } from '@signalapp/mock-server';
import {
  Proto,
  StorageState,
  EMPTY_DATA_MESSAGE,
  SignalingProto,
} from '@signalapp/mock-server';
import * as Bytes from '../../Bytes.std.ts';
import { uuidToBytes } from '../../util/uuidToBytes.std.ts';
import * as durations from '../../util/durations/index.std.ts';
import { Bootstrap } from '../bootstrap.node.ts';
import type { App } from '../bootstrap.node.ts';
import { createGroup } from '../helpers.node.ts';

const debug = createDebug('mock:test:calling:callHistoryExpiration');

const EXPIRE_TIMER_SECONDS: 1 | 5 = 1;
const EXPIRE_TIMER_MS = EXPIRE_TIMER_SECONDS * 1000;
const WAIT_FOR_SLOW_EXPIRE_TIMER_MS = EXPIRE_TIMER_MS * 2;

function delay(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function $navTab(page: Page, name: string) {
  return page.getByRole('tab', { name });
}

function $navTabUnreadBadge(page: Page, name: string) {
  return $navTab(page, name).locator('.NavTabs__ItemIconLabel');
}

function $navSidebar(page: Page) {
  return page.locator('.NavSidebar');
}

function $chatListItem(page: Page, id: string) {
  return $navSidebar(page).getByTestId(id);
}

function $callListItem(page: Page, title: string) {
  return $navSidebar(page).locator('.CallsList__ItemTile', { hasText: title });
}

function $unreadBadge(page: Page, id: string) {
  return $chatListItem(page, id)
    .locator(
      '.module-conversation-list__item--contact-or-conversation__content'
    )
    .locator(
      '.module-conversation-list__item--contact-or-conversation__unread-indicator--unread-messages'
    );
}

function $systemMessage(page: Page) {
  return page.locator('.SystemMessage__contents');
}

function $incomingCall(page: Page) {
  return $systemMessage(page).getByText('Incoming voice call');
}

function $missedCall(page: Page) {
  return $systemMessage(page).getByText('Missed voice call');
}

function $groupCallEnded(page: Page) {
  return $systemMessage(page).getByText('The video call has ended');
}

function $missedGroupCall(page: Page) {
  return $systemMessage(page).getByText('Missed video call');
}

function $youStartedCall(page: Page) {
  return $systemMessage(page).getByText('You started a video call');
}

describe('calling/callHistoryExpiration', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let contact: PrimaryDevice;
  let group: Group;

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 0 });
    await bootstrap.init();

    const { server, phone } = bootstrap;

    contact = await server.createPrimaryDevice({ profileName: 'Alice' });

    let state = StorageState.getEmpty();
    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
    });
    state = state.addContact(contact, {
      identityKey: contact.publicKey.serialize(),
      profileKey: contact.profileKey.serialize(),
      whitelisted: true,
    });
    state = state.pin(contact);
    await phone.setStorageState(state);

    group = await createGroup(phone, [contact], 'Test Group');

    app = await bootstrap.link();

    const { desktop } = bootstrap;
    const ourKey = await desktop.popSingleUseKey();
    await contact.addSingleUseKey(desktop, ourKey);
  });

  afterEach(async function (this: Mocha.Context) {
    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  async function setExpireTimer() {
    const { desktop } = bootstrap;

    const key = await desktop.popSingleUseKey();
    await contact.addSingleUseKey(desktop, key);

    const timestamp = bootstrap.getTimestamp();
    const content: Proto.Content.Params = {
      content: {
        dataMessage: {
          ...EMPTY_DATA_MESSAGE,
          flags: Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
          expireTimer: EXPIRE_TIMER_SECONDS,
          expireTimerVersion: 1,
          timestamp: BigInt(timestamp),
        },
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };
    await contact.sendRaw(desktop, content, { timestamp });
  }

  async function setGroupExpireTimer() {
    const { desktop, phone } = bootstrap;

    await phone.modifyGroupDisappearingMessageTimer(
      group,
      EXPIRE_TIMER_SECONDS,
      {
        timestamp: bootstrap.getTimestamp(),
        sendUpdateTo: [{ device: desktop }],
      }
    );
  }

  async function sendCallEventSync(params: {
    callTimestamp: number;
    wasAccepted: boolean;
  }) {
    const { desktop, phone } = bootstrap;
    const content: Proto.Content.Params = {
      content: {
        syncMessage: {
          content: {
            callEvent: {
              conversationId: uuidToBytes(contact.device.aci),
              callId: BigInt(params.callTimestamp),
              timestamp: BigInt(params.callTimestamp),
              type: Proto.SyncMessage.CallEvent.Type.AUDIO_CALL,
              direction: Proto.SyncMessage.CallEvent.Direction.INCOMING,
              event: params.wasAccepted
                ? Proto.SyncMessage.CallEvent.Event.ACCEPTED
                : Proto.SyncMessage.CallEvent.Event.NOT_ACCEPTED,
            },
          },
          read: null,
          stickerPackOperation: null,
          viewed: null,
          padding: null,
        },
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };
    await phone.sendRaw(desktop, content, { timestamp: params.callTimestamp });
  }

  async function sendGroupCallMessageOffer(params: { callTimestamp: number }) {
    const { callTimestamp } = params;
    const { desktop } = bootstrap;

    const content: Proto.Content.Params = {
      content: {
        callMessage: {
          offer: {
            id: BigInt(callTimestamp),
            type: Proto.CallMessage.Offer.Type.OFFER_VIDEO_CALL,
            opaque: null,
          },
          answer: null,
          iceUpdate: null,
          busy: null,
          hangup: null,
          destinationDeviceId: null,
          opaque: {
            urgency: null,
            data: SignalingProto.CallMessage.encode({
              ringIntention: {
                type: SignalingProto.CallMessage.RingIntention.Type.RING,
                groupId: Buffer.from(group.id, 'base64'),
                ringId: BigInt(callTimestamp),
              },
              groupCallMessage: {
                groupId: Buffer.from(group.id, 'base64'),
              },
            }),
          },
        },
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };

    await contact.sendRaw(desktop, content, {
      timestamp: callTimestamp,
      sealed: true,
      group,
    });
  }

  async function sendCallLogEventSync(params: {
    callTimestamp: number;
    groupCall?: boolean;
  }) {
    const { desktop, phone } = bootstrap;
    const timestamp = Date.now();
    const conversationId = params.groupCall
      ? Bytes.fromBase64(group.id)
      : uuidToBytes(contact.device.aci);
    const content: Proto.Content.Params = {
      content: {
        syncMessage: {
          content: {
            callLogEvent: {
              type: Proto.SyncMessage.CallLogEvent.Type
                .MARKED_AS_READ_IN_CONVERSATION,
              timestamp: BigInt(params.callTimestamp),
              conversationId,
              callId: BigInt(params.callTimestamp),
            },
          },
          read: null,
          stickerPackOperation: null,
          viewed: null,
          padding: null,
        },
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };
    await phone.sendRaw(desktop, content, { timestamp });
  }

  describe('1:1 calls', () => {
    it('expire missed call: read by opening chat', async () => {
      const { phone } = bootstrap;
      const page = await app.getWindow();
      const chatListItem = $chatListItem(page, contact.device.aci);
      const unreadBadge = $unreadBadge(page, contact.device.aci);

      debug('waiting for chat list item');
      await expect(chatListItem).toBeVisible();

      debug('setting expire timer via contact message');
      await setExpireTimer();
      await expect(unreadBadge).toContainText('1');
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();
      await expect(chatListItem).toContainText(/Timer set to \d seconds?/);

      debug('sending incoming missed call event sync');
      const callTimestamp = bootstrap.getTimestamp();
      await sendCallEventSync({ callTimestamp, wasAccepted: false });
      await expect(unreadBadge).toContainText('1');
      await expect($navTabUnreadBadge(page, 'Calls')).toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).toContainText('1');
      await expect(chatListItem).toContainText('Missed voice call');

      debug('wait to make sure message does not expire before its been read');
      await delay(WAIT_FOR_SLOW_EXPIRE_TIMER_MS);
      await expect(unreadBadge).toContainText('1');
      await expect($navTabUnreadBadge(page, 'Calls')).toContainText('1');
      await expect(chatListItem).toContainText('Missed voice call');

      debug('checking the call doesnt need to be the latest message');
      await contact.sendText(bootstrap.desktop, 'Another message');
      await expect(unreadBadge).toContainText('2');
      await expect(chatListItem).toContainText('Another message');

      debug('opening conversation to mark read');
      await chatListItem.click();
      await expect(unreadBadge).not.toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();
      await expect($missedCall(page)).toBeVisible();

      debug('waiting for sync message');
      const syncMessage = await phone.waitForSyncMessage(entry => {
        return (
          entry.syncMessage.content?.callLogEvent?.type ===
          Proto.SyncMessage.CallLogEvent.Type.MARKED_AS_READ_IN_CONVERSATION
        );
      });
      expect(syncMessage.syncMessage.content?.callLogEvent?.callId).toBe(
        BigInt(callTimestamp)
      );

      debug('waiting for message to expire');
      await delay(EXPIRE_TIMER_MS);
      await expect($missedCall(page)).not.toBeVisible();
    });

    it('missed call is expired by navigating to calls tab', async () => {
      const page = await app.getWindow();
      const chatListItem = $chatListItem(page, contact.device.aci);
      const unreadBadge = $unreadBadge(page, contact.device.aci);

      debug('waiting for chat list item');
      await expect(chatListItem).toBeVisible();

      debug('setting expire timer via contact message');
      await setExpireTimer();
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();
      await expect(chatListItem).toContainText(/Timer set to \d seconds?/);

      debug('sending incoming missed call event sync');
      const callTimestamp = bootstrap.getTimestamp();
      await sendCallEventSync({ callTimestamp, wasAccepted: false });
      await expect(unreadBadge).toContainText('1');
      await expect($navTabUnreadBadge(page, 'Calls')).toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).toContainText('1');
      await expect(chatListItem).toContainText('Missed voice call');

      debug('navigating to calls tab');
      await $navTab(page, 'Calls').click();

      debug('clicking on the call to mark it read');
      await $callListItem(page, 'Alice').click();
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();

      debug('navigating back to chats tab');
      await $navTab(page, 'Chats').click();
      await expect(chatListItem).toContainText('Missed voice call');

      debug('waiting for missed call to expire');
      await delay(EXPIRE_TIMER_MS);
      await expect(chatListItem).toContainText(/Timer set to \d seconds?/);

      debug('checking in conversation');
      await chatListItem.click();
      await expect($missedCall(page)).not.toBeVisible();
    });

    it('expire missed call: read via CallLogEvent sync', async () => {
      const page = await app.getWindow();
      const chatListItem = $chatListItem(page, contact.device.aci);
      const unreadBadge = $unreadBadge(page, contact.device.aci);

      debug('waiting for chat list item');
      await expect(chatListItem).toBeVisible();

      debug('setting expire timer via contact message');
      await setExpireTimer();
      await expect(unreadBadge).toContainText('1');
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();
      await expect(chatListItem).toContainText(/Timer set to \d seconds?/);

      debug('sending incoming missed call event sync');
      const callTimestamp = bootstrap.getTimestamp();
      await sendCallEventSync({ callTimestamp, wasAccepted: false });

      debug('waiting for missed call unread badge');
      await expect(unreadBadge).toContainText('1');
      await expect($navTabUnreadBadge(page, 'Calls')).toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).toContainText('1');
      await expect(chatListItem).toContainText('Missed voice call');

      debug('marking calls read in conversation via sync');
      await sendCallLogEventSync({ callTimestamp });
      await expect(unreadBadge).toContainText('1');
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();
      await expect(chatListItem).toContainText('Missed voice call');

      debug('waiting for message to expire');
      await delay(EXPIRE_TIMER_MS);
      await expect(chatListItem).toContainText(/Timer set to \d seconds?/);

      debug('checking in conversation');
      await chatListItem.click();
      await expect($missedCall(page)).not.toBeVisible();
    });

    it('expire accepted call', async () => {
      const page = await app.getWindow();
      const chatListItem = $chatListItem(page, contact.device.aci);
      const unreadBadge = $unreadBadge(page, contact.device.aci);

      debug('waiting for chat list item');
      await expect(chatListItem).toBeVisible();

      debug('setting expire timer via contact message');
      await setExpireTimer();
      await expect(unreadBadge).toContainText('1');
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();
      await expect(chatListItem).toContainText(/Timer set to \d seconds?/);

      debug('sending incoming missed call event sync');
      const callTimestamp = bootstrap.getTimestamp();
      await sendCallEventSync({ callTimestamp, wasAccepted: false });
      await expect(unreadBadge).toContainText('1');
      await expect($navTabUnreadBadge(page, 'Calls')).toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).toContainText('1');
      await expect(chatListItem).toContainText('Missed voice call');

      debug('marking call event accepted from sync');
      await sendCallEventSync({ callTimestamp, wasAccepted: true });
      await expect(unreadBadge).toContainText('1');
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();
      await expect(chatListItem).toContainText(/Timer set to \d seconds?/);

      debug('waiting for message to expire');
      await delay(EXPIRE_TIMER_MS);

      debug('checking in conversation');
      await chatListItem.click();
      await expect($incomingCall(page)).not.toBeVisible();
    });
  });

  describe('group calls', () => {
    it('expire missed call: read by opening chat', async () => {
      const page = await app.getWindow();
      const chatListItem = $chatListItem(page, group.id);
      const unreadBadge = $unreadBadge(page, group.id);

      debug('waiting for group chat list item');
      await expect(chatListItem).toBeVisible();

      debug('setting expire timer for group');
      await setGroupExpireTimer();
      await expect(unreadBadge).not.toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();
      await expect(chatListItem).toContainText(/Timer set to \d seconds?/);

      debug('sending incoming missed group call via offer');
      const callTimestamp = bootstrap.getTimestamp();
      await sendGroupCallMessageOffer({ callTimestamp });
      await expect(unreadBadge).not.toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).toContainText('1');
      await expect(chatListItem).toContainText('The video call has ended');

      debug('wait to make sure message does not expire before its been read');
      await delay(WAIT_FOR_SLOW_EXPIRE_TIMER_MS);
      await expect(unreadBadge).not.toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).toContainText('1');
      await expect(chatListItem).toContainText('The video call has ended');

      debug('opening group conversation');
      await chatListItem.click();
      await expect($groupCallEnded(page)).toBeVisible();
      await expect(unreadBadge).not.toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();

      debug('waiting for message to expire');
      await delay(EXPIRE_TIMER_MS);

      await expect($groupCallEnded(page)).not.toBeVisible();
      await expect(chatListItem).toContainText(/Timer set to \d seconds?/);
    });

    it('missed call is expired by navigating to calls tab', async () => {
      const page = await app.getWindow();
      const chatListItem = $chatListItem(page, group.id);
      const unreadBadge = $unreadBadge(page, group.id);

      debug('waiting for group chat list item');
      await expect(chatListItem).toBeVisible();

      debug('setting expire timer via group state');
      await setGroupExpireTimer();
      await expect(unreadBadge).not.toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();
      await expect(chatListItem).toContainText(/Timer set to \d seconds?/);

      debug('sending incoming missed group call via offer');
      const callTimestamp = bootstrap.getTimestamp();
      await sendGroupCallMessageOffer({ callTimestamp });
      await expect(unreadBadge).not.toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).toContainText('1');
      await expect(chatListItem).toContainText('The video call has ended');

      debug('navigating to calls tab');
      await $navTab(page, 'Calls').click();

      debug('clicking on the call to mark it read');
      await $callListItem(page, 'Test Group').click();
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();

      debug('navigating back to chats tab');
      await $navTab(page, 'Chats').click();
      await expect(unreadBadge).not.toBeVisible();
      await expect(chatListItem).toContainText('The video call has ended');

      debug('waiting for missed call to expire');
      await delay(EXPIRE_TIMER_MS);

      debug('checking in conversation');
      await chatListItem.click();
      await expect($missedCall(page)).not.toBeVisible();
    });

    it('expire missed call: read via CallLogEvent sync', async () => {
      const page = await app.getWindow();
      const chatListItem = $chatListItem(page, group.id);
      const unreadBadge = $unreadBadge(page, group.id);

      debug('waiting for group chat list item');
      await expect(chatListItem).toBeVisible();

      debug('setting expire timer via group state');
      await setGroupExpireTimer();
      await expect(unreadBadge).not.toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();
      await expect(chatListItem).toContainText(/Timer set to \d seconds?/);

      debug('creating incoming missed group call via ring notification');
      const callTimestamp = bootstrap.getTimestamp();
      await sendGroupCallMessageOffer({ callTimestamp });
      await expect(unreadBadge).not.toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).toContainText('1');
      await expect(chatListItem).toContainText('The video call has ended');

      debug('marking calls read in conversation via sync');
      await sendCallLogEventSync({ callTimestamp, groupCall: true });
      await expect(unreadBadge).not.toBeVisible();
      await expect($navTabUnreadBadge(page, 'Calls')).not.toBeVisible();
      await expect(chatListItem).toContainText('The video call has ended');

      debug('waiting for message to expire');
      await delay(EXPIRE_TIMER_MS);
      await expect(chatListItem).toContainText(/Timer set to \d seconds?/);

      debug('opening group conversation to verify expired');
      await chatListItem.click();
      await expect($missedGroupCall(page)).not.toBeVisible();
    });

    it('does not expire an ongoing group call', async () => {
      const page = await app.getWindow();
      const chatListItem = $chatListItem(page, group.id);

      debug('waiting for group chat list item');
      await expect(chatListItem).toBeVisible();

      debug('setting expire timer via group state');
      await setGroupExpireTimer();
      await expect(chatListItem).toContainText(/Timer set to \d seconds?/);

      debug('opening group conversation');
      await chatListItem.click();

      debug('opening call screen');
      await page.getByRole('button', { name: 'Start a video call' }).click();

      debug('accepting audio permissions');
      const audioPermissions = await app.waitForWindow();
      await audioPermissions
        .getByRole('button', { name: 'Allow Access' })
        .click();

      debug('accepting video permissions');
      const videoPermissions = await app.waitForWindow();
      await videoPermissions
        .getByRole('button', { name: 'Allow Access' })
        .click();

      debug('starting call');
      await page
        .locator('.CallControls')
        .getByRole('button', { name: 'Start' })
        .click();

      debug('minimizing call');
      await page.getByRole('button', { name: 'Minimize call' }).click();
      await expect($youStartedCall(page)).toBeVisible();

      debug('wait to make sure message does not expire before call is over');
      await delay(WAIT_FOR_SLOW_EXPIRE_TIMER_MS);
      await expect($youStartedCall(page)).toBeVisible();

      debug('leaving call');
      await page.getByRole('button', { name: 'Leave call' }).click();

      debug('waiting for message to expire');
      await delay(EXPIRE_TIMER_MS);
      await expect($youStartedCall(page)).not.toBeVisible();
    });
  });
});
