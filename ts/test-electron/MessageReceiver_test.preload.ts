// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import sinon from 'sinon';
import { v4 as generateUuid } from 'uuid';
import { Aci } from '@signalapp/libsignal-client';

import MessageReceiver from '../textsecure/MessageReceiver.preload.ts';
import {
  IncomingWebSocketRequest,
  ServerRequestType,
} from '../textsecure/WebsocketResources.preload.ts';
import { toAciObject } from '../util/ServiceId.node.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import * as Crypto from '../Crypto.node.ts';
import { toBase64 } from '../Bytes.std.ts';
import { signalProtocolStore } from '../SignalProtocolStore.preload.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { generateAci } from '../test-helpers/serviceIdUtils.std.ts';
import { DataWriter } from '../sql/Client.preload.ts';

import type { DecryptionErrorEvent } from '../textsecure/messageReceiverEvents.std.ts';
import {
  normalizePni,
  normalizeServiceId,
  type AciString,
} from '../types/ServiceId.std.ts';
import type { ProcessedEnvelope } from '../textsecure/Types.d.ts';
import type { ConversationModel } from '../models/conversations.preload.ts';
import type {
  ConversationAttributesType,
  ConversationAttributesTypeType,
} from '../model-types.d.ts';
import {
  ReceivedTimestampMs,
  SentTimestampMs,
  ServerTimestampMs,
} from '@signalapp/types';

describe('MessageReceiver', () => {
  const someAci = generateAci();
  const deviceId = 1;

  let oldAci: AciString | undefined;
  let oldDeviceId: number | undefined;

  const fakeTrustRootPublicKey = Crypto.getRandomBytes(33);
  fakeTrustRootPublicKey.set([5], 0); // first byte is the key type (5)

  before(async () => {
    await window.ConversationController.load();
  });

  beforeEach(async () => {
    oldAci = itemStorage.user.getAci();
    oldDeviceId = itemStorage.user.getDeviceId();
    await itemStorage.user.setAciAndDeviceId(generateAci(), 2);
    await signalProtocolStore.hydrateCaches();
  });

  afterEach(async () => {
    if (oldAci !== undefined && oldDeviceId !== undefined) {
      await itemStorage.user.setAciAndDeviceId(oldAci, oldDeviceId);
    }
    await signalProtocolStore.removeAllUnprocessed();
  });

  describe('connecting', () => {
    it('generates decryption-error event when it cannot decrypt', async () => {
      const messageReceiver = new MessageReceiver({
        storage: itemStorage,
        serverTrustRoots: [toBase64(fakeTrustRootPublicKey)],
      });

      const body = Proto.Envelope.encode({
        type: Proto.Envelope.Type.DOUBLE_RATCHET,
        sourceServiceId: null,
        sourceServiceIdBinary: toAciObject(someAci).getRawUuidBytes(),
        sourceDeviceId: deviceId,
        clientTimestamp: BigInt(Date.now()),
        content: Crypto.getRandomBytes(200),
        destinationServiceId: null,
        destinationServiceIdBinary: null,
        serverGuid: null,
        serverGuidBinary: null,
        serverTimestamp: null,
        ephemeral: null,
        urgent: null,
        updatedPni: null,
        story: null,
        reportSpamToken: null,
        updatedPniBinary: null,
      });

      messageReceiver.handleRequest(
        new IncomingWebSocketRequest(
          ServerRequestType.ApiMessage,
          body,
          Date.now(),
          {
            async send() {
              // no-op
            },
          }
        )
      );

      await new Promise<void>(resolve => {
        messageReceiver.addEventListener(
          'decryption-error',
          (error: DecryptionErrorEvent) => {
            assert.strictEqual(error.decryptionError.senderAci, someAci);
            assert.strictEqual(error.decryptionError.senderDevice, deviceId);
            resolve();
          }
        );
      });

      await messageReceiver.drain();
    });
  });

  describe('handleBlocked', () => {
    const now = Date.now();

    const ME_E164 = '+18005551110';
    const E164_1 = '+18005551111';
    const E164_2 = '+18005551112';
    const E164_3 = '+18005551113';
    const ME_UUID = generateUuid();
    const UUID_1 = generateUuid();
    const UUID_2 = generateUuid();
    const UUID_3 = generateUuid();
    const GROUP_1 = Crypto.getRandomBytes(32).toBase64();
    const GROUP_2 = Crypto.getRandomBytes(32).toBase64();
    const GROUP_3 = Crypto.getRandomBytes(32).toBase64();

    function addConversation(
      identifier: string,
      type: ConversationAttributesTypeType = 'private',
      additionalAttributes?: Partial<ConversationAttributesType>
    ): ConversationModel {
      const conversation = window.ConversationController.getOrCreate(
        identifier,
        type,
        additionalAttributes
      );
      conversation.applyMessageRequestResponse = sinon.spy();
      return conversation;
    }

    beforeEach(async () => {
      await DataWriter._removeAllConversations();
      window.ConversationController.reset();
      await window.ConversationController.load();

      await DataWriter.removeAllItems();
      itemStorage.reset();
      await itemStorage.fetch();

      const e1 = addConversation(E164_1);
      e1.block({ viaStorageServiceSync: false, timestamp: now + 1 });
      const e2 = addConversation(E164_2);
      e2.block({ viaStorageServiceSync: false, timestamp: now + 2 });
      addConversation(E164_3);

      const u1 = addConversation(UUID_1);
      u1.block({ viaStorageServiceSync: false, timestamp: now + 10 + 1 });
      const u2 = addConversation(UUID_2);
      u2.block({ viaStorageServiceSync: false, timestamp: now + 10 + 2 });
      addConversation(UUID_3);

      const g1 = addConversation(GROUP_1, 'group');
      g1.block({ viaStorageServiceSync: false, timestamp: now + 20 + 1 });
      const g2 = addConversation(GROUP_2, 'group');
      g2.block({ viaStorageServiceSync: false, timestamp: now + 20 + 2 });
      addConversation(GROUP_3, 'group');
    });

    afterEach(async () => {
      await DataWriter._removeAllConversations();
      window.ConversationController.reset();
      await window.ConversationController.load();

      await DataWriter.removeAllItems();
      itemStorage.reset();
      await itemStorage.fetch();
    });

    it('handles modern fields', async () => {
      const messageReceiver = new MessageReceiver({
        storage: itemStorage,
        serverTrustRoots: [toBase64(fakeTrustRootPublicKey)],
      });

      const processedEnvelope: ProcessedEnvelope = {
        id: generateUuid(),
        receivedAtCounter: 1,
        receivedAtDate: ReceivedTimestampMs.fromNumber(now - 1),
        messageAgeSec: 1,

        type: Proto.Envelope.Type.DOUBLE_RATCHET,
        source: ME_E164,
        sourceServiceId: normalizeServiceId(ME_UUID, 'test1'),
        sourceDevice: 1,
        destinationServiceId: normalizeServiceId(ME_UUID, 'test2'),
        updatedPni: normalizePni(generateUuid(), 'test3'),
        timestamp: SentTimestampMs.fromNumber(now - 2),
        content: Crypto.getRandomBytes(200),
        serverGuid: generateUuid(),
        serverTimestamp: ServerTimestampMs.fromNumber(now - 3),
        groupId: undefined,
        urgent: false,
        story: false,
        reportingToken: undefined,
      };
      const blocked: Proto.SyncMessage.Blocked = {
        numbers: [],
        acis: [],
        groupIds: [],
        acisBinary: [],
        blockedE164s: [
          { e164: E164_1, timestamp: BigInt(now + 30 + 1), $unknown: [] },
          { e164: E164_3, timestamp: BigInt(now + 30 + 3), $unknown: [] },
        ],
        blockedAcis: [
          {
            aciBinary: Aci.parseFromServiceIdString(UUID_1).getRawUuidBytes(),
            timestamp: BigInt(now + 40 + 1),
            $unknown: [],
          },
          {
            aciBinary: Aci.parseFromServiceIdString(UUID_3).getRawUuidBytes(),
            timestamp: BigInt(now + 40 + 3),
            $unknown: [],
          },
        ],
        blockedGroups: [
          {
            groupId: Uint8Array.fromBase64(GROUP_1),
            timestamp: BigInt(now + 50 + 1),
            $unknown: [],
          },
          {
            groupId: Uint8Array.fromBase64(GROUP_3),
            timestamp: BigInt(now + 50 + 3),
            $unknown: [],
          },
        ],
        $unknown: [],
      };

      await messageReceiver._handleBlocked(processedEnvelope, blocked);

      const e1 = window.ConversationController.get(E164_1);
      assert.isTrue(e1?.isBlocked(), 'e1 should be blocked');
      const e1BlockItem = itemStorage.blocked.getBlockedNumbers().get(E164_1);
      assert.strictEqual(
        e1BlockItem?.blockedAt,
        now + 30 + 1,
        'e1 should have an updated blockedAt'
      );

      const e2 = window.ConversationController.get(E164_2);
      assert.isFalse(e2?.isBlocked(), 'e2 should not be blocked');
      const e3 = window.ConversationController.get(E164_3);
      assert.isTrue(e3?.isBlocked(), 'e3 should be blocked');
      const e3BlockItem = itemStorage.blocked.getBlockedNumbers().get(E164_3);
      assert.strictEqual(
        e3BlockItem?.blockedAt,
        now + 30 + 3,
        'e3 should take new blockedAt from sync'
      );

      const u1 = window.ConversationController.get(UUID_1);
      assert.isTrue(u1?.isBlocked(), 'u1 should be blocked');
      const u1BlockItem = itemStorage.blocked
        .getBlockedServiceIds()
        .get(UUID_1);
      assert.strictEqual(
        u1BlockItem?.blockedAt,
        now + 40 + 1,
        'u1 should have an updated blockedAt'
      );

      const u2 = window.ConversationController.get(UUID_2);
      assert.isFalse(u2?.isBlocked(), 'u2 should not be blocked');

      const u3 = window.ConversationController.get(UUID_3);
      assert.isTrue(u3?.isBlocked(), 'u3 should be blocked');
      const u3BlockItem = itemStorage.blocked
        .getBlockedServiceIds()
        .get(UUID_3);
      assert.strictEqual(
        u3BlockItem?.blockedAt,
        now + 40 + 3,
        'u3 should take new blockedAt from sync'
      );

      const g1 = window.ConversationController.get(GROUP_1);
      assert.isTrue(g1?.isBlocked(), 'g1 should be blocked');
      const g1BlockItem = itemStorage.blocked.getBlockedGroups().get(GROUP_1);
      assert.strictEqual(
        g1BlockItem?.blockedAt,
        now + 50 + 1,
        'g1 should have an updated blockedAt'
      );

      const g2 = window.ConversationController.get(GROUP_2);
      assert.isFalse(g2?.isBlocked(), 'g2 should not be blocked');

      const g3 = window.ConversationController.get(GROUP_3);
      assert.isTrue(g3?.isBlocked(), 'g3 should be blocked');
      const g3BlockItem = itemStorage.blocked.getBlockedGroups().get(GROUP_3);
      assert.strictEqual(
        g3BlockItem?.blockedAt,
        now + 50 + 3,
        'g3 should take new blockedAt from sync'
      );
    });

    it('handles legacy fields', async () => {
      const messageReceiver = new MessageReceiver({
        storage: itemStorage,
        serverTrustRoots: [toBase64(fakeTrustRootPublicKey)],
      });

      const processedEnvelope: ProcessedEnvelope = {
        id: generateUuid(),
        receivedAtCounter: 1,
        receivedAtDate: ReceivedTimestampMs.fromNumber(now - 1),
        messageAgeSec: 1,

        type: Proto.Envelope.Type.DOUBLE_RATCHET,
        source: ME_E164,
        sourceServiceId: normalizeServiceId(ME_UUID, 'test1'),
        sourceDevice: 1,
        destinationServiceId: normalizeServiceId(ME_UUID, 'test2'),
        updatedPni: normalizePni(generateUuid(), 'test3'),
        timestamp: SentTimestampMs.fromNumber(now - 2),
        content: Crypto.getRandomBytes(200),
        serverGuid: generateUuid(),
        serverTimestamp: ServerTimestampMs.fromNumber(now - 3),
        groupId: undefined,
        urgent: false,
        story: false,
        reportingToken: undefined,
      };
      const blocked: Proto.SyncMessage.Blocked = {
        numbers: [E164_1, E164_3],
        acis: [UUID_1, UUID_3],
        groupIds: [
          Uint8Array.fromBase64(GROUP_1),
          Uint8Array.fromBase64(GROUP_3),
        ],
        acisBinary: [],
        blockedE164s: [],
        blockedAcis: [],
        blockedGroups: [],
        $unknown: [],
      };

      await messageReceiver._handleBlocked(processedEnvelope, blocked);

      const e1 = window.ConversationController.get(E164_1);
      assert.isTrue(e1?.isBlocked(), 'e1 should be blocked');
      const e1BlockItem = itemStorage.blocked.getBlockedNumbers().get(E164_1);
      assert.strictEqual(
        e1BlockItem?.blockedAt,
        now + 1,
        'e1 should keep its blockedAt'
      );

      const e2 = window.ConversationController.get(E164_2);
      assert.isFalse(e2?.isBlocked(), 'e2 should not be blocked');
      const e3 = window.ConversationController.get(E164_3);
      assert.isTrue(e3?.isBlocked(), 'e3 should be blocked');
      const e3BlockItem = itemStorage.blocked.getBlockedNumbers().get(E164_3);
      assert.isUndefined(e3BlockItem?.blockedAt, 'e3 should have no blockedAt');

      const u1 = window.ConversationController.get(UUID_1);
      assert.isTrue(u1?.isBlocked(), 'u1 should be blocked');
      const u1BlockItem = itemStorage.blocked
        .getBlockedServiceIds()
        .get(UUID_1);
      assert.strictEqual(
        u1BlockItem?.blockedAt,
        now + 10 + 1,
        'u1 should keep its blockedAt'
      );

      const u2 = window.ConversationController.get(UUID_2);
      assert.isFalse(u2?.isBlocked(), 'u2 should not be blocked');

      const u3 = window.ConversationController.get(UUID_3);
      assert.isTrue(u3?.isBlocked(), 'u3 should be blocked');
      const u3BlockItem = itemStorage.blocked
        .getBlockedServiceIds()
        .get(UUID_3);
      assert.isUndefined(u3BlockItem?.blockedAt, 'u3 should have no blockedAt');

      const g1 = window.ConversationController.get(GROUP_1);
      assert.isTrue(g1?.isBlocked(), 'g1 should be blocked');
      const g1BlockItem = itemStorage.blocked.getBlockedGroups().get(GROUP_1);
      assert.strictEqual(
        g1BlockItem?.blockedAt,
        now + 20 + 1,
        'g1 should keep its blockedAt'
      );

      const g2 = window.ConversationController.get(GROUP_2);
      assert.isFalse(g2?.isBlocked(), 'g2 should not be blocked');

      const g3 = window.ConversationController.get(GROUP_3);
      assert.isTrue(g3?.isBlocked(), 'g3 should be blocked');
      const g3BlockItem = itemStorage.blocked.getBlockedGroups().get(GROUP_3);
      assert.isUndefined(g3BlockItem?.blockedAt, 'g3 should have no blockedAt');
    });

    it('handles legacy fields with acisBinary set', async () => {
      const messageReceiver = new MessageReceiver({
        storage: itemStorage,
        serverTrustRoots: [toBase64(fakeTrustRootPublicKey)],
      });

      const processedEnvelope: ProcessedEnvelope = {
        id: generateUuid(),
        receivedAtCounter: 1,
        receivedAtDate: ReceivedTimestampMs.fromNumber(now - 1),
        messageAgeSec: 1,

        type: Proto.Envelope.Type.DOUBLE_RATCHET,
        source: ME_E164,
        sourceServiceId: normalizeServiceId(ME_UUID, 'test1'),
        sourceDevice: 1,
        destinationServiceId: normalizeServiceId(ME_UUID, 'test2'),
        updatedPni: normalizePni(generateUuid(), 'test3'),
        timestamp: SentTimestampMs.fromNumber(now - 2),
        content: Crypto.getRandomBytes(200),
        serverGuid: generateUuid(),
        serverTimestamp: ServerTimestampMs.fromNumber(now - 3),
        groupId: undefined,
        urgent: false,
        story: false,
        reportingToken: undefined,
      };
      const blocked: Proto.SyncMessage.Blocked = {
        numbers: [E164_1, E164_2],
        acis: [],
        groupIds: [
          Uint8Array.fromBase64(GROUP_1),
          Uint8Array.fromBase64(GROUP_2),
        ],
        acisBinary: [
          Aci.parseFromServiceIdString(UUID_1).getRawUuidBytes(),
          Aci.parseFromServiceIdString(UUID_3).getRawUuidBytes(),
        ],
        blockedE164s: [],
        blockedAcis: [],
        blockedGroups: [],
        $unknown: [],
      };

      await messageReceiver._handleBlocked(processedEnvelope, blocked);

      const u1 = window.ConversationController.get(UUID_1);
      assert.isTrue(u1?.isBlocked(), 'u1 should be blocked');
      const u2 = window.ConversationController.get(UUID_2);
      assert.isFalse(u2?.isBlocked(), 'u2 should not be blocked');
      const u3 = window.ConversationController.get(UUID_3);
      assert.isTrue(u3?.isBlocked(), 'u3 should be blocked');
    });
  });
});
