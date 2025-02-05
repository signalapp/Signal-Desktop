// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as durations from '../../util/durations';
import type { Bootstrap, App } from '../bootstrap';
import {
  artAddStickersRoute,
  showConversationRoute,
} from '../../util/signalRoutes';
import {
  initStorage,
  STICKER_PACKS,
  storeStickerPacks,
} from '../storage/fixtures';
import { strictAssert } from '../../util/assert';

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
    const [friend] = contacts;
    const page = await app.getWindow();
    await page.locator('#LeftPane').waitFor();
    const token = await page.evaluate(
      serviceId => window.SignalCI?.createNotificationToken(serviceId),
      friend.toContact().aci
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
