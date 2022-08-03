// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import type { Group, PrimaryDevice } from '@signalapp/mock-server';
import { StorageState, Proto } from '@signalapp/mock-server';
import { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import type { BootstrapOptions } from '../bootstrap';
import { MY_STORIES_ID } from '../../types/Stories';
import { uuidToBytes } from '../../util/uuidToBytes';

export const debug = createDebug('mock:test:storage');

export { App, Bootstrap };

const GROUP_SIZE = 8;

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

export type InitStorageResultType = Readonly<{
  bootstrap: Bootstrap;
  app: App;
  group: Group;
  members: ReadonlyArray<PrimaryDevice>;
}>;

//
// This function creates an initial storage service state that includes:
//
// - All contacts from contact sync (first contact pinned)
// - A pinned group with GROUP_SIZE members (from the contacts)
// - Account with e164 and profileKey
//
// In addition to above, this function will queue one incoming message in the
// group, and one for the first contact (so that both will appear in the left
// pane).
export async function initStorage(
  options?: BootstrapOptions
): Promise<InitStorageResultType> {
  // Creates primary device, contacts
  const bootstrap = new Bootstrap(options);

  await bootstrap.init();

  try {
    // Populate storage service
    const { contacts, phone } = bootstrap;

    const [firstContact] = contacts;

    const members = [...contacts].slice(0, GROUP_SIZE);

    const group = await phone.createGroup({
      title: 'Mock Group',
      members: [phone, ...members],
    });

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      e164: phone.device.number,
      givenName: phone.profileName,
    });

    state = state
      .addGroup(group, {
        whitelisted: true,
      })
      .pinGroup(group);

    for (const contact of contacts) {
      state = state.addContact(contact, {
        identityState: Proto.ContactRecord.IdentityState.VERIFIED,
        whitelisted: true,

        identityKey: contact.publicKey.serialize(),
        profileKey: contact.profileKey.serialize(),
        givenName: contact.profileName,
      });
    }

    state = state.pin(firstContact);

    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(MY_STORIES_ID),
          isBlockList: true,
          name: MY_STORIES_ID,
          recipientUuids: [],
        },
      },
    });

    await phone.setStorageState(state);

    // Link new device
    const app = await bootstrap.link();

    const { desktop } = bootstrap;

    // Send a message to the group and the first contact
    const contactSend = contacts[0].sendText(desktop, 'hello from contact', {
      timestamp: bootstrap.getTimestamp(),
      sealed: true,
    });

    const groupSend = members[0].sendText(desktop, 'hello in group', {
      timestamp: bootstrap.getTimestamp(),
      sealed: true,
      group,
    });

    await Promise.all([contactSend, groupSend]);

    return { bootstrap, app, group, members };
  } catch (error) {
    await bootstrap.saveLogs();
    throw error;
  }
}
