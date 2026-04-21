// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { getMidnight } from '../../types/NotificationProfile.std.ts';
import {
  mapItemsIntoCollapseSets,
  MAX_COLLAPSE_SET_SIZE,
} from '../../util/CollapseSet.std.ts';
import { ReadStatus } from '../../messages/MessageReadStatus.std.ts';
import { SeenStatus } from '../../MessageSeenStatus.std.ts';
import { DurationInSeconds } from '../../util/durations/duration-in-seconds.std.ts';
import {
  CallDirection,
  CallMode,
  CallType,
  DirectCallStatus,
} from '../../types/CallDisposition.std.ts';
import { DAY } from '../../util/durations/constants.std.ts';

import type { CallHistoryDetails } from '../../types/CallDisposition.std.ts';
import type {
  MessageLookupType,
  MessageType,
} from '../../state/ducks/conversations.preload.ts';
import type { CollapseSet } from '../../util/CollapseSet.std.ts';
import type { MessageAttributesType } from '../../model-types.d.ts';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';

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
    it('returns single set for all non-groupv2 items included in group sets', () => {
      const groupMessage = {
        ...getDefaultMessage('unused'),
        type: 'group-v2-change' as const,
        groupV2Change: {
          details: [{ type: 'create' as const }],
        },
      };
      // The best test is if these are all right next to group messages; otherwise
      // it's only testing whether they group against their neighbors...
      const itemsToMixIn = [
        // The first set is included
        {
          ...getDefaultMessage('unused'),
          type: 'profile-change' as const,
          profileChange: {
            type: 'name' as const,
            oldName: 'Someone',
            newName: 'Sometwo',
          },
          changedId: generateAci(),
        },
        {
          ...getDefaultMessage('unused'),
          type: 'poll-terminate' as const,
          pollTerminateNotification: {
            question: 'What is the best?',
            pollTimestamp: yesterday,
          },
          changedId: generateAci(),
        },
        {
          ...getDefaultMessage('unused'),
          type: 'keychange' as const,
          key_changed: generateAci(),
        },
        {
          ...getDefaultMessage('unused'),
          type: 'change-number-notification' as const,
          changedId: generateAci(),
        },
        {
          ...getDefaultMessage('unused'),
          type: 'pinned-message-notification' as const,
          pinMessage: {
            targetAuthorAci: generateAci(),
            targetSentTimestamp: yesterday,
          },
        },
        {
          ...getDefaultMessage('unused'),
          type: 'verified-change' as const,
          verified: true,
          verifiedChanged: generateAci(),
        },
        // From here on, they should not be included
        {
          ...getDefaultMessage('unused'),
          type: 'group-v2-change' as const,
          groupV2Change: {
            details: [{ type: 'terminated' as const }],
          },
        },
        {
          ...getDefaultMessage('unused'),
          type: 'chat-session-refreshed' as const,
        },
        {
          ...getDefaultMessage('unused'),
          type: 'conversation-merge' as const,
        },
        {
          ...getDefaultMessage('unused'),
          type: 'delivery-issue' as const,
        },
        {
          ...getDefaultMessage('unused'),
          type: 'group-v1-migration' as const,
        },
        {
          ...getDefaultMessage('unused'),
          type: 'group' as const,
        },
        {
          ...getDefaultMessage('unused'),
          type: 'joined-signal-notification' as const,
        },
        {
          ...getDefaultMessage('unused'),
          type: 'phone-number-discovery' as const,
        },
        {
          ...getDefaultMessage('unused'),
          type: 'universal-timer-notification' as const,
        },
        {
          ...getDefaultMessage('unused'),
          type: 'contact-removed-notification' as const,
        },
        {
          ...getDefaultMessage('unused'),
          type: 'title-transition-notification' as const,
        },
        {
          ...getDefaultMessage('unused'),
          type: 'message-request-response-event' as const,
        },
      ];
      const items = [];
      const messages: Record<string, MessageAttributesType> = {};
      let i = 0;

      for (const item of itemsToMixIn) {
        const firstId = `id${i}`;
        items.push(firstId);
        messages[firstId] = {
          ...groupMessage,
          id: firstId,
        };

        i += 1;

        const secondId = `id${i}`;
        items.push(secondId);
        messages[secondId] = {
          ...item,
          id: secondId,
        };

        i += 1;
      }

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
            {
              id: 'id2',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
            {
              id: 'id3',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
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
              atDateBoundary: false,
            },
            {
              id: 'id7',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
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
            {
              id: 'id10',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
            {
              id: 'id11',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
            {
              id: 'id12',
              isUnseen: false,
              extraItems: undefined,
              atDateBoundary: false,
            },
          ],
        },
        {
          id: 'id13',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id14',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id15',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id16',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id17',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id18',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id19',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id20',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id21',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id22',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id23',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id24',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id25',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id26',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id27',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id28',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id29',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id30',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id31',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id32',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id33',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id34',
          type: 'none',
          messages: undefined,
        },
        {
          id: 'id35',
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
          ...getDefaultMessage('id2'),
          type: 'timer-notification',
          expirationTimerUpdate: {
            expireTimer: DurationInSeconds.fromHours(3),
          },
        },
        id3: {
          ...getDefaultMessage('id3'),
          type: 'timer-notification',
          expirationTimerUpdate: {
            expireTimer: DurationInSeconds.fromHours(4),
          },
        },
        id4: getDefaultMessage('id4'),
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
          ...getDefaultMessage('id8'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id9: {
          ...getDefaultMessage('id9'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id10: {
          ...getDefaultMessage('id10'),
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
          ...getDefaultMessage('id5'),
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
          ...getDefaultMessage('id7'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id8: {
          ...getDefaultMessage('id8'),
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
          ...getDefaultMessage('id0'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id1: {
          ...getDefaultMessage('id1'),
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

    it('limits collapse set size based on MAX_COLLAPSE_SET_SIZE', () => {
      const items = [];
      const messages: Record<string, MessageAttributesType> = {};

      const max = MAX_COLLAPSE_SET_SIZE * 3 + 1;
      for (let i = 0; i < max; i += 1) {
        const id = `id${i}`;
        items.push(id);
        messages[id] = {
          ...getDefaultMessage(id),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        };
      }

      const { resultSets, resultScrollToIndex, resultUnseenIndex } =
        mapItemsIntoCollapseSets({
          ...defaultParams,
          items,
          messages,
        });

      assert.strictEqual(resultSets.length, 4);

      assert.strictEqual(
        resultSets[0]?.messages?.length,
        MAX_COLLAPSE_SET_SIZE,
        'first set'
      );
      assert.strictEqual(
        resultSets[1]?.messages?.length,
        MAX_COLLAPSE_SET_SIZE,
        'second set'
      );
      assert.strictEqual(
        resultSets[2]?.messages?.length,
        MAX_COLLAPSE_SET_SIZE,
        'third set'
      );
      assert.strictEqual(resultSets[3]?.type, 'none', 'fourth set');

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
          ...getDefaultMessage('id8'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id9: {
          ...getDefaultMessage('id9'),
          type: 'group-v2-change',
          groupV2Change: {
            details: [{ type: 'group-link-reset' }],
          },
        },
        id10: {
          ...getDefaultMessage('id10'),
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
