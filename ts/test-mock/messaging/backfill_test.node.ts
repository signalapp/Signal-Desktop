// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { PrimaryDevice } from '@signalapp/mock-server';
import { Proto } from '@signalapp/mock-server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import createDebug from 'debug';
import type { Page } from 'playwright';
import assert from 'node:assert';
import Long from 'long';

import { LONG_MESSAGE, IMAGE_JPEG } from '../../types/MIME.std.js';
import * as durations from '../../util/durations/index.std.js';
import type { App } from '../playwright.node.js';
import { Bootstrap } from '../bootstrap.node.js';
import {
  sendTextMessage,
  getTimelineMessageWithText,
} from '../helpers.node.js';

export const debug = createDebug('mock:test:backfill');

const FIXTURES_PATH = join(__dirname, '..', '..', '..', 'fixtures');

const CAT_PATH = join(FIXTURES_PATH, 'cat-screenshot.png');
const SNOW_PATH = join(FIXTURES_PATH, 'snow.jpg');

const { Status } = Proto.SyncMessage.AttachmentBackfillResponse.AttachmentData;

function createResponse(
  response: Proto.SyncMessage.IAttachmentBackfillResponse
): Proto.IContent {
  return { syncMessage: { attachmentBackfillResponse: response } };
}

describe('attachment backfill', function (this: Mocha.Suite) {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;
  let page: Page;
  let unknownContact: PrimaryDevice;
  let textAttachment: Proto.IAttachmentPointer;
  let catAttachment: Proto.IAttachmentPointer;
  let snowAttachment: Proto.IAttachmentPointer;

  beforeEach(async () => {
    bootstrap = new Bootstrap({ contactCount: 1, unknownContactCount: 1 });
    await bootstrap.init();
    app = await bootstrap.link();
    page = await app.getWindow();

    const { unknownContacts } = bootstrap;
    [unknownContact] = unknownContacts;

    textAttachment = await bootstrap.encryptAndStoreAttachmentOnCDN(
      Buffer.from('look at this pic, it is gorgeous!'),
      LONG_MESSAGE
    );

    const plaintextCat = await readFile(CAT_PATH);
    catAttachment = await bootstrap.encryptAndStoreAttachmentOnCDN(
      plaintextCat,
      IMAGE_JPEG
    );

    const plaintextSnow = await readFile(SNOW_PATH);
    snowAttachment = await bootstrap.encryptAndStoreAttachmentOnCDN(
      plaintextSnow,
      IMAGE_JPEG
    );
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('should be requested on manual download', async () => {
    const { phone, desktop } = bootstrap;

    debug('sending a message with attachment that is 404 on CDN');
    const timestamp = bootstrap.getTimestamp();
    await sendTextMessage({
      from: unknownContact,
      to: desktop,
      desktop,
      text: 'look at this pic!',
      attachments: [
        { ...textAttachment, cdnKey: 'text-not-found' },
        { ...catAttachment, cdnKey: 'cat-not-found' },
        { ...snowAttachment, cdnKey: 'snow-not-found' },
      ],
      timestamp,
    });

    debug('opening conversation');
    const leftPane = page.locator('#LeftPane');

    const conversationListItem = leftPane.getByRole('button', {
      name: 'Chat with Unknown contact',
    });
    await conversationListItem.getByText('Message Request').click();

    debug('dowloading attachment');
    const conversationStack = page.locator('.Inbox__conversation-stack');
    const startDownload = conversationStack.getByRole('button', {
      name: 'Start Download',
    });
    await startDownload.click();

    debug('waiting for backfill request');
    const {
      syncMessage: { attachmentBackfillRequest: request },
    } = await phone.waitForSyncMessage(entry => {
      return entry.syncMessage.attachmentBackfillRequest != null;
    });

    assert.deepEqual(
      request?.targetConversation?.threadServiceIdBinary,
      unknownContact.device.aciBinary
    );
    assert.deepEqual(
      request?.targetMessage?.authorServiceIdBinary,
      unknownContact.device.aciBinary
    );
    assert.strictEqual(
      request?.targetMessage?.sentTimestamp?.toNumber(),
      timestamp
    );

    // No download buttons
    debug('waiting for spinner to become visible');
    await startDownload.waitFor({ state: 'detached' });
    const cancelDownload = conversationStack.getByRole('button', {
      name: 'Cancel Download',
    });
    await cancelDownload.waitFor();

    debug('sending pending backfill response');
    await phone.sendRaw(
      desktop,
      createResponse({
        targetConversation: request.targetConversation,
        targetMessage: request.targetMessage,
        attachments: {
          longText: { status: Status.PENDING },
          attachments: [{ status: Status.PENDING }, { status: Status.PENDING }],
        },
      }),
      {
        timestamp: bootstrap.getTimestamp(),
      }
    );

    debug('resolving long text');
    await phone.sendRaw(
      desktop,
      createResponse({
        targetConversation: request.targetConversation,
        targetMessage: request.targetMessage,
        attachments: {
          longText: { attachment: textAttachment },
          attachments: [{ status: Status.PENDING }, { status: Status.PENDING }],
        },
      }),
      {
        timestamp: bootstrap.getTimestamp(),
      }
    );

    await getTimelineMessageWithText(page, 'gorgeous').waitFor();

    debug('resolving first attachment');
    await phone.sendRaw(
      desktop,
      createResponse({
        targetConversation: request.targetConversation,
        targetMessage: request.targetMessage,
        attachments: {
          longText: { attachment: textAttachment },
          attachments: [
            { attachment: catAttachment },
            { status: Status.PENDING },
          ],
        },
      }),
      {
        timestamp: bootstrap.getTimestamp(),
      }
    );

    await conversationStack
      .getByRole('button', {
        name: 'Open this attachment in a larger view',
      })
      .first()
      .waitFor();

    debug('failing second attachment');
    await phone.sendRaw(
      desktop,
      createResponse({
        targetConversation: request.targetConversation,
        targetMessage: request.targetMessage,
        attachments: {
          longText: { attachment: textAttachment },
          attachments: [
            { attachment: catAttachment },
            { status: Status.TERMINAL_ERROR },
          ],
        },
      }),
      {
        timestamp: bootstrap.getTimestamp(),
      }
    );

    await page.locator('.Toast >> "Download failed"').waitFor();
    await cancelDownload.waitFor({ state: 'detached' });
    await conversationStack
      .getByRole('button', {
        name: 'This media is not available',
      })
      .waitFor();

    await conversationStack
      .locator('.module-image__undownloadable-icon')
      .waitFor();
  });

  it('should show modal on timeout', async () => {
    const { desktop } = bootstrap;

    debug('sending a message with attachment that is 404 on CDN');
    const timestamp = bootstrap.getTimestamp();
    await sendTextMessage({
      from: unknownContact,
      to: desktop,
      desktop,
      text: undefined,
      attachments: [{ ...catAttachment, cdnKey: 'cat-not-found' }],
      timestamp,
    });

    debug('opening conversation');
    const leftPane = page.locator('#LeftPane');

    const conversationListItem = leftPane.getByRole('button', {
      name: 'Chat with Unknown contact',
    });
    await conversationListItem.getByText('Message Request').click();

    debug('dowloading attachment');
    const conversationStack = page.locator('.Inbox__conversation-stack');
    const startDownload = conversationStack.getByRole('button', {
      name: 'Start Download',
    });
    await startDownload.click();

    debug('waiting for modal');
    const modal = page.getByTestId('BackfillFailureModal');
    await modal.waitFor();
    await modal.locator('text=/internet connection/').waitFor();
  });

  it('should show modal on missing message', async () => {
    const { phone, desktop } = bootstrap;

    debug('sending a message with attachment that is 404 on CDN');
    const timestamp = bootstrap.getTimestamp();
    await sendTextMessage({
      from: unknownContact,
      to: desktop,
      desktop,
      text: undefined,
      attachments: [{ ...catAttachment, cdnKey: 'cat-not-found' }],
      timestamp,
    });

    debug('opening conversation');
    const leftPane = page.locator('#LeftPane');

    const conversationListItem = leftPane.getByRole('button', {
      name: 'Chat with Unknown contact',
    });
    await conversationListItem.getByText('Message Request').click();

    debug('downloading attachment');
    const conversationStack = page.locator('.Inbox__conversation-stack');
    const startDownload = conversationStack.getByRole('button', {
      name: 'Start Download',
    });
    await startDownload.click();

    debug('waiting for request');
    const {
      syncMessage: { attachmentBackfillRequest: request },
    } = await phone.waitForSyncMessage(entry => {
      return entry.syncMessage.attachmentBackfillRequest != null;
    });

    assert.deepEqual(
      request?.targetConversation?.threadServiceIdBinary,
      unknownContact.device.aciBinary
    );
    assert.deepEqual(
      request?.targetMessage?.authorServiceIdBinary,
      unknownContact.device.aciBinary
    );
    assert.strictEqual(
      request?.targetMessage?.sentTimestamp?.toNumber(),
      timestamp
    );

    debug('sending not found response');
    await phone.sendRaw(
      desktop,
      createResponse({
        targetConversation: request.targetConversation,
        targetMessage: request.targetMessage,
        error:
          Proto.SyncMessage.AttachmentBackfillResponse.Error.MESSAGE_NOT_FOUND,
      }),
      {
        timestamp: bootstrap.getTimestamp(),
      }
    );

    debug('waiting for modal');
    const modal = page.getByTestId('BackfillFailureModal');
    await modal.waitFor();
    await modal.locator('text=/no longer available/').waitFor();
  });

  it('should resolve sticker', async () => {
    const { phone, desktop } = bootstrap;

    debug('sending a message with attachment that is 404 on CDN');
    const timestamp = bootstrap.getTimestamp();
    await sendTextMessage({
      from: unknownContact,
      to: desktop,
      desktop,
      text: undefined,
      sticker: {
        packId: Buffer.from('ae8fedafda4768fd3384d4b3b9db963d', 'hex'),
        packKey: Buffer.from(
          '53f4aa8b95e1c2e75afab2328fe67eb6d7affbcd4f50cd4da89dfc325dbc73ca',
          'hex'
        ),
        stickerId: 1,
        emoji: '🐈',
        data: { ...catAttachment, cdnKey: 'cat-not-found' },
      },
      timestamp,
    });

    debug('opening conversation');
    const leftPane = page.locator('#LeftPane');

    const conversationListItem = leftPane.getByRole('button', {
      name: 'Chat with Unknown contact',
    });
    await conversationListItem.getByText('Message Request').click();

    debug('dowloading attachment');
    const conversationStack = page.locator('.Inbox__conversation-stack');
    const startDownload = conversationStack.getByRole('button', {
      name: 'Start Download',
    });
    await startDownload.click();

    debug('waiting for backfill request');
    const {
      syncMessage: { attachmentBackfillRequest: request },
    } = await phone.waitForSyncMessage(entry => {
      return entry.syncMessage.attachmentBackfillRequest != null;
    });

    assert.deepEqual(
      request?.targetConversation?.threadServiceIdBinary,
      unknownContact.device.aciBinary
    );
    assert.deepEqual(
      request?.targetMessage?.authorServiceIdBinary,
      unknownContact.device.aciBinary
    );
    assert.strictEqual(
      request?.targetMessage?.sentTimestamp?.toNumber(),
      timestamp
    );

    debug('sending pending backfill response');
    await phone.sendRaw(
      desktop,
      createResponse({
        targetConversation: request.targetConversation,
        targetMessage: request.targetMessage,
        attachments: {
          attachments: [{ status: Status.PENDING }],
        },
      }),
      {
        timestamp: bootstrap.getTimestamp(),
      }
    );

    debug('resolving sticker');
    await phone.sendRaw(
      desktop,
      createResponse({
        targetConversation: request.targetConversation,
        targetMessage: request.targetMessage,
        attachments: {
          attachments: [{ attachment: catAttachment }],
        },
      }),
      {
        timestamp: bootstrap.getTimestamp(),
      }
    );

    await conversationStack
      .locator('.module-image-grid--with-sticker')
      .waitFor();
  });

  it('should not request backfill on quote/preview', async () => {
    const { desktop } = bootstrap;

    debug('sending a message with attachment that is 404 on CDN');
    const timestamp = bootstrap.getTimestamp();
    await sendTextMessage({
      from: unknownContact,
      to: desktop,
      desktop,
      quote: {
        id: Long.fromNumber(bootstrap.getTimestamp()),
        authorAciBinary: unknownContact.device.aciRawUuid,
        text: 'quote text',
        attachments: [
          {
            contentType: IMAGE_JPEG,
            fileName: 'snow.jpg',
            thumbnail: { ...snowAttachment, cdnKey: 'snow-not-found' },
          },
        ],
        type: Proto.DataMessage.Quote.Type.NORMAL,
      },
      preview: {
        url: 'https://signal.org',
        title: 'Signal',
        image: { ...catAttachment, cdnKey: 'cat-not-found' },
      },
      text: 'https://signal.org',
      timestamp,
    });

    debug('opening conversation');
    const leftPane = page.locator('#LeftPane');

    const conversationListItem = leftPane.getByRole('button', {
      name: 'Chat with Unknown contact',
    });
    await conversationListItem.getByText('Message Request').click();

    debug('dowloading attachment');
    const conversationStack = page.locator('.Inbox__conversation-stack');
    const startDownload = conversationStack.getByRole('button', {
      name: 'Start Download',
    });
    await startDownload.click();

    await page.locator('.Toast >> "Download failed"').waitFor();
  });
});
