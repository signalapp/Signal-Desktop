// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { range } from 'lodash';
import { Proto } from '@signalapp/mock-server';
import type { StorageStateRecord } from '@signalapp/mock-server';
import fs from 'fs/promises';
import path from 'path';

import * as durations from '../../util/durations';
import type { App, Bootstrap } from './fixtures';
import { initStorage, debug } from './fixtures';

const { StickerPackOperation } = Proto.SyncMessage;

const FIXTURES = path.join(__dirname, '..', '..', '..', 'fixtures');
const IdentifierType = Proto.ManifestRecord.Identifier.Type;

const EMPTY = new Uint8Array(0);

export type StickerPackType = Readonly<{
  id: Buffer;
  key: Buffer;
  stickerCount: number;
}>;

const STICKER_PACKS: ReadonlyArray<StickerPackType> = [
  {
    id: Buffer.from('c40ed069cdc2b91eccfccf25e6bcddfc', 'hex'),
    key: Buffer.from(
      'cefadd6e81c128680aead1711eb5c92c10f63bdfbc78528a4519ba682de396e4',
      'hex'
    ),
    stickerCount: 1,
  },
  {
    id: Buffer.from('ae8fedafda4768fd3384d4b3b9db963d', 'hex'),
    key: Buffer.from(
      '53f4aa8b95e1c2e75afab2328fe67eb6d7affbcd4f50cd4da89dfc325dbc73ca',
      'hex'
    ),
    stickerCount: 1,
  },
];

function getStickerPackLink(pack: StickerPackType): string {
  return (
    `https://signal.art/addstickers/#pack_id=${pack.id.toString('hex')}&` +
    `pack_key=${pack.key.toString('hex')}`
  );
}

function getStickerPackRecordPredicate(
  pack: StickerPackType
): (record: StorageStateRecord) => boolean {
  return ({ type, record }: StorageStateRecord): boolean => {
    if (type !== IdentifierType.STICKER_PACK) {
      return false;
    }
    return pack.id.equals(record.stickerPack?.packId ?? EMPTY);
  };
}

describe('storage service', function needsName() {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    ({ bootstrap, app } = await initStorage());

    const { server } = bootstrap;

    await Promise.all(
      STICKER_PACKS.map(async ({ id, stickerCount }) => {
        const hexId = id.toString('hex');

        await server.storeStickerPack({
          id,
          manifest: await fs.readFile(
            path.join(FIXTURES, `stickerpack-${hexId}.bin`)
          ),
          stickers: await Promise.all(
            range(0, stickerCount).map(async index =>
              fs.readFile(
                path.join(FIXTURES, `stickerpack-${hexId}-${index}.bin`)
              )
            )
          ),
        });
      })
    );
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

  it('should install/uninstall stickers', async () => {
    const { phone, desktop, contacts } = bootstrap;
    const [firstContact] = contacts;

    const window = await app.getWindow();

    const leftPane = window.locator('.left-pane-wrapper');
    const conversationStack = window.locator('.conversation-stack');

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
      .locator(
        '_react=ConversationListItem' +
          `[title = ${JSON.stringify(firstContact.profileName)}]`
      )
      .click();

    {
      debug('installing first sticker pack via UI');
      const state = await phone.expectStorageState('initial state');

      await conversationStack
        .locator(`a:has-text("${STICKER_PACKS[0].id.toString('hex')}")`)
        .click({ noWaitAfter: true });
      await window
        .locator(
          '.module-sticker-manager__preview-modal__container button >> "Install"'
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

      await conversationStack
        .locator(`a:has-text("${STICKER_PACKS[0].id.toString('hex')}")`)
        .click({ noWaitAfter: true });
      await window
        .locator(
          '.module-sticker-manager__preview-modal__container button ' +
            '>> "Uninstall"'
        )
        .click();

      // Confirm
      await window.locator('.module-Modal button >> "Uninstall"').click();

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

    debug('opening sticker picker');
    conversationStack
      .locator('.CompositionArea .module-sticker-button__button')
      .click();

    const stickerPicker = conversationStack.locator('.module-sticker-picker');

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
      stickerPicker
        .locator(
          'button.module-sticker-picker__header__button' +
            `[key="${STICKER_PACKS[0].id.toString('hex')}"]`
        )
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
      stickerPicker
        .locator(
          'button.module-sticker-picker__header__button' +
            `[key="${STICKER_PACKS[1].id.toString('hex')}"]`
        )
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
        6,
        'Wrong sticker pack position'
      );
    }

    debug('Verifying the final manifest version');
    const finalState = await phone.expectStorageState('consistency check');

    assert.strictEqual(finalState.version, 5);
  });
});
