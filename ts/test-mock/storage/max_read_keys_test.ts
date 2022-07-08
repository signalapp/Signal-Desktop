// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Proto } from '@signalapp/mock-server';

import * as durations from '../../util/durations';
import { UUID } from '../../types/UUID';
import { MAX_READ_KEYS } from '../../services/storageConstants';
import type { App, Bootstrap } from './fixtures';
import { initStorage, debug } from './fixtures';

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('storage service', function needsName() {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    ({ bootstrap, app } = await initStorage());
  });

  afterEach(async function after() {
    if (!bootstrap) {
      return;
    }

    if (this.currentTest?.state !== 'passed') {
      await bootstrap.saveLogs();
    }

    await app.close();
    await bootstrap.teardown();
  });

  it('should receive all contacts despite low read keys limit', async () => {
    debug('prepare for a slow test');

    const { phone, contacts } = bootstrap;
    const firstContact = contacts[0];
    const lastContact = contacts[contacts.length - 1];

    const window = await app.getWindow();

    const leftPane = window.locator('.left-pane-wrapper');

    debug('wait for first contact to be pinned in the left pane');
    await leftPane
      .locator(
        '_react=ConversationListItem' +
          '[isPinned = true] ' +
          `[title = ${JSON.stringify(firstContact.profileName)}]`
      )
      .waitFor();

    {
      let state = await phone.expectStorageState('consistency check');

      debug('generating a lot of fake contacts');
      for (let i = 0; i < MAX_READ_KEYS + 1; i += 1) {
        state = state.addRecord({
          type: IdentifierType.CONTACT,
          record: {
            contact: {
              serviceUuid: UUID.generate().toString(),
            },
          },
        });
      }

      debug('pinning last contact');
      state = state.pin(lastContact);

      await phone.setStorageState(state);

      debug('sending fetch storage');
      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });
    }

    debug('wait for last contact to be pinned in the left pane');
    await leftPane
      .locator(
        '_react=ConversationListItem' +
          '[isPinned = true] ' +
          `[title = ${JSON.stringify(lastContact.profileName)}]`
      )
      .waitFor({ timeout: durations.MINUTE });

    debug('Verifying the final manifest version');
    const finalState = await phone.expectStorageState('consistency check');

    assert.strictEqual(finalState.version, 2);
  });
});
