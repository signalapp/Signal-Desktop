// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { PrimaryDevice } from '@signalapp/mock-server';
import { Proto, StorageState } from '@signalapp/mock-server';

import Long from 'long';
import { sample } from 'lodash';
import { expect } from 'playwright/test';
import { Bootstrap, debug, RUN_COUNT, DISCARD_COUNT } from './fixtures';
import { stats } from '../../util/benchmark/stats';
import { uuidToBytes } from '../../util/uuidToBytes';
import { strictAssert } from '../../util/assert';
import { typeIntoInput } from '../helpers';

const CALL_HISTORY_COUNT = 1000;

function rand<T>(values: ReadonlyArray<T>): T {
  const value = sample(values);
  strictAssert(value != null, 'must not be null');
  return value;
}

const { CallEvent } = Proto.SyncMessage;
const { Type, Direction, Event } = CallEvent;

const Types = [Type.AUDIO_CALL, Type.VIDEO_CALL];
const Directions = [Direction.INCOMING, Direction.OUTGOING];
const Events = [Event.ACCEPTED, Event.NOT_ACCEPTED];

Bootstrap.benchmark(async (bootstrap: Bootstrap): Promise<void> => {
  const { server, contacts, phone } = bootstrap;

  let state = StorageState.getEmpty();

  state = state.updateAccount({
    profileKey: phone.profileKey.serialize(),
    givenName: phone.profileName,
    readReceipts: true,
    hasCompletedUsernameOnboarding: true,
  });

  debug('accepting all contacts');
  for (const contact of contacts) {
    state = state.addContact(contact, {
      identityKey: contact.publicKey.serialize(),
      profileKey: contact.profileKey.serialize(),
      whitelisted: true,
    });
  }
  await phone.setStorageState(state);

  debug('linking');
  const app = await bootstrap.link();
  const { desktop } = bootstrap;

  debug('sending messages from all contacts');
  await Promise.all(
    contacts.map(async contact => {
      const timestamp = bootstrap.getTimestamp();

      await server.send(
        desktop,
        await contact.encryptText(
          desktop,
          `hello from: ${contact.profileName}`,
          { timestamp, sealed: true }
        )
      );

      await server.send(
        desktop,
        await phone.encryptSyncRead(desktop, {
          timestamp: bootstrap.getTimestamp(),
          messages: [
            {
              senderAci: contact.device.aci,
              timestamp,
            },
          ],
        })
      );
    })
  );

  async function sendCallEventSync(
    contact: PrimaryDevice,
    type: Proto.SyncMessage.CallEvent.Type,
    direction: Proto.SyncMessage.CallEvent.Direction,
    event: Proto.SyncMessage.CallEvent.Event,
    timestamp: number
  ) {
    await phone.sendRaw(
      desktop,
      {
        syncMessage: {
          callEvent: {
            peerId: uuidToBytes(contact.device.aci),
            callId: Long.fromNumber(timestamp),
            timestamp: Long.fromNumber(timestamp),
            type,
            direction,
            event,
          },
        },
      },
      { timestamp }
    );
  }

  debug('sending initial call events');
  let unreadCount = 0;
  await Promise.all(
    Array.from({ length: CALL_HISTORY_COUNT }, () => {
      const contact = rand(contacts);
      const type = rand(Types);
      const direction = rand(Directions);
      const event = rand(Events);
      const timestamp = bootstrap.getTimestamp();

      if (
        direction === Proto.SyncMessage.CallEvent.Direction.INCOMING &&
        event === Proto.SyncMessage.CallEvent.Event.NOT_ACCEPTED
      ) {
        unreadCount += 1;
      }
      return sendCallEventSync(contact, type, direction, event, timestamp);
    })
  );

  const window = await app.getWindow();

  const CallsNavTab = window.getByTestId('NavTabsItem--Calls');
  const CallsNavTabUnread = CallsNavTab.locator('.NavTabs__ItemUnreadBadge');
  const CallsTabSidebar = window.locator('.CallsTab .NavSidebar');
  const SearchBar = CallsTabSidebar.locator('.module-SearchInput__input');
  const CallListItem = CallsTabSidebar.locator('.CallsList__ItemTile');
  const CreateCallLink = CallListItem.filter({ hasText: 'Create a Call Link' });
  const CallsTabDetails = window.locator('.CallsTab__ConversationCallDetails');
  const CallsTabDetailsTitle = CallsTabDetails.locator(
    '.ConversationDetailsHeader__title'
  );

  debug('waiting for unread badge to hit correct value', unreadCount);
  await CallsNavTabUnread.getByText(`${unreadCount} unread`).waitFor();

  debug('opening calls tab');
  await CallsNavTab.click();

  async function measure(runId: number): Promise<number> {
    // setup
    const searchContact = contacts[runId % contacts.length];
    const OtherCallListItems = CallListItem.filter({
      hasNotText: searchContact.profileName,
    });
    const timestamp = bootstrap.getTimestamp();
    const NewCallListItemTime = window.locator(
      `.CallsList__ItemCallInfo time[datetime="${new Date(timestamp).toISOString()}"]`
    );
    const NewCallListItem = CallListItem.filter({
      has: NewCallListItemTime,
    });
    const NewCallDetailsTitle = CallsTabDetailsTitle.filter({
      hasText: searchContact.profileName,
    });

    // measure
    const start = Date.now();

    // test
    await typeIntoInput(SearchBar, searchContact.profileName);
    await CreateCallLink.waitFor({ state: 'hidden' }); // hides when searching
    await expect(OtherCallListItems).not.toBeAttached();
    await sendCallEventSync(
      searchContact,
      Type.AUDIO_CALL,
      Direction.INCOMING,
      Event.ACCEPTED,
      timestamp
    );
    await NewCallListItem.click();
    await NewCallDetailsTitle.waitFor();
    await SearchBar.clear();
    await CreateCallLink.waitFor();

    // measure
    const end = Date.now();
    const delta = end - start;
    return delta;
  }

  const deltaList = new Array<number>();
  for (let runId = 0; runId < RUN_COUNT + DISCARD_COUNT; runId += 1) {
    // eslint-disable-next-line no-await-in-loop
    const delta = await measure(runId);

    if (runId >= DISCARD_COUNT) {
      deltaList.push(delta);
      // eslint-disable-next-line no-console
      console.log('run=%d info=%j', runId - DISCARD_COUNT, { delta });
    } else {
      // eslint-disable-next-line no-console
      console.log('discarded=%d info=%j', runId, { delta });
    }
  }

  // eslint-disable-next-line no-console
  console.log('stats info=%j', { delta: stats(deltaList, [99, 99.8]) });
});
