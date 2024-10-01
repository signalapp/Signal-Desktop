// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Proto } from '@signalapp/mock-server';

import * as durations from '../../util/durations';
import type { App, Bootstrap } from './fixtures';
import { initStorage, debug } from './fixtures';

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('storage service', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    ({ bootstrap, app } = await initStorage());
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('should drop gv1 record if there is a matching gv2 record', async () => {
    const { phone } = bootstrap;

    debug('adding both records');
    {
      const state = await phone.expectStorageState('consistency check');

      const groupV1Id = Buffer.from('Wi9258rCEp7AdSdp+jCMlQ==', 'base64');
      const masterKey = Buffer.from(
        '2+rdvzFGCOJI8POHcPNZHrYQWS/JXmT63R5OXKxhrPk=',
        'base64'
      );

      const updatedState = await phone.setStorageState(
        state
          .addRecord({
            type: IdentifierType.GROUPV1,
            record: {
              groupV1: {
                id: groupV1Id,
              },
            },
          })
          .addRecord({
            type: IdentifierType.GROUPV2,
            record: {
              groupV2: {
                masterKey,
              },
            },
          })
      );

      debug('sending fetch storage');
      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      debug('waiting for next storage state');
      const nextState = await phone.waitForStorageState({
        after: updatedState,
      });

      assert.isFalse(
        nextState.hasRecord(({ type }) => {
          return type === IdentifierType.GROUPV1;
        }),
        'should not have gv1 record'
      );

      assert.isTrue(
        nextState.hasRecord(({ type, record }) => {
          if (type !== IdentifierType.GROUPV2) {
            return false;
          }

          if (!record.groupV2?.masterKey) {
            return false;
          }
          return Buffer.from(masterKey).equals(record.groupV2.masterKey);
        }),
        'should have gv2 record'
      );
    }
  });

  it('should drop duplicate account record', async () => {
    const { phone } = bootstrap;

    debug('duplicating account record');
    const state = await phone.expectStorageState('consistency check');

    const oldAccount = state.findRecord(({ type }) => {
      return type === IdentifierType.ACCOUNT;
    });
    if (oldAccount === undefined) {
      throw new Error('should have initial account record');
    }

    const updatedState = await phone.setStorageState(
      state.addRecord({
        type: IdentifierType.ACCOUNT,
        record: oldAccount.record,
      })
    );

    debug('sending fetch storage');
    await phone.sendFetchStorage({
      timestamp: bootstrap.getTimestamp(),
    });

    debug('waiting for next storage state');
    const nextState = await phone.waitForStorageState({
      after: updatedState,
    });

    assert.isFalse(
      nextState.hasRecord(({ type, key }) => {
        return type === IdentifierType.ACCOUNT && key.equals(oldAccount.key);
      }),
      'should not have old account record'
    );

    assert.isTrue(
      nextState.hasRecord(({ type }) => {
        return type === IdentifierType.ACCOUNT;
      }),
      'should have new account record'
    );
  });
});
