// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';

import type { WritableDB } from '../../sql/Interface';
import { createDB, updateToVersion, insertData, getTableData } from './helpers';

const CONVO_ID = generateGuid();
const GROUP_ID = generateGuid();
const UUID = generateGuid();
const PNI = generateGuid();
const OUR_UUID = generateGuid();
const OUR_PNI = generateGuid();
const THEIR_UUID = generateGuid();

describe('SQL/updateToSchemaVersion88', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 86);

    insertData(db, 'items', [
      {
        id: 'uuid_id',
        json: {
          id: 'uuid_id',
          value: `${OUR_UUID}.1`,
        },
      },
      {
        id: 'pni',
        json: {
          id: 'pni',
          value: OUR_PNI,
        },
      },
    ]);
  });

  afterEach(() => {
    db.close();
  });

  it('should migrate conversations', () => {
    insertData(db, 'conversations', [
      {
        id: CONVO_ID,
        type: 'direct',
        uuid: UUID,
        json: {
          id: CONVO_ID,
          uuid: UUID,
          pni: PNI,
        },
      },
      {
        id: GROUP_ID,
        type: 'group',
        json: {
          id: GROUP_ID,
          bannedMembersV2: [
            {
              uuid: THEIR_UUID,
            },
          ],
          lastMessageBodyRanges: [
            {
              mentionUuid: THEIR_UUID,
            },
          ],
          membersV2: [
            {
              uuid: THEIR_UUID,
            },
          ],
          pendingAdminApprovalV2: [
            {
              uuid: THEIR_UUID,
            },
          ],
          pendingMembersV2: [
            {
              uuid: THEIR_UUID,
            },
          ],
          senderKeyInfo: {
            memberDevices: [{ identifier: CONVO_ID }],
          },
        },
      },
    ]);
    updateToVersion(db, 88);
    assert.deepStrictEqual(getTableData(db, 'conversations'), [
      {
        id: CONVO_ID,
        type: 'direct',
        serviceId: UUID,
        json: {
          id: CONVO_ID,
          serviceId: UUID,
          pni: `PNI:${PNI}`,
        },
      },
      {
        id: GROUP_ID,
        type: 'group',
        json: {
          id: GROUP_ID,
          bannedMembersV2: [{ serviceId: THEIR_UUID }],
          lastMessageBodyRanges: [{ mentionAci: THEIR_UUID }],
          membersV2: [{ aci: THEIR_UUID }],
          pendingAdminApprovalV2: [{ aci: THEIR_UUID }],
          pendingMembersV2: [{ serviceId: THEIR_UUID }],
          senderKeyInfo: {
            memberDevices: [{ serviceId: UUID }],
          },
        },
      },
    ]);
  });

  it('should migrate items', () => {
    insertData(db, 'items', [
      {
        id: 'registrationIdMap',
        json: {
          id: 'registrationIdMap',
          value: {
            [OUR_UUID]: 123,
            [OUR_PNI]: 456,
          },
        },
      },
      {
        id: 'identityKeyMap',
        json: {
          id: 'identityKeyMap',
          value: {
            [OUR_UUID]: {},
            [OUR_PNI]: {},
          },
        },
      },
    ]);
    updateToVersion(db, 88);
    assert.deepStrictEqual(getTableData(db, 'items'), [
      {
        id: 'uuid_id',
        json: {
          id: 'uuid_id',
          value: `${OUR_UUID}.1`,
        },
      },
      {
        id: 'pni',
        json: {
          id: 'pni',
          value: `PNI:${OUR_PNI}`,
        },
      },
      {
        id: 'registrationIdMap',
        json: {
          id: 'registrationIdMap',
          value: {
            [OUR_UUID]: 123,
            [`PNI:${OUR_PNI}`]: 456,
          },
        },
      },
      {
        id: 'identityKeyMap',
        json: {
          id: 'identityKeyMap',
          value: {
            [OUR_UUID]: {},
            [`PNI:${OUR_PNI}`]: {},
          },
        },
      },
    ]);
  });

  it('should migrate sessions', () => {
    insertData(db, 'sessions', [
      {
        id: `${OUR_UUID}:${THEIR_UUID}.1`,
        ourUuid: OUR_UUID,
        uuid: THEIR_UUID,
        json: {
          id: `${OUR_UUID}:${THEIR_UUID}.1`,
          ourUuid: OUR_UUID,
          uuid: THEIR_UUID,
        },
      },
      {
        id: `${OUR_PNI}:${THEIR_UUID}.1`,
        ourUuid: OUR_PNI,
        uuid: THEIR_UUID,
        json: {
          id: `${OUR_PNI}:${THEIR_UUID}.1`,
          ourUuid: OUR_PNI,
          uuid: THEIR_UUID,
        },
      },
    ]);
    updateToVersion(db, 88);
    assert.deepStrictEqual(getTableData(db, 'sessions'), [
      {
        id: `${OUR_UUID}:${THEIR_UUID}.1`,
        ourServiceId: OUR_UUID,
        serviceId: THEIR_UUID,
        json: {
          id: `${OUR_UUID}:${THEIR_UUID}.1`,
          ourServiceId: OUR_UUID,
          serviceId: THEIR_UUID,
        },
      },
      {
        id: `PNI:${OUR_PNI}:${THEIR_UUID}.1`,
        ourServiceId: `PNI:${OUR_PNI}`,
        serviceId: THEIR_UUID,
        json: {
          id: `PNI:${OUR_PNI}:${THEIR_UUID}.1`,
          ourServiceId: `PNI:${OUR_PNI}`,
          serviceId: THEIR_UUID,
        },
      },
    ]);
  });

  it('should migrate messages', () => {
    insertData(db, 'messages', [
      {
        id: 'message-id',
        json: {
          id: 'message-id',
          bodyRanges: [{ mentionUuid: THEIR_UUID }],
          quote: {
            bodyRanges: [{ mentionUuid: THEIR_UUID }],
          },
          sourceUuid: THEIR_UUID,
          expirationTimerUpdate: {
            sourceUuid: THEIR_UUID,
          },
          reactions: [{ targetAuthorUuid: THEIR_UUID }],
          storyReaction: { targetAuthorUuid: THEIR_UUID },
          storyReplyContext: {
            authorUuid: THEIR_UUID,
          },
          editHistory: [
            {
              bodyRanges: [{ mentionUuid: THEIR_UUID }],
              quote: {
                bodyRanges: [{ mentionUuid: THEIR_UUID }],
              },
            },
          ],
          groupV2Change: {
            from: 'abc',
            details: [
              {
                type: 'member-add',
                uuid: THEIR_UUID,
              },
              {
                type: 'pending-add-one',
                uuid: THEIR_UUID,
              },
            ],
          },
        },
      },
    ]);
    updateToVersion(db, 88);
    assert.deepStrictEqual(getTableData(db, 'messages'), [
      {
        id: 'message-id',
        json: {
          id: 'message-id',
          bodyRanges: [{ mentionAci: THEIR_UUID }],
          quote: {
            bodyRanges: [{ mentionAci: THEIR_UUID }],
          },
          sourceServiceId: THEIR_UUID,
          expirationTimerUpdate: {
            sourceServiceId: THEIR_UUID,
          },
          reactions: [{}],
          storyReaction: {},
          storyReplyContext: {
            authorAci: THEIR_UUID,
          },
          editHistory: [
            {
              bodyRanges: [{ mentionAci: THEIR_UUID }],
              quote: {
                bodyRanges: [{ mentionAci: THEIR_UUID }],
              },
            },
          ],
          groupV2Change: {
            from: 'abc',
            details: [
              {
                type: 'member-add',
                aci: THEIR_UUID,
              },
              {
                type: 'pending-add-one',
                serviceId: THEIR_UUID,
              },
            ],
          },
        },
        mentionsMe: 0,
        rowid: 1,
        seenStatus: 0,
        shouldAffectActivity: 1,
        shouldAffectPreview: 1,
        isChangeCreatedByUs: 0,
        isGroupLeaveEvent: 0,
        isGroupLeaveEventFromOther: 0,
        isStory: 0,
        isTimerChangeFromSync: 0,
        isUserInitiatedMessage: 1,
        expiresAt: 9007199254740991,
      },
    ]);
  });

  for (const table of ['preKeys', 'signedPreKeys', 'kyberPreKeys']) {
    // eslint-disable-next-line no-loop-func
    it(`should migrate ${table}`, () => {
      insertData(db, table, [
        {
          id: `${OUR_UUID}:123`,
          json: {
            id: `${OUR_UUID}:123`,
            ourUuid: OUR_UUID,
          },
        },
        {
          id: `${OUR_PNI}:456`,
          json: {
            id: `${OUR_PNI}:456`,
            ourUuid: OUR_PNI,
          },
        },
      ]);
      updateToVersion(db, 88);
      assert.deepStrictEqual(getTableData(db, table), [
        {
          id: `${OUR_UUID}:123`,
          json: {
            id: `${OUR_UUID}:123`,
            ourServiceId: OUR_UUID,
          },
        },
        {
          id: `PNI:${OUR_PNI}:456`,
          json: {
            id: `PNI:${OUR_PNI}:456`,
            ourServiceId: `PNI:${OUR_PNI}`,
          },
        },
      ]);
    });
  }

  it('should migrate jobs', () => {
    insertData(db, 'conversations', [
      {
        id: CONVO_ID,
        type: 'direct',
        uuid: UUID,
        json: {
          id: CONVO_ID,
          uuid: UUID,
          pni: PNI,
        },
      },
    ]);

    insertData(db, 'jobs', [
      {
        id: 'a',
        queueType: 'conversation',
        data: {
          type: 'DeleteStoryForEveryone',
          updatedStoryRecipients: [
            {
              destinationUuid: THEIR_UUID,
            },
          ],
        },
        timestamp: 1,
      },
      {
        id: 'b',
        queueType: 'conversation',
        data: {
          type: 'ResendRequest',
          senderUuid: THEIR_UUID,
        },
        timestamp: 1,
      },
      {
        id: 'c',
        queueType: 'conversation',
        data: {
          type: 'Receipts',
          receipts: [
            {
              senderUuid: THEIR_UUID,
            },
          ],
        },
        timestamp: 1,
      },
      {
        id: 'd',
        queueType: 'read sync',
        data: {
          type: 'Receipts',
          readSyncs: [
            {
              senderUuid: THEIR_UUID,
            },
          ],
        },
        timestamp: 1,
      },
      {
        id: 'e',
        queueType: 'view sync',
        data: {
          type: 'Receipts',
          viewSyncs: [
            {
              senderUuid: THEIR_UUID,
            },
          ],
        },
        timestamp: 1,
      },
      {
        id: 'f',
        queueType: 'view once open sync',
        data: {
          type: 'Receipts',
          viewOnceOpens: [
            {
              senderUuid: THEIR_UUID,
            },
          ],
        },
        timestamp: 1,
      },
      {
        id: 'g',
        queueType: 'single proto',
        data: {
          identifier: CONVO_ID,
        },
        timestamp: 1,
      },
    ]);
    updateToVersion(db, 88);
    assert.deepStrictEqual(getTableData(db, 'jobs'), [
      {
        id: 'a',
        queueType: 'conversation',
        data: {
          type: 'DeleteStoryForEveryone',
          updatedStoryRecipients: [
            {
              destinationServiceId: THEIR_UUID,
            },
          ],
        },
        timestamp: 1,
      },
      {
        id: 'b',
        queueType: 'conversation',
        data: {
          type: 'ResendRequest',
          senderAci: THEIR_UUID,
        },
        timestamp: 1,
      },
      {
        id: 'c',
        queueType: 'conversation',
        data: {
          type: 'Receipts',
          receipts: [
            {
              senderAci: THEIR_UUID,
            },
          ],
        },
        timestamp: 1,
      },
      {
        id: 'd',
        queueType: 'read sync',
        data: {
          type: 'Receipts',
          readSyncs: [
            {
              senderAci: THEIR_UUID,
            },
          ],
        },
        timestamp: 1,
      },
      {
        id: 'e',
        queueType: 'view sync',
        data: {
          type: 'Receipts',
          viewSyncs: [
            {
              senderAci: THEIR_UUID,
            },
          ],
        },
        timestamp: 1,
      },
      {
        id: 'f',
        queueType: 'view once open sync',
        data: {
          type: 'Receipts',
          viewOnceOpens: [
            {
              senderAci: THEIR_UUID,
            },
          ],
        },
        timestamp: 1,
      },
      {
        id: 'g',
        queueType: 'single proto',
        data: {
          serviceId: UUID,
        },
        timestamp: 1,
      },
    ]);
  });
});
