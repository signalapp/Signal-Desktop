// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import dataInterface from '../../sql/Client';

import { CallMode } from '../../types/Calling';
import { generateAci } from '../../types/ServiceId';
import type { ServiceIdString } from '../../types/ServiceId';
import type {
  CallHistoryDetails,
  CallHistoryGroup,
  CallStatus,
} from '../../types/CallDisposition';
import {
  AdhocCallStatus,
  CallDirection,
  CallHistoryFilterStatus,
  CallType,
  DirectCallStatus,
} from '../../types/CallDisposition';
import { strictAssert } from '../../util/assert';
import type { ConversationAttributesType } from '../../model-types';

const {
  removeAll,
  getCallHistoryGroups,
  getCallHistoryGroupsCount,
  saveCallHistory,
  saveConversation,
} = dataInterface;

function toGroup(calls: Array<CallHistoryDetails>): CallHistoryGroup {
  const firstCall = calls.at(0);
  strictAssert(firstCall != null, 'needs at least 1 item');
  return {
    peerId: firstCall.peerId,
    mode: firstCall.mode,
    type: firstCall.type,
    direction: firstCall.direction,
    timestamp: firstCall.timestamp,
    status: firstCall.status,
    children: calls.map(call => {
      return { callId: call.callId, timestamp: call.timestamp };
    }),
  };
}

function toAdhocGroup(call: CallHistoryDetails): CallHistoryGroup {
  strictAssert(call != null, 'needs call');
  return {
    peerId: call.peerId,
    mode: call.mode,
    type: call.type,
    direction: call.direction,
    timestamp: call.timestamp,
    status: call.status,
    children: [],
  };
}

describe('sql/getCallHistoryGroups', () => {
  beforeEach(async () => {
    await removeAll();
  });

  it('should merge related items in order', async () => {
    const now = Date.now();
    const conversationId = generateUuid();

    function toCall(callId: string, timestamp: number) {
      return {
        callId,
        peerId: conversationId,
        ringerId: generateAci(),
        mode: CallMode.Direct,
        type: CallType.Video,
        direction: CallDirection.Incoming,
        timestamp,
        status: DirectCallStatus.Accepted,
      };
    }

    const call1 = toCall('1', now - 10);
    const call2 = toCall('2', now);

    await saveCallHistory(call1);
    await saveCallHistory(call2);

    const groups = await getCallHistoryGroups(
      { status: CallHistoryFilterStatus.All, conversationIds: null },
      { offset: 0, limit: 0 }
    );

    assert.deepEqual(groups, [toGroup([call2, call1])]);
  });

  it('should separate unrelated items in order', async () => {
    const now = Date.now();
    const conversationId = generateUuid();

    function toCall(callId: string, timestamp: number, type: CallType) {
      return {
        callId,
        peerId: conversationId,
        ringerId: generateAci(),
        mode: CallMode.Direct,
        type,
        direction: CallDirection.Incoming,
        timestamp,
        status: DirectCallStatus.Accepted,
      };
    }

    const call1 = toCall('1', now - 10, CallType.Video);
    const call2 = toCall('2', now, CallType.Audio);

    await saveCallHistory(call1);
    await saveCallHistory(call2);

    const groups = await getCallHistoryGroups(
      { status: CallHistoryFilterStatus.All, conversationIds: null },
      { offset: 0, limit: 0 }
    );

    assert.deepEqual(groups, [toGroup([call2]), toGroup([call1])]);
  });

  it('should split groups that are contiguous', async () => {
    const now = Date.now();
    const conversationId = generateUuid();

    function toCall(callId: string, timestamp: number, type: CallType) {
      return {
        callId,
        peerId: conversationId,
        ringerId: generateAci(),
        mode: CallMode.Direct,
        type,
        direction: CallDirection.Incoming,
        timestamp,
        status: DirectCallStatus.Accepted,
      };
    }

    const call1 = toCall('1', now - 30, CallType.Video);
    const call2 = toCall('2', now - 20, CallType.Video);
    const call3 = toCall('3', now - 10, CallType.Audio);
    const call4 = toCall('4', now, CallType.Video);

    await saveCallHistory(call1);
    await saveCallHistory(call2);
    await saveCallHistory(call3);
    await saveCallHistory(call4);

    const groups = await getCallHistoryGroups(
      { status: CallHistoryFilterStatus.All, conversationIds: null },
      { offset: 0, limit: 0 }
    );

    assert.deepEqual(groups, [
      toGroup([call4]),
      toGroup([call3]),
      toGroup([call2, call1]),
    ]);
  });

  it('should search in the correct conversations', async () => {
    const now = Date.now();

    const conversation1Uuid = generateAci();
    const conversation2GroupId = 'groupId:2';

    const conversation1: ConversationAttributesType = {
      type: 'private',
      version: 0,
      id: 'id:1',
      serviceId: conversation1Uuid,
    };

    const conversation2: ConversationAttributesType = {
      type: 'group',
      version: 2,
      id: 'id:2',
      groupId: conversation2GroupId,
    };

    await saveConversation(conversation1);
    await saveConversation(conversation2);

    function toCall(
      callId: string,
      timestamp: number,
      mode: CallMode,
      peerId: string | ServiceIdString
    ) {
      return {
        callId,
        peerId,
        ringerId: null,
        mode,
        type: CallType.Video,
        direction: CallDirection.Incoming,
        timestamp,
        status: DirectCallStatus.Accepted,
      };
    }

    const call1 = toCall('1', now - 10, CallMode.Direct, conversation1Uuid);
    const call2 = toCall('2', now, CallMode.Group, conversation2GroupId);

    await saveCallHistory(call1);
    await saveCallHistory(call2);

    {
      const groups = await getCallHistoryGroups(
        {
          status: CallHistoryFilterStatus.All,
          conversationIds: [conversation1.id],
        },
        { offset: 0, limit: 0 }
      );

      assert.deepEqual(groups, [toGroup([call1])]);
    }

    {
      const groups = await getCallHistoryGroups(
        {
          status: CallHistoryFilterStatus.All,
          conversationIds: [conversation2.id],
        },
        { offset: 0, limit: 0 }
      );

      assert.deepEqual(groups, [toGroup([call2])]);
    }
  });

  it('should support legacy call history with conversation.id', async () => {
    const now = Date.now();

    const conversationId = generateUuid();

    const conversation: ConversationAttributesType = {
      type: 'private',
      version: 0,
      id: conversationId,
    };

    await saveConversation(conversation);

    const call = {
      callId: '1',
      peerId: conversationId,
      ringerId: null,
      mode: CallMode.Direct,
      type: CallType.Video,
      direction: CallDirection.Incoming,
      timestamp: now,
      status: DirectCallStatus.Accepted,
    };

    await saveCallHistory(call);

    const groups = await getCallHistoryGroups(
      {
        status: CallHistoryFilterStatus.All,
        conversationIds: [conversation.id],
      },
      { offset: 0, limit: 0 }
    );

    assert.deepEqual(groups, [toGroup([call])]);
  });

  it('should support Missed status filter', async () => {
    const now = Date.now();
    const conversationId = generateUuid();

    function toCall(
      callId: string,
      timestamp: number,
      type: CallType,
      status: CallStatus
    ) {
      return {
        callId,
        peerId: conversationId,
        ringerId: generateAci(),
        mode: CallMode.Direct,
        type,
        direction: CallDirection.Incoming,
        timestamp,
        status,
      };
    }

    const call1 = toCall(
      '1',
      now - 10,
      CallType.Video,
      DirectCallStatus.Accepted
    );
    const call2 = toCall('2', now, CallType.Audio, DirectCallStatus.Missed);

    await saveCallHistory(call1);
    await saveCallHistory(call2);

    const groups = await getCallHistoryGroups(
      { status: CallHistoryFilterStatus.Missed, conversationIds: null },
      { offset: 0, limit: 0 }
    );

    assert.deepEqual(groups, [toGroup([call2])]);
  });

  it('should only return the newest call for an adhoc call roomId', async () => {
    const now = Date.now();
    const roomId = generateUuid();

    function toCall(callId: string, timestamp: number, type: CallType) {
      return {
        callId,
        peerId: roomId,
        ringerId: null,
        mode: CallMode.Adhoc,
        type,
        direction: CallDirection.Outgoing,
        timestamp,
        status: AdhocCallStatus.Joined,
      };
    }

    const call1 = toCall('1', now - 10, CallType.Group);
    const call2 = toCall('2', now, CallType.Group);

    await saveCallHistory(call1);
    await saveCallHistory(call2);

    const groups = await getCallHistoryGroups(
      { status: CallHistoryFilterStatus.All, conversationIds: null },
      { offset: 0, limit: 0 }
    );

    assert.deepEqual(groups, [toAdhocGroup(call2)]);
  });
});

describe('sql/getCallHistoryGroupsCount', () => {
  beforeEach(async () => {
    await removeAll();
  });

  it('counts', async () => {
    const now = Date.now();
    const conversationId = generateUuid();

    function toCall(callId: string, timestamp: number, type: CallType) {
      return {
        callId,
        peerId: conversationId,
        ringerId: generateAci(),
        mode: CallMode.Direct,
        type,
        direction: CallDirection.Incoming,
        timestamp,
        status: DirectCallStatus.Accepted,
      };
    }

    const call1 = toCall('1', now - 30, CallType.Video);
    const call2 = toCall('2', now - 20, CallType.Video);
    const call3 = toCall('3', now - 10, CallType.Audio);
    const call4 = toCall('4', now, CallType.Video);

    await saveCallHistory(call1);
    await saveCallHistory(call2);
    await saveCallHistory(call3);
    await saveCallHistory(call4);

    const result = await getCallHistoryGroupsCount({
      status: CallHistoryFilterStatus.All,
      conversationIds: null,
    });

    assert.equal(result, 3);
  });

  it('should only count each call link roomId once if it had multiple calls', async () => {
    const now = Date.now();
    const roomId1 = generateUuid();
    const roomId2 = generateUuid();

    function toCall(
      callId: string,
      roomId: string,
      timestamp: number,
      type: CallType
    ) {
      return {
        callId,
        peerId: roomId,
        ringerId: null,
        mode: CallMode.Adhoc,
        type,
        direction: CallDirection.Outgoing,
        timestamp,
        status: AdhocCallStatus.Joined,
      };
    }

    const call1 = toCall('1', roomId1, now - 20, CallType.Group);
    const call2 = toCall('2', roomId1, now - 10, CallType.Group);
    const call3 = toCall('3', roomId1, now, CallType.Group);
    const call4 = toCall('4', roomId2, now, CallType.Group);

    await saveCallHistory(call1);
    await saveCallHistory(call2);
    await saveCallHistory(call3);
    await saveCallHistory(call4);

    const result = await getCallHistoryGroupsCount({
      status: CallHistoryFilterStatus.All,
      conversationIds: null,
    });

    assert.equal(result, 2);
  });
});
