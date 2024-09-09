// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { generateAci } from '../../types/ServiceId';
import { type MessageAttributesType } from '../../model-types.d';
import { CircularMessageCache } from '../../services/backups/util/CircularMessageCache';
import { DataWriter } from '../../sql/Client';

const OUR_ACI = generateAci();

function createMessage(sentAt: number): MessageAttributesType {
  return {
    sent_at: sentAt,
    received_at: sentAt,
    timestamp: sentAt,

    id: 'abc',
    type: 'incoming' as const,
    conversationId: 'cid',
  };
}

describe('backup/attachments', () => {
  let messageCache: CircularMessageCache;
  let flush: sinon.SinonStub;

  beforeEach(async () => {
    await DataWriter.removeAll();
    flush = sinon.stub();
    messageCache = new CircularMessageCache({
      size: 2,
      flush,
    });
  });

  afterEach(async () => {
    await DataWriter.removeAll();
  });

  it('should return a cached message', async () => {
    const message = createMessage(123);
    messageCache.push(message);

    const found = await messageCache.findBySentAt(123, () => true);
    sinon.assert.notCalled(flush);
    assert.strictEqual(found, message);
  });

  it('should purge message from cache on overflow', async () => {
    messageCache.push(createMessage(123));
    messageCache.push(createMessage(124));
    messageCache.push(createMessage(125));

    const found = await messageCache.findBySentAt(123, () => true);
    sinon.assert.calledOnce(flush);
    assert.isUndefined(found);
  });

  it('should find message in the database', async () => {
    const message = createMessage(123);

    await DataWriter.saveMessage(message, {
      ourAci: OUR_ACI,
      forceSave: true,
    });

    const found = await messageCache.findBySentAt(123, () => true);
    sinon.assert.calledOnce(flush);
    assert.deepStrictEqual(found, message);
  });
});
