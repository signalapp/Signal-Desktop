// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';

import type { PrimaryDevice } from '@signalapp/mock-server';
import * as durations from '../../util/durations/index.std.ts';
import type { Bootstrap, App } from '../bootstrap.node.ts';
import {
  artAddStickersRoute,
  showConversationRoute,
} from '../../util/signalRoutes.std.ts';
import {
  initStorage,
  STICKER_PACKS,
  storeStickerPacks,
} from '../storage/fixtures.node.ts';
import { strictAssert } from '../../util/assert.std.ts';

describe('routing', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    ({ bootstrap, app } = await initStorage());
  });

  afterEach(async function (this: Mocha.Context) {
    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('artAddStickersRoute', async () => {
    const { server } = bootstrap;
    const stickerPack = STICKER_PACKS[0];
    await storeStickerPacks(server, [stickerPack]);
    const stickerUrl = artAddStickersRoute.toWebUrl({
      packId: stickerPack.id.toString('hex'),
      packKey: stickerPack.key.toString('hex'),
    });
    await app.openSignalRoute(stickerUrl);
    const page = await app.getWindow();
    const title = page.locator(
      '.module-sticker-manager__preview-modal__footer--title',
      { hasText: 'Test Stickerpack' }
    );
    await title.waitFor();
    assert.isTrue(await title.isVisible());
  });

  it('showConversationRoute', async () => {
    const { contacts } = bootstrap;
    const [friend] = contacts as [PrimaryDevice];
    const page = await app.getWindow();
    await page.locator('#LeftPane').waitFor();
    const token = await page.evaluate(
      // oxlint-disable-next-line no-undef FIXME
      serviceId => window.SignalCI?.createNotificationToken(serviceId),
      friend.device.aci
    );
    strictAssert(typeof token === 'string', 'token must be returned');
    const conversationUrl = showConversationRoute.toAppUrl({
      token,
    });
    await app.openSignalRoute(conversationUrl);
    const title = page.locator(
      '.module-ConversationHeader__header__info__title',
      { hasText: 'Alice Smith' }
    );
    await title.waitFor();
    assert.isTrue(await title.isVisible());
  });
});
