// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import { v4 as generateGuid } from 'uuid';
import { CallLinkRootKey } from '@signalapp/ringrtc';

import type { ConversationModel } from '../../models/conversations';
import type { MessageAttributesType } from '../../model-types';
import type { CallHistoryDetails } from '../../types/CallDisposition';
import type { CallLinkType } from '../../types/CallLink';

import * as Bytes from '../../Bytes';
import { getRandomBytes } from '../../Crypto';
import { DataReader, DataWriter } from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';
import { setupBasics, symmetricRoundtripHarness } from './helpers';
import {
  AdhocCallStatus,
  CallDirection,
  CallMode,
  CallType,
  DirectCallStatus,
  GroupCallStatus,
} from '../../types/CallDisposition';
import { CallLinkRestrictions } from '../../types/CallLink';
import { getRoomIdFromRootKey } from '../../util/callLinksRingrtc';
import { fromAdminKeyBytes } from '../../util/callLinks';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SeenStatus } from '../../MessageSeenStatus';
import { deriveGroupID, deriveGroupSecretParams } from '../../util/zkgroup';
import { loadAllAndReinitializeRedux } from '../../services/allLoaders';

const CONTACT_A = generateAci();
const GROUP_MASTER_KEY = getRandomBytes(32);
const GROUP_SECRET_PARAMS = deriveGroupSecretParams(GROUP_MASTER_KEY);
const GROUP_ID_STRING = Bytes.toBase64(deriveGroupID(GROUP_SECRET_PARAMS));

describe('backup/calling', () => {
  let contactA: ConversationModel;
  let groupA: ConversationModel;

  beforeEach(async () => {
    await DataWriter.removeAll();
    window.ConversationController.reset();
    window.storage.reset();

    await setupBasics();

    contactA = await window.ConversationController.getOrCreateAndWait(
      CONTACT_A,
      'private',
      { systemGivenName: 'CONTACT_A', active_at: 1 }
    );
    groupA = await window.ConversationController.getOrCreateAndWait(
      GROUP_ID_STRING,
      'group',
      {
        groupVersion: 2,
        masterKey: Bytes.toBase64(GROUP_MASTER_KEY),
        name: 'Rock Enthusiasts',
        active_at: 1,
      }
    );

    await loadAllAndReinitializeRedux();
  });
  after(async () => {
    await DataWriter.removeAll();
  });

  describe('Direct calls', () => {
    it('roundtrips with a missed call', async () => {
      const now = Date.now();
      const callId = '11111';
      const callHistory: CallHistoryDetails = {
        callId,
        peerId: CONTACT_A,
        ringerId: CONTACT_A,
        startedById: null,
        mode: CallMode.Direct,
        type: CallType.Audio,
        status: DirectCallStatus.Missed,
        direction: CallDirection.Incoming,
        timestamp: now,
        endedTimestamp: null,
      };
      await DataWriter.saveCallHistory(callHistory);
      await loadAllAndReinitializeRedux();

      const messageUnseen: MessageAttributesType = {
        id: generateGuid(),
        type: 'call-history',
        sent_at: now,
        received_at: now,
        timestamp: now,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Unseen,
        conversationId: contactA.id,
        callId,
      };
      const messageSeen: MessageAttributesType = {
        id: generateGuid(),
        type: 'call-history',
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        conversationId: contactA.id,
        callId,
      };
      await symmetricRoundtripHarness([messageUnseen, messageSeen]);

      const allCallHistory = await DataReader.getAllCallHistory();
      assert.strictEqual(allCallHistory.length, 1);

      assert.deepEqual(callHistory, allCallHistory[0]);
    });
  });

  describe('Group calls', () => {
    it('roundtrips with a missed call', async () => {
      const now = Date.now();
      const callId = '22222';
      const callHistory: CallHistoryDetails = {
        callId,
        peerId: GROUP_ID_STRING,
        ringerId: CONTACT_A,
        startedById: CONTACT_A,
        mode: CallMode.Group,
        type: CallType.Group,
        status: GroupCallStatus.Declined,
        direction: CallDirection.Incoming,
        timestamp: now,
        endedTimestamp: null,
      };
      await DataWriter.saveCallHistory(callHistory);
      await loadAllAndReinitializeRedux();

      const messageUnseen: MessageAttributesType = {
        id: generateGuid(),
        type: 'call-history',
        sent_at: now,
        received_at: now,
        timestamp: now,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Unseen,
        conversationId: groupA.id,
        callId,
      };
      const messageSeen: MessageAttributesType = {
        id: generateGuid(),
        type: 'call-history',
        sent_at: now + 1,
        received_at: now + 1,
        timestamp: now + 1,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        conversationId: groupA.id,
        callId,
      };
      await symmetricRoundtripHarness([messageUnseen, messageSeen]);

      const allCallHistory = await DataReader.getAllCallHistory();
      assert.strictEqual(allCallHistory.length, 1);

      assert.deepEqual(callHistory, allCallHistory[0]);
    });
  });
  describe('Call Links', () => {
    let callLink: CallLinkType;
    let adminCallLink: CallLinkType;

    beforeEach(async () => {
      const adminRootKey = CallLinkRootKey.generate();
      const adminKey = CallLinkRootKey.generateAdminPassKey();
      adminCallLink = {
        rootKey: adminRootKey.toString(),
        roomId: getRoomIdFromRootKey(adminRootKey),
        adminKey: fromAdminKeyBytes(adminKey),
        name: "Let's Talk Rocks",
        restrictions: CallLinkRestrictions.AdminApproval,
        revoked: false,
        expiration: null,
        storageID: undefined,
        storageVersion: undefined,
        storageUnknownFields: undefined,
        storageNeedsSync: false,
      };

      const rootKey = CallLinkRootKey.generate();
      callLink = {
        rootKey: rootKey.toString(),
        roomId: getRoomIdFromRootKey(rootKey),
        adminKey: null,
        name: "Let's Talk Rocks #2",
        restrictions: CallLinkRestrictions.AdminApproval,
        revoked: false,
        expiration: null,
        storageID: undefined,
        storageVersion: undefined,
        storageUnknownFields: undefined,
        storageNeedsSync: false,
      };
      await DataWriter.insertCallLink(callLink);

      await loadAllAndReinitializeRedux();
    });

    it('roundtrips with a link with admin details', async () => {
      await DataWriter._removeAllCallLinks();

      await DataWriter.insertCallLink(adminCallLink);

      const allCallLinksBefore = await DataReader.getAllCallLinks();
      assert.strictEqual(allCallLinksBefore.length, 1);

      await symmetricRoundtripHarness([]);

      const allCallLinks = await DataReader.getAllCallLinks();
      assert.strictEqual(allCallLinks.length, 1);

      assert.deepEqual(adminCallLink, allCallLinks[0]);
    });
    it('creates placeholder call history for a link with admin details', async () => {
      await DataWriter._removeAllCallLinks();

      await DataWriter.insertCallLink(adminCallLink);

      const allCallHistoryBefore = await DataReader.getAllCallHistory();
      assert.strictEqual(allCallHistoryBefore.length, 0);

      await symmetricRoundtripHarness([]);

      const allCallHistory = await DataReader.getAllCallHistory();
      assert.strictEqual(allCallHistory.length, 1);
    });
    it('roundtrips with a link without admin details', async () => {
      await DataWriter._removeAllCallLinks();

      await DataWriter.insertCallLink(callLink);

      const allCallLinksBefore = await DataReader.getAllCallLinks();
      assert.strictEqual(allCallLinksBefore.length, 1);

      await symmetricRoundtripHarness([]);

      const allCallLinks = await DataReader.getAllCallLinks();
      assert.strictEqual(allCallLinks.length, 1);

      assert.deepEqual(callLink, allCallLinks[0]);
    });
    it('roundtrips with a joined adhoc call', async () => {
      const now = Date.now();
      const callId = '333333';
      const callHistory: CallHistoryDetails = {
        callId,
        peerId: callLink.roomId,
        ringerId: null,
        startedById: null,
        mode: CallMode.Adhoc,
        type: CallType.Adhoc,
        status: AdhocCallStatus.Generic,
        direction: CallDirection.Unknown,
        timestamp: now,
        endedTimestamp: null,
      };
      await DataWriter.saveCallHistory(callHistory);
      await loadAllAndReinitializeRedux();

      await symmetricRoundtripHarness([]);

      const allCallHistory = await DataReader.getAllCallHistory();
      assert.strictEqual(allCallHistory.length, 1);

      assert.deepEqual(callHistory, allCallHistory[0]);
    });
    it('does not roundtrip adhoc call with missing call link', async () => {
      const now = Date.now();
      const callId = '44444';
      const callHistory: CallHistoryDetails = {
        callId,
        peerId: 'nonexistent',
        ringerId: null,
        startedById: null,
        mode: CallMode.Adhoc,
        type: CallType.Adhoc,
        status: AdhocCallStatus.Generic,
        direction: CallDirection.Unknown,
        timestamp: now,
        endedTimestamp: null,
      };
      await DataWriter.saveCallHistory(callHistory);
      await loadAllAndReinitializeRedux();

      await symmetricRoundtripHarness([]);

      const allCallHistory = await DataReader.getAllCallHistory();
      assert.strictEqual(allCallHistory.length, 0);
    });
  });
});
