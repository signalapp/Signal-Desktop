// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import {
  ClientZkGroupCipher,
  GroupSecretParams,
  ProfileKey,
  ProfileKeyCredentialPresentation,
  UuidCiphertext,
} from '@signalapp/libsignal-client/zkgroup';
import { ServiceId } from '@signalapp/libsignal-client';

import { signalservice as Proto } from '../../protos/compiled';
import { AciString, ServiceIdString } from '../types';
import { Group as GroupData } from '../data/group';

const AccessRequired = Proto.AccessControl.AccessRequired;

export type GroupOptions = Readonly<{
  secretParams: GroupSecretParams;
  groupState: Proto.Group.Params;
}>;

export type GroupMember = Readonly<{
  presentation: ProfileKeyCredentialPresentation;
  profileKey: ProfileKey;
  aci: AciString;
}>;

export type GroupFromConfigOptions = Readonly<{
  secretParams: GroupSecretParams;

  title: string;
  members: ReadonlyArray<GroupMember>;

  addFromInviteLink?: Proto.AccessControl.AccessRequired;
  inviteLinkPassword?: Uint8Array<ArrayBuffer>;
}>;

function encryptBlob(
  cipher: ClientZkGroupCipher,
  proto: Proto.GroupAttributeBlob.Params,
): Buffer<ArrayBuffer> {
  const plaintext = Proto.GroupAttributeBlob.encode(proto);
  return Buffer.from(cipher.encryptBlob(plaintext));
}

function decryptBlob(
  cipher: ClientZkGroupCipher,
  ciphertext: Uint8Array<ArrayBuffer>,
): Proto.GroupAttributeBlob {
  const plaintext = cipher.decryptBlob(Buffer.from(ciphertext));
  return Proto.GroupAttributeBlob.decode(plaintext);
}

export class Group extends GroupData {
  public readonly secretParams: GroupSecretParams;
  public readonly title: string;

  constructor({ secretParams, groupState }: GroupOptions) {
    super();

    assert.ok(groupState.title, 'Group must have a title blob');

    this.secretParams = secretParams;

    const cipher = new ClientZkGroupCipher(secretParams);
    const decrypted = decryptBlob(cipher, groupState.title);
    assert(decrypted.content?.title != null, 'expected title');
    this.title = decrypted.content.title;

    this.privPublicParams = this.secretParams.getPublicParams();

    // Build group log

    this.privChanges = {
      groupChanges: [
        {
          groupState,
          groupChange: null,
        },
      ],
      groupSendEndorsementsResponse: null,
    };
  }

  public static fromConfig({
    secretParams,
    title,
    members,
    addFromInviteLink = AccessRequired.UNSATISFIABLE,
    inviteLinkPassword,
  }: GroupFromConfigOptions): Group {
    const cipher = new ClientZkGroupCipher(secretParams);

    const groupState: Proto.Group.Params = {
      publicKey: secretParams.getPublicParams().serialize(),
      version: 0,
      title: encryptBlob(cipher, { content: { title } }),

      // TODO(indutny): make it configurable
      accessControl: {
        attributes: AccessRequired.MEMBER,
        members: AccessRequired.MEMBER,
        addFromInviteLink,
        memberLabel: AccessRequired.MEMBER,
      },

      members: members.map(({ presentation }) => {
        return {
          role: Proto.Member.Role.ADMINISTRATOR,
          presentation: presentation.serialize(),
          userId: null,
          profileKey: null,
          joinedAtVersion: null,
          labelEmoji: null,
          labelString: null,
        };
      }),

      avatarUrl: null,
      disappearingMessagesTimer: null,
      membersPendingProfileKey: null,
      membersPendingAdminApproval: null,
      inviteLinkPassword: inviteLinkPassword ?? null,
      description: null,
      announcementsOnly: null,
      membersBanned: null,
      terminated: null,
    };

    return new Group({
      secretParams,
      groupState,
    });
  }

  public get masterKey(): Buffer<ArrayBuffer> {
    return Buffer.from(this.secretParams.getMasterKey().serialize());
  }

  public toContext(): Proto.GroupContextV2.Params {
    const masterKey = this.masterKey;
    return {
      masterKey,
      revision: this.revision,
      groupChange: null,
    };
  }

  public encryptServiceId(serviceId: ServiceIdString): Buffer<ArrayBuffer> {
    const cipher = new ClientZkGroupCipher(this.secretParams);
    return Buffer.from(
      cipher
        .encryptServiceId(ServiceId.parseFromServiceIdString(serviceId))
        .serialize(),
    );
  }

  public decryptServiceId(
    ciphertext: Uint8Array<ArrayBuffer>,
  ): ServiceIdString {
    const cipher = new ClientZkGroupCipher(this.secretParams);
    const uuidCiphertext = new UuidCiphertext(Buffer.from(ciphertext));
    return cipher
      .decryptServiceId(uuidCiphertext)
      .getServiceIdString() as ServiceIdString;
  }

  public getMemberByServiceId(
    serviceId: ServiceIdString,
  ): Proto.Member.Params | undefined {
    return this.getMember(new UuidCiphertext(this.encryptServiceId(serviceId)));
  }

  public getPendingMemberByServiceId(
    serviceId: ServiceIdString,
  ): Proto.MemberPendingProfileKey.Params | undefined {
    return this.getPendingMember(
      new UuidCiphertext(this.encryptServiceId(serviceId)),
    );
  }

  public getPendingAdminApprovalMemberByServiceId(
    serviceId: ServiceIdString,
  ): Proto.MemberPendingAdminApproval.Params | null {
    return this.getPendingAdminApprovalMember(
      new UuidCiphertext(this.encryptServiceId(serviceId)),
    );
  }

  public encryptBlob(
    proto: Proto.GroupAttributeBlob.Params,
  ): Buffer<ArrayBuffer> {
    return encryptBlob(new ClientZkGroupCipher(this.secretParams), proto);
  }
}
