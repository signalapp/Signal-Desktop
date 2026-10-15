// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { access, readFile } from 'node:fs/promises';
import assert from 'node:assert';
import { join } from 'node:path';
import { Proto, EMPTY_DATA_MESSAGE } from '@signalapp/mock-server';
import createDebug from 'debug';
import type { Page } from 'playwright';

import type { Group, PrimaryDevice } from '@signalapp/mock-server';

import * as durations from '../../util/durations/index.std.ts';
import { Bootstrap } from '../bootstrap.node.ts';
import { acceptConversation, sendTextMessage } from '../helpers.node.ts';
import { IMAGE_PNG } from '../../types/MIME.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { sleep } from '../../util/sleep.std.ts';

import type { App } from '../playwright.node.ts';

const CAT_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'cat-screenshot.png'
);

export const debug = createDebug('mock:test:edit');

describe('unknown contacts', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let page: Page;
  let unknownContact: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 1, unknownContactCount: 1 });
    await bootstrap.init();
    app = await bootstrap.link();
    page = await app.getWindow();

    const { unknownContacts } = bootstrap;
    [unknownContact] = unknownContacts as [PrimaryDevice];
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('blocks incoming calls from unknown contacts & shows message request', async () => {
    const { desktop } = bootstrap;

    debug('sending calling offer message');
    await unknownContact.sendRaw(desktop, {
      content: {
        callMessage: {
          offer: {
            id: BigInt(Math.floor(Math.random() * 1e10)),
            type: Proto.CallMessage.Offer.Type.OFFER_AUDIO_CALL,
            opaque: new Uint8Array(0),
          },
          answer: null,
          iceUpdate: null,
          busy: null,
          hangup: null,
          destinationDeviceId: null,
          opaque: null,
        },
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    });

    debug('opening conversation');
    const leftPane = page.locator('#LeftPane');

    const conversationListItem = leftPane.getByRole('button', {
      name: 'Chat with Unknown contact',
    });
    await conversationListItem.getByText('Message Request').click();

    const conversationStack = page.locator('.Inbox__conversation-stack');
    await conversationStack.getByText('Missed voice call').waitFor();

    debug('accepting message request');
    await page.getByText('message you and share your name').waitFor();
    await acceptConversation(page);
    await page.getByText('message you and share your name').waitFor({
      state: 'detached',
    });
    assert.strictEqual(
      await page.getByText('message you and share your name').count(),
      0
    );
  });

  it('syncs message request state', async () => {
    const { phone, desktop } = bootstrap;

    debug('sending regular text message');
    await unknownContact.sendText(desktop, 'hello');

    debug('opening conversation');
    const leftPane = page.locator('#LeftPane');

    const conversationListItem = leftPane.getByRole('button', {
      name: 'Chat with Unknown contact',
    });
    await conversationListItem.getByText('Message Request').click();

    debug('sending message request sync');
    await phone.sendRaw(desktop, {
      content: {
        syncMessage: {
          content: {
            messageRequestResponse: {
              type: Proto.SyncMessage.MessageRequestResponse.Type.ACCEPT,
              threadAciBinary: unknownContact.device.aciRawUuid,
              groupId: null,
              threadAci: null,
            },
          },
          read: null,
          stickerPackOperation: null,
          viewed: null,
          padding: null,
        },
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    });

    debug('verifying that compose is now visible');
    const composeArea = page.locator(
      '.composition-area-wrapper, .Inbox__conversation .ConversationView'
    );
    const input = composeArea.locator('[data-testid=CompositionInput]');
    await input.waitFor();
  });

  async function sendEdit(
    originalTimestamp: number,
    body: string,
    group?: Group
  ) {
    const timestamp = originalTimestamp + 1;
    await unknownContact.sendRaw(
      bootstrap.desktop,
      {
        content: {
          editMessage: {
            targetSentTimestamp: BigInt(originalTimestamp),
            dataMessage: {
              ...EMPTY_DATA_MESSAGE,
              body,
              groupV2: group
                ? {
                    masterKey: group.masterKey,
                    revision: group.revision,
                    groupChange: null,
                  }
                : null,
              timestamp: BigInt(timestamp),
            },
          },
        },
        pniSignatureMessage: null,
        senderKeyDistributionMessage: null,
      },
      { timestamp }
    );
  }

  async function checkNotDownloaded(originalTimestamp: number) {
    // Give any (incorrectly) queued download a chance to finish
    await sleep(durations.SECOND);

    const [message] = await app.getMessagesBySentAt(originalTimestamp);
    strictAssert(message, 'message exists in DB');
    assert.strictEqual(message.attachments?.length, 1);
    assert.strictEqual(message.attachments?.[0]?.path, undefined);
    assert.strictEqual(
      message.editHistory?.[0]?.attachments?.[0]?.path,
      undefined
    );
  }

  it('does not download attachments when convo not accepted, even for edits', async () => {
    const { desktop } = bootstrap;
    const pointer = await bootstrap.encryptAndStoreAttachmentOnCDN(
      await readFile(CAT_PATH),
      IMAGE_PNG
    );

    const timestamp = Date.now();
    debug('sending message with attachment');
    await sendTextMessage({
      from: unknownContact,
      to: desktop,
      desktop,
      text: 'v1',
      attachments: [pointer],
      timestamp,
    });

    debug('verifying message is received');
    await app.waitForMessage({
      timestamp,
      predicate: () => true,
    });

    debug('verifying attachment is not downloaded');
    await checkNotDownloaded(timestamp);

    debug('sending edit');
    await sendEdit(timestamp, 'v2');

    debug('verify edit is processed');
    await app.waitForMessage({
      timestamp,
      predicate: message =>
        message.body === 'v2' && message.editHistory?.length === 2,
    });

    debug('verifying attachment in edit is not downloaded');
    await checkNotDownloaded(timestamp);

    debug('accepting message request');
    const leftPane = page.locator('#LeftPane');
    await leftPane
      .getByRole('button', { name: 'Chat with Unknown contact' })
      .click();
    await acceptConversation(page);

    debug('waiting for attachment download');
    const downloaded = await app.waitForMessage({
      timestamp,
      predicate: ({ attachments, editHistory }) =>
        attachments?.[0]?.path != null &&
        editHistory?.[0]?.attachments?.[0]?.path != null,
    });

    debug('verifying attachment on disk');
    const path = downloaded.attachments?.[0]?.path;
    strictAssert(path, 'attachment path exists');
    assert.strictEqual(
      downloaded.editHistory?.[0]?.attachments?.[0]?.path,
      path
    );
    await access(bootstrap.getAbsoluteAttachmentPath(path));
  });
});
