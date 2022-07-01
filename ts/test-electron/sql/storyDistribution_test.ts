// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import dataInterface from '../../sql/Client';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';

import type { StoryDistributionWithMembersType } from '../../sql/Interface';

const {
  _deleteAllStoryDistributions,
  _getAllStoryDistributionMembers,
  _getAllStoryDistributions,
  createNewStoryDistribution,
  deleteStoryDistribution,
  getAllStoryDistributionsWithMembers,
  modifyStoryDistribution,
  modifyStoryDistributionMembers,
  modifyStoryDistributionWithMembers,
} = dataInterface;

function getUuid(): UUIDStringType {
  return UUID.generate().toString();
}

describe('sql/storyDistribution', () => {
  beforeEach(async () => {
    await _deleteAllStoryDistributions();
  });

  it('roundtrips with create/fetch/delete', async () => {
    const list: StoryDistributionWithMembersType = {
      id: getUuid(),
      name: 'My Story',
      allowsReplies: true,
      isBlockList: false,
      members: [getUuid(), getUuid()],
      senderKeyInfo: {
        createdAtDate: Date.now(),
        distributionId: getUuid(),
        memberDevices: [],
      },
      storageID: getUuid(),
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
    const UUID_1 = getUuid();
    const UUID_2 = getUuid();
    const list: StoryDistributionWithMembersType = {
      id: getUuid(),
      name: 'My Story',
      allowsReplies: true,
      isBlockList: false,
      members: [UUID_1, UUID_2],
      senderKeyInfo: {
        createdAtDate: Date.now(),
        distributionId: getUuid(),
        memberDevices: [],
      },
      storageID: getUuid(),
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
        distributionId: getUuid(),
        memberDevices: [
          {
            id: 1,
            identifier: UUID_1,
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
    const UUID_1 = getUuid();
    const UUID_2 = getUuid();
    const UUID_3 = getUuid();
    const UUID_4 = getUuid();
    const list: StoryDistributionWithMembersType = {
      id: getUuid(),
      name: 'My Story',
      allowsReplies: true,
      isBlockList: false,
      members: [UUID_1, UUID_2],
      senderKeyInfo: {
        createdAtDate: Date.now(),
        distributionId: getUuid(),
        memberDevices: [],
      },
      storageID: getUuid(),
      storageVersion: 1,
      storageNeedsSync: false,
      storageUnknownFields: undefined,
      deletedAtTimestamp: undefined,
    };

    await createNewStoryDistribution(list);

    assert.lengthOf(await _getAllStoryDistributions(), 1);
    assert.lengthOf(await _getAllStoryDistributionMembers(), 2);

    await modifyStoryDistributionMembers(list.id, {
      toAdd: [UUID_3, UUID_4],
      toRemove: [UUID_1],
    });

    assert.lengthOf(await _getAllStoryDistributions(), 1);
    assert.lengthOf(await _getAllStoryDistributionMembers(), 3);

    const allHydratedLists = await getAllStoryDistributionsWithMembers();
    assert.lengthOf(allHydratedLists, 1);
    assert.deepEqual(allHydratedLists[0], {
      ...list,
      members: [UUID_2, UUID_3, UUID_4],
    });
  });

  it('adds and removes with modifyStoryDistributionWithMembers', async () => {
    const UUID_1 = getUuid();
    const UUID_2 = getUuid();
    const UUID_3 = getUuid();
    const UUID_4 = getUuid();
    const list: StoryDistributionWithMembersType = {
      id: getUuid(),
      name: 'My Story',
      allowsReplies: true,
      isBlockList: false,
      members: [UUID_1, UUID_2],
      senderKeyInfo: {
        createdAtDate: Date.now(),
        distributionId: getUuid(),
        memberDevices: [],
      },
      storageID: getUuid(),
      storageVersion: 1,
      storageNeedsSync: false,
      storageUnknownFields: undefined,
      deletedAtTimestamp: undefined,
    };

    await createNewStoryDistribution(list);

    assert.lengthOf(await _getAllStoryDistributions(), 1);
    assert.lengthOf(await _getAllStoryDistributionMembers(), 2);

    await modifyStoryDistributionWithMembers(list, {
      toAdd: [UUID_3, UUID_4],
      toRemove: [UUID_1],
    });

    assert.lengthOf(await _getAllStoryDistributions(), 1);
    assert.lengthOf(await _getAllStoryDistributionMembers(), 3);

    const allHydratedLists = await getAllStoryDistributionsWithMembers();
    assert.lengthOf(allHydratedLists, 1);
    assert.deepEqual(allHydratedLists[0], {
      ...list,
      members: [UUID_2, UUID_3, UUID_4],
    });
  });

  it('eliminates duplicates without complaint in createNewStoryDistribution', async () => {
    const UUID_1 = getUuid();
    const UUID_2 = getUuid();
    const list: StoryDistributionWithMembersType = {
      id: getUuid(),
      name: 'My Story',
      allowsReplies: true,
      isBlockList: false,
      members: [UUID_1, UUID_1, UUID_2],
      senderKeyInfo: {
        createdAtDate: Date.now(),
        distributionId: getUuid(),
        memberDevices: [],
      },
      storageID: getUuid(),
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
    assert.deepEqual(allHydratedLists[0].members, [UUID_1, UUID_2]);
  });
});
