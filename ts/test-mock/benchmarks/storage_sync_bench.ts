// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-await-in-loop, no-console */

import type { PrimaryDevice } from '@signalapp/mock-server';
import { StorageState } from '@signalapp/mock-server';

import { Bootstrap } from './fixtures.node.js';

const CONTACT_COUNT = 1000;

Bootstrap.benchmark(async (bootstrap: Bootstrap): Promise<void> => {
  const contactNames = new Array<string>();
  for (let i = 0; i < CONTACT_COUNT; i += 1) {
    contactNames.push(`Contact ${i}`);
  }

  const { phone, server } = bootstrap;

  let state = StorageState.getEmpty();
  let lastContact: PrimaryDevice | undefined;
  for (const [i, profileName] of contactNames.entries()) {
    const contact = await server.createPrimaryDevice({
      profileName,
    });

    state = state.addContact(contact, {
      // Make sure we fetch profile from the server
      givenName: `Loading ${profileName}...`,

      identityKey: contact.publicKey.serialize(),
      profileKey: contact.profileKey.serialize(),
    });

    if (i >= contactNames.length - 4) {
      state = state.pin(contact);
    }

    if (i === contactNames.length - 1) {
      lastContact = contact;
    }
  }

  await phone.setStorageState(state);

  const start = Date.now();
  const app = await bootstrap.link();
  const window = await app.getWindow();

  const leftPane = window.locator('#LeftPane');

  const item = leftPane.locator(`[data-testid="${lastContact?.device.aci}"]`);
  await item.waitFor();

  const duration = Date.now() - start;
  console.log(`Took: ${(duration / 1000).toFixed(2)} seconds`);
});
