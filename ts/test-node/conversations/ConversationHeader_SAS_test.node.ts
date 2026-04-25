import { assert } from 'chai';

type GroupMember = {
  id: string;
  name: string;
  isBlocked: boolean;
};

type VerifiedMap = Record<string, boolean>;

// since SAS verification functions are made using React hooks in ConversationHeader
// we extract the core logic into standalone functions to facilitate testing without needing to render the entire component
function isGroupSasVerified(
  members: Array<GroupMember>,
  verifiedMap: VerifiedMap
): boolean {
  if (members.length === 0) return false;
  return members.every(m => verifiedMap[m.id] === true);
}

function isIndividualSasVerified(
  conversationId: string,
  verifiedMap: VerifiedMap
): boolean {
  return verifiedMap[conversationId] === true;
}

function markMemberVerified(
  memberId: string,
  verifiedMap: VerifiedMap
): VerifiedMap {
  return { ...verifiedMap, [memberId]: true };
}

describe('SAS Verification with individual conversation', () => {
  it('returns false when verifiedMap is empty', () => {
    assert.isFalse(isIndividualSasVerified('conv_abc', {}));
  });

  it('returns false when a different conversation is verified', () => {
    const map = { 'conv_xyz': true };
    assert.isFalse(isIndividualSasVerified('conv_abc', map));
  });

  it('returns true when the conversation is in the verified map', () => {
    const map = { 'conv_abc': true };
    assert.isTrue(isIndividualSasVerified('conv_abc', map));
  });

  it('returns false when the entry is explicitly false', () => {
    const map: VerifiedMap = { 'conv_abc': false };
    assert.isFalse(isIndividualSasVerified('conv_abc', map));
  });
});

describe('SAS Verification group conversation', () => {
  const alice: GroupMember = { id: 'alice_id', name: 'Alice', isBlocked: false };
  const bob: GroupMember = { id: 'bob_id', name: 'Bob', isBlocked: false };
  const blocked: GroupMember = { id: 'blocked_id', name: 'Eve', isBlocked: true  };

  it('returns false when verifiedMap is empty', () => {
    assert.isFalse(isGroupSasVerified([alice, bob], {}));
  });

  it('returns false when only some members are verified', () => {
    const map = { 'alice_id': true };
    assert.isFalse(isGroupSasVerified([alice, bob], map));
  });

  it('returns true when all members are verified', () => {
    const map = { 'alice_id': true, 'bob_id': true };
    assert.isTrue(isGroupSasVerified([alice, bob], map));
  });

  it('returns false when all non-blocked members are verified but blocked member is not', () => {
    const map = { 'alice_id': true, 'bob_id': true };
    assert.isFalse(isGroupSasVerified([alice, bob, blocked], map));
  });

  it('returns true when all members including blocked are verified', () => {
    const map = { 'alice_id': true, 'bob_id': true, 'blocked_id': true };
    assert.isTrue(isGroupSasVerified([alice, bob, blocked], map));
  });

  it('returns true when the only member is blocked and is verified', () => {
    assert.isTrue(isGroupSasVerified([blocked], { 'blocked_id': true }));
  });

  it('returns false when the only member is blocked and is not verified', () => {
    assert.isFalse(isGroupSasVerified([blocked], {}));
  });

  it('returns false for an empty member list', () => {
    assert.isFalse(isGroupSasVerified([], {}));
  });

  it('returns false when a blocked member is the only unverified member', () => {
    const map = { 'alice_id': true, 'bob_id': true };
    assert.isFalse(isGroupSasVerified([alice, bob, blocked], map));
  });
});

describe('SAS Verification markMemberVerified', () => {
  it('adds a new entry to an empty map', () => {
    const result = markMemberVerified('alice_id', {});
    assert.deepEqual(result, { 'alice_id': true });
  });

  it('does not mutate the original map', () => {
    const original: VerifiedMap = { 'bob_id': true };
    const result = markMemberVerified('alice_id', original);
    assert.notStrictEqual(result, original);
    assert.isUndefined(original['alice_id']);
  });

  it('preserves existing entries', () => {
    const original: VerifiedMap = { 'bob_id': true };
    const result = markMemberVerified('alice_id', original);
    assert.isTrue(result['bob_id']);
    assert.isTrue(result['alice_id']);
  });

  it('overwrites an existing entry', () => {
    const original: VerifiedMap = { 'alice_id': false };
    const result = markMemberVerified('alice_id', original);
    assert.isTrue(result['alice_id']);
  });
});

describe('SAS Verification group flow integration', () => {
  const alice: GroupMember = { id: 'alice_id', name: 'Alice', isBlocked: false };
  const bob: GroupMember = { id: 'bob_id', name: 'Bob', isBlocked: false };
  const charlie: GroupMember = { id: 'charlie_id', name: 'Charlie', isBlocked: false };
  const blocked: GroupMember = { id: 'blocked_id', name: 'Eve', isBlocked: true  };

  it('group is not verified until ALL members including blocked are verified', () => {
    let map: VerifiedMap = {};
    const members = [alice, bob, charlie, blocked];

    assert.isFalse(isGroupSasVerified(members, map));

    map = markMemberVerified('alice_id', map);
    assert.isFalse(isGroupSasVerified(members, map));

    map = markMemberVerified('bob_id', map);
    assert.isFalse(isGroupSasVerified(members, map));

    // verifying the blocked member is required blocked is still a member
    map = markMemberVerified('blocked_id', map);
    assert.isFalse(isGroupSasVerified(members, map)); // charlie still unverified

    // final member verified group is now fully verified
    map = markMemberVerified('charlie_id', map);
    assert.isTrue(isGroupSasVerified(members, map));
  });

  it('verifying a group member also satisfies individual verification', () => {
    let map: VerifiedMap = {};
    map = markMemberVerified('alice_id', map);

    assert.isTrue(isIndividualSasVerified('alice_id', map));
    assert.isTrue(isGroupSasVerified([alice], map));
  });

  it('a group with one blocked and one unverified member is not verified', () => {
    const map: VerifiedMap = {};
    assert.isFalse(isGroupSasVerified([alice, blocked], map));
  });

  it('a group with one blocked unverified and one verified member is not verified', () => {
    // alice is verified but blocked member is not group is still not fully verified
    const map = { 'alice_id': true };
    assert.isFalse(isGroupSasVerified([alice, blocked], map));
  });

  it('a group with all members including blocked verified is fully verified', () => {
    const map = { 'alice_id': true, 'blocked_id': true };
    assert.isTrue(isGroupSasVerified([alice, blocked], map));
  });
});