// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Proto } from '@signalapp/mock-server';
import * as durations from '../../util/durations';
import type { App, Bootstrap } from './fixtures';
import {
  initStorage,
  debug,
  STICKER_PACKS,
  EMPTY,
  storeStickerPacks,
  getStickerPackRecordPredicate,
  getStickerPackLink,
} from './fixtures';

const { StickerPackOperation } = Proto.SyncMessage;

describe('storage service', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    ({ bootstrap, app } = await initStorage());
    const { server } = bootstrap;
    await storeStickerPacks(server, STICKER_PACKS);
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('should install/uninstall stickers', async () => {
    const { phone, desktop, contacts } = bootstrap;
    const [firstContact] = contacts;

    const window = await app.getWindow();

    const leftPane = window.locator('#LeftPane');
    const conversationView = window.locator(
      '.Inbox__conversation > .ConversationView'
    );

    debug('sending two sticker pack links');
    await firstContact.sendText(
      desktop,
      `First sticker pack ${getStickerPackLink(STICKER_PACKS[0])}`
    );
    await firstContact.sendText(
      desktop,
      `Second sticker pack ${getStickerPackLink(STICKER_PACKS[1])}`
    );

    await leftPane
      .locator(`[data-testid="${firstContact.toContact().aci}"]`)
      .click();

    {
      debug('installing first sticker pack via UI');
      const state = await phone.expectStorageState('initial state');

      await conversationView
        .locator(`a:has-text("${STICKER_PACKS[0].id.toString('hex')}")`)
        .click({ noWaitAfter: true });
      await window
        .locator(
          '.module-sticker-manager__preview-modal__footer--install button >> "Install"'
        )
        .click();

      debug('waiting for sync message');
      const { syncMessage } = await phone.waitForSyncMessage(entry =>
        Boolean(entry.syncMessage.stickerPackOperation?.length)
      );
      const [syncOp] = syncMessage.stickerPackOperation ?? [];
      assert.isTrue(STICKER_PACKS[0].id.equals(syncOp?.packId ?? EMPTY));
      assert.isTrue(STICKER_PACKS[0].key.equals(syncOp?.packKey ?? EMPTY));
      assert.strictEqual(syncOp?.type, StickerPackOperation.Type.INSTALL);

      debug('waiting for storage service update');
      const stateAfter = await phone.waitForStorageState({ after: state });
      const stickerPack = stateAfter.findRecord(
        getStickerPackRecordPredicate(STICKER_PACKS[0])
      );
      assert.ok(
        stickerPack,
        'New storage state should have sticker pack record'
      );
      assert.isTrue(
        STICKER_PACKS[0].key.equals(
          stickerPack?.record.stickerPack?.packKey ?? EMPTY
        ),
        'Wrong sticker pack key'
      );
      assert.strictEqual(
        stickerPack?.record.stickerPack?.position,
        6,
        'Wrong sticker pack position'
      );
    }

    {
      debug('uninstalling first sticker pack via UI');
      const state = await phone.expectStorageState('initial state');

      await conversationView
        .locator(`a:has-text("${STICKER_PACKS[0].id.toString('hex')}")`)
        .click({ noWaitAfter: true });
      await window
        .locator(
          '.module-sticker-manager__preview-modal__footer--install button ' +
            '>> "Uninstall"'
        )
        .click();

      // Confirm
      await window
        .locator('.module-Button--destructive >> "Uninstall"')
        .click();

      debug('waiting for sync message');
      const { syncMessage } = await phone.waitForSyncMessage(entry =>
        Boolean(entry.syncMessage.stickerPackOperation?.length)
      );
      const [syncOp] = syncMessage.stickerPackOperation ?? [];
      assert.isTrue(STICKER_PACKS[0].id.equals(syncOp?.packId ?? EMPTY));
      assert.strictEqual(syncOp?.type, StickerPackOperation.Type.REMOVE);

      debug('waiting for storage service update');
      const stateAfter = await phone.waitForStorageState({ after: state });
      const stickerPack = stateAfter.findRecord(
        getStickerPackRecordPredicate(STICKER_PACKS[0])
      );
      assert.ok(
        stickerPack,
        'New storage state should have sticker pack record'
      );
      assert.deepStrictEqual(
        stickerPack?.record.stickerPack?.packKey,
        EMPTY,
        'Sticker pack key should be removed'
      );
      const deletedAt =
        stickerPack?.record.stickerPack?.deletedAtTimestamp?.toNumber() ?? 0;
      assert.isAbove(
        deletedAt,
        Date.now() - durations.HOUR,
        'Sticker pack should have deleted at timestamp'
      );
    }

    debug('opening sticker manager');
    await conversationView
      .locator('.CompositionArea .module-sticker-button__button')
      .click();

    const stickerManager = conversationView.locator(
      '[data-testid=StickerManager]'
    );

    debug('switching to Installed tab');
    await stickerManager.locator('.Tabs__tab >> "Installed"').click();

    {
      debug('installing first sticker pack via storage service');
      const state = await phone.expectStorageState('initial state');

      await phone.setStorageState(
        state.updateRecord(
          getStickerPackRecordPredicate(STICKER_PACKS[0]),
          record => ({
            ...record,
            stickerPack: {
              ...record?.stickerPack,
              packKey: STICKER_PACKS[0].key,
              position: 7,
              deletedAtTimestamp: undefined,
            },
          })
        )
      );
      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      debug('waiting for sticker pack to become visible');
      await stickerManager
        .locator(`[data-testid="${STICKER_PACKS[0].id.toString('hex')}"]`)
        .waitFor();
    }

    {
      debug('installing second sticker pack via sync message');
      const state = await phone.expectStorageState('initial state');

      await phone.sendStickerPackSync({
        type: 'install',
        packId: STICKER_PACKS[1].id,
        packKey: STICKER_PACKS[1].key,
        timestamp: bootstrap.getTimestamp(),
      });

      debug('waiting for sticker pack to become visible');
      await stickerManager
        .locator(`[data-testid="${STICKER_PACKS[1].id.toString('hex')}"]`)
        .waitFor();

      debug('waiting for storage service update');
      const stateAfter = await phone.waitForStorageState({ after: state });
      const stickerPack = stateAfter.findRecord(
        getStickerPackRecordPredicate(STICKER_PACKS[1])
      );
      assert.ok(
        stickerPack,
        'New storage state should have sticker pack record'
      );
      assert.isTrue(
        STICKER_PACKS[1].key.equals(
          stickerPack?.record.stickerPack?.packKey ?? EMPTY
        ),
        'Wrong sticker pack key'
      );
      assert.strictEqual(
        stickerPack?.record.stickerPack?.position,
        7,
        'Wrong sticker pack position'
      );
    }

    debug('Verifying the final manifest version');
    const finalState = await phone.expectStorageState('consistency check');

    assert.strictEqual(finalState.version, 5);
  });
});
