// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { getMidnight } from '../../types/NotificationProfile.std.js';
import { mapItemsIntoCollapseSets } from '../../util/CollapseSet.std.js';
import { generateAci } from '../../types/ServiceId.std.js';
import { ReadStatus } from '../../messages/MessageReadStatus.std.js';
import { SeenStatus } from '../../MessageSeenStatus.std.js';
import { DurationInSeconds } from '../../util/durations/duration-in-seconds.std.js';
import {
  CallDirection,
  CallMode,
  CallType,
  DirectCallStatus,
} from '../../types/CallDisposition.std.js';
import { DAY } from '../../util/durations/constants.std.js';

import type { CallHistoryDetails } from '../../types/CallDisposition.std.js';
import type {
  MessageLookupType,
  MessageType,
} from '../../state/ducks/conversations.preload.js';
import type { CollapseSet } from '../../util/CollapseSet.std.js';

describe('util/CollapseSets', () => {
  describe('mapItemsIntoCollapseSets', () => {
    const conversationId = generateUuid();
    const now = Date.now();
    const yesterday = now - DAY;
    const defaultParams = {
      activeCall: undefined,
      allowMultidaySets: true,
      callHistorySelector: () => undefined,
      callSelector: () => undefined,
      getCallIdFromEra: (eraId: string) => eraId,
      items: [],
      messages: {},
      midnightToday: getMidnight(now),
      oldestUnseenIndex: null,
      scrollToIndex: null,
    };

    function getDefaultMessage(id: string, timestamp = yesterday): MessageType {
      return {
        attachments: [],
        conversationId,
        id,
        received_at: timestamp,
        sent_at: timestamp,
        source: 'source',
        sourceServiceId: generateAci(),
        timestamp,
        type: 'incoming' as const,
        readStatus: ReadStatus.Read,
      };
    }

    it('returns all "none" for normal messages', () => {
      const items = ['id0', 'id1', 'id2'];
      const messages: MessageLookupType = {
        id0: getDefaultMessage('id0'),
        id1: getDefaultMessage('id1'),
        id2: getDefaultMessage('id2'),
      };

      const expectedSets: Array<CollapseSet> = [
        {
          id: 'id0',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id1',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id2',
          type: 'none',
          messages: undefined,
        },
      ];

      const { resultSets, resultScrollToIndex, resultUnseenIndex } =
        mapItemsIntoCollapseSets({
          ...defaultParams,
          items,
          messages,
        });

      assert.deepEqual(resultSets, expectedSets);
      assert.isNull(resultScrollToIndex);
      assert.isNull(resultUnseenIndex);
    });
    it('returns single set for all group update items', () => {
      const items = ['id0', 'id1', 'id2'];
      const messages: MessageLookupType = {
        id0: {
          ...getDefaultMessage('id0'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'create' }],
          },
        },
        id1: {
          ...getDefaultMessage('id1'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [
              { type: 'member-add', aci: generateAci() },
              { type: 'member-add', aci: generateAci() },
            ],
          },
        },
        id2: {
          ...getDefaultMessage('id2'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
          seenStatus: SeenStatus.Unseen,
        },
      };
      const scrollToIndex = 2;

      const expectedSets: Array<CollapseSet> = [
        {
          id: 'id0',
          type: 'group-updates',
          messages: [
            {
              id: 'id0',
              isUnseen: false,
              extraItems: undefined,
            },
            {
              id: 'id1',
              isUnseen: false,
              extraItems: 1,
              atDateBoundary: false,
            },
            {
              id: 'id2',
              isUnseen: true,
              extraItems: undefined,
              atDateBoundary: false,
            },
          ],
        },
      ];
      const expectedScrollToIndex = 0;

      const { resultSets, resultScrollToIndex, resultUnseenIndex } =
        mapItemsIntoCollapseSets({
          ...defaultParams,
          items,
          messages,
          scrollToIndex,
        });

      assert.deepEqual(resultSets, expectedSets);
      assert.strictEqual(
        resultScrollToIndex,
        expectedScrollToIndex,
        'resultScrollToIndex'
      );
      assert.isNull(resultUnseenIndex);
    });

    it('returns single set for all timer change items', () => {
      const items = ['id0', 'id1', 'id2'];
      const messages: MessageLookupType = {
        id0: {
          ...getDefaultMessage('id0'),
          type: 'incoming',
          expirationTimerUpdate: {
            expireTimer: DurationInSeconds.fromHours(5),
          },
        },
        id1: {
          ...getDefaultMessage('id1'),
          type: 'timer-notification',
          expirationTimerUpdate: {
            expireTimer: undefined,
          },
          seenStatus: SeenStatus.Unseen,
        },
        id2: {
          ...getDefaultMessage('id2'),
          type: 'outgoing',
          expirationTimerUpdate: {
            expireTimer: DurationInSeconds.fromSeconds(30),
          },
          seenStatus: SeenStatus.Unseen,
        },
      };
      const expectedSets: Array<CollapseSet> = [
        {
          id: 'id0',
          type: 'timer-changes',
          endingState: DurationInSeconds.fromSeconds(30),
          messages: [
            {
              id: 'id0',
              isUnseen: false,
            },
            {
              id: 'id1',
              isUnseen: true,
              atDateBoundary: false,
            },
            {
              id: 'id2',
              isUnseen: true,
              atDateBoundary: false,
            },
          ],
        },
      ];

      const { resultSets, resultScrollToIndex, resultUnseenIndex } =
        mapItemsIntoCollapseSets({ ...defaultParams, items, messages });

      assert.deepEqual(resultSets, expectedSets);
      assert.isNull(resultScrollToIndex);
      assert.isNull(resultUnseenIndex);
    });
    it('returns single set for all call event items', () => {
      const items = ['id0', 'id1', 'id2'];
      const messages: MessageLookupType = {
        id0: {
          ...getDefaultMessage('id0'),
          type: 'call-history',
          callId: 'id0',
        },
        id1: {
          ...getDefaultMessage('id1'),
          type: 'call-history',
          callId: 'id1',
        },
        id2: {
          ...getDefaultMessage('id2'),
          type: 'call-history',
          callId: 'id2',
          seenStatus: SeenStatus.Unseen,
        },
      };
      const callHistorySelector = (callId: string): CallHistoryDetails => {
        if (callId === 'id0') {
          return {
            callId: 'id0',
            peerId: generateUuid(),
            ringerId: generateAci(),
            startedById: generateAci(),
            mode: CallMode.Direct,
            type: CallType.Audio,
            direction: CallDirection.Incoming,
            timestamp: now,
            endedTimestamp: now,
            status: DirectCallStatus.Accepted,
          };
        }
        if (callId === 'id1') {
          return {
            callId: 'id1',
            peerId: generateUuid(),
            ringerId: generateAci(),
            startedById: generateAci(),
            mode: CallMode.Direct,
            type: CallType.Audio,
            direction: CallDirection.Incoming,
            timestamp: now,
            endedTimestamp: now,
            status: DirectCallStatus.Missed,
          };
        }
        if (callId === 'id2') {
          return {
            callId: 'id2',
            peerId: generateUuid(),
            ringerId: generateAci(),
            startedById: generateAci(),
            mode: CallMode.Direct,
            type: CallType.Audio,
            direction: CallDirection.Incoming,
            timestamp: now,
            endedTimestamp: now,
            status: DirectCallStatus.Missed,
          };
        }
        throw new Error(`${callId} is not known!`);
      };

      const expectedSets: Array<CollapseSet> = [
        {
          id: 'id0',
          type: 'call-events',
          messages: [
            {
              id: 'id0',
              isUnseen: false,
            },
            {
              id: 'id1',
              isUnseen: false,
              atDateBoundary: false,
            },
            {
              id: 'id2',
              isUnseen: true,
              atDateBoundary: false,
            },
          ],
        },
      ];

      const { resultSets, resultScrollToIndex, resultUnseenIndex } =
        mapItemsIntoCollapseSets({
          ...defaultParams,
          items,
          messages,
          callHistorySelector,
        });

      assert.deepEqual(resultSets, expectedSets);
      assert.isNull(resultScrollToIndex);
      assert.isNull(resultUnseenIndex);
    });

    it('returns a combination of sets for combination of items', () => {
      const items = [
        'id0',
        'id1',
        'id2',
        'id3',
        'id4',
        'id5',
        'id6',
        'id7',
        'id8',
      ];
      const messages: MessageLookupType = {
        id0: {
          ...getDefaultMessage('id0'),
          type: 'call-history',
          callId: 'id0',
        },
        id1: {
          ...getDefaultMessage('id1'),
          type: 'call-history',
          callId: 'id1',
        },
        id2: getDefaultMessage('id2'),
        id3: {
          ...getDefaultMessage('id3'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [
              { type: 'member-add', aci: generateAci() },
              { type: 'member-add', aci: generateAci() },
            ],
          },
        },
        id4: {
          ...getDefaultMessage('id4'),
          type: 'incoming',
          expirationTimerUpdate: {
            expireTimer: DurationInSeconds.fromHours(5),
          },
        },
        id5: {
          ...getDefaultMessage('id5'),
          type: 'timer-notification',
          expirationTimerUpdate: {
            expireTimer: undefined,
          },
        },
        id6: {
          ...getDefaultMessage('id4'),
          type: 'call-history',
          callId: 'id4',
        },
        id7: getDefaultMessage('id7'),
        id8: getDefaultMessage('id8'),
      };
      const callHistorySelector = (callId: string): CallHistoryDetails => {
        if (callId === 'id0') {
          return {
            callId: 'id0',
            peerId: generateUuid(),
            ringerId: generateAci(),
            startedById: generateAci(),
            mode: CallMode.Direct,
            type: CallType.Audio,
            direction: CallDirection.Incoming,
            timestamp: now,
            endedTimestamp: now,
            status: DirectCallStatus.Accepted,
          };
        }
        if (callId === 'id1') {
          return {
            callId: 'id1',
            peerId: generateUuid(),
            ringerId: generateAci(),
            startedById: generateAci(),
            mode: CallMode.Direct,
            type: CallType.Audio,
            direction: CallDirection.Incoming,
            timestamp: now,
            endedTimestamp: now,
            status: DirectCallStatus.Missed,
          };
        }
        if (callId === 'id4') {
          return {
            callId: 'id4',
            peerId: generateUuid(),
            ringerId: generateAci(),
            startedById: generateAci(),
            mode: CallMode.Direct,
            type: CallType.Audio,
            direction: CallDirection.Incoming,
            timestamp: now,
            endedTimestamp: now,
            status: DirectCallStatus.Missed,
          };
        }
        throw new Error(`${callId} is not known!`);
      };
      const scrollToIndex = 5;
      const oldestUnseenIndex = 7;

      const expectedSets: Array<CollapseSet> = [
        {
          id: 'id0',
          type: 'call-events',
          messages: [
            {
              id: 'id0',
              isUnseen: false,
            },
            {
              id: 'id1',
              isUnseen: false,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id2',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id3',
          type: 'group-updates',
          messages: [
            {
              id: 'id3',
              isUnseen: false,
              extraItems: 1,
            },
          ],
        },
        {
          id: 'id4',
          type: 'timer-changes',
          endingState: undefined,
          messages: [
            {
              id: 'id4',
              isUnseen: false,
            },
            {
              id: 'id5',
              isUnseen: false,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id6',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id7',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id8',
          type: 'none',
          messages: undefined,
        },
      ];
      const expectedScrollToIndex = 3;
      const expectedUnseenIndex = 5;

      const { resultSets, resultScrollToIndex, resultUnseenIndex } =
        mapItemsIntoCollapseSets({
          ...defaultParams,
          items,
          messages,
          callHistorySelector,
          scrollToIndex,
          oldestUnseenIndex,
        });

      assert.deepEqual(resultSets, expectedSets);
      assert.strictEqual(
        resultScrollToIndex,
        expectedScrollToIndex,
        'resultScrollToIndex'
      );
      assert.strictEqual(
        resultUnseenIndex,
        expectedUnseenIndex,
        'resultUnseenIndex'
      );
    });

    it('splits sets across the lastSeenIndex', () => {
      const items = ['id0', 'id1', 'id2', 'id3'];
      const messages: MessageLookupType = {
        id0: {
          ...getDefaultMessage('id0'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'create' }],
          },
        },
        id1: {
          ...getDefaultMessage('id1'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [
              { type: 'member-add', aci: generateAci() },
              { type: 'member-add', aci: generateAci() },
            ],
          },
        },
        id2: {
          ...getDefaultMessage('id2'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id3: {
          ...getDefaultMessage('id3'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
      };
      const oldestUnseenIndex = 2;

      const expectedSets: Array<CollapseSet> = [
        {
          id: 'id0',
          type: 'group-updates',
          messages: [
            {
              id: 'id0',
              isUnseen: false,
              extraItems: undefined,
            },
            {
              id: 'id1',
              isUnseen: false,
              extraItems: 1,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id2',
          type: 'group-updates',
          messages: [
            {
              id: 'id2',
              isUnseen: false,
              extraItems: undefined,
            },
            {
              id: 'id3',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
          ],
        },
      ];
      const expectedLastSeenIndex = 1;

      const { resultSets, resultScrollToIndex, resultUnseenIndex } =
        mapItemsIntoCollapseSets({
          ...defaultParams,
          items,
          oldestUnseenIndex,
          messages,
        });

      assert.deepEqual(resultSets, expectedSets);
      assert.isNull(resultScrollToIndex);
      assert.strictEqual(
        resultUnseenIndex,
        expectedLastSeenIndex,
        'resultUnseenIndex'
      );
    });

    it('splits timer events and updates endingState properly', () => {
      const items = ['id0', 'id1', 'id2', 'id3', 'id4'];
      const messages: MessageLookupType = {
        id0: {
          ...getDefaultMessage('id0', now - DAY * 2),
          type: 'timer-notification',
          expirationTimerUpdate: {
            expireTimer: DurationInSeconds.fromHours(1),
          },
        },
        id1: {
          ...getDefaultMessage('id1', now - DAY * 2),
          type: 'timer-notification',
          expirationTimerUpdate: {
            expireTimer: DurationInSeconds.fromHours(2),
          },
        },
        id2: {
          ...getDefaultMessage('id2', yesterday),
          type: 'timer-notification',
          expirationTimerUpdate: {
            expireTimer: DurationInSeconds.fromHours(3),
          },
        },
        id3: {
          ...getDefaultMessage('id3', yesterday),
          type: 'timer-notification',
          expirationTimerUpdate: {
            expireTimer: DurationInSeconds.fromHours(4),
          },
        },
        id4: getDefaultMessage('id4', yesterday),
      };

      const expectedSets: Array<CollapseSet> = [
        {
          id: 'id0',
          type: 'timer-changes',
          endingState: DurationInSeconds.fromHours(2),
          messages: [
            {
              id: 'id0',
              isUnseen: false,
            },
            {
              id: 'id1',
              isUnseen: false,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id2',
          type: 'timer-changes',
          endingState: DurationInSeconds.fromHours(4),
          messages: [
            {
              id: 'id2',
              isUnseen: false,
              atDateBoundary: false,
            },
            {
              id: 'id3',
              isUnseen: false,
              atDateBoundary: false,
            },
          ],
        },
        { id: 'id4', type: 'none', messages: undefined },
      ];

      const { resultSets, resultScrollToIndex, resultUnseenIndex } =
        mapItemsIntoCollapseSets({
          ...defaultParams,
          items,
          messages,
        });

      assert.deepEqual(resultSets, expectedSets);
      assert.isNull(resultScrollToIndex);
      assert.isNull(resultUnseenIndex);
    });

    it('generates multiday sets, but not if start/end are incomplete days', () => {
      const items = [
        'id0', // Today - 4
        'id1',
        'id2',
        'id3', // Today - 3
        'id4',
        'id5',
        'id6', // Today - 2
        'id7',
        'id8', // Yesterday
        'id9',
        'id10',
      ];
      const messages: MessageLookupType = {
        id0: {
          ...getDefaultMessage('id0', now - DAY * 4),
        },
        id1: {
          ...getDefaultMessage('id1', now - DAY * 4),
          type: 'group-v2-change',
          groupV2Change: {
            details: [
              { type: 'member-add', aci: generateAci() },
              { type: 'member-add', aci: generateAci() },
            ],
          },
        },
        id2: {
          ...getDefaultMessage('id2', now - DAY * 4),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id3: {
          ...getDefaultMessage('id3', now - DAY * 3),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id4: {
          ...getDefaultMessage('id4', now - DAY * 3),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id5: {
          ...getDefaultMessage('id5', now - DAY * 3),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id6: {
          ...getDefaultMessage('id6', now - DAY * 2),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id7: {
          ...getDefaultMessage('id7', now - DAY * 2),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id8: {
          ...getDefaultMessage('id8', yesterday),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id9: {
          ...getDefaultMessage('id9', yesterday),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id10: {
          ...getDefaultMessage('id10', yesterday),
        },
      };

      const expectedSets: Array<CollapseSet> = [
        {
          id: 'id0',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id1',
          type: 'group-updates',
          messages: [
            {
              id: 'id1',
              isUnseen: false,
              extraItems: 1,
            },
            {
              id: 'id2',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id3',
          type: 'group-updates',
          messages: [
            {
              id: 'id3',
              isUnseen: false,
              extraItems: undefined,
            },
            {
              id: 'id4',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
            {
              id: 'id5',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
            {
              id: 'id6',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: true,
            },
            {
              id: 'id7',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id8',
          type: 'group-updates',
          messages: [
            {
              id: 'id8',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
            {
              id: 'id9',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id10',
          type: 'none',
          messages: undefined,
        },
      ];
      const { resultSets, resultScrollToIndex, resultUnseenIndex } =
        mapItemsIntoCollapseSets({
          ...defaultParams,
          items,
          messages,
        });

      assert.deepEqual(resultSets, expectedSets);
      assert.isNull(resultScrollToIndex);
      assert.isNull(resultUnseenIndex);
    });

    it('handles multiday edge cases: single-item days, etc.', () => {
      const items = [
        'id0', // Today - 6
        'id1', // Today - 5
        'id2', // Today - 4
        'id3', // Today - 3
        'id4', // Today - 2
        'id5', // Yesterday
      ];
      const messages: MessageLookupType = {
        id0: {
          ...getDefaultMessage('id0', now - DAY * 6),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id1: getDefaultMessage('id1', now - DAY * 5),
        id2: {
          ...getDefaultMessage('id2', now - DAY * 4),
          type: 'group-v2-change',
          groupV2Change: {
            details: [
              { type: 'member-add', aci: generateAci() },
              { type: 'member-add', aci: generateAci() },
            ],
          },
        },
        id3: getDefaultMessage('id3', now - DAY * 3),
        id4: {
          ...getDefaultMessage('id4', now - DAY * 2),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id5: {
          ...getDefaultMessage('id5', yesterday),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
      };

      const expectedSets: Array<CollapseSet> = [
        {
          id: 'id0',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id1',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id2',
          type: 'group-updates',
          messages: [
            {
              id: 'id2',
              isUnseen: false,
              extraItems: 1,
            },
          ],
        },
        {
          id: 'id3',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id4',
          type: 'group-updates',
          messages: [
            {
              id: 'id4',
              isUnseen: false,
              extraItems: undefined,
            },
            {
              id: 'id5',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: true,
            },
          ],
        },
      ];
      const { resultSets, resultScrollToIndex, resultUnseenIndex } =
        mapItemsIntoCollapseSets({
          ...defaultParams,
          items,
          messages,
        });

      assert.deepEqual(resultSets, expectedSets);
      assert.isNull(resultScrollToIndex);
      assert.isNull(resultUnseenIndex);
    });

    it('splits failed multiday sets into none sets if needed', () => {
      const items = [
        'id0', // Today - 6
        'id1', // Today - 5
        'id2',
        'id3', // Today - 4
        'id4', // Today - 3
        'id5',
        'id6', // Today - 2
        'id7', // Yesterday
        'id8',
      ];
      const messages: MessageLookupType = {
        id0: {
          ...getDefaultMessage('id0', now - DAY * 6),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id1: {
          ...getDefaultMessage('id1', now - DAY * 5),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id2: getDefaultMessage('id2', now - DAY * 5),
        id3: {
          ...getDefaultMessage('id3', now - DAY * 4),
          type: 'group-v2-change',
          groupV2Change: {
            details: [
              { type: 'member-add', aci: generateAci() },
              { type: 'member-add', aci: generateAci() },
            ],
          },
        },
        id4: {
          ...getDefaultMessage('id4', now - DAY * 3),
          type: 'group-v2-change',
          groupV2Change: {
            details: [
              { type: 'member-add', aci: generateAci() },
              { type: 'member-add', aci: generateAci() },
            ],
          },
        },
        id5: getDefaultMessage('id5', now - DAY * 3),
        id6: {
          ...getDefaultMessage('id6', now - DAY * 2),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id7: {
          ...getDefaultMessage('id7', yesterday),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id8: {
          ...getDefaultMessage('id8', yesterday),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
      };
      const oldestUnseenIndex = 8;

      const expectedSets: Array<CollapseSet> = [
        {
          id: 'id0',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id1',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id2',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id3',
          type: 'group-updates',
          messages: [
            {
              id: 'id3',
              isUnseen: false,
              extraItems: 1,
            },
          ],
        },
        {
          id: 'id4',
          type: 'group-updates',
          messages: [
            {
              id: 'id4',
              isUnseen: false,
              extraItems: 1,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id5',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id6',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id7',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id8',
          type: 'none',
          messages: undefined,
        },
      ];
      const expectedUnseenIndex = 8;

      const { resultSets, resultScrollToIndex, resultUnseenIndex } =
        mapItemsIntoCollapseSets({
          ...defaultParams,
          items,
          messages,
          oldestUnseenIndex,
        });

      assert.deepEqual(resultSets, expectedSets);
      assert.isNull(resultScrollToIndex);
      assert.strictEqual(
        resultUnseenIndex,
        expectedUnseenIndex,
        'resultUnseenIndex'
      );
    });

    it('today is never included in a multiday set', () => {
      const items = [
        'id0', // Yesterday
        'id1',
        'id2', // Today
        'id3',
      ];
      const messages: MessageLookupType = {
        id0: {
          ...getDefaultMessage('id0', yesterday),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id1: {
          ...getDefaultMessage('id1', yesterday),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id2: {
          ...getDefaultMessage('id2', now),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id3: {
          ...getDefaultMessage('id3', now),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
      };

      const expectedSets: Array<CollapseSet> = [
        {
          id: 'id0',
          type: 'group-updates',
          messages: [
            {
              id: 'id0',
              isUnseen: false,
              extraItems: undefined,
            },
            {
              id: 'id1',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id2',
          type: 'group-updates',
          messages: [
            {
              id: 'id2',
              isUnseen: false,
              extraItems: undefined,
            },
            {
              id: 'id3',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
          ],
        },
      ];

      const { resultSets, resultScrollToIndex, resultUnseenIndex } =
        mapItemsIntoCollapseSets({
          ...defaultParams,
          items,
          messages,
        });

      assert.deepEqual(resultSets, expectedSets);
      assert.isNull(resultScrollToIndex);
      assert.isNull(resultUnseenIndex);
    });

    it('if allowMultidaySets=false, generates a set for each day', () => {
      const items = [
        'id0', // Today - 4
        'id1',
        'id2',
        'id3', // Today - 3
        'id4',
        'id5',
        'id6', // Today - 2
        'id7',
        'id8', // Yesterday
        'id9',
        'id10',
      ];
      const messages: MessageLookupType = {
        id0: {
          ...getDefaultMessage('id0', now - DAY * 4),
        },
        id1: {
          ...getDefaultMessage('id1', now - DAY * 4),
          type: 'group-v2-change',
          groupV2Change: {
            details: [
              { type: 'member-add', aci: generateAci() },
              { type: 'member-add', aci: generateAci() },
            ],
          },
        },
        id2: {
          ...getDefaultMessage('id2', now - DAY * 4),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id3: {
          ...getDefaultMessage('id3', now - DAY * 3),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id4: {
          ...getDefaultMessage('id4', now - DAY * 3),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id5: {
          ...getDefaultMessage('id5', now - DAY * 3),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id6: {
          ...getDefaultMessage('id6', now - DAY * 2),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id7: {
          ...getDefaultMessage('id7', now - DAY * 2),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id8: {
          ...getDefaultMessage('id8', yesterday),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id9: {
          ...getDefaultMessage('id9', yesterday),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id10: {
          ...getDefaultMessage('id10', yesterday),
        },
      };

      const expectedSets: Array<CollapseSet> = [
        {
          id: 'id0',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id1',
          type: 'group-updates',
          messages: [
            {
              id: 'id1',
              isUnseen: false,
              extraItems: 1,
            },
            {
              id: 'id2',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id3',
          type: 'group-updates',
          messages: [
            {
              id: 'id3',
              isUnseen: false,
              extraItems: undefined,
            },
            {
              id: 'id4',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
            {
              id: 'id5',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id6',
          type: 'group-updates',
          messages: [
            {
              id: 'id6',
              isUnseen: false,
              extraItems: undefined,
            },
            {
              id: 'id7',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id8',
          type: 'group-updates',
          messages: [
            {
              id: 'id8',
              isUnseen: false,
              extraItems: undefined,
            },
            {
              id: 'id9',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id10',
          type: 'none',
          messages: undefined,
        },
      ];
      const { resultSets, resultScrollToIndex, resultUnseenIndex } =
        mapItemsIntoCollapseSets({
          ...defaultParams,
          allowMultidaySets: false,
          items,
          messages,
        });

      assert.deepEqual(resultSets, expectedSets);
      assert.isNull(resultScrollToIndex);
      assert.isNull(resultUnseenIndex);
    });
  });
});
