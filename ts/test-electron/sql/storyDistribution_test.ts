// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';
import { generateStoryDistributionId } from '../../types/StoryDistributionId';

import type { StoryDistributionWithMembersType } from '../../sql/Interface';

const {
  _getAllStoryDistributionMembers,
  _getAllStoryDistributions,
  getAllStoryDistributionsWithMembers,
} = DataReader;

const {
  _deleteAllStoryDistributions,
  createNewStoryDistribution,
  deleteStoryDistribution,
  modifyStoryDistribution,
  modifyStoryDistributionMembers,
  modifyStoryDistributionWithMembers,
} = DataWriter;

describe('sql/storyDistribution', () => {
  beforeEach(async () => {
    await _deleteAllStoryDistributions();
  });

  it('roundtrips with create/fetch/delete', async () => {
    const list: StoryDistributionWithMembersType = {
      id: generateStoryDistributionId(),
      name: 'My Story',
      allowsReplies: true,
      isBlockList: false,
      members: [generateAci(), generateAci()],
      senderKeyInfo: {
        createdAtDate: Date.now(),
        distributionId: generateUuid(),
        memberDevices: [],
      },
      storageID: generateUuid(),
      storageVersion: 1,
      storageNeedsSync: false,
      storageUnknownFields: undefined,
      deletedAtTimestamp: undefined,
    };

    await createNewStoryDistribution(list);

    assert.lengthOf(await _getAllStoryDistributions(), 1);
    assert.lengthOf(await _getAllStoryDistributionMembers(), 2);

    const allHydratedLists = await getAllStoryDistributionsWithMembers();
    assert.lengthOf(allHydratedLists, 1);
    assert.deepEqual(allHydratedLists[0], list);

    await deleteStoryDistribution(list.id);

    assert.lengthOf(await _getAllStoryDistributions(), 0);
    assert.lengthOf(await _getAllStoryDistributionMembers(), 0);
    assert.lengthOf(await getAllStoryDistributionsWithMembers(), 0);
  });

  it('updates core fields with modifyStoryDistribution', async () => {
    const SERVICE_ID_1 = generateAci();
    const SERVICE_ID_2 = generateAci();
    const list: StoryDistributionWithMembersType = {
      id: generateStoryDistributionId(),
      name: 'My Story',
      allowsReplies: true,
      isBlockList: false,
      members: [SERVICE_ID_1, SERVICE_ID_2],
      senderKeyInfo: {
        createdAtDate: Date.now(),
        distributionId: generateUuid(),
        memberDevices: [],
      },
      storageID: generateUuid(),
      storageVersion: 1,
      storageNeedsSync: false,
      storageUnknownFields: undefined,
      deletedAtTimestamp: undefined,
    };

    await createNewStoryDistribution(list);

    assert.lengthOf(await _getAllStoryDistributions(), 1);
    assert.lengthOf(await _getAllStoryDistributionMembers(), 2);

    const updated = {
      ...list,
      name: 'Updated story',
      senderKeyInfo: {
        createdAtDate: Date.now() + 10,
        distributionId: generateUuid(),
        memberDevices: [
          {
            id: 1,
            serviceId: SERVICE_ID_1,
            registrationId: 232,
          },
        ],
      },
    };

    await modifyStoryDistribution(updated);

    assert.lengthOf(await _getAllStoryDistributions(), 1);
    assert.lengthOf(await _getAllStoryDistributionMembers(), 2);

    const allHydratedLists = await getAllStoryDistributionsWithMembers();
    assert.lengthOf(allHydratedLists, 1);
    assert.deepEqual(allHydratedLists[0], updated);
  });

  it('adds and removes with modifyStoryDistributionMembers', async () => {
    const SERVICE_ID_1 = generateAci();
    const SERVICE_ID_2 = generateAci();
    const SERVICE_ID_3 = generateAci();
    const SERVICE_ID_4 = generateAci();
    const list: StoryDistributionWithMembersType = {
      id: generateStoryDistributionId(),
      name: 'My Story',
      allowsReplies: true,
      isBlockList: false,
      members: [SERVICE_ID_1, SERVICE_ID_2],
      senderKeyInfo: {
        createdAtDate: Date.now(),
        distributionId: generateUuid(),
        memberDevices: [],
      },
      storageID: generateUuid(),
      storageVersion: 1,
      storageNeedsSync: false,
      storageUnknownFields: undefined,
      deletedAtTimestamp: undefined,
    };

    await createNewStoryDistribution(list);

    assert.lengthOf(await _getAllStoryDistributions(), 1);
    assert.lengthOf(await _getAllStoryDistributionMembers(), 2);

    await modifyStoryDistributionMembers(list.id, {
      toAdd: [SERVICE_ID_3, SERVICE_ID_4],
      toRemove: [SERVICE_ID_1],
    });

    assert.lengthOf(await _getAllStoryDistributions(), 1);
    assert.lengthOf(await _getAllStoryDistributionMembers(), 3);

    const allHydratedLists = await getAllStoryDistributionsWithMembers();
    assert.lengthOf(allHydratedLists, 1);
    assert.deepEqual(allHydratedLists[0], {
      ...list,
      members: [SERVICE_ID_2, SERVICE_ID_3, SERVICE_ID_4],
    });
  });

  it('adds and removes with modifyStoryDistributionWithMembers', async () => {
    const SERVICE_ID_1 = generateAci();
    const SERVICE_ID_2 = generateAci();
    const SERVICE_ID_3 = generateAci();
    const SERVICE_ID_4 = generateAci();
    const list: StoryDistributionWithMembersType = {
      id: generateStoryDistributionId(),
      name: 'My Story',
      allowsReplies: true,
      isBlockList: false,
      members: [SERVICE_ID_1, SERVICE_ID_2],
      senderKeyInfo: {
        createdAtDate: Date.now(),
        distributionId: generateUuid(),
        memberDevices: [],
      },
      storageID: generateUuid(),
      storageVersion: 1,
      storageNeedsSync: false,
      storageUnknownFields: undefined,
      deletedAtTimestamp: undefined,
    };

    await createNewStoryDistribution(list);

    assert.lengthOf(await _getAllStoryDistributions(), 1);
    assert.lengthOf(await _getAllStoryDistributionMembers(), 2);

    await modifyStoryDistributionWithMembers(list, {
      toAdd: [SERVICE_ID_3, SERVICE_ID_4],
      toRemove: [SERVICE_ID_1],
    });

    assert.lengthOf(await _getAllStoryDistributions(), 1);
    assert.lengthOf(await _getAllStoryDistributionMembers(), 3);

    const allHydratedLists = await getAllStoryDistributionsWithMembers();
    assert.lengthOf(allHydratedLists, 1);
    assert.deepEqual(allHydratedLists[0], {
      ...list,
      members: [SERVICE_ID_2, SERVICE_ID_3, SERVICE_ID_4],
    });
  });

  it('eliminates duplicates without complaint in createNewStoryDistribution', async () => {
    const SERVICE_ID_1 = generateAci();
    const SERVICE_ID_2 = generateAci();
    const list: StoryDistributionWithMembersType = {
      id: generateStoryDistributionId(),
      name: 'My Story',
      allowsReplies: true,
      isBlockList: false,
      members: [SERVICE_ID_1, SERVICE_ID_1, SERVICE_ID_2],
      senderKeyInfo: {
        createdAtDate: Date.now(),
        distributionId: generateUuid(),
        memberDevices: [],
      },
      storageID: generateUuid(),
      storageVersion: 1,
      storageNeedsSync: false,
      storageUnknownFields: undefined,
      deletedAtTimestamp: undefined,
    };

    await createNewStoryDistribution(list);

    assert.lengthOf(await _getAllStoryDistributions(), 1);
    assert.lengthOf(await _getAllStoryDistributionMembers(), 2);

    const allHydratedLists = await getAllStoryDistributionsWithMembers();
    assert.lengthOf(allHydratedLists, 1);
    assert.deepEqual(allHydratedLists[0].members, [SERVICE_ID_1, SERVICE_ID_2]);
  });
});
