// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { times } from 'lodash';
import { DataReader, DataWriter } from '../../sql/Client';

import {
  CallMode,
  CallDirection,
  CallType,
  GroupCallStatus,
} from '../../types/CallDisposition';
import { generateAci } from '../../types/ServiceId';
import type { CallHistoryDetails } from '../../types/CallDisposition';
import type { MaybeStaleCallHistory } from '../../sql/Server';

const { getAllCallHistory } = DataReader;
const { getRecentStaleRingsAndMarkOlderMissed, removeAll, saveCallHistory } =
  DataWriter;

describe('sql/getRecentStaleRingsAndMarkOlderMissed', () => {
  beforeEach(async () => {
    await removeAll();
  });

  const now = Date.now();
  let offset = 0;

  async function makeCall(
    peerId: string,
    callId: string,
    status: GroupCallStatus
  ) {
    const timestamp = now + offset;
    offset += 1;
    const call: CallHistoryDetails = {
      callId,
      peerId,
      ringerId: generateAci(),
      startedById: generateAci(),
      mode: CallMode.Group,
      type: CallType.Group,
      direction: CallDirection.Incoming,
      timestamp,
      endedTimestamp: null,
      status,
    };
    await saveCallHistory(call);
    return call;
  }

  function toMissed(call: CallHistoryDetails) {
    return { ...call, status: GroupCallStatus.Missed };
  }

  function toMaybeStale(call: CallHistoryDetails): MaybeStaleCallHistory {
    return { callId: call.callId, peerId: call.peerId };
  }

  it('should mark every call but the latest with the same peer as missed', async () => {
    const peer1 = generateUuid();
    const peer2 = generateUuid();
    const call1 = await makeCall(peer1, '1', GroupCallStatus.Ringing);
    const call2 = await makeCall(peer1, '2', GroupCallStatus.Ringing);
    const call3 = await makeCall(peer2, '3', GroupCallStatus.Ringing);
    const call4 = await makeCall(peer2, '4', GroupCallStatus.Ringing);
    const callsToCheck = await getRecentStaleRingsAndMarkOlderMissed();
    const callHistory = await getAllCallHistory();
    assert.deepEqual(callHistory, [
      toMissed(call1),
      call2, // latest peer1
      toMissed(call3),
      call4, // latest peer2
    ]);
    assert.deepEqual(callsToCheck, [
      // in order of timestamp
      toMaybeStale(call4),
      toMaybeStale(call2),
    ]);
  });

  it('should mark every ringing call after the first 10 as missed', async () => {
    const calls = await Promise.all(
      times(15, async i => {
        return makeCall(generateUuid(), String(i), GroupCallStatus.Ringing);
      })
    );

    const callsToCheck = await getRecentStaleRingsAndMarkOlderMissed();
    const callHistory = await getAllCallHistory();
    assert.deepEqual(callHistory, [
      // first 10 are not missed
      ...calls.slice(0, -10).map(toMissed),
      ...calls.slice(-10),
    ]);
    assert.deepEqual(
      callsToCheck,
      calls.slice(-10).map(toMaybeStale).reverse()
    );
  });
});
