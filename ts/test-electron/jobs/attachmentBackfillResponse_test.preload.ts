// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v7 } from 'uuid';

import * as Bytes from '../../Bytes.std.ts';
import { getRandomBytes } from '../../Crypto.node.ts';
import { createLogger } from '../../logging/log.std.ts';
import type { MessageAttributesType } from '../../model-types.std.ts';
import { SignalService as Proto } from '../../protobuf/index.std.ts';
import { MessageCache } from '../../services/MessageCache.preload.ts';
import { DataWriter } from '../../sql/Client.preload.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import type { SingleProtoJobData } from '../../textsecure/SendMessage.preload.ts';
import { AttachmentBackfillRequestSyncEvent } from '../../textsecure/messageReceiverEvents.std.ts';
import type {
  AttachmentType,
  UploadedAttachmentType,
} from '../../types/Attachment.std.ts';
import { IMAGE_JPEG, LONG_MESSAGE } from '../../types/MIME.std.ts';
import type { AciString } from '../../types/ServiceId.std.ts';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';
import { singleProtoJobQueue } from '../../jobs/singleProtoJobQueue.preload.ts';
import {
  attachmentBackfillResponseJobQueue,
  handleAttachmentBackfillRequest,
} from '../../jobs/attachmentBackfillResponseJobQueue.preload.ts';
import { getMessageById } from '../../messages/getMessageById.preload.ts';
import {
  getAttachmentBackfillResponseData,
  runAttachmentBackfillResponseJob,
} from '../../jobs/helpers/attachmentBackfillResponse.preload.ts';
import { writeNewAttachmentData } from '../../util/migrations.preload.ts';
import { DAY } from '../../util/durations/index.std.ts';

const log = createLogger('attachmentBackfillResponse_test');

const { Status } = Proto.SyncMessage.AttachmentBackfillResponse.AttachmentData;
const { MESSAGE_NOT_FOUND } =
  Proto.SyncMessage.AttachmentBackfillResponse.Error;

type DecodedResponse = Proto.SyncMessage.AttachmentBackfillResponse;
type DecodedAttachmentData =
  Proto.SyncMessage.AttachmentBackfillResponse.AttachmentData | null;

async function downloadedAttachment(
  overrides: Partial<AttachmentType> = {}
): Promise<AttachmentType> {
  return {
    contentType: IMAGE_JPEG,
    ...(await writeNewAttachmentData(getRandomBytes(100))),
    ...overrides,
  };
}

function cdnFields(uploadTimestamp: number): Partial<AttachmentType> {
  return {
    cdnKey: `cdn-${v7()}`,
    cdnNumber: 3,
    key: Bytes.toBase64(getRandomBytes(64)),
    digest: Bytes.toBase64(getRandomBytes(32)),
    uploadTimestamp,
  };
}

function freshCdnFields(): Partial<AttachmentType> {
  return cdnFields(Date.now());
}

function staleCdnFields(): Partial<AttachmentType> {
  return cdnFields(Date.now() - 4 * DAY);
}

async function fakeUpload(
  attachment: AttachmentType
): Promise<Partial<UploadedAttachmentType>> {
  return {
    attachmentIdentifier: { cdnKey: `new-cdn-${v7()}` },
    cdnNumber: 3,
    key: getRandomBytes(64),
    size: attachment.size,
    digest: getRandomBytes(32),
    contentType: attachment.contentType,
    plaintextHash: attachment.plaintextHash ?? '',
    uploadTimestamp: BigInt(Date.now()),
  };
}

function getCdnKey(entry: DecodedAttachmentData | undefined) {
  return entry?.data?.attachment?.attachmentIdentifier?.cdnKey;
}

describe('attachmentBackfillResponse', () => {
  let sandbox: sinon.SinonSandbox;
  let sent: Array<DecodedResponse>;
  let senderAci: AciString;
  let conversationId: string;

  beforeEach(async () => {
    await itemStorage.user.setAciAndDeviceId(generateAci(), 1);
    window.ConversationController.reset();
    MessageCache.install();
    await window.ConversationController.load();

    senderAci = generateAci();
    const conversation = await window.ConversationController.getOrCreateAndWait(
      senderAci,
      'private'
    );
    conversationId = conversation.id;

    sandbox = sinon.createSandbox();
    sent = [];
    sandbox
      .stub(singleProtoJobQueue, 'add')
      .callsFake(async (data: SingleProtoJobData) => {
        const response = Proto.Content.decode(
          Bytes.fromBase64(data.protoBase64)
        ).content?.syncMessage?.content?.attachmentBackfillResponse;
        assert.isDefined(response);
        sent.push(response);
        return { completion: Promise.resolve() } as never;
      });
  });

  afterEach(async () => {
    sandbox.restore();
    await DataWriter.removeAll();
    await itemStorage.fetch();
    window.ConversationController.reset();
  });

  async function saveMessage(
    overrides: Partial<MessageAttributesType>
  ): Promise<MessageAttributesType> {
    const now = Date.now();
    const message: MessageAttributesType = {
      id: v7(),
      type: 'incoming',
      conversationId,
      sourceServiceId: senderAci,
      sourceDevice: 1,
      sent_at: now,
      timestamp: now,
      received_at: now,
      ...overrides,
    };
    await window.MessageCache.saveMessage(message, { forceSave: true });
    return message;
  }

  function getTarget(sentAt: number) {
    return {
      targetMessage: { type: 'aci' as const, authorAci: senderAci, sentAt },
      targetConversation: { type: 'aci' as const, aci: senderAci },
    };
  }

  function getLastSentAttachments() {
    return sent.at(-1)?.data?.attachments;
  }

  async function runJob(
    message: MessageAttributesType,
    {
      isFinalAttempt = false,
      upload = sandbox.stub().callsFake(fakeUpload),
    }: { isFinalAttempt?: boolean; upload?: sinon.SinonStub } = {}
  ) {
    await runAttachmentBackfillResponseJob(
      { messageId: message.id, ...getTarget(message.sent_at) },
      { isFinalAttempt, log, upload }
    );
    return upload;
  }

  it('responds with pointers, PENDING, or TERMINAL_ERROR without uploading', async () => {
    const fresh = await downloadedAttachment(freshCdnFields());
    const stale = await downloadedAttachment(staleCdnFields());
    const notDownloaded: AttachmentType = {
      contentType: IMAGE_JPEG,
      size: 100,
    };
    const message = await saveMessage({
      attachments: [fresh, stale, notDownloaded],
    });

    const { response, attachmentsNeedingUpload } =
      await getAttachmentBackfillResponseData(message, {
        isFinalResponse: false,
      });

    const [freshData, staleData, notDownloadedData] =
      response.attachments?.attachments ?? [];

    assert.isTrue(freshData?.data != null && 'attachment' in freshData.data);
    assert.deepEqual(staleData?.data, { status: Status.PENDING });
    assert.deepEqual(notDownloadedData?.data, {
      status: Status.TERMINAL_ERROR,
    });
    assert.deepEqual(
      attachmentsNeedingUpload.map(({ path }) => path),
      [stale.path]
    );
  });

  describe('handleAttachmentBackfillRequest', () => {
    function makeRequest(sentAt: number) {
      return new AttachmentBackfillRequestSyncEvent(
        getTarget(sentAt),
        Date.now(),
        v7(),
        () => undefined
      );
    }

    it('sends MESSAGE_NOT_FOUND when the message is missing', async () => {
      const addJob = sandbox.stub(attachmentBackfillResponseJobQueue, 'add');

      await handleAttachmentBackfillRequest(makeRequest(Date.now()));

      assert.strictEqual(sent[0]?.data?.error, MESSAGE_NOT_FOUND);
      assert.strictEqual(addJob.callCount, 0);
    });

    it('responds immediately and queues a job to upload', async () => {
      const addJob = sandbox.stub(attachmentBackfillResponseJobQueue, 'add');
      const message = await saveMessage({
        attachments: [await downloadedAttachment(staleCdnFields())],
      });

      await handleAttachmentBackfillRequest(makeRequest(message.sent_at));

      assert.strictEqual(sent.length, 1);
      assert.strictEqual(
        getLastSentAttachments()?.attachments[0]?.data?.status,
        Status.PENDING
      );
      assert.strictEqual(addJob.callCount, 1);
      assert.deepEqual(addJob.firstCall.args[0], {
        messageId: message.id,
        ...getTarget(message.sent_at),
      });
    });
  });

  describe('runAttachmentBackfillResponseJob', () => {
    it('uploads stale attachments and saves the new upload data', async () => {
      const message = await saveMessage({
        attachments: [await downloadedAttachment(staleCdnFields())],
      });

      const upload = await runJob(message);

      assert.strictEqual(upload.callCount, 1);
      const cdnKey = getCdnKey(getLastSentAttachments()?.attachments[0]);
      assert.isTrue(cdnKey?.startsWith('new-cdn'));
      const saved = await getMessageById(message.id);
      assert.strictEqual(saved?.attributes.attachments?.[0]?.cdnKey, cdnKey);
    });

    it('uploads long text from the body if its file was deleted', async () => {
      const body = 'x'.repeat(5000);
      const message = await saveMessage({
        body,
        bodyAttachment: {
          contentType: LONG_MESSAGE,
          size: body.length,
          path: `deleted/${v7()}`,
          localKey: Bytes.toBase64(getRandomBytes(64)),
        },
      });

      const upload = await runJob(message);

      assert.strictEqual(upload.callCount, 1);
      assert.strictEqual(upload.firstCall.args[0].contentType, LONG_MESSAGE);
      const cdnKey = getCdnKey(getLastSentAttachments()?.longText);
      assert.isTrue(cdnKey?.startsWith('new-cdn'));
    });
  });
});
