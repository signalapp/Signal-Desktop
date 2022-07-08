// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { UUID } from '../../types/UUID';
import { _maybeBuildAddBannedMemberActions } from '../../groups';
import { getClientZkGroupCipher, decryptUuid } from '../../util/zkgroup';
import { updateRemoteConfig } from '../helpers/RemoteConfigStub';

const HARD_LIMIT_KEY = 'global.groupsv2.groupSizeHardLimit';

describe('group add banned member', () => {
  const uuid = UUID.generate();
  const ourUuid = UUID.generate();
  const existing = Array.from({ length: 10 }, (_, index) => ({
    uuid: UUID.generate().toString(),
    timestamp: index,
  }));
  const secretParams =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAd/rq8//fR' +
    '4RzhvN3G9KcKlQoj7cguQFjTOqLV6JUSbrURzeILsUmsymGJmHt3kpBJ2zosqp4ex' +
    'sg+qwF1z6YdB/rxKnxKRLZZP/V0F7bERslYILy2lUh3Sh3iA98yO4CGfzjjFVo1SI' +
    '7U8XApLeVNQHJo7nkflf/JyBrqPft5gEucbKW/h+S3OYjfQ5zl2Cpw3XrV7N6OKEu' +
    'tLUWPHQuJx11A4xDPrmtAOnGy2NBxoOybDNlWipeNbn1WQJqOjMF7YA80oEm+5qnM' +
    'kEYcFVqbYaSzPcMhg3mQ0SYfQpxYgSOJpwp9f/8EDnwJV4ISPBOo2CiaSqVfnd8Dw' +
    'ZOc58gQA==';
  const clientZkGroupCipher = getClientZkGroupCipher(secretParams);

  before(async () => {
    await updateRemoteConfig([
      { name: HARD_LIMIT_KEY, value: '5', enabled: true },
    ]);
  });

  it('should add banned member without deleting', () => {
    const actions = _maybeBuildAddBannedMemberActions({
      clientZkGroupCipher,
      uuid,
      ourUuid,
      group: {
        bannedMembersV2: [],
      },
    });

    assert.strictEqual(actions.addMembersBanned?.length, 1);
    assert.strictEqual(
      decryptUuid(
        clientZkGroupCipher,
        actions.addMembersBanned?.[0]?.added?.userId ?? new Uint8Array(0)
      ),
      uuid.toString()
    );
    assert.strictEqual(actions.deleteMembersBanned, null);
  });

  it('should add banned member while deleting the oldest', () => {
    const actions = _maybeBuildAddBannedMemberActions({
      clientZkGroupCipher,
      uuid,
      ourUuid,
      group: {
        bannedMembersV2: [...existing],
      },
    });

    const deleted = actions.deleteMembersBanned?.map(({ deletedUserId }) => {
      return decryptUuid(
        clientZkGroupCipher,
        deletedUserId ?? new Uint8Array(0)
      );
    });

    assert.strictEqual(actions.addMembersBanned?.length, 1);
    assert.strictEqual(
      decryptUuid(
        clientZkGroupCipher,
        actions.addMembersBanned?.[0]?.added?.userId ?? new Uint8Array(0)
      ),
      uuid.toString()
    );
    assert.deepStrictEqual(
      deleted,
      existing
        .slice(0, 6)
        .reverse()
        .map(member => member.uuid)
    );
  });

  it('should not ban ourselves', () => {
    const actions = _maybeBuildAddBannedMemberActions({
      clientZkGroupCipher,
      uuid: ourUuid,
      ourUuid,
      group: {
        bannedMembersV2: [],
      },
    });

    assert.isUndefined(actions.addMembersBanned);
    assert.isUndefined(actions.deleteMembersBanned);
  });

  it('should not ban already banned person', () => {
    const actions = _maybeBuildAddBannedMemberActions({
      clientZkGroupCipher,
      uuid,
      ourUuid,
      group: {
        bannedMembersV2: [{ uuid: uuid.toString(), timestamp: 1 }],
      },
    });

    assert.isUndefined(actions.addMembersBanned);
    assert.isUndefined(actions.deleteMembersBanned);
  });
});
