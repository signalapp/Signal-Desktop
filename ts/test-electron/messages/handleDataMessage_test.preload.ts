// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as uuid } from 'uuid';

import { handleDataMessage } from '../../messages/handleDataMessage.preload.ts';
import type { MessageAttributesType } from '../../model-types.d.ts';
import { MessageModel } from '../../models/messages.preload.ts';
import { MessageCache } from '../../services/MessageCache.preload.ts';
import { DataWriter } from '../../sql/Client.preload.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import type { ProcessedDataMessage } from '../../textsecure/Types.d.ts';
import {
  type AciString,
  generateAci,
  generatePni,
} from '../../types/ServiceId.std.ts';
import { DurationInSeconds } from '../../util/durations/duration-in-seconds.std.ts';
import { SignalService } from '../../protobuf/index.std.ts';

describe('handleDataMessage', () => {
  let ourAci: AciString;

  beforeEach(async () => {
    ourAci = generateAci();
    MessageCache.install();
    await itemStorage.user.setAciAndDeviceId(ourAci, 1);
    await itemStorage.user.setPni(generatePni());

    window.ConversationController.reset();
    MessageCache.install();
    await window.ConversationController.load();
  });

  afterEach(async () => {
    await DataWriter.removeAll();
    await itemStorage.fetch();
    window.ConversationController.reset();
  });

  it('deduplicates incoming messages with same sender/timestamp, if existing message saved to DB', async () => {
    const senderAci = generateAci();
    const conversation = await window.ConversationController.getOrCreateAndWait(
      senderAci,
      'private'
    );
    const sentAt = Date.now();

    const existingAttributes: MessageAttributesType = {
      id: uuid(),
      conversationId: conversation.id,
      type: 'incoming',
      sourceServiceId: senderAci,
      sourceDevice: 1,
      sent_at: sentAt,
      timestamp: sentAt,
      received_at: sentAt,
    };

    await DataWriter.saveMessage(existingAttributes, {
      ourAci,
      forceSave: true,
      postSaveUpdates: () => Promise.resolve(),
    });

    const dataMessage: ProcessedDataMessage = {
      attachments: [],
      flags: 0,
      body: 'body',
      expireTimer: DurationInSeconds.fromDays(0),
      expireTimerVersion: 1,
      isViewOnce: false,
      timestamp: sentAt,
      requiredProtocolVersion:
        SignalService.DataMessage.ProtocolVersion.CURRENT,
    };

    const duplicateMessage = new MessageModel({
      id: uuid(),
      conversationId: conversation.id,
      type: 'incoming',
      sourceServiceId: senderAci,
      sourceDevice: 2,
      sent_at: sentAt,
      timestamp: sentAt,
      received_at: sentAt + 1,
    });

    const saveAndNotify = sinon.stub();
    const confirm = sinon.stub();

    await handleDataMessage(
      duplicateMessage,
      dataMessage,
      confirm,
      {},
      { saveAndNotify }
    );

    assert.strictEqual(saveAndNotify.callCount, 0, 'not saved');
    assert.strictEqual(confirm.callCount, 1, 'confirmed immediately');
  });

  it('deduplicates incoming messages with same sender/timestamp, if existing message only in memory', async () => {
    const senderAci = generateAci();
    const conversation = await window.ConversationController.getOrCreateAndWait(
      senderAci,
      'private'
    );
    const sentAt = Date.now();
    const dataMessage: ProcessedDataMessage = {
      attachments: [],
      flags: 0,
      body: 'body',
      expireTimer: DurationInSeconds.fromDays(0),
      expireTimerVersion: 1,
      isViewOnce: false,
      timestamp: sentAt,
      requiredProtocolVersion:
        SignalService.DataMessage.ProtocolVersion.CURRENT,
    };
    const saveAndNotify = sinon.stub();
    const confirm = sinon.stub();

    const attributes: MessageAttributesType = {
      id: uuid(),
      conversationId: conversation.id,
      type: 'incoming',
      sourceServiceId: senderAci,
      sourceDevice: 1,
      sent_at: sentAt,
      timestamp: sentAt,
      received_at: sentAt,
    };

    await handleDataMessage(
      new MessageModel(attributes),
      dataMessage,
      confirm,
      {},
      { saveAndNotify }
    );

    assert.strictEqual(saveAndNotify.callCount, 1, 'initial message saved');
    assert.strictEqual(confirm.callCount, 0, 'not confirmed until saved');

    // Calling it again with same message does not call saveAndNotify, but does confirm()
    await handleDataMessage(
      new MessageModel(attributes),
      dataMessage,
      confirm,
      {},
      { saveAndNotify }
    );

    assert.strictEqual(saveAndNotify.callCount, 1, 'not saved again');
    assert.strictEqual(confirm.callCount, 1, 'duplicate confirmed immediately');

    // Calling it again with different message but same aci/timestamp does not call
    // saveAndNotify, but does confirm()
    await handleDataMessage(
      new MessageModel({
        ...attributes,
        // we intentionally (if suboptimally) do not consider deviceId when deduplicating
        sourceDevice: 2,
        id: uuid(),
      }),
      dataMessage,
      confirm,
      {},
      { saveAndNotify }
    );

    assert.strictEqual(saveAndNotify.callCount, 1, 'not saved again');
    assert.strictEqual(confirm.callCount, 2, 'duplicate confirmed immediately');
  });
});
