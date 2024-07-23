// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Proto } from '@signalapp/mock-server';
import { assert } from 'chai';
import Long from 'long';
import type { App } from '../../playwright';
import * as durations from '../../../util/durations';
import { Bootstrap } from '../../bootstrap';
import type { SignalDesktopUI } from '../../signal-desktop-ui';

const pause = process.env.PAUSE;

const createMessage = (body: string): Proto.IDataMessage => {
  return {
    body,
    groupV2: undefined,
    timestamp: Long.fromNumber(Date.now()),
  };
};

// https://github.com/signalapp/Signal-Desktop/issues/6659
describe('[6659] Editing a sent message does not delete draft of new message', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let ui: SignalDesktopUI;
  let sentMessage: Proto.IDataMessage;

  beforeEach(async () => {
    bootstrap = new Bootstrap({});
    await bootstrap.init();
    app = await bootstrap.link();
    ui = await bootstrap.signalDesktopUI();

    const { phone, desktop } = bootstrap;

    sentMessage = createMessage('A B C');

    await phone.sendRaw(
      desktop,
      {
        dataMessage: sentMessage,
      },
      {
        timestamp: Number(sentMessage.timestamp),
      }
    );
  });

  afterEach(async function (this: Mocha.Context) {
    if (!pause) {
      await bootstrap?.maybeSaveLogs(this.currentTest, app);
      await app?.close();
      await bootstrap?.teardown();
    }
  });

  /*
  
    See: `ts/components/conversation/MessageContextMenu.tsx`

    @todo: test is flaky.

  */
  it('disallows editing sent messages when there is a draft present', async () => {
    await ui.openFirstConversation();
    await ui.typeMessage('Draft message');

    assert.isFalse(
      await ui.isShowingEditMessageMenuItem(sentMessage.timestamp)
    );
  });
});
