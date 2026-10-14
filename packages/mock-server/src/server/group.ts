// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  GroupPublicParams,
  GroupSendDerivedKeyPair,
  GroupSendEndorsementsResponse,
  ProfileKeyCredentialPresentation,
  ServerSecretParams,
  ServerZkProfileOperations,
  UuidCiphertext,
} from '@signalapp/libsignal-client/zkgroup';
import assert from 'assert';

import { signalservice as Proto } from '../../protos/compiled';
import { Group } from '../data/group';
import { GroupStateSchema } from '../data/schemas';
import { daysToSeconds, fromBase64, getTodayInSeconds } from '../util';

export type ServerGroupOptions = Readonly<{
  profileOps: ServerZkProfileOperations;
  zkSecret: ServerSecretParams;
  state: Proto.Group.Params;
}>;

export type ModifyGroupResult = Readonly<
  | {
      conflict: false;
      signedChange: Proto.GroupChange.Params;
    }
  | {
      conflict: true;
      signedChange: undefined;
    }
>;

const { AccessRequired } = Proto.AccessControl;
const { Role } = Proto.Member;

function getTodaysKey(zkSecret: ServerSecretParams): GroupSendDerivedKeyPair {
  const startOfDay = getTodayInSeconds();
  const expiration = startOfDay + daysToSeconds(2);
  return GroupSendDerivedKeyPair.forExpiration(
    new Date(1000 * expiration),
    zkSecret,
  );
}

export class ServerGroup extends Group {
  private readonly profileOps: ServerZkProfileOperations;
  private readonly zkSecret: ServerSecretParams;

  constructor({ profileOps, zkSecret, state }: ServerGroupOptions) {
    super();

    const parsedState = GroupStateSchema.parse(state);

    this.privPublicParams = new GroupPublicParams(
      Buffer.from(parsedState.publicKey),
    );
    this.profileOps = profileOps;
    this.zkSecret = zkSecret;

    const unrolledState = { ...state };

    unrolledState.members = (state.members ?? []).map((member) =>
      this.unrollMember(member),
    );

    this.privChanges = {
      groupChanges: [
        {
          groupState: unrolledState,
          groupChange: null,
        },
      ],
      groupSendEndorsementsResponse: null,
    };
  }

  public getGroupSendEndorsementResponse(
    sourceAci: UuidCiphertext,
  ): Uint8Array<ArrayBuffer> | null {
    const authMember = this.getMember(sourceAci);
    if (!authMember) {
      return null;
    }

    const members = this.state.members ?? [];

    const groupCiphertexts = members.map((member) => {
      assert(member.userId, 'Member must have a user ID');
      return new UuidCiphertext(Buffer.from(member.userId));
    });

    const todaysKey = getTodaysKey(this.zkSecret);
    return GroupSendEndorsementsResponse.issue(
      groupCiphertexts,
      todaysKey,
    ).serialize();
  }

  public modify(
    sourceAci: UuidCiphertext,
    sourcePni: UuidCiphertext | undefined,
    actions: Proto.GroupChange.Actions.Params,
  ): ModifyGroupResult {
    const appliedActions: Proto.GroupChange.Actions.Params = {
      version: actions.version,
      sourceUserId: sourceAci.serialize(),
      groupId: fromBase64(this.id),
      addMembers: null,
      deleteMembers: null,
      modifyMemberRoles: null,
      modifyMemberProfileKeys: null,
      addMembersPendingProfileKey: null,
      deleteMembersPendingProfileKey: null,
      promoteMembersPendingProfileKey: null,
      modifyTitle: null,
      modifyAvatar: null,
      modifyDisappearingMessageTimer: null,
      modifyAttributesAccess: null,
      modifyMemberAccess: null,
      modifyAddFromInviteLinkAccess: null,
      addMembersPendingAdminApproval: null,
      deleteMembersPendingAdminApproval: null,
      promoteMembersPendingAdminApproval: null,
      modifyInviteLinkPassword: null,
      modifyDescription: null,
      modifyAnnouncementsOnly: null,
      addMembersBanned: null,
      deleteMembersBanned: null,
      promoteMembersPendingPniAciProfileKey: null,
      modifyMemberLabels: null,
      modifyMemberLabelAccess: null,
      terminateGroup: null,
    };

    assert.ok(actions.version, 'Actions should have a new version');

    const timestamp = BigInt(Date.now());

    const newState = {
      ...this.state,
      version: actions.version,
    };

    const authMember = this.getMember(sourceAci);
    const { accessControl } = newState;

    let changeEpoch = 1;

    if (actions.modifyTitle) {
      this.verifyAccess(
        'title',
        authMember,
        accessControl?.attributes ?? AccessRequired.UNKNOWN,
      );

      appliedActions.modifyTitle = actions.modifyTitle;
      newState.title = actions.modifyTitle.title;
    }

    const deleteMembers = actions.deleteMembers ?? [];
    for (const { deletedUserId } of deleteMembers) {
      assert.ok(deletedUserId, 'Missing deletedUserId');

      this.verifyAccess(
        'members',
        authMember,
        accessControl?.members ?? AccessRequired.UNKNOWN,
        deletedUserId,
      );

      const member = this.getMember(
        new UuidCiphertext(Buffer.from(deletedUserId)),
      );
      assert.ok(member, 'Pending member not found for deletion');

      newState.members = (newState.members ?? []).filter(
        (entry) => entry !== member,
      );

      appliedActions.deleteMembers = [
        ...(appliedActions.deleteMembers ?? []),
        { deletedUserId },
      ];
    }

    const addMembersPendingProfileKey =
      actions.addMembersPendingProfileKey ?? [];
    for (const { added } of addMembersPendingProfileKey) {
      assert.ok(added, 'Missing addPendingMember.added');

      const { member } = added;
      assert.ok(member, 'Missing addMembersPendingProfileKey.added.member');

      const { userId, role } = member;
      assert.ok(
        userId,
        'Missing addMembersPendingProfileKey.added.member.userId',
      );
      assert.ok(
        role != null,
        'Missing addMembersPendingProfileKey.added.member.role',
      );

      this.verifyAccess(
        'pendingMembers',
        authMember,
        accessControl?.members ?? AccessRequired.UNKNOWN,
      );

      const newPendingMember = {
        member: {
          userId,
          role,
          profileKey: null,
          presentation: null,
          joinedAtVersion: null,
          labelEmoji: null,
          labelString: null,
        },
        addedByUserId: sourceAci.serialize(),
        timestamp,
      };

      newState.membersPendingProfileKey = [
        ...(newState.membersPendingProfileKey ?? []),
        newPendingMember,
      ];

      appliedActions.addMembersPendingProfileKey = [
        ...(appliedActions.addMembersPendingProfileKey ?? []),
        { added: newPendingMember },
      ];
    }

    const deleteMembersPendingProfileKey =
      actions.deleteMembersPendingProfileKey ?? [];
    for (const { deletedUserId } of deleteMembersPendingProfileKey) {
      assert.ok(deletedUserId, 'Missing deletedUserId');

      assert.ok(
        Buffer.from(deletedUserId).equals(sourceAci.serialize()) ||
          (sourcePni &&
            Buffer.from(deletedUserId).equals(sourcePni.serialize())),
        'Not a pending member',
      );

      const pendingMember = this.getPendingMember(
        new UuidCiphertext(Buffer.from(deletedUserId)),
      );
      assert.ok(pendingMember, 'Pending member not found for deletion');

      newState.membersPendingProfileKey = (
        newState.membersPendingProfileKey ?? []
      ).filter((entry) => entry !== pendingMember);

      appliedActions.deleteMembersPendingProfileKey = [
        ...(appliedActions.deleteMembersPendingProfileKey ?? []),
        { deletedUserId },
      ];
    }

    const modifyMemberProfileKeys = actions.modifyMemberProfileKeys ?? [];
    for (const { presentation } of modifyMemberProfileKeys) {
      assert.ok(
        presentation,
        'Missing presentation in modifyMemberProfileKeys',
      );
      const presentationFFI = new ProfileKeyCredentialPresentation(
        Buffer.from(presentation),
      );
      this.profileOps.verifyProfileKeyCredentialPresentation(
        this.publicParams,
        presentationFFI,
      );

      assert.ok(
        Buffer.from(presentationFFI.getUuidCiphertext().serialize()).equals(
          sourceAci.serialize(),
        ),
        'Must be from the contact it is referencing',
      );

      const member = this.getMember(presentationFFI.getUuidCiphertext());
      assert.ok(member, 'No existing member');
      assert.ok(
        !this.getPendingMember(presentationFFI.getUuidCiphertext()),
        'Member is both pending and active',
      );

      newState.members = (newState.members ?? []).filter(
        (entry) => entry !== member,
      );

      const profileKey = presentationFFI.getProfileKeyCiphertext().serialize();

      newState.members.push({
        ...member,
        profileKey,
      });
    }

    const promoteMembersPendingProfileKey =
      actions.promoteMembersPendingProfileKey ?? [];
    for (const { presentation } of promoteMembersPendingProfileKey) {
      assert.ok(
        presentation,
        'Missing presentation in deleteMembersPendingProfileKey',
      );
      const presentationFFI = new ProfileKeyCredentialPresentation(
        Buffer.from(presentation),
      );
      this.profileOps.verifyProfileKeyCredentialPresentation(
        this.publicParams,
        presentationFFI,
      );

      assert.ok(
        Buffer.from(presentationFFI.getUuidCiphertext().serialize()).equals(
          sourceAci.serialize(),
        ),
        'Not a pending member',
      );

      const pendingMember = this.getPendingMember(
        presentationFFI.getUuidCiphertext(),
      );
      assert.ok(pendingMember, 'No pending member');
      assert.ok(
        !this.getMember(presentationFFI.getUuidCiphertext()),
        'Member is both pending and active',
      );

      newState.membersPendingProfileKey = (
        newState.membersPendingProfileKey ?? []
      ).filter((entry) => entry !== pendingMember);

      const userId = presentationFFI.getUuidCiphertext().serialize();
      const profileKey = presentationFFI.getProfileKeyCiphertext().serialize();

      newState.members = [
        ...(newState.members ?? []),
        {
          role: Role.DEFAULT,
          userId,
          profileKey,
          presentation: null,
          joinedAtVersion: null,
          labelEmoji: null,
          labelString: null,
        },
      ];

      appliedActions.promoteMembersPendingProfileKey = [
        ...(appliedActions.promoteMembersPendingProfileKey ?? []),
        { userId, profileKey, presentation: null },
      ];
    }

    const promotePNIMembers = actions.promoteMembersPendingPniAciProfileKey;
    for (const { presentation } of promotePNIMembers ?? []) {
      assert.ok(
        presentation,
        'Missing presentation in promoteMembersPendingPniAciProfileKey',
      );
      const presentationFFI = new ProfileKeyCredentialPresentation(
        Buffer.from(presentation),
      );

      this.profileOps.verifyProfileKeyCredentialPresentation(
        this.publicParams,
        presentationFFI,
      );

      const aci = presentationFFI.getUuidCiphertext();
      const pni = sourcePni;
      assert(pni != null, 'Must know pni source for promotePNIMembers');
      const profileKey = presentationFFI.getProfileKeyCiphertext();

      assert.ok(
        Buffer.from(aci.serialize()).equals(sourceAci.serialize()),
        'Not a pending member',
      );

      const pendingMember = this.getPendingMember(pni);
      assert.ok(pendingMember, 'No pending pni member');
      assert.ok(!this.getMember(aci), 'ACI is already a member');

      newState.membersPendingProfileKey = (
        newState.membersPendingProfileKey ?? []
      ).filter((entry) => entry !== pendingMember);

      newState.members = [
        ...(newState.members ?? []),
        {
          role: Role.DEFAULT,
          userId: aci.serialize(),
          profileKey: profileKey.serialize(),
          presentation: null,
          joinedAtVersion: null,
          labelEmoji: null,
          labelString: null,
        },
      ];

      changeEpoch = Math.max(changeEpoch, 5);
      appliedActions.sourceUserId = pni.serialize();
      appliedActions.promoteMembersPendingPniAciProfileKey = [
        ...(appliedActions.promoteMembersPendingPniAciProfileKey ?? []),
        {
          userId: aci.serialize(),
          pni: pni.serialize(),
          profileKey: profileKey.serialize(),
          presentation: null,
        },
      ];
    }

    if (actions.terminateGroup !== null) {
      this.verifyAccess('terminated', authMember, AccessRequired.ADMINISTRATOR);

      appliedActions.terminateGroup = {};
      newState.terminated = true;
    }

    if (actions.modifyDisappearingMessageTimer !== null) {
      this.verifyAccess(
        'disappearingMessagesTimer',
        authMember,
        accessControl?.attributes ?? AccessRequired.UNKNOWN,
      );

      appliedActions.modifyDisappearingMessageTimer =
        actions.modifyDisappearingMessageTimer;
      newState.disappearingMessagesTimer =
        actions.modifyDisappearingMessageTimer.timer;
    }

    const { version: oldVersion } = this.state;
    assert.ok(
      typeof oldVersion === 'number',
      'Group must have existing version',
    );
    if (actions.version !== oldVersion + 1) {
      return { conflict: true, signedChange: undefined };
    }

    const encodedActions = Proto.GroupChange.Actions.encode(appliedActions);
    const serverSignature = this.zkSecret
      .sign(Buffer.from(encodedActions))
      .serialize();

    const groupChange: Proto.GroupChange.Params = {
      actions: encodedActions,
      changeEpoch,
      serverSignature: null,
    };

    assert.ok(this.privChanges?.groupChanges, 'Must be initialized');
    this.privChanges.groupChanges.push({
      groupChange,
      groupState: newState,
    });

    return {
      conflict: false,
      signedChange: {
        ...groupChange,
        serverSignature,
      },
    };
  }

  //
  // Private
  //

  private verifyAccess(
    attribute: string,
    member: Proto.Member.Params | undefined,
    access: Proto.AccessControl['attributes'],
    affectedUserId?: Uint8Array<ArrayBuffer>,
  ): void {
    // Changing something about ourselves is always allowed
    if (
      member?.userId &&
      affectedUserId &&
      Buffer.from(member.userId).equals(affectedUserId)
    ) {
      return;
    }

    switch (access) {
      case AccessRequired.ANY:
        break;

      case AccessRequired.MEMBER:
        assert.ok(member, `Must be a member to access: ${attribute}`);
        break;

      case AccessRequired.ADMINISTRATOR:
        assert.strictEqual(
          member?.role,
          Role.ADMINISTRATOR,
          `Must be an administrator to modify: ${attribute}`,
        );
        break;

      case AccessRequired.UNSATISFIABLE:
        throw new Error(`Unsatisfiable access attribute: ${attribute}`);

      case AccessRequired.UNKNOWN:
        throw new Error(`Unknown access for attribute: ${attribute}`);
    }
  }

  private unrollMember({
    role,
    presentation,
  }: Proto.Member.Params): Proto.Member.Params {
    assert.strictEqual(typeof role, 'number', 'Group member role is undefined');
    assert.ok(presentation, 'Group member presentation is undefined');

    const presentationFFI = new ProfileKeyCredentialPresentation(
      Buffer.from(presentation),
    );
    this.profileOps.verifyProfileKeyCredentialPresentation(
      this.publicParams,
      presentationFFI,
    );

    return {
      role,
      userId: presentationFFI.getUuidCiphertext().serialize(),
      profileKey: presentationFFI.getProfileKeyCiphertext().serialize(),
      presentation: null,
      joinedAtVersion: null,
      labelEmoji: null,
      labelString: null,
    };
  }
}
