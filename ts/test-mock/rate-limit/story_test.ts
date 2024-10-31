// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import createDebug from 'debug';
import { Proto, StorageState } from '@signalapp/mock-server';

import * as durations from '../../util/durations';
import { uuidToBytes } from '../../util/uuidToBytes';
import { MY_STORY_ID } from '../../types/Stories';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';

export const debug = createDebug('mock:test:rate-limit');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('story/no-sender-key', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap({
      contactCount: 0,
      contactsWithoutProfileKey: 40,
    });
    await bootstrap.init();

    const { phone } = bootstrap;

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
      hasSetMyStoriesPrivacy: true,
    });

    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(MY_STORY_ID),
          isBlockList: true,
          name: MY_STORY_ID,
          recipientServiceIds: [],
        },
      },
    });
    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function (this: Mocha.Context) {
    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('should successfully send story', async () => {
    const {
      server,
      contactsWithoutProfileKey: contacts,
      phone,
      desktop,
    } = bootstrap;

    for (const contact of contacts) {
      server.rateLimit({ source: desktop.aci, target: contact.device.aci });
    }

    const window = await app.getWindow();

    debug('Posting a new story');
    {
      const storiesPane = window.locator('.Stories');
      const storiesCreator = window.locator('.StoryCreator');

      await window.getByTestId('NavTabsItem--Stories').click();

      await storiesPane
        .locator('button.Stories__pane__add-story__button')
        .click();
      await storiesPane
        .locator(
          '.ContextMenu__popper .Stories__pane__add-story__option--title ' +
            '>> "Text story"'
        )
        .click();

      debug('Focusing textarea');
      // Note: For some reason `.click()` doesn't work here anymore.
      await storiesCreator.locator('.TextAttachment').dispatchEvent('click');

      debug('Entering text');
      await storiesCreator
        .locator('.TextAttachment__text__textarea')
        .fill('123');

      debug('Clicking "Next"');
      await storiesCreator
        .locator('.StoryCreator__toolbar button >> "Next"')
        .click();

      debug('Selecting "My Story"');
      await window
        .locator('.SendStoryModal__distribution-list__name >> "My Story"')
        .click();

      debug('Hitting Send');
      await window.locator('button.SendStoryModal__send').click();
    }

    debug('Verifying that all contacts received story');
    await Promise.all(
      contacts.map(async contact => {
        const { storyMessage } = await contact.waitForStory();
        assert.isTrue(
          phone.profileKey
            .serialize()
            .equals(storyMessage.profileKey ?? new Uint8Array(0))
        );
        assert.strictEqual(storyMessage.textAttachment?.text, '123');
      })
    );
  });
});
