// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Proto } from '@signalapp/mock-server';
import { assert } from 'chai';
import Long from 'long';
import type { Locator } from 'playwright';
import type { App } from '../../playwright';
import * as durations from '../../../util/durations';
import { Bootstrap } from '../../bootstrap';

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
  let screen: Screen;
  let sentMessage: Proto.IDataMessage;

  beforeEach(async () => {
    bootstrap = new Bootstrap({});
    await bootstrap.init();
    app = await bootstrap.link();
    screen = new Screen(app);

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
    This is the test we want to pass.
    
    See: `setMessageToEdit` (ts/state/ducks/conversations.ts)

    It looks to me like the draft is being completely overwritten when editing, 
    so not sure what the solution is.

    Skipped because I don't know how to make it pass.

    This does demonstrate an alternative way to express the tests more in user-centric 
    terms using `Screen`.

  */
  it.skip('[wip, fails] restores draft after editing a sent message', async () => {
    await screen.openFirstConversation();
    await screen.typeMessage('Draft message');
    await screen.editMessage(sentMessage.timestamp, 'A B C D E F');

    assert.strictEqual(await screen.draftText(), 'Draft message');
  });

  /*
  
    This test demonstrates the current behaviour. Delete this once the above test passes.

  */
  it('unexpectedly clears draft after editing a sent message', async () => {
    await screen.openFirstConversation();
    await screen.typeMessage('Draft message');
    await screen.editMessage(sentMessage.timestamp, 'A B C D E F');

    assert.strictEqual(await screen.draftText(), '');
  });
});

class Screen {
  constructor(private app: App) {}

  public openFirstConversation = async (): Promise<void> => {
    const window = await this.app.getWindow();
    const leftPane = window.locator('#LeftPane');

    await leftPane
      .locator('.module-conversation-list__item--contact-or-conversation')
      .first()
      .click();
  };

  public editMessage = async (
    timestamp: Long | null | undefined,
    text: string
  ): Promise<void> => {
    const page = await this.app.getWindow();

    await page
      .getByTestId(`${timestamp}`)
      .locator('.module-message__buttons__menu')
      .click();

    await page.getByRole('menuitem', { name: 'Edit' }).click();

    await this.typeMessage(text);

    await this.sendMessage();
  };

  public typeMessage = async (text: string): Promise<void> => {
    const messageTextInput = await this.getMessageTextInput();
    await messageTextInput.fill(text);
  };

  public sendMessage = async (): Promise<void> => {
    const messageTextInput = await this.getMessageTextInput();
    await messageTextInput.press('Enter');
  };

  public draftText = async (): Promise<string | null> => {
    const messageTextInput = await this.getMessageTextInput();
    return messageTextInput.textContent();
  };

  private getMessageTextInput = (): Promise<Locator> =>
    this.app.waitForEnabledComposer();
}
