// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import {
  GroupPublicParams,
  UuidCiphertext,
} from '@signalapp/libsignal-client/zkgroup';

import { signalservice as Proto } from '../../protos/compiled';

export abstract class Group {
  protected privChanges?: Proto.GroupChanges.Params;
  protected privPublicParams?: GroupPublicParams;

  public get changes(): Readonly<Proto.GroupChanges.Params> {
    assert(this.privChanges !== undefined, 'Group not initialized');
    return this.privChanges;
  }

  public get publicParams(): GroupPublicParams {
    assert(this.privPublicParams !== undefined, 'Group not initialized');
    return this.privPublicParams;
  }

  public get state(): Readonly<Proto.Group.Params> {
    const { groupChanges } = this.changes;
    assert(groupChanges, 'Missing group changes in the group state');
    const state = groupChanges.at(-1)?.groupState;
    assert(state, 'Group must have the last state');
    return state;
  }

  public get id(): string {
    return Buffer.from(
      this.publicParams.getGroupIdentifier().serialize(),
    ).toString('base64');
  }

  public get revision(): number {
    return this.state.version ?? 0;
  }

  public getChangesSince(since: number): Readonly<Proto.GroupChanges.Params> {
    return {
      groupChanges: this.changes.groupChanges?.slice(since) ?? null,
      groupSendEndorsementsResponse: null,
    };
  }

  public getMember(
    uuidCiphertext: UuidCiphertext,
  ): Proto.Member.Params | undefined {
    const state = this.state;
    const userId = Buffer.from(uuidCiphertext.serialize());
    return (
      state.members?.find((member) => {
        if (!member.userId) {
          return false;
        }

        return userId.equals(member.userId);
      }) ?? undefined
    );
  }

  public getPendingAdminApprovalMember(
    uuidCiphertext: UuidCiphertext,
  ): Proto.MemberPendingAdminApproval.Params | null {
    const state = this.state;
    const userId = Buffer.from(uuidCiphertext.serialize());

    const found = state.membersPendingAdminApproval?.find((member) => {
      if (!member.userId) {
        return false;
      }

      return userId.equals(member.userId);
    });

    return found ?? null;
  }

  public getPendingMember(
    uuidCiphertext: UuidCiphertext,
  ): Proto.MemberPendingProfileKey.Params | undefined {
    const state = this.state;
    const userId = Buffer.from(uuidCiphertext.serialize());
    return (
      state.membersPendingProfileKey?.find(({ member }) => {
        if (!member?.userId) {
          return false;
        }

        return userId.equals(member.userId);
      }) ?? undefined
    );
  }
}
