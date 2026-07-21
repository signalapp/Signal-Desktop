// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { generateAci } from '../test-helpers/serviceIdUtils.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { DataWriter } from '../sql/Client.preload.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import * as Bytes from '../Bytes.std.ts';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.preload.ts';
import { sendDraftAttachmentSync } from '../util/sendDraftAttachmentSync.preload.ts';

describe('sendDraftAttachmentSync', () => {
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    const ourAci = generateAci();
    await itemStorage.put('uuid_id', `${ourAci}.1`);
    await window.ConversationController.load();
  });

  afterEach(async () => {
    sandbox.restore();
    await DataWriter.removeAll();
    await itemStorage.fetch();
  });

  it('queues a clear draft tombstone (field 27) to our other devices', async () => {
    sandbox
      .stub(window.ConversationController, 'doWeHaveOtherDevices')
      .returns(true);
    const addStub = sandbox.stub(singleProtoJobQueue, 'add').resolves();

    const friendAci = generateAci();
    await sendDraftAttachmentSync({
      conversationServiceId: friendAci,
      clear: true,
      timestamp: 1730000000000,
    });

    assert.isTrue(addStub.calledOnce);
    const job = addStub.firstCall.args[0];
    assert.strictEqual(job.type, 'draftSync');
    assert.isTrue(job.isSyncMessage);

    const content = Proto.Content.decode(Bytes.fromBase64(job.protoBase64));
    const draft = content.content?.syncMessage?.content?.draftAttachment;
    assert.strictEqual(draft?.clear, true);
    assert.strictEqual(draft?.destinationServiceId, friendAci);
    assert.strictEqual(String(draft?.timestamp), '1730000000000');
  });

  it('does nothing when there are no other linked devices', async () => {
    sandbox
      .stub(window.ConversationController, 'doWeHaveOtherDevices')
      .returns(false);
    const addStub = sandbox.stub(singleProtoJobQueue, 'add').resolves();

    await sendDraftAttachmentSync({
      conversationServiceId: generateAci(),
      clear: true,
      timestamp: 1730000000000,
    });

    assert.isTrue(addStub.notCalled);
  });

  it('queues a draft attachment pointer (field 27) to our other devices', async () => {
    sandbox
      .stub(window.ConversationController, 'doWeHaveOtherDevices')
      .returns(true);
    const addStub = sandbox.stub(singleProtoJobQueue, 'add').resolves();

    const friendAci = generateAci();
    const attachment: Proto.AttachmentPointer.Params = {
      attachmentIdentifier: { cdnKey: 'draft-cdn' },
      contentType: 'image/jpeg',
      fileName: 'sunset.jpg',
      size: 10,
      key: null,
      digest: null,
      thumbnail: null,
      clientUuid: null,
      incrementalMac: null,
      chunkSize: null,
      flags: null,
      width: null,
      height: null,
      caption: null,
      blurHash: null,
      uploadTimestamp: null,
      cdnNumber: null,
    };

    await sendDraftAttachmentSync({
      conversationServiceId: friendAci,
      clear: false,
      timestamp: 1730000000000,
      attachment,
    });

    assert.isTrue(addStub.calledOnce);
    const content = Proto.Content.decode(
      Bytes.fromBase64(addStub.firstCall.args[0].protoBase64)
    );
    const draft = content.content?.syncMessage?.content?.draftAttachment;
    assert.strictEqual(draft?.destinationServiceId, friendAci);
    assert.strictEqual(draft?.attachment?.fileName, 'sunset.jpg');
  });
});
