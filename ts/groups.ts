// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  compact,
  difference,
  flatten,
  fromPairs,
  isNumber,
  values,
} from 'lodash';
import Long from 'long';
import type { ClientZkGroupCipher } from '@signalapp/libsignal-client/zkgroup';
import { v4 as getGuid } from 'uuid';
import LRU from 'lru-cache';
import * as log from './logging/log';
import {
  getCheckedCredentialsForToday,
  maybeFetchNewCredentials,
} from './services/groupCredentialFetcher';
import dataInterface from './sql/Client';
import { toWebSafeBase64, fromWebSafeBase64 } from './util/webSafeBase64';
import { assert, strictAssert } from './util/assert';
import { isMoreRecentThan } from './util/timestamp';
import * as durations from './util/durations';
import { normalizeUuid } from './util/normalizeUuid';
import { dropNull } from './util/dropNull';
import type {
  ConversationAttributesType,
  GroupV2MemberType,
  GroupV2PendingAdminApprovalType,
  GroupV2PendingMemberType,
  GroupV2BannedMemberType,
  MessageAttributesType,
} from './model-types.d';
import {
  createProfileKeyCredentialPresentation,
  createPNICredentialPresentation,
  decodeProfileKeyCredentialPresentation,
  decryptGroupBlob,
  decryptProfileKey,
  decryptUuid,
  deriveGroupID,
  deriveGroupPublicParams,
  deriveGroupSecretParams,
  encryptGroupBlob,
  encryptUuid,
  getAuthCredentialPresentation,
  getClientZkAuthOperations,
  getClientZkGroupCipher,
  getClientZkProfileOperations,
  verifyNotarySignature,
} from './util/zkgroup';
import {
  computeHash,
  deriveMasterKeyFromGroupV1,
  getRandomBytes,
} from './Crypto';
import type {
  GroupCredentialsType,
  GroupLogResponseType,
} from './textsecure/WebAPI';
import { HTTPError } from './textsecure/Errors';
import type MessageSender from './textsecure/SendMessage';
import { CURRENT_SCHEMA_VERSION as MAX_MESSAGE_SCHEMA } from './types/Message2';
import type { ConversationModel } from './models/conversations';
import { getGroupSizeHardLimit } from './groups/limits';
import {
  isGroupV1 as getIsGroupV1,
  isGroupV2 as getIsGroupV2,
  isMe,
} from './util/whatTypeOfConversation';
import * as Bytes from './Bytes';
import type { AvatarDataType } from './types/Avatar';
import { UUID, UUIDKind, isValidUuid } from './types/UUID';
import type { UUIDStringType } from './types/UUID';
import * as Errors from './types/errors';
import { SignalService as Proto } from './protobuf';
import { isNotNil } from './util/isNotNil';
import { isAccessControlEnabled } from './groups/util';

import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from './jobs/conversationJobQueue';
import { ReadStatus } from './messages/MessageReadStatus';
import { SeenStatus } from './MessageSeenStatus';

type AccessRequiredEnum = Proto.AccessControl.AccessRequired;

export { joinViaLink } from './groups/joinViaLink';

type GroupV2AccessCreateChangeType = {
  type: 'create';
};
type GroupV2AccessAttributesChangeType = {
  type: 'access-attributes';
  newPrivilege: number;
};
type GroupV2AccessMembersChangeType = {
  type: 'access-members';
  newPrivilege: number;
};
type GroupV2AccessInviteLinkChangeType = {
  type: 'access-invite-link';
  newPrivilege: number;
};
type GroupV2AnnouncementsOnlyChangeType = {
  type: 'announcements-only';
  announcementsOnly: boolean;
};
type GroupV2AvatarChangeType = {
  type: 'avatar';
  removed: boolean;
};
type GroupV2TitleChangeType = {
  type: 'title';
  // Allow for null, because the title could be removed entirely
  newTitle?: string;
};
type GroupV2GroupLinkAddChangeType = {
  type: 'group-link-add';
  privilege: number;
};
type GroupV2GroupLinkResetChangeType = {
  type: 'group-link-reset';
};
type GroupV2GroupLinkRemoveChangeType = {
  type: 'group-link-remove';
};

// No disappearing messages timer change type - message.expirationTimerUpdate used instead

type GroupV2MemberAddChangeType = {
  type: 'member-add';
  uuid: UUIDStringType;
};
type GroupV2MemberAddFromInviteChangeType = {
  type: 'member-add-from-invite';
  uuid: UUIDStringType;
  inviter?: UUIDStringType;
};
type GroupV2MemberAddFromLinkChangeType = {
  type: 'member-add-from-link';
  uuid: UUIDStringType;
};
type GroupV2MemberAddFromAdminApprovalChangeType = {
  type: 'member-add-from-admin-approval';
  uuid: UUIDStringType;
};
type GroupV2MemberPrivilegeChangeType = {
  type: 'member-privilege';
  uuid: UUIDStringType;
  newPrivilege: number;
};
type GroupV2MemberRemoveChangeType = {
  type: 'member-remove';
  uuid: UUIDStringType;
};

type GroupV2PendingAddOneChangeType = {
  type: 'pending-add-one';
  uuid: UUIDStringType;
};
type GroupV2PendingAddManyChangeType = {
  type: 'pending-add-many';
  count: number;
};
// Note: pending-remove is only used if user didn't also join the group at the same time
type GroupV2PendingRemoveOneChangeType = {
  type: 'pending-remove-one';
  uuid: UUIDStringType;
  inviter?: UUIDStringType;
};
// Note: pending-remove is only used if user didn't also join the group at the same time
type GroupV2PendingRemoveManyChangeType = {
  type: 'pending-remove-many';
  count: number;
  inviter?: UUIDStringType;
};

type GroupV2AdminApprovalAddOneChangeType = {
  type: 'admin-approval-add-one';
  uuid: UUIDStringType;
};
// Note: admin-approval-remove-one is only used if user didn't also join the group at
//   the same time
type GroupV2AdminApprovalRemoveOneChangeType = {
  type: 'admin-approval-remove-one';
  uuid: UUIDStringType;
  inviter?: UUIDStringType;
};
type GroupV2AdminApprovalBounceChangeType = {
  type: 'admin-approval-bounce';
  times: number;
  isApprovalPending: boolean;
  uuid: UUIDStringType;
};
export type GroupV2DescriptionChangeType = {
  type: 'description';
  removed?: boolean;
  // Adding this field; cannot remove previous field for backwards compatibility
  description?: string;
};

export type GroupV2ChangeDetailType =
  | GroupV2AccessAttributesChangeType
  | GroupV2AccessCreateChangeType
  | GroupV2AccessInviteLinkChangeType
  | GroupV2AccessMembersChangeType
  | GroupV2AdminApprovalAddOneChangeType
  | GroupV2AdminApprovalRemoveOneChangeType
  | GroupV2AdminApprovalBounceChangeType
  | GroupV2AnnouncementsOnlyChangeType
  | GroupV2AvatarChangeType
  | GroupV2DescriptionChangeType
  | GroupV2GroupLinkAddChangeType
  | GroupV2GroupLinkRemoveChangeType
  | GroupV2GroupLinkResetChangeType
  | GroupV2MemberAddChangeType
  | GroupV2MemberAddFromAdminApprovalChangeType
  | GroupV2MemberAddFromInviteChangeType
  | GroupV2MemberAddFromLinkChangeType
  | GroupV2MemberPrivilegeChangeType
  | GroupV2MemberRemoveChangeType
  | GroupV2PendingAddManyChangeType
  | GroupV2PendingAddOneChangeType
  | GroupV2PendingRemoveManyChangeType
  | GroupV2PendingRemoveOneChangeType
  | GroupV2TitleChangeType;

export type GroupV2ChangeType = {
  from?: UUIDStringType;
  details: Array<GroupV2ChangeDetailType>;
};

export type GroupFields = {
  readonly id: Uint8Array;
  readonly secretParams: Uint8Array;
  readonly publicParams: Uint8Array;
};

const MAX_CACHED_GROUP_FIELDS = 100;

const groupFieldsCache = new LRU<string, GroupFields>({
  max: MAX_CACHED_GROUP_FIELDS,
});

const { updateConversation } = dataInterface;

if (!isNumber(MAX_MESSAGE_SCHEMA)) {
  throw new Error(
    'groups.ts: Unable to capture max message schema from js/modules/types/message'
  );
}

type MemberType = {
  profileKey: string;
  uuid: UUIDStringType;
};
type UpdatesResultType = {
  // The array of new messages to be added into the message timeline
  groupChangeMessages: Array<GroupChangeMessageType>;
  // The set of members in the group, and we largely just pull profile keys for each,
  //   because the group membership is updated in newAttributes
  members: Array<MemberType>;
  // To be merged into the conversation model
  newAttributes: ConversationAttributesType;
};

type UploadedAvatarType = {
  data: Uint8Array;
  hash: string;
  key: string;
};

type BasicMessageType = Pick<
  MessageAttributesType,
  'id' | 'schemaVersion' | 'readStatus' | 'seenStatus'
>;

type GroupV2ChangeMessageType = {
  type: 'group-v2-change';
} & Pick<MessageAttributesType, 'groupV2Change' | 'sourceUuid'>;

type GroupV1MigrationMessageType = {
  type: 'group-v1-migration';
} & Pick<
  MessageAttributesType,
  'invitedGV2Members' | 'droppedGV2MemberIds' | 'groupMigration'
>;

type TimerNotificationMessageType = {
  type: 'timer-notification';
} & Pick<
  MessageAttributesType,
  'sourceUuid' | 'flags' | 'expirationTimerUpdate'
>;

type GroupChangeMessageType = BasicMessageType &
  (
    | GroupV2ChangeMessageType
    | GroupV1MigrationMessageType
    | TimerNotificationMessageType
  );

// Constants

export const MASTER_KEY_LENGTH = 32;
const GROUP_TITLE_MAX_ENCRYPTED_BYTES = 1024;
const GROUP_DESC_MAX_ENCRYPTED_BYTES = 8192;
export const ID_V1_LENGTH = 16;
export const ID_LENGTH = 32;
const TEMPORAL_AUTH_REJECTED_CODE = 401;
const GROUP_ACCESS_DENIED_CODE = 403;
const GROUP_NONEXISTENT_CODE = 404;
const SUPPORTED_CHANGE_EPOCH = 5;
export const LINK_VERSION_ERROR = 'LINK_VERSION_ERROR';
const GROUP_INVITE_LINK_PASSWORD_LENGTH = 16;

function generateBasicMessage(): BasicMessageType {
  return {
    id: getGuid(),
    schemaVersion: MAX_MESSAGE_SCHEMA,
    // this is missing most properties to fulfill this type
  };
}

// Group Links

export function generateGroupInviteLinkPassword(): Uint8Array {
  return getRandomBytes(GROUP_INVITE_LINK_PASSWORD_LENGTH);
}

// Group Links

export async function getPreJoinGroupInfo(
  inviteLinkPasswordBase64: string,
  masterKeyBase64: string
): Promise<Proto.GroupJoinInfo> {
  const data = window.Signal.Groups.deriveGroupFields(
    Bytes.fromBase64(masterKeyBase64)
  );

  return makeRequestWithTemporalRetry({
    logId: `getPreJoinInfo/groupv2(${data.id})`,
    publicParams: Bytes.toBase64(data.publicParams),
    secretParams: Bytes.toBase64(data.secretParams),
    request: (sender, options) =>
      sender.getGroupFromLink(inviteLinkPasswordBase64, options),
  });
}

export function buildGroupLink(conversation: ConversationModel): string {
  const { masterKey, groupInviteLinkPassword } = conversation.attributes;

  const bytes = Proto.GroupInviteLink.encode({
    v1Contents: {
      groupMasterKey: Bytes.fromBase64(masterKey),
      inviteLinkPassword: Bytes.fromBase64(groupInviteLinkPassword),
    },
  }).finish();

  const hash = toWebSafeBase64(Bytes.toBase64(bytes));

  return `https://signal.group/#${hash}`;
}

export function parseGroupLink(hash: string): {
  masterKey: string;
  inviteLinkPassword: string;
} {
  const base64 = fromWebSafeBase64(hash);
  const buffer = Bytes.fromBase64(base64);

  const inviteLinkProto = Proto.GroupInviteLink.decode(buffer);
  if (
    inviteLinkProto.contents !== 'v1Contents' ||
    !inviteLinkProto.v1Contents
  ) {
    const error = new Error(
      'parseGroupLink: Parsed proto is missing v1Contents'
    );
    error.name = LINK_VERSION_ERROR;
    throw error;
  }

  const {
    groupMasterKey: groupMasterKeyRaw,
    inviteLinkPassword: inviteLinkPasswordRaw,
  } = inviteLinkProto.v1Contents;

  if (!groupMasterKeyRaw || !groupMasterKeyRaw.length) {
    throw new Error('v1Contents.groupMasterKey had no data!');
  }
  if (!inviteLinkPasswordRaw || !inviteLinkPasswordRaw.length) {
    throw new Error('v1Contents.inviteLinkPassword had no data!');
  }

  const masterKey = Bytes.toBase64(groupMasterKeyRaw);
  if (masterKey.length !== 44) {
    throw new Error(`masterKey had unexpected length ${masterKey.length}`);
  }
  const inviteLinkPassword = Bytes.toBase64(inviteLinkPasswordRaw);
  if (inviteLinkPassword.length === 0) {
    throw new Error(
      `inviteLinkPassword had unexpected length ${inviteLinkPassword.length}`
    );
  }

  return { masterKey, inviteLinkPassword };
}

// Group Modifications

async function uploadAvatar(
  options: {
    logId: string;
    publicParams: string;
    secretParams: string;
  } & ({ path: string } | { data: Uint8Array })
): Promise<UploadedAvatarType> {
  const { logId, publicParams, secretParams } = options;

  try {
    const clientZkGroupCipher = getClientZkGroupCipher(secretParams);

    let data: Uint8Array;
    if ('data' in options) {
      ({ data } = options);
    } else {
      data = await window.Signal.Migrations.readAttachmentData(options.path);
    }

    const hash = computeHash(data);

    const blobPlaintext = Proto.GroupAttributeBlob.encode({
      avatar: data,
    }).finish();
    const ciphertext = encryptGroupBlob(clientZkGroupCipher, blobPlaintext);

    const key = await makeRequestWithTemporalRetry({
      logId: `uploadGroupAvatar/${logId}`,
      publicParams,
      secretParams,
      request: (sender, requestOptions) =>
        sender.uploadGroupAvatar(ciphertext, requestOptions),
    });

    return {
      data,
      hash,
      key,
    };
  } catch (error) {
    log.warn(`uploadAvatar/${logId} Failed to upload avatar`, error.stack);
    throw error;
  }
}

function buildGroupTitleBuffer(
  clientZkGroupCipher: ClientZkGroupCipher,
  title: string
): Uint8Array {
  const titleBlobPlaintext = Proto.GroupAttributeBlob.encode({
    title,
  }).finish();

  const result = encryptGroupBlob(clientZkGroupCipher, titleBlobPlaintext);

  if (result.byteLength > GROUP_TITLE_MAX_ENCRYPTED_BYTES) {
    throw new Error('buildGroupTitleBuffer: encrypted group title is too long');
  }

  return result;
}

function buildGroupDescriptionBuffer(
  clientZkGroupCipher: ClientZkGroupCipher,
  description: string
): Uint8Array {
  const attrsBlobPlaintext = Proto.GroupAttributeBlob.encode({
    descriptionText: description,
  }).finish();

  const result = encryptGroupBlob(clientZkGroupCipher, attrsBlobPlaintext);

  if (result.byteLength > GROUP_DESC_MAX_ENCRYPTED_BYTES) {
    throw new Error(
      'buildGroupDescriptionBuffer: encrypted group title is too long'
    );
  }

  return result;
}

function buildGroupProto(
  attributes: Pick<
    ConversationAttributesType,
    | 'accessControl'
    | 'expireTimer'
    | 'id'
    | 'membersV2'
    | 'name'
    | 'pendingMembersV2'
    | 'publicParams'
    | 'revision'
    | 'secretParams'
  > & {
    avatarUrl?: string;
  }
): Proto.Group {
  const MEMBER_ROLE_ENUM = Proto.Member.Role;
  const ACCESS_ENUM = Proto.AccessControl.AccessRequired;
  const logId = `groupv2(${attributes.id})`;

  const { publicParams, secretParams } = attributes;

  if (!publicParams) {
    throw new Error(
      `buildGroupProto/${logId}: attributes were missing publicParams!`
    );
  }
  if (!secretParams) {
    throw new Error(
      `buildGroupProto/${logId}: attributes were missing secretParams!`
    );
  }

  const serverPublicParamsBase64 = window.getServerPublicParams();
  const clientZkGroupCipher = getClientZkGroupCipher(secretParams);
  const clientZkProfileCipher = getClientZkProfileOperations(
    serverPublicParamsBase64
  );
  const proto = new Proto.Group();

  proto.publicKey = Bytes.fromBase64(publicParams);
  proto.version = attributes.revision || 0;

  if (attributes.name) {
    proto.title = buildGroupTitleBuffer(clientZkGroupCipher, attributes.name);
  }

  if (attributes.avatarUrl) {
    proto.avatar = attributes.avatarUrl;
  }

  if (attributes.expireTimer) {
    const timerBlobPlaintext = Proto.GroupAttributeBlob.encode({
      disappearingMessagesDuration: attributes.expireTimer,
    }).finish();
    proto.disappearingMessagesTimer = encryptGroupBlob(
      clientZkGroupCipher,
      timerBlobPlaintext
    );
  }

  const accessControl = new Proto.AccessControl();
  if (attributes.accessControl) {
    accessControl.attributes =
      attributes.accessControl.attributes || ACCESS_ENUM.MEMBER;
    accessControl.members =
      attributes.accessControl.members || ACCESS_ENUM.MEMBER;
  } else {
    accessControl.attributes = ACCESS_ENUM.MEMBER;
    accessControl.members = ACCESS_ENUM.MEMBER;
  }
  proto.accessControl = accessControl;

  proto.members = (attributes.membersV2 || []).map(item => {
    const member = new Proto.Member();

    const conversation = window.ConversationController.get(item.uuid);
    if (!conversation) {
      throw new Error(`buildGroupProto/${logId}: no conversation for member!`);
    }

    const profileKeyCredentialBase64 = conversation.get('profileKeyCredential');
    if (!profileKeyCredentialBase64) {
      throw new Error(
        `buildGroupProto/${logId}: member was missing profileKeyCredential!`
      );
    }
    const presentation = createProfileKeyCredentialPresentation(
      clientZkProfileCipher,
      profileKeyCredentialBase64,
      secretParams
    );

    member.role = item.role || MEMBER_ROLE_ENUM.DEFAULT;
    member.presentation = presentation;

    return member;
  });

  const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI);

  const ourACICipherTextBuffer = encryptUuid(clientZkGroupCipher, ourACI);

  proto.membersPendingProfileKey = (attributes.pendingMembersV2 || []).map(
    item => {
      const pendingMember = new Proto.MemberPendingProfileKey();
      const member = new Proto.Member();

      const conversation = window.ConversationController.get(item.uuid);
      if (!conversation) {
        throw new Error('buildGroupProto: no conversation for pending member!');
      }

      const uuid = conversation.getCheckedUuid(
        'buildGroupProto: pending member was missing uuid!'
      );

      const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);
      member.userId = uuidCipherTextBuffer;
      member.role = item.role || MEMBER_ROLE_ENUM.DEFAULT;

      pendingMember.member = member;
      pendingMember.timestamp = Long.fromNumber(item.timestamp);
      pendingMember.addedByUserId = ourACICipherTextBuffer;

      return pendingMember;
    }
  );

  return proto;
}

export async function buildAddMembersChange(
  conversation: Pick<
    ConversationAttributesType,
    'bannedMembersV2' | 'id' | 'publicParams' | 'revision' | 'secretParams'
  >,
  conversationIds: ReadonlyArray<string>
): Promise<undefined | Proto.GroupChange.Actions> {
  const MEMBER_ROLE_ENUM = Proto.Member.Role;

  const { id, publicParams, revision, secretParams } = conversation;

  const logId = `groupv2(${id})`;

  if (!publicParams) {
    throw new Error(
      `buildAddMembersChange/${logId}: attributes were missing publicParams!`
    );
  }
  if (!secretParams) {
    throw new Error(
      `buildAddMembersChange/${logId}: attributes were missing secretParams!`
    );
  }

  const newGroupVersion = (revision || 0) + 1;
  const serverPublicParamsBase64 = window.getServerPublicParams();
  const clientZkProfileCipher = getClientZkProfileOperations(
    serverPublicParamsBase64
  );
  const clientZkGroupCipher = getClientZkGroupCipher(secretParams);

  const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI);
  const ourACICipherTextBuffer = encryptUuid(clientZkGroupCipher, ourACI);

  const now = Date.now();

  const addMembers: Array<Proto.GroupChange.Actions.AddMemberAction> = [];
  const addPendingMembers: Array<Proto.GroupChange.Actions.AddMemberPendingProfileKeyAction> =
    [];
  const actions = new Proto.GroupChange.Actions();

  await Promise.all(
    conversationIds.map(async conversationId => {
      const contact = window.ConversationController.get(conversationId);
      if (!contact) {
        assert(
          false,
          `buildAddMembersChange/${logId}: missing local contact, skipping`
        );
        return;
      }

      const uuid = contact.getUuid();
      if (!uuid) {
        assert(false, `buildAddMembersChange/${logId}: missing UUID; skipping`);
        return;
      }

      // Refresh our local data to be sure
      if (!contact.get('profileKey') || !contact.get('profileKeyCredential')) {
        await contact.getProfiles();
      }

      const profileKey = contact.get('profileKey');
      const profileKeyCredential = contact.get('profileKeyCredential');

      const member = new Proto.Member();
      member.userId = encryptUuid(clientZkGroupCipher, uuid);
      member.role = MEMBER_ROLE_ENUM.DEFAULT;
      member.joinedAtVersion = newGroupVersion;

      // This is inspired by [Android's equivalent code][0].
      //
      // [0]: https://github.com/signalapp/Signal-Android/blob/2be306867539ab1526f0e49d1aa7bd61e783d23f/libsignal/service/src/main/java/org/whispersystems/signalservice/api/groupsv2/GroupsV2Operations.java#L152-L174
      if (profileKey && profileKeyCredential) {
        member.presentation = createProfileKeyCredentialPresentation(
          clientZkProfileCipher,
          profileKeyCredential,
          secretParams
        );

        const addMemberAction = new Proto.GroupChange.Actions.AddMemberAction();
        addMemberAction.added = member;
        addMemberAction.joinFromInviteLink = false;

        addMembers.push(addMemberAction);
      } else {
        const memberPendingProfileKey = new Proto.MemberPendingProfileKey();
        memberPendingProfileKey.member = member;
        memberPendingProfileKey.addedByUserId = ourACICipherTextBuffer;
        memberPendingProfileKey.timestamp = Long.fromNumber(now);

        const addPendingMemberAction =
          new Proto.GroupChange.Actions.AddMemberPendingProfileKeyAction();
        addPendingMemberAction.added = memberPendingProfileKey;

        addPendingMembers.push(addPendingMemberAction);
      }

      const doesMemberNeedUnban = conversation.bannedMembersV2?.find(
        bannedMember => bannedMember.uuid === uuid.toString()
      );
      if (doesMemberNeedUnban) {
        const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);

        const deleteMemberBannedAction =
          new Proto.GroupChange.Actions.DeleteMemberBannedAction();

        deleteMemberBannedAction.deletedUserId = uuidCipherTextBuffer;

        actions.deleteMembersBanned = actions.deleteMembersBanned || [];
        actions.deleteMembersBanned.push(deleteMemberBannedAction);
      }
    })
  );

  if (!addMembers.length && !addPendingMembers.length) {
    // This shouldn't happen. When these actions are passed to `modifyGroupV2`, a warning
    //   will be logged.
    return undefined;
  }
  if (addMembers.length) {
    actions.addMembers = addMembers;
  }
  if (addPendingMembers.length) {
    actions.addPendingMembers = addPendingMembers;
  }
  actions.version = newGroupVersion;

  return actions;
}

export async function buildUpdateAttributesChange(
  conversation: Pick<
    ConversationAttributesType,
    'id' | 'revision' | 'publicParams' | 'secretParams'
  >,
  attributes: Readonly<{
    avatar?: undefined | Uint8Array;
    description?: string;
    title?: string;
  }>
): Promise<undefined | Proto.GroupChange.Actions> {
  const { publicParams, secretParams, revision, id } = conversation;

  const logId = `groupv2(${id})`;

  if (!publicParams) {
    throw new Error(
      `buildUpdateAttributesChange/${logId}: attributes were missing publicParams!`
    );
  }
  if (!secretParams) {
    throw new Error(
      `buildUpdateAttributesChange/${logId}: attributes were missing secretParams!`
    );
  }

  const actions = new Proto.GroupChange.Actions();

  let hasChangedSomething = false;

  const clientZkGroupCipher = getClientZkGroupCipher(secretParams);

  // There are three possible states here:
  //
  // 1. 'avatar' not in attributes: we don't want to change the avatar.
  // 2. attributes.avatar === undefined: we want to clear the avatar.
  // 3. attributes.avatar !== undefined: we want to update the avatar.
  if ('avatar' in attributes) {
    hasChangedSomething = true;

    actions.modifyAvatar = new Proto.GroupChange.Actions.ModifyAvatarAction();
    const { avatar } = attributes;
    if (avatar) {
      const uploadedAvatar = await uploadAvatar({
        data: avatar,
        logId,
        publicParams,
        secretParams,
      });
      actions.modifyAvatar.avatar = uploadedAvatar.key;
    }

    // If we don't set `actions.modifyAvatar.avatar`, it will be cleared.
  }

  const { title } = attributes;
  if (title) {
    hasChangedSomething = true;

    actions.modifyTitle = new Proto.GroupChange.Actions.ModifyTitleAction();
    actions.modifyTitle.title = buildGroupTitleBuffer(
      clientZkGroupCipher,
      title
    );
  }

  const { description } = attributes;
  if (typeof description === 'string') {
    hasChangedSomething = true;

    actions.modifyDescription =
      new Proto.GroupChange.Actions.ModifyDescriptionAction();
    actions.modifyDescription.descriptionBytes = buildGroupDescriptionBuffer(
      clientZkGroupCipher,
      description
    );
  }

  if (!hasChangedSomething) {
    // This shouldn't happen. When these actions are passed to `modifyGroupV2`, a warning
    //   will be logged.
    return undefined;
  }

  actions.version = (revision || 0) + 1;

  return actions;
}

export function buildDisappearingMessagesTimerChange({
  expireTimer,
  group,
}: {
  expireTimer: number;
  group: ConversationAttributesType;
}): Proto.GroupChange.Actions {
  const actions = new Proto.GroupChange.Actions();

  const blob = new Proto.GroupAttributeBlob();
  blob.disappearingMessagesDuration = expireTimer;

  if (!group.secretParams) {
    throw new Error(
      'buildDisappearingMessagesTimerChange: group was missing secretParams!'
    );
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);

  const blobPlaintext = Proto.GroupAttributeBlob.encode(blob).finish();
  const blobCipherText = encryptGroupBlob(clientZkGroupCipher, blobPlaintext);

  const timerAction =
    new Proto.GroupChange.Actions.ModifyDisappearingMessagesTimerAction();
  timerAction.timer = blobCipherText;

  actions.version = (group.revision || 0) + 1;
  actions.modifyDisappearingMessagesTimer = timerAction;

  return actions;
}

export function buildInviteLinkPasswordChange(
  group: ConversationAttributesType,
  inviteLinkPassword: string
): Proto.GroupChange.Actions {
  const inviteLinkPasswordAction =
    new Proto.GroupChange.Actions.ModifyInviteLinkPasswordAction();
  inviteLinkPasswordAction.inviteLinkPassword =
    Bytes.fromBase64(inviteLinkPassword);

  const actions = new Proto.GroupChange.Actions();
  actions.version = (group.revision || 0) + 1;
  actions.modifyInviteLinkPassword = inviteLinkPasswordAction;

  return actions;
}

export function buildNewGroupLinkChange(
  group: ConversationAttributesType,
  inviteLinkPassword: string,
  addFromInviteLinkAccess: AccessRequiredEnum
): Proto.GroupChange.Actions {
  const accessControlAction =
    new Proto.GroupChange.Actions.ModifyAddFromInviteLinkAccessControlAction();
  accessControlAction.addFromInviteLinkAccess = addFromInviteLinkAccess;

  const inviteLinkPasswordAction =
    new Proto.GroupChange.Actions.ModifyInviteLinkPasswordAction();
  inviteLinkPasswordAction.inviteLinkPassword =
    Bytes.fromBase64(inviteLinkPassword);

  const actions = new Proto.GroupChange.Actions();
  actions.version = (group.revision || 0) + 1;
  actions.modifyAddFromInviteLinkAccess = accessControlAction;
  actions.modifyInviteLinkPassword = inviteLinkPasswordAction;

  return actions;
}

export function buildAccessControlAddFromInviteLinkChange(
  group: ConversationAttributesType,
  value: AccessRequiredEnum
): Proto.GroupChange.Actions {
  const accessControlAction =
    new Proto.GroupChange.Actions.ModifyAddFromInviteLinkAccessControlAction();
  accessControlAction.addFromInviteLinkAccess = value;

  const actions = new Proto.GroupChange.Actions();
  actions.version = (group.revision || 0) + 1;
  actions.modifyAddFromInviteLinkAccess = accessControlAction;

  return actions;
}

export function buildAnnouncementsOnlyChange(
  group: ConversationAttributesType,
  value: boolean
): Proto.GroupChange.Actions {
  const action = new Proto.GroupChange.Actions.ModifyAnnouncementsOnlyAction();
  action.announcementsOnly = value;

  const actions = new Proto.GroupChange.Actions();
  actions.version = (group.revision || 0) + 1;
  actions.modifyAnnouncementsOnly = action;

  return actions;
}

export function buildAccessControlAttributesChange(
  group: ConversationAttributesType,
  value: AccessRequiredEnum
): Proto.GroupChange.Actions {
  const accessControlAction =
    new Proto.GroupChange.Actions.ModifyAttributesAccessControlAction();
  accessControlAction.attributesAccess = value;

  const actions = new Proto.GroupChange.Actions();
  actions.version = (group.revision || 0) + 1;
  actions.modifyAttributesAccess = accessControlAction;

  return actions;
}

export function buildAccessControlMembersChange(
  group: ConversationAttributesType,
  value: AccessRequiredEnum
): Proto.GroupChange.Actions {
  const accessControlAction =
    new Proto.GroupChange.Actions.ModifyMembersAccessControlAction();
  accessControlAction.membersAccess = value;

  const actions = new Proto.GroupChange.Actions();
  actions.version = (group.revision || 0) + 1;
  actions.modifyMemberAccess = accessControlAction;

  return actions;
}

export function _maybeBuildAddBannedMemberActions({
  clientZkGroupCipher,
  group,
  ourUuid,
  uuid,
}: {
  clientZkGroupCipher: ClientZkGroupCipher;
  group: Pick<ConversationAttributesType, 'bannedMembersV2'>;
  ourUuid: UUID;
  uuid: UUID;
}): Pick<
  Proto.GroupChange.IActions,
  'addMembersBanned' | 'deleteMembersBanned'
> {
  const doesMemberNeedBan =
    !group.bannedMembersV2?.find(member => member.uuid === uuid.toString()) &&
    !uuid.isEqual(ourUuid);
  if (!doesMemberNeedBan) {
    return {};
  }
  // Sort current banned members by decreasing timestamp
  const sortedBannedMembers = [...(group.bannedMembersV2 ?? [])].sort(
    (a, b) => {
      return b.timestamp - a.timestamp;
    }
  );

  // All members after the limit have to be deleted and are older than the
  // rest of the list.
  const deletedBannedMembers = sortedBannedMembers.slice(
    Math.max(0, getGroupSizeHardLimit() - 1)
  );

  let deleteMembersBanned = null;
  if (deletedBannedMembers.length > 0) {
    deleteMembersBanned = deletedBannedMembers.map(bannedMember => {
      const deleteMemberBannedAction =
        new Proto.GroupChange.Actions.DeleteMemberBannedAction();

      deleteMemberBannedAction.deletedUserId = encryptUuid(
        clientZkGroupCipher,
        new UUID(bannedMember.uuid)
      );

      return deleteMemberBannedAction;
    });
  }

  const addMemberBannedAction =
    new Proto.GroupChange.Actions.AddMemberBannedAction();

  const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);
  addMemberBannedAction.added = new Proto.MemberBanned();
  addMemberBannedAction.added.userId = uuidCipherTextBuffer;

  return {
    addMembersBanned: [addMemberBannedAction],
    deleteMembersBanned,
  };
}

// TODO AND-1101
export function buildDeletePendingAdminApprovalMemberChange({
  group,
  ourUuid,
  uuid,
}: {
  group: ConversationAttributesType;
  ourUuid: UUID;
  uuid: UUID;
}): Proto.GroupChange.Actions {
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildDeletePendingAdminApprovalMemberChange: group was missing secretParams!'
    );
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);

  const deleteMemberPendingAdminApproval =
    new Proto.GroupChange.Actions.DeleteMemberPendingAdminApprovalAction();
  deleteMemberPendingAdminApproval.deletedUserId = uuidCipherTextBuffer;

  actions.version = (group.revision || 0) + 1;
  actions.deleteMemberPendingAdminApprovals = [
    deleteMemberPendingAdminApproval,
  ];

  const { addMembersBanned, deleteMembersBanned } =
    _maybeBuildAddBannedMemberActions({
      clientZkGroupCipher,
      group,
      ourUuid,
      uuid,
    });

  if (addMembersBanned) {
    actions.addMembersBanned = addMembersBanned;
  }
  if (deleteMembersBanned) {
    actions.deleteMembersBanned = deleteMembersBanned;
  }

  return actions;
}

export function buildAddPendingAdminApprovalMemberChange({
  group,
  profileKeyCredentialBase64,
  serverPublicParamsBase64,
}: {
  group: ConversationAttributesType;
  profileKeyCredentialBase64: string;
  serverPublicParamsBase64: string;
}): Proto.GroupChange.Actions {
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildAddPendingAdminApprovalMemberChange: group was missing secretParams!'
    );
  }
  const clientZkProfileCipher = getClientZkProfileOperations(
    serverPublicParamsBase64
  );

  const addMemberPendingAdminApproval =
    new Proto.GroupChange.Actions.AddMemberPendingAdminApprovalAction();
  const presentation = createProfileKeyCredentialPresentation(
    clientZkProfileCipher,
    profileKeyCredentialBase64,
    group.secretParams
  );

  const added = new Proto.MemberPendingAdminApproval();
  added.presentation = presentation;

  addMemberPendingAdminApproval.added = added;

  actions.version = (group.revision || 0) + 1;
  actions.addMemberPendingAdminApprovals = [addMemberPendingAdminApproval];

  return actions;
}

export function buildAddMember({
  group,
  profileKeyCredentialBase64,
  serverPublicParamsBase64,
  uuid,
}: {
  group: ConversationAttributesType;
  profileKeyCredentialBase64: string;
  serverPublicParamsBase64: string;
  joinFromInviteLink?: boolean;
  uuid: UUID;
}): Proto.GroupChange.Actions {
  const MEMBER_ROLE_ENUM = Proto.Member.Role;

  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error('buildAddMember: group was missing secretParams!');
  }
  const clientZkProfileCipher = getClientZkProfileOperations(
    serverPublicParamsBase64
  );

  const addMember = new Proto.GroupChange.Actions.AddMemberAction();
  const presentation = createProfileKeyCredentialPresentation(
    clientZkProfileCipher,
    profileKeyCredentialBase64,
    group.secretParams
  );

  const added = new Proto.Member();
  added.presentation = presentation;
  added.role = MEMBER_ROLE_ENUM.DEFAULT;

  addMember.added = added;

  actions.version = (group.revision || 0) + 1;
  actions.addMembers = [addMember];

  const doesMemberNeedUnban = group.bannedMembersV2?.find(
    member => member.uuid === uuid.toString()
  );
  if (doesMemberNeedUnban) {
    const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
    const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);

    const deleteMemberBannedAction =
      new Proto.GroupChange.Actions.DeleteMemberBannedAction();

    deleteMemberBannedAction.deletedUserId = uuidCipherTextBuffer;
    actions.deleteMembersBanned = [deleteMemberBannedAction];
  }

  return actions;
}

export function buildDeletePendingMemberChange({
  uuids,
  group,
}: {
  uuids: Array<UUID>;
  group: ConversationAttributesType;
}): Proto.GroupChange.Actions {
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildDeletePendingMemberChange: group was missing secretParams!'
    );
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);

  const deletePendingMembers = uuids.map(uuid => {
    const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);
    const deletePendingMember =
      new Proto.GroupChange.Actions.DeleteMemberPendingProfileKeyAction();
    deletePendingMember.deletedUserId = uuidCipherTextBuffer;
    return deletePendingMember;
  });

  actions.version = (group.revision || 0) + 1;
  actions.deletePendingMembers = deletePendingMembers;

  return actions;
}

export function buildDeleteMemberChange({
  group,
  ourUuid,
  uuid,
}: {
  group: ConversationAttributesType;
  ourUuid: UUID;
  uuid: UUID;
}): Proto.GroupChange.Actions {
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error('buildDeleteMemberChange: group was missing secretParams!');
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);

  const deleteMember = new Proto.GroupChange.Actions.DeleteMemberAction();
  deleteMember.deletedUserId = uuidCipherTextBuffer;

  actions.version = (group.revision || 0) + 1;
  actions.deleteMembers = [deleteMember];

  const { addMembersBanned, deleteMembersBanned } =
    _maybeBuildAddBannedMemberActions({
      clientZkGroupCipher,
      group,
      ourUuid,
      uuid,
    });

  if (addMembersBanned) {
    actions.addMembersBanned = addMembersBanned;
  }
  if (deleteMembersBanned) {
    actions.deleteMembersBanned = deleteMembersBanned;
  }

  return actions;
}

export function buildAddBannedMemberChange({
  uuid,
  group,
}: {
  uuid: UUID;
  group: ConversationAttributesType;
}): Proto.GroupChange.Actions {
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildAddBannedMemberChange: group was missing secretParams!'
    );
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);

  const addMemberBannedAction =
    new Proto.GroupChange.Actions.AddMemberBannedAction();

  addMemberBannedAction.added = new Proto.MemberBanned();
  addMemberBannedAction.added.userId = uuidCipherTextBuffer;

  actions.addMembersBanned = [addMemberBannedAction];

  if (
    group.pendingAdminApprovalV2?.some(item => item.uuid === uuid.toString())
  ) {
    const deleteMemberPendingAdminApprovalAction =
      new Proto.GroupChange.Actions.DeleteMemberPendingAdminApprovalAction();

    deleteMemberPendingAdminApprovalAction.deletedUserId = uuidCipherTextBuffer;

    actions.deleteMemberPendingAdminApprovals = [
      deleteMemberPendingAdminApprovalAction,
    ];
  }

  actions.version = (group.revision || 0) + 1;

  return actions;
}

export function buildModifyMemberRoleChange({
  uuid,
  group,
  role,
}: {
  uuid: UUID;
  group: ConversationAttributesType;
  role: number;
}): Proto.GroupChange.Actions {
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error('buildMakeAdminChange: group was missing secretParams!');
  }

  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);

  const toggleAdmin = new Proto.GroupChange.Actions.ModifyMemberRoleAction();
  toggleAdmin.userId = uuidCipherTextBuffer;
  toggleAdmin.role = role;

  actions.version = (group.revision || 0) + 1;
  actions.modifyMemberRoles = [toggleAdmin];

  return actions;
}

export function buildPromotePendingAdminApprovalMemberChange({
  group,
  uuid,
}: {
  group: ConversationAttributesType;
  uuid: UUID;
}): Proto.GroupChange.Actions {
  const MEMBER_ROLE_ENUM = Proto.Member.Role;
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildAddPendingAdminApprovalMemberChange: group was missing secretParams!'
    );
  }

  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);

  const promotePendingMember =
    new Proto.GroupChange.Actions.PromoteMemberPendingAdminApprovalAction();
  promotePendingMember.userId = uuidCipherTextBuffer;
  promotePendingMember.role = MEMBER_ROLE_ENUM.DEFAULT;

  actions.version = (group.revision || 0) + 1;
  actions.promoteMemberPendingAdminApprovals = [promotePendingMember];

  return actions;
}

export type BuildPromoteMemberChangeOptionsType = Readonly<{
  group: ConversationAttributesType;
  serverPublicParamsBase64: string;
  profileKeyCredentialBase64?: string;
  pniCredentialBase64?: string;
}>;

export function buildPromoteMemberChange({
  group,
  profileKeyCredentialBase64,
  pniCredentialBase64,
  serverPublicParamsBase64,
}: BuildPromoteMemberChangeOptionsType): Proto.GroupChange.Actions {
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildDisappearingMessagesTimerChange: group was missing secretParams!'
    );
  }

  actions.version = (group.revision || 0) + 1;

  const clientZkProfileCipher = getClientZkProfileOperations(
    serverPublicParamsBase64
  );

  let presentation: Uint8Array;
  if (profileKeyCredentialBase64 !== undefined) {
    presentation = createProfileKeyCredentialPresentation(
      clientZkProfileCipher,
      profileKeyCredentialBase64,
      group.secretParams
    );

    actions.promotePendingMembers = [
      {
        presentation,
      },
    ];
  } else {
    strictAssert(
      pniCredentialBase64,
      'Either pniCredential or profileKeyCredential must be present'
    );
    presentation = createPNICredentialPresentation(
      clientZkProfileCipher,
      pniCredentialBase64,
      group.secretParams
    );

    actions.promoteMembersPendingPniAciProfileKey = [
      {
        presentation,
      },
    ];
  }

  return actions;
}

async function uploadGroupChange({
  actions,
  group,
  inviteLinkPassword,
}: {
  actions: Proto.GroupChange.IActions;
  group: ConversationAttributesType;
  inviteLinkPassword?: string;
}): Promise<Proto.IGroupChange> {
  const logId = idForLogging(group.groupId);

  // Ensure we have the credentials we need before attempting GroupsV2 operations
  await maybeFetchNewCredentials();

  if (!group.secretParams) {
    throw new Error('uploadGroupChange: group was missing secretParams!');
  }
  if (!group.publicParams) {
    throw new Error('uploadGroupChange: group was missing publicParams!');
  }

  return makeRequestWithTemporalRetry({
    logId: `uploadGroupChange/${logId}`,
    publicParams: group.publicParams,
    secretParams: group.secretParams,
    request: (sender, options) =>
      sender.modifyGroup(actions, options, inviteLinkPassword),
  });
}

export async function modifyGroupV2({
  conversation,
  usingCredentialsFrom,
  createGroupChange,
  extraConversationsForSend,
  inviteLinkPassword,
  name,
}: {
  conversation: ConversationModel;
  usingCredentialsFrom: ReadonlyArray<ConversationModel>;
  createGroupChange: () => Promise<Proto.GroupChange.Actions | undefined>;
  extraConversationsForSend?: Array<string>;
  inviteLinkPassword?: string;
  name: string;
}): Promise<void> {
  const logId = `${name}/${conversation.idForLogging()}`;

  if (!getIsGroupV2(conversation.attributes)) {
    throw new Error(
      `modifyGroupV2/${logId}: Called for non-GroupV2 conversation`
    );
  }

  const startTime = Date.now();
  const timeoutTime = startTime + durations.MINUTE;

  const MAX_ATTEMPTS = 5;

  let refreshedCredentials = false;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    log.info(`modifyGroupV2/${logId}: Starting attempt ${attempt}`);
    try {
      // eslint-disable-next-line no-await-in-loop
      await window.waitForEmptyEventQueue();

      // Fetch profiles for contacts that do not have credentials (or have
      // expired credentials)
      {
        const membersMissingCredentials = usingCredentialsFrom.filter(member =>
          member.hasProfileKeyCredentialExpired()
        );
        const logIds = membersMissingCredentials.map(member =>
          member.idForLogging()
        );

        if (logIds.length !== 0) {
          log.info(`modifyGroupV2/${logId}: Fetching profiles for ${logIds}`);
        }

        // eslint-disable-next-line no-await-in-loop
        await Promise.all(
          membersMissingCredentials.map(member => member.getProfiles())
        );
      }

      log.info(`modifyGroupV2/${logId}: Queuing attempt ${attempt}`);

      // eslint-disable-next-line no-await-in-loop
      await conversation.queueJob('modifyGroupV2', async () => {
        log.info(`modifyGroupV2/${logId}: Running attempt ${attempt}`);

        const actions = await createGroupChange();
        if (!actions) {
          log.warn(
            `modifyGroupV2/${logId}: No change actions. Returning early.`
          );
          return;
        }

        // The new revision has to be exactly one more than the current revision
        //   or it won't upload properly, and it won't apply in maybeUpdateGroup
        const currentRevision = conversation.get('revision');
        const newRevision = actions.version;

        if ((currentRevision || 0) + 1 !== newRevision) {
          throw new Error(
            `modifyGroupV2/${logId}: Revision mismatch - ${currentRevision} to ${newRevision}.`
          );
        }

        // Upload. If we don't have permission, the server will return an error here.
        const groupChange = await uploadGroupChange({
          actions,
          inviteLinkPassword,
          group: conversation.attributes,
        });

        const groupChangeBuffer =
          Proto.GroupChange.encode(groupChange).finish();
        const groupChangeBase64 = Bytes.toBase64(groupChangeBuffer);

        // Apply change locally, just like we would with an incoming change. This will
        //   change conversation state and add change notifications to the timeline.
        await window.Signal.Groups.maybeUpdateGroup({
          conversation,
          groupChange: {
            base64: groupChangeBase64,
            isTrusted: true,
          },
          newRevision,
        });

        const groupV2Info = conversation.getGroupV2Info({
          includePendingMembers: true,
          extraConversationsForSend,
        });
        strictAssert(groupV2Info, 'missing groupV2Info');

        await conversationJobQueue.add({
          type: conversationQueueJobEnum.enum.GroupUpdate,
          conversationId: conversation.id,
          groupChangeBase64,
          recipients: groupV2Info.members,
          revision: groupV2Info.revision,
        });
      });

      // If we've gotten here with no error, we exit!
      log.info(
        `modifyGroupV2/${logId}: Update complete, with attempt ${attempt}!`
      );
      break;
    } catch (error) {
      if (error.code === 409 && Date.now() <= timeoutTime) {
        log.info(
          `modifyGroupV2/${logId}: Conflict while updating. Trying again...`
        );

        // eslint-disable-next-line no-await-in-loop
        await conversation.fetchLatestGroupV2Data({ force: true });
      } else if (error.code === 400 && !refreshedCredentials) {
        const logIds = usingCredentialsFrom.map(member =>
          member.idForLogging()
        );
        if (logIds.length !== 0) {
          log.warn(
            `modifyGroupV2/${logId}: Profile key credentials were not ` +
              `up-to-date. Updating profiles for ${logIds} and retrying`
          );
        }

        for (const member of usingCredentialsFrom) {
          member.set({
            profileKeyCredential: null,
            profileKeyCredentialExpiration: null,
          });
        }

        // eslint-disable-next-line no-await-in-loop
        await Promise.all(
          usingCredentialsFrom.map(member => member.getProfiles())
        );

        // Fetch credentials only once
        refreshedCredentials = true;
      } else if (error.code === 409) {
        log.error(
          `modifyGroupV2/${logId}: Conflict while updating. Timed out; not retrying.`
        );
        // We don't wait here because we're breaking out of the loop immediately.
        conversation.fetchLatestGroupV2Data({ force: true });
        throw error;
      } else {
        const errorString = Errors.toLogFormat(error);
        log.error(`modifyGroupV2/${logId}: Error updating: ${errorString}`);
        throw error;
      }
    }
  }
}

// Utility

export function idForLogging(groupId: string | undefined): string {
  return `groupv2(${groupId})`;
}

export function deriveGroupFields(masterKey: Uint8Array): GroupFields {
  if (masterKey.length !== MASTER_KEY_LENGTH) {
    throw new Error(
      `deriveGroupFields: masterKey had length ${masterKey.length}, ` +
        `expected ${MASTER_KEY_LENGTH}`
    );
  }

  const cacheKey = Bytes.toBase64(masterKey);
  const cached = groupFieldsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  log.info('deriveGroupFields: cache miss');

  const secretParams = deriveGroupSecretParams(masterKey);
  const publicParams = deriveGroupPublicParams(secretParams);
  const id = deriveGroupID(secretParams);

  const fresh = {
    id,
    secretParams,
    publicParams,
  };
  groupFieldsCache.set(cacheKey, fresh);
  return fresh;
}

async function makeRequestWithTemporalRetry<T>({
  logId,
  publicParams,
  secretParams,
  request,
}: {
  logId: string;
  publicParams: string;
  secretParams: string;
  request: (sender: MessageSender, options: GroupCredentialsType) => Promise<T>;
}): Promise<T> {
  const groupCredentials = getCheckedCredentialsForToday(
    `makeRequestWithTemporalRetry/${logId}`
  );

  const sender = window.textsecure.messaging;
  if (!sender) {
    throw new Error(
      `makeRequestWithTemporalRetry/${logId}: textsecure.messaging is not available!`
    );
  }

  log.info(`makeRequestWithTemporalRetry/${logId}: starting`);

  const todayOptions = getGroupCredentials({
    authCredentialBase64: groupCredentials.today.credential,
    groupPublicParamsBase64: publicParams,
    groupSecretParamsBase64: secretParams,
    serverPublicParamsBase64: window.getServerPublicParams(),
  });

  try {
    return await request(sender, todayOptions);
  } catch (todayError) {
    if (todayError.code === TEMPORAL_AUTH_REJECTED_CODE) {
      log.warn(
        `makeRequestWithTemporalRetry/${logId}: Trying again with tomorrow's credentials`
      );
      const tomorrowOptions = getGroupCredentials({
        authCredentialBase64: groupCredentials.tomorrow.credential,
        groupPublicParamsBase64: publicParams,
        groupSecretParamsBase64: secretParams,
        serverPublicParamsBase64: window.getServerPublicParams(),
      });

      return request(sender, tomorrowOptions);
    }

    throw todayError;
  }
}

export async function fetchMembershipProof({
  publicParams,
  secretParams,
}: {
  publicParams: string;
  secretParams: string;
}): Promise<string | undefined> {
  // Ensure we have the credentials we need before attempting GroupsV2 operations
  await maybeFetchNewCredentials();

  if (!publicParams) {
    throw new Error('fetchMembershipProof: group was missing publicParams!');
  }
  if (!secretParams) {
    throw new Error('fetchMembershipProof: group was missing secretParams!');
  }

  const response = await makeRequestWithTemporalRetry({
    logId: 'fetchMembershipProof',
    publicParams,
    secretParams,
    request: (sender, options) => sender.getGroupMembershipToken(options),
  });
  return response.token;
}

// Creating a group

export async function createGroupV2(
  options: Readonly<{
    name: string;
    avatar: undefined | Uint8Array;
    expireTimer: undefined | number;
    conversationIds: Array<string>;
    avatars?: Array<AvatarDataType>;
    refreshedCredentials?: boolean;
  }>
): Promise<ConversationModel> {
  const {
    name,
    avatar,
    expireTimer,
    conversationIds,
    avatars,
    refreshedCredentials = false,
  } = options;

  // Ensure we have the credentials we need before attempting GroupsV2 operations
  await maybeFetchNewCredentials();

  const ACCESS_ENUM = Proto.AccessControl.AccessRequired;
  const MEMBER_ROLE_ENUM = Proto.Member.Role;

  const masterKeyBuffer = getRandomBytes(32);
  const fields = deriveGroupFields(masterKeyBuffer);

  const groupId = Bytes.toBase64(fields.id);
  const logId = `groupv2(${groupId})`;

  const masterKey = Bytes.toBase64(masterKeyBuffer);
  const secretParams = Bytes.toBase64(fields.secretParams);
  const publicParams = Bytes.toBase64(fields.publicParams);

  const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI).toString();

  const ourConversation =
    window.ConversationController.getOurConversationOrThrow();
  if (ourConversation.hasProfileKeyCredentialExpired()) {
    log.info(`createGroupV2/${logId}: fetching our own credentials`);
    await ourConversation.getProfiles();
  }

  const membersV2: Array<GroupV2MemberType> = [
    {
      uuid: ourACI,
      role: MEMBER_ROLE_ENUM.ADMINISTRATOR,
      joinedAtVersion: 0,
    },
  ];
  const pendingMembersV2: Array<GroupV2PendingMemberType> = [];

  let uploadedAvatar: undefined | UploadedAvatarType;

  await Promise.all([
    ...conversationIds.map(async conversationId => {
      const contact = window.ConversationController.get(conversationId);
      if (!contact) {
        assert(
          false,
          `createGroupV2/${logId}: missing local contact, skipping`
        );
        return;
      }

      const contactUuid = contact.get('uuid');
      if (!contactUuid) {
        assert(false, `createGroupV2/${logId}: missing UUID; skipping`);
        return;
      }

      // Refresh our local data to be sure
      if (contact.hasProfileKeyCredentialExpired()) {
        await contact.getProfiles();
      }

      if (contact.get('profileKey') && contact.get('profileKeyCredential')) {
        membersV2.push({
          uuid: contactUuid,
          role: MEMBER_ROLE_ENUM.DEFAULT,
          joinedAtVersion: 0,
        });
      } else {
        pendingMembersV2.push({
          addedByUserId: ourACI,
          uuid: contactUuid,
          timestamp: Date.now(),
          role: MEMBER_ROLE_ENUM.DEFAULT,
        });
      }
    }),
    (async () => {
      if (!avatar) {
        return;
      }

      uploadedAvatar = await uploadAvatar({
        data: avatar,
        logId,
        publicParams,
        secretParams,
      });
    })(),
  ]);

  if (membersV2.length + pendingMembersV2.length > getGroupSizeHardLimit()) {
    throw new Error(
      `createGroupV2/${logId}: Too many members! Member count: ${membersV2.length}, Pending member count: ${pendingMembersV2.length}`
    );
  }

  const protoAndConversationAttributes = {
    name,

    // Core GroupV2 info
    revision: 0,
    publicParams,
    secretParams,

    // GroupV2 state
    accessControl: {
      attributes: ACCESS_ENUM.MEMBER,
      members: ACCESS_ENUM.MEMBER,
      addFromInviteLink: ACCESS_ENUM.UNSATISFIABLE,
    },
    membersV2,
    pendingMembersV2,
  };

  const groupProto = await buildGroupProto({
    id: groupId,
    avatarUrl: uploadedAvatar?.key,
    ...protoAndConversationAttributes,
  });

  try {
    await makeRequestWithTemporalRetry({
      logId: `createGroupV2/${logId}`,
      publicParams,
      secretParams,
      request: (sender, requestOptions) =>
        sender.createGroup(groupProto, requestOptions),
    });
  } catch (error) {
    if (!(error instanceof HTTPError)) {
      throw error;
    }
    if (error.code !== 400 || refreshedCredentials) {
      throw error;
    }

    const logIds = conversationIds.map(conversationId => {
      const contact = window.ConversationController.get(conversationId);
      if (!contact) {
        return;
      }
      contact.set({
        profileKeyCredential: null,
        profileKeyCredentialExpiration: null,
      });

      return contact.idForLogging();
    });

    log.warn(
      `createGroupV2/${logId}: Profile key credentials were not ` +
        `up-to-date. Updating profiles for ${logIds} and retrying`
    );

    return createGroupV2({
      ...options,
      refreshedCredentials: true,
    });
  }

  let avatarAttribute: ConversationAttributesType['avatar'];
  if (uploadedAvatar) {
    try {
      avatarAttribute = {
        url: uploadedAvatar.key,
        path: await window.Signal.Migrations.writeNewAttachmentData(
          uploadedAvatar.data
        ),
        hash: uploadedAvatar.hash,
      };
    } catch (err) {
      log.warn(
        `createGroupV2/${logId}: avatar failed to save to disk. Continuing on`
      );
    }
  }

  const now = Date.now();

  const conversation = await window.ConversationController.getOrCreateAndWait(
    groupId,
    'group',
    {
      ...protoAndConversationAttributes,
      active_at: now,
      addedBy: ourACI,
      avatar: avatarAttribute,
      avatars,
      groupVersion: 2,
      masterKey,
      profileSharing: true,
      timestamp: now,
      needsStorageServiceSync: true,
    }
  );

  await conversation.queueJob('storageServiceUploadJob', async () => {
    await window.Signal.Services.storageServiceUploadJob();
  });

  const timestamp = Date.now();
  const groupV2Info = conversation.getGroupV2Info({
    includePendingMembers: true,
  });
  strictAssert(groupV2Info, 'missing groupV2Info');

  await conversationJobQueue.add({
    type: conversationQueueJobEnum.enum.GroupUpdate,
    conversationId: conversation.id,
    recipients: groupV2Info.members,
    revision: groupV2Info.revision,
  });

  const createdTheGroupMessage: MessageAttributesType = {
    ...generateBasicMessage(),
    type: 'group-v2-change',
    sourceUuid: ourACI,
    conversationId: conversation.id,
    readStatus: ReadStatus.Read,
    received_at: window.Signal.Util.incrementMessageCounter(),
    received_at_ms: timestamp,
    timestamp,
    seenStatus: SeenStatus.Seen,
    sent_at: timestamp,
    groupV2Change: {
      from: ourACI,
      details: [{ type: 'create' }],
    },
  };
  await dataInterface.saveMessages([createdTheGroupMessage], {
    forceSave: true,
    ourUuid: ourACI,
  });
  const model = new window.Whisper.Message(createdTheGroupMessage);
  window.MessageController.register(model.id, model);
  conversation.trigger('newmessage', model);

  if (expireTimer) {
    await conversation.updateExpirationTimer(expireTimer, {
      reason: 'createGroupV2',
    });
  }

  return conversation;
}

// Migrating a group

export async function hasV1GroupBeenMigrated(
  conversation: ConversationModel
): Promise<boolean> {
  const logId = conversation.idForLogging();
  const isGroupV1 = getIsGroupV1(conversation.attributes);
  if (!isGroupV1) {
    log.warn(
      `checkForGV2Existence/${logId}: Called for non-GroupV1 conversation!`
    );
    return false;
  }

  // Ensure we have the credentials we need before attempting GroupsV2 operations
  await maybeFetchNewCredentials();

  const groupId = conversation.get('groupId');
  if (!groupId) {
    throw new Error(`checkForGV2Existence/${logId}: No groupId!`);
  }

  const idBuffer = Bytes.fromBinary(groupId);
  const masterKeyBuffer = deriveMasterKeyFromGroupV1(idBuffer);
  const fields = deriveGroupFields(masterKeyBuffer);

  try {
    await makeRequestWithTemporalRetry({
      logId: `getGroup/${logId}`,
      publicParams: Bytes.toBase64(fields.publicParams),
      secretParams: Bytes.toBase64(fields.secretParams),
      request: (sender, options) => sender.getGroup(options),
    });
    return true;
  } catch (error) {
    const { code } = error;
    return code !== GROUP_NONEXISTENT_CODE;
  }
}

export function maybeDeriveGroupV2Id(conversation: ConversationModel): boolean {
  const isGroupV1 = getIsGroupV1(conversation.attributes);
  const groupV1Id = conversation.get('groupId');
  const derived = conversation.get('derivedGroupV2Id');

  if (!isGroupV1 || !groupV1Id || derived) {
    return false;
  }

  const v1IdBuffer = Bytes.fromBinary(groupV1Id);
  const masterKeyBuffer = deriveMasterKeyFromGroupV1(v1IdBuffer);
  const fields = deriveGroupFields(masterKeyBuffer);
  const derivedGroupV2Id = Bytes.toBase64(fields.id);

  conversation.set({
    derivedGroupV2Id,
  });

  return true;
}

type WrappedGroupChangeType = Readonly<{
  base64: string;
  isTrusted: boolean;
}>;

type MigratePropsType = Readonly<{
  conversation: ConversationModel;
  newRevision?: number;
  receivedAt?: number;
  sentAt?: number;
  groupChange?: WrappedGroupChangeType;
}>;

export async function isGroupEligibleToMigrate(
  conversation: ConversationModel
): Promise<boolean> {
  if (!getIsGroupV1(conversation.attributes)) {
    return false;
  }

  const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI);
  const areWeMember =
    !conversation.get('left') && conversation.hasMember(ourACI);
  if (!areWeMember) {
    return false;
  }

  const members = conversation.get('members') || [];
  for (let i = 0, max = members.length; i < max; i += 1) {
    const identifier = members[i];
    const contact = window.ConversationController.get(identifier);

    if (!contact) {
      return false;
    }
    if (!contact.get('uuid')) {
      return false;
    }
  }

  return true;
}

export async function getGroupMigrationMembers(
  conversation: ConversationModel
): Promise<{
  droppedGV2MemberIds: Array<string>;
  membersV2: Array<GroupV2MemberType>;
  pendingMembersV2: Array<GroupV2PendingMemberType>;
  previousGroupV1Members: Array<string>;
}> {
  const logId = conversation.idForLogging();
  const MEMBER_ROLE_ENUM = Proto.Member.Role;

  const ourConversationId =
    window.ConversationController.getOurConversationId();
  if (!ourConversationId) {
    throw new Error(
      `getGroupMigrationMembers/${logId}: Couldn't fetch our own conversationId!`
    );
  }

  const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI).toString();

  let areWeMember = false;
  let areWeInvited = false;

  const previousGroupV1Members = conversation.get('members') || [];
  const now = Date.now();
  const memberLookup: Record<string, boolean> = {};
  const membersV2: Array<GroupV2MemberType> = compact(
    await Promise.all(
      previousGroupV1Members.map(async e164 => {
        const contact = window.ConversationController.get(e164);

        if (!contact) {
          throw new Error(
            `getGroupMigrationMembers/${logId}: membersV2 - missing local contact for ${e164}, skipping.`
          );
        }
        if (!isMe(contact.attributes) && window.GV2_MIGRATION_DISABLE_ADD) {
          log.warn(
            `getGroupMigrationMembers/${logId}: membersV2 - skipping ${e164} due to GV2_MIGRATION_DISABLE_ADD flag`
          );
          return null;
        }

        const contactUuid = contact.get('uuid');
        if (!contactUuid) {
          log.warn(
            `getGroupMigrationMembers/${logId}: membersV2 - missing uuid for ${e164}, skipping.`
          );
          return null;
        }

        if (!contact.get('profileKey')) {
          log.warn(
            `getGroupMigrationMembers/${logId}: membersV2 - missing profileKey for member ${e164}, skipping.`
          );
          return null;
        }

        let capabilities = contact.get('capabilities');

        // Refresh our local data to be sure
        if (
          !capabilities?.['gv1-migration'] ||
          !contact.get('profileKeyCredential')
        ) {
          await contact.getProfiles();
        }

        capabilities = contact.get('capabilities');
        if (!capabilities?.['gv1-migration']) {
          log.warn(
            `getGroupMigrationMembers/${logId}: membersV2 - member ${e164} is missing gv1-migration capability, skipping.`
          );
          return null;
        }
        if (!contact.get('profileKeyCredential')) {
          log.warn(
            `getGroupMigrationMembers/${logId}: membersV2 - no profileKeyCredential for ${e164}, skipping.`
          );
          return null;
        }

        const conversationId = contact.id;

        if (conversationId === ourConversationId) {
          areWeMember = true;
        }

        memberLookup[conversationId] = true;

        return {
          uuid: contactUuid,
          role: MEMBER_ROLE_ENUM.ADMINISTRATOR,
          joinedAtVersion: 0,
        };
      })
    )
  );

  const droppedGV2MemberIds: Array<string> = [];
  const pendingMembersV2: Array<GroupV2PendingMemberType> = compact(
    (previousGroupV1Members || []).map(e164 => {
      const contact = window.ConversationController.get(e164);

      if (!contact) {
        throw new Error(
          `getGroupMigrationMembers/${logId}: pendingMembersV2 - missing local contact for ${e164}, skipping.`
        );
      }

      const conversationId = contact.id;
      // If we've already added this contact above, we'll skip here
      if (memberLookup[conversationId]) {
        return null;
      }

      if (!isMe(contact.attributes) && window.GV2_MIGRATION_DISABLE_INVITE) {
        log.warn(
          `getGroupMigrationMembers/${logId}: pendingMembersV2 - skipping ${e164} due to GV2_MIGRATION_DISABLE_INVITE flag`
        );
        droppedGV2MemberIds.push(conversationId);
        return null;
      }

      const contactUuid = contact.get('uuid');
      if (!contactUuid) {
        log.warn(
          `getGroupMigrationMembers/${logId}: pendingMembersV2 - missing uuid for ${e164}, skipping.`
        );
        droppedGV2MemberIds.push(conversationId);
        return null;
      }

      const capabilities = contact.get('capabilities');
      if (!capabilities?.['gv1-migration']) {
        log.warn(
          `getGroupMigrationMembers/${logId}: pendingMembersV2 - member ${e164} is missing gv1-migration capability, skipping.`
        );
        droppedGV2MemberIds.push(conversationId);
        return null;
      }

      if (conversationId === ourConversationId) {
        areWeInvited = true;
      }

      return {
        uuid: contactUuid,
        timestamp: now,
        addedByUserId: ourACI,
        role: MEMBER_ROLE_ENUM.ADMINISTRATOR,
      };
    })
  );

  if (!areWeMember) {
    throw new Error(`getGroupMigrationMembers/${logId}: We are not a member!`);
  }
  if (areWeInvited) {
    throw new Error(`getGroupMigrationMembers/${logId}: We are invited!`);
  }

  return {
    droppedGV2MemberIds,
    membersV2,
    pendingMembersV2,
    previousGroupV1Members,
  };
}

// This is called when the user chooses to migrate a GroupV1. It will update the server,
//   then let all members know about the new group.
export async function initiateMigrationToGroupV2(
  conversation: ConversationModel
): Promise<void> {
  // Ensure we have the credentials we need before attempting GroupsV2 operations
  await maybeFetchNewCredentials();

  try {
    await conversation.queueJob('initiateMigrationToGroupV2', async () => {
      const ACCESS_ENUM = Proto.AccessControl.AccessRequired;

      const isEligible = isGroupEligibleToMigrate(conversation);
      const previousGroupV1Id = conversation.get('groupId');

      if (!isEligible || !previousGroupV1Id) {
        throw new Error(
          `initiateMigrationToGroupV2: conversation is not eligible to migrate! ${conversation.idForLogging()}`
        );
      }

      const groupV1IdBuffer = Bytes.fromBinary(previousGroupV1Id);
      const masterKeyBuffer = deriveMasterKeyFromGroupV1(groupV1IdBuffer);
      const fields = deriveGroupFields(masterKeyBuffer);

      const groupId = Bytes.toBase64(fields.id);
      const logId = `groupv2(${groupId})`;
      log.info(
        `initiateMigrationToGroupV2/${logId}: Migrating from ${conversation.idForLogging()}`
      );

      const masterKey = Bytes.toBase64(masterKeyBuffer);
      const secretParams = Bytes.toBase64(fields.secretParams);
      const publicParams = Bytes.toBase64(fields.publicParams);

      const ourConversationId =
        window.ConversationController.getOurConversationId();
      if (!ourConversationId) {
        throw new Error(
          `initiateMigrationToGroupV2/${logId}: Couldn't fetch our own conversationId!`
        );
      }
      const ourConversation =
        window.ConversationController.get(ourConversationId);
      if (!ourConversation) {
        throw new Error(
          `initiateMigrationToGroupV2/${logId}: cannot get our own conversation. Cannot migrate`
        );
      }

      const {
        membersV2,
        pendingMembersV2,
        droppedGV2MemberIds,
        previousGroupV1Members,
      } = await getGroupMigrationMembers(conversation);

      if (
        membersV2.length + pendingMembersV2.length >
        getGroupSizeHardLimit()
      ) {
        throw new Error(
          `initiateMigrationToGroupV2/${logId}: Too many members! Member count: ${membersV2.length}, Pending member count: ${pendingMembersV2.length}`
        );
      }

      // Note: A few group elements don't need to change here:
      //   - name
      //   - expireTimer
      let avatarAttribute: ConversationAttributesType['avatar'];
      const avatarPath = conversation.attributes.avatar?.path;
      if (avatarPath) {
        const { hash, key } = await uploadAvatar({
          logId,
          publicParams,
          secretParams,
          path: avatarPath,
        });
        avatarAttribute = {
          url: key,
          path: avatarPath,
          hash,
        };
      }

      const newAttributes = {
        ...conversation.attributes,
        avatar: avatarAttribute,

        // Core GroupV2 info
        revision: 0,
        groupId,
        groupVersion: 2,
        masterKey,
        publicParams,
        secretParams,

        // GroupV2 state
        accessControl: {
          attributes: ACCESS_ENUM.MEMBER,
          members: ACCESS_ENUM.MEMBER,
          addFromInviteLink: ACCESS_ENUM.UNSATISFIABLE,
        },
        membersV2,
        pendingMembersV2,

        // Capture previous GroupV1 data for future use
        previousGroupV1Id,
        previousGroupV1Members,

        // Clear storage ID, since we need to start over on the storage service
        storageID: undefined,

        // Clear obsolete data
        derivedGroupV2Id: undefined,
        members: undefined,
      };

      const groupProto = buildGroupProto({
        ...newAttributes,
        avatarUrl: avatarAttribute?.url,
      });

      try {
        await makeRequestWithTemporalRetry({
          logId: `createGroup/${logId}`,
          publicParams,
          secretParams,
          request: (sender, options) => sender.createGroup(groupProto, options),
        });
      } catch (error) {
        log.error(
          `initiateMigrationToGroupV2/${logId}: Error creating group:`,
          error.stack
        );

        throw error;
      }

      const groupChangeMessages: Array<GroupChangeMessageType> = [];
      groupChangeMessages.push({
        ...generateBasicMessage(),
        type: 'group-v1-migration',
        invitedGV2Members: pendingMembersV2,
        droppedGV2MemberIds,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
      });

      await updateGroup({
        conversation,
        updates: {
          newAttributes,
          groupChangeMessages,
          members: [],
        },
      });

      if (window.storage.blocked.isGroupBlocked(previousGroupV1Id)) {
        window.storage.blocked.addBlockedGroup(groupId);
      }

      // Save these most recent updates to conversation
      updateConversation(conversation.attributes);
    });
  } catch (error) {
    const logId = conversation.idForLogging();
    if (!getIsGroupV1(conversation.attributes)) {
      throw error;
    }

    const alreadyMigrated = await hasV1GroupBeenMigrated(conversation);
    if (!alreadyMigrated) {
      log.error(
        `initiateMigrationToGroupV2/${logId}: Group has not already been migrated, re-throwing error`
      );
      throw error;
    }

    await respondToGroupV2Migration({
      conversation,
    });

    return;
  }

  const groupV2Info = conversation.getGroupV2Info({
    includePendingMembers: true,
  });
  strictAssert(groupV2Info, 'missing groupV2Info');

  await conversationJobQueue.add({
    type: conversationQueueJobEnum.enum.GroupUpdate,
    conversationId: conversation.id,
    recipients: groupV2Info.members,
    revision: groupV2Info.revision,
  });
}

export async function waitThenRespondToGroupV2Migration(
  options: MigratePropsType
): Promise<void> {
  // First wait to process all incoming messages on the websocket
  await window.waitForEmptyEventQueue();

  // Then wait to process all outstanding messages for this conversation
  const { conversation } = options;

  await conversation.queueJob('waitThenRespondToGroupV2Migration', async () => {
    try {
      // And finally try to migrate the group
      await respondToGroupV2Migration(options);
    } catch (error) {
      log.error(
        `waitThenRespondToGroupV2Migration/${conversation.idForLogging()}: respondToGroupV2Migration failure:`,
        error && error.stack ? error.stack : error
      );
    }
  });
}

export function buildMigrationBubble(
  previousGroupV1MembersIds: Array<string>,
  newAttributes: ConversationAttributesType
): GroupChangeMessageType {
  const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI);
  const ourPNI = window.storage.user.getUuid(UUIDKind.PNI);
  const ourConversationId =
    window.ConversationController.getOurConversationId();

  // Assemble items to commemorate this event for the timeline..
  const combinedConversationIds: Array<string> = [
    ...(newAttributes.membersV2 || []).map(item => item.uuid),
    ...(newAttributes.pendingMembersV2 || []).map(item => item.uuid),
  ].map(uuid => {
    const conversation = window.ConversationController.lookupOrCreate({
      uuid,
    });
    strictAssert(conversation, `Conversation not found for ${uuid}`);
    return conversation.id;
  });
  const droppedMemberIds: Array<string> = difference(
    previousGroupV1MembersIds,
    combinedConversationIds
  ).filter(id => id && id !== ourConversationId);
  const invitedMembers = (newAttributes.pendingMembersV2 || []).filter(
    item =>
      item.uuid !== ourACI.toString() &&
      !(ourPNI && item.uuid === ourPNI.toString())
  );

  const areWeInvited = (newAttributes.pendingMembersV2 || []).some(
    item =>
      item.uuid === ourACI.toString() ||
      (ourPNI && item.uuid === ourPNI.toString())
  );

  return {
    ...generateBasicMessage(),
    type: 'group-v1-migration',
    groupMigration: {
      areWeInvited,
      invitedMembers,
      droppedMemberIds,
    },
  };
}

export function getBasicMigrationBubble(): GroupChangeMessageType {
  return {
    ...generateBasicMessage(),
    type: 'group-v1-migration',
    groupMigration: {
      areWeInvited: false,
      invitedMembers: [],
      droppedMemberIds: [],
    },
  };
}

export async function joinGroupV2ViaLinkAndMigrate({
  approvalRequired,
  conversation,
  inviteLinkPassword,
  revision,
}: {
  approvalRequired: boolean;
  conversation: ConversationModel;
  inviteLinkPassword: string;
  revision: number;
}): Promise<void> {
  const isGroupV1 = getIsGroupV1(conversation.attributes);
  const previousGroupV1Id = conversation.get('groupId');

  if (!isGroupV1 || !previousGroupV1Id) {
    throw new Error(
      `joinGroupV2ViaLinkAndMigrate: Conversation is not GroupV1! ${conversation.idForLogging()}`
    );
  }

  // Derive GroupV2 fields
  const groupV1IdBuffer = Bytes.fromBinary(previousGroupV1Id);
  const masterKeyBuffer = deriveMasterKeyFromGroupV1(groupV1IdBuffer);
  const fields = deriveGroupFields(masterKeyBuffer);

  const groupId = Bytes.toBase64(fields.id);
  const logId = idForLogging(groupId);
  log.info(
    `joinGroupV2ViaLinkAndMigrate/${logId}: Migrating from ${conversation.idForLogging()}`
  );

  const masterKey = Bytes.toBase64(masterKeyBuffer);
  const secretParams = Bytes.toBase64(fields.secretParams);
  const publicParams = Bytes.toBase64(fields.publicParams);

  // A mini-migration, which will not show dropped/invited members
  const newAttributes = {
    ...conversation.attributes,

    // Core GroupV2 info
    revision,
    groupId,
    groupVersion: 2,
    masterKey,
    publicParams,
    secretParams,
    groupInviteLinkPassword: inviteLinkPassword,

    addedBy: undefined,
    left: true,

    // Capture previous GroupV1 data for future use
    previousGroupV1Id: conversation.get('groupId'),
    previousGroupV1Members: conversation.get('members'),

    // Clear storage ID, since we need to start over on the storage service
    storageID: undefined,

    // Clear obsolete data
    derivedGroupV2Id: undefined,
    members: undefined,
  };
  const groupChangeMessages: Array<GroupChangeMessageType> = [
    {
      ...generateBasicMessage(),
      type: 'group-v1-migration',
      groupMigration: {
        areWeInvited: false,
        invitedMembers: [],
        droppedMemberIds: [],
      },
    },
  ];
  await updateGroup({
    conversation,
    updates: {
      newAttributes,
      groupChangeMessages,
      members: [],
    },
  });

  // Now things are set up, so we can go through normal channels
  await conversation.joinGroupV2ViaLink({
    inviteLinkPassword,
    approvalRequired,
  });
}

// This may be called from storage service, an out-of-band check, or an incoming message.
//   If this is kicked off via an incoming message, we want to do the right thing and hit
//   the log endpoint - the parameters beyond conversation are needed in that scenario.
export async function respondToGroupV2Migration({
  conversation,
  groupChange,
  newRevision,
  receivedAt,
  sentAt,
}: MigratePropsType): Promise<void> {
  // Ensure we have the credentials we need before attempting GroupsV2 operations
  await maybeFetchNewCredentials();

  const isGroupV1 = getIsGroupV1(conversation.attributes);
  const previousGroupV1Id = conversation.get('groupId');

  if (!isGroupV1 || !previousGroupV1Id) {
    throw new Error(
      `respondToGroupV2Migration: Conversation is not GroupV1! ${conversation.idForLogging()}`
    );
  }

  const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI);
  const wereWePreviouslyAMember = conversation.hasMember(ourACI);

  // Derive GroupV2 fields
  const groupV1IdBuffer = Bytes.fromBinary(previousGroupV1Id);
  const masterKeyBuffer = deriveMasterKeyFromGroupV1(groupV1IdBuffer);
  const fields = deriveGroupFields(masterKeyBuffer);

  const groupId = Bytes.toBase64(fields.id);
  const logId = idForLogging(groupId);
  log.info(
    `respondToGroupV2Migration/${logId}: Migrating from ${conversation.idForLogging()}`
  );

  const masterKey = Bytes.toBase64(masterKeyBuffer);
  const secretParams = Bytes.toBase64(fields.secretParams);
  const publicParams = Bytes.toBase64(fields.publicParams);

  const previousGroupV1Members = conversation.get('members');
  const previousGroupV1MembersIds = conversation.getMemberIds();

  // Skeleton of the new group state - not useful until we add the group's server state
  const attributes = {
    ...conversation.attributes,

    // Core GroupV2 info
    revision: 0,
    groupId,
    groupVersion: 2,
    masterKey,
    publicParams,
    secretParams,

    // Capture previous GroupV1 data for future use
    previousGroupV1Id,
    previousGroupV1Members,

    // Clear storage ID, since we need to start over on the storage service
    storageID: undefined,

    // Clear obsolete data
    derivedGroupV2Id: undefined,
    members: undefined,
  };

  let firstGroupState: Proto.IGroup | null | undefined;

  try {
    const response: GroupLogResponseType = await makeRequestWithTemporalRetry({
      logId: `getGroupLog/${logId}`,
      publicParams,
      secretParams,
      request: (sender, options) =>
        sender.getGroupLog(
          {
            startVersion: 0,
            includeFirstState: true,
            includeLastState: false,
            maxSupportedChangeEpoch: SUPPORTED_CHANGE_EPOCH,
          },
          options
        ),
    });

    // Attempt to start with the first group state, only later processing future updates
    firstGroupState = response?.changes?.groupChanges?.[0]?.groupState;
  } catch (error) {
    if (error.code === GROUP_ACCESS_DENIED_CODE) {
      log.info(
        `respondToGroupV2Migration/${logId}: Failed to access log endpoint; fetching full group state`
      );
      try {
        firstGroupState = await makeRequestWithTemporalRetry({
          logId: `getGroup/${logId}`,
          publicParams,
          secretParams,
          request: (sender, options) => sender.getGroup(options),
        });
      } catch (secondError) {
        if (secondError.code === GROUP_ACCESS_DENIED_CODE) {
          log.info(
            `respondToGroupV2Migration/${logId}: Failed to access state endpoint; user is no longer part of group`
          );

          if (window.storage.blocked.isGroupBlocked(previousGroupV1Id)) {
            window.storage.blocked.addBlockedGroup(groupId);
          }

          if (wereWePreviouslyAMember) {
            log.info(
              `respondToGroupV2Migration/${logId}: Upgrading group with migration/removed events`
            );
            const ourNumber = window.textsecure.storage.user.getNumber();
            await updateGroup({
              conversation,
              receivedAt,
              sentAt,
              updates: {
                newAttributes: {
                  // Because we're using attributes here, we upgrade this to a v2 group
                  ...attributes,
                  addedBy: undefined,
                  left: true,
                  members: (conversation.get('members') || []).filter(
                    item => item !== ourACI.toString() && item !== ourNumber
                  ),
                },
                groupChangeMessages: [
                  {
                    ...getBasicMigrationBubble(),
                    readStatus: ReadStatus.Read,
                    seenStatus: SeenStatus.Seen,
                  },
                  {
                    ...generateBasicMessage(),
                    type: 'group-v2-change',
                    groupV2Change: {
                      details: [
                        {
                          type: 'member-remove' as const,
                          uuid: ourACI.toString(),
                        },
                      ],
                    },
                    readStatus: ReadStatus.Read,
                    seenStatus: SeenStatus.Unseen,
                  },
                ],
                members: [],
              },
            });
            return;
          }

          log.info(
            `respondToGroupV2Migration/${logId}: Upgrading group with migration event; no removed event`
          );
          await updateGroup({
            conversation,
            receivedAt,
            sentAt,
            updates: {
              newAttributes: attributes,
              groupChangeMessages: [
                {
                  ...getBasicMigrationBubble(),
                  readStatus: ReadStatus.Read,
                  seenStatus: SeenStatus.Seen,
                },
              ],
              members: [],
            },
          });
          return;
        }
        throw secondError;
      }
    } else {
      throw error;
    }
  }
  if (!firstGroupState) {
    throw new Error(
      `respondToGroupV2Migration/${logId}: Couldn't get a first group state!`
    );
  }

  const groupState = decryptGroupState(
    firstGroupState,
    attributes.secretParams,
    logId
  );
  const { newAttributes, newProfileKeys } = await applyGroupState({
    group: attributes,
    groupState,
  });

  // Generate notifications into the timeline
  const groupChangeMessages: Array<GroupChangeMessageType> = [];

  groupChangeMessages.push({
    ...buildMigrationBubble(previousGroupV1MembersIds, newAttributes),
    readStatus: ReadStatus.Read,
    seenStatus: SeenStatus.Seen,
  });

  const areWeInvited = (newAttributes.pendingMembersV2 || []).some(
    item => item.uuid === ourACI.toString()
  );
  const areWeMember = (newAttributes.membersV2 || []).some(
    item => item.uuid === ourACI.toString()
  );
  if (!areWeInvited && !areWeMember) {
    // Add a message to the timeline saying the user was removed. This shouldn't happen.
    groupChangeMessages.push({
      ...generateBasicMessage(),
      type: 'group-v2-change',
      groupV2Change: {
        details: [
          {
            type: 'member-remove' as const,
            uuid: ourACI.toString(),
          },
        ],
      },
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.Unseen,
    });
  }

  // This buffer ensures that all migration-related messages are sorted above
  //   any initiating message. We need to do this because groupChangeMessages are
  //   already sorted via updates to sentAt inside of updateGroup().
  const SORT_BUFFER = 1000;
  await updateGroup({
    conversation,
    receivedAt,
    sentAt: sentAt ? sentAt - SORT_BUFFER : undefined,
    updates: {
      newAttributes,
      groupChangeMessages,
      members: profileKeysToMembers(newProfileKeys),
    },
  });

  if (window.storage.blocked.isGroupBlocked(previousGroupV1Id)) {
    window.storage.blocked.addBlockedGroup(groupId);
  }

  // Save these most recent updates to conversation
  updateConversation(conversation.attributes);

  // Finally, check for any changes to the group since its initial creation using normal
  //   group update codepaths.
  await maybeUpdateGroup({
    conversation,
    groupChange,
    newRevision,
    receivedAt,
    sentAt,
  });
}

// Fetching and applying group changes

type MaybeUpdatePropsType = Readonly<{
  conversation: ConversationModel;
  newRevision?: number;
  receivedAt?: number;
  sentAt?: number;
  dropInitialJoinMessage?: boolean;
  force?: boolean;
  groupChange?: WrappedGroupChangeType;
}>;

const FIVE_MINUTES = 5 * durations.MINUTE;

export async function waitThenMaybeUpdateGroup(
  options: MaybeUpdatePropsType,
  { viaFirstStorageSync = false } = {}
): Promise<void> {
  const { conversation } = options;

  if (conversation.isBlocked()) {
    log.info(
      `waitThenMaybeUpdateGroup: Group ${conversation.idForLogging()} is blocked, returning early`
    );
    return;
  }

  // First wait to process all incoming messages on the websocket
  await window.waitForEmptyEventQueue();

  // Then make sure we haven't fetched this group too recently
  const { lastSuccessfulGroupFetch = 0 } = conversation;
  if (
    !options.force &&
    isMoreRecentThan(lastSuccessfulGroupFetch, FIVE_MINUTES)
  ) {
    const waitTime = lastSuccessfulGroupFetch + FIVE_MINUTES - Date.now();
    log.info(
      `waitThenMaybeUpdateGroup/${conversation.idForLogging()}: group update ` +
        `was fetched recently, skipping for ${waitTime}ms`
    );
    return;
  }

  // Then wait to process all outstanding messages for this conversation
  await conversation.queueJob('waitThenMaybeUpdateGroup', async () => {
    try {
      // And finally try to update the group
      await maybeUpdateGroup(options, { viaFirstStorageSync });

      conversation.lastSuccessfulGroupFetch = Date.now();
    } catch (error) {
      log.error(
        `waitThenMaybeUpdateGroup/${conversation.idForLogging()}: maybeUpdateGroup failure:`,
        error && error.stack ? error.stack : error
      );
    }
  });
}

export async function maybeUpdateGroup(
  {
    conversation,
    dropInitialJoinMessage,
    groupChange,
    newRevision,
    receivedAt,
    sentAt,
  }: MaybeUpdatePropsType,
  { viaFirstStorageSync = false } = {}
): Promise<void> {
  const logId = conversation.idForLogging();

  try {
    // Ensure we have the credentials we need before attempting GroupsV2 operations
    await maybeFetchNewCredentials();

    const updates = await getGroupUpdates({
      group: conversation.attributes,
      serverPublicParamsBase64: window.getServerPublicParams(),
      newRevision,
      groupChange,
      dropInitialJoinMessage,
    });

    await updateGroup(
      { conversation, receivedAt, sentAt, updates },
      { viaFirstStorageSync }
    );
  } catch (error) {
    log.error(
      `maybeUpdateGroup/${logId}: Failed to update group:`,
      error && error.stack ? error.stack : error
    );
    throw error;
  }
}

async function updateGroup(
  {
    conversation,
    receivedAt,
    sentAt,
    updates,
  }: {
    conversation: ConversationModel;
    receivedAt?: number;
    sentAt?: number;
    updates: UpdatesResultType;
  },
  { viaFirstStorageSync = false } = {}
): Promise<void> {
  const logId = conversation.idForLogging();

  const { newAttributes, groupChangeMessages, members } = updates;
  const ourACI = window.textsecure.storage.user.getCheckedUuid(UUIDKind.ACI);
  const ourPNI = window.textsecure.storage.user.getUuid(UUIDKind.PNI);

  const startingRevision = conversation.get('revision');
  const endingRevision = newAttributes.revision;

  const wasMemberOrPending =
    conversation.hasMember(ourACI) ||
    conversation.isMemberPending(ourACI) ||
    (ourPNI && conversation.isMemberPending(ourPNI));
  const isMemberOrPending =
    !newAttributes.left ||
    newAttributes.pendingMembersV2?.some(
      item =>
        item.uuid === ourACI.toString() || item.uuid === ourPNI?.toString()
    );
  const isMemberOrPendingOrAwaitingApproval =
    isMemberOrPending ||
    newAttributes.pendingAdminApprovalV2?.some(
      item => item.uuid === ourACI.toString()
    );

  const isInitialDataFetch =
    !isNumber(startingRevision) && isNumber(endingRevision);

  // Ensure that all generated messages are ordered properly.
  // Before the provided timestamp so update messages appear before the
  //   initiating message, or after now().
  const finalReceivedAt =
    receivedAt || window.Signal.Util.incrementMessageCounter();
  const initialSentAt = sentAt || Date.now();

  // GroupV1 -> GroupV2 migration changes the groupId, and we need to update our id-based
  //   lookups if there's a change on that field.
  const previousId = conversation.get('groupId');
  const idChanged = previousId && previousId !== newAttributes.groupId;

  // By updating activeAt we force this conversation into the left pane if this is the
  //   first time we've fetched data about it, and we were able to fetch its name. Nobody
  //   likes to see Unknown Group in the left pane. After first fetch, we rely on normal
  //   message activity (including group change messsages) to set the timestamp properly.
  let activeAt = conversation.get('active_at') || null;
  if (
    !viaFirstStorageSync &&
    isMemberOrPendingOrAwaitingApproval &&
    isInitialDataFetch &&
    newAttributes.name
  ) {
    activeAt = initialSentAt;
  }

  // Save all synthetic messages describing group changes
  let syntheticSentAt = initialSentAt - (groupChangeMessages.length + 1);
  const timestamp = Date.now();
  const changeMessagesToSave = groupChangeMessages.map(changeMessage => {
    // We do this to preserve the order of the timeline. We only update sentAt to ensure
    //   that we don't stomp on messages received around the same time as the message
    //   which initiated this group fetch and in-conversation messages.
    syntheticSentAt += 1;

    return {
      ...changeMessage,
      conversationId: conversation.id,
      received_at: finalReceivedAt,
      received_at_ms: syntheticSentAt,
      sent_at: syntheticSentAt,
      timestamp,
    };
  });

  const contactsWithoutProfileKey = new Array<ConversationModel>();

  // Capture profile key for each member in the group, if we don't have it yet
  members.forEach(member => {
    const contact = window.ConversationController.getOrCreate(
      member.uuid,
      'private'
    );

    if (
      !isMe(contact.attributes) &&
      member.profileKey &&
      member.profileKey.length > 0 &&
      contact.get('profileKey') !== member.profileKey
    ) {
      contactsWithoutProfileKey.push(contact);
      contact.setProfileKey(member.profileKey);
    }
  });

  let profileFetches: Promise<Array<void>> | undefined;
  if (contactsWithoutProfileKey.length !== 0) {
    log.info(
      `updateGroup/${logId}: fetching ` +
        `${contactsWithoutProfileKey.length} missing profiles`
    );

    profileFetches = Promise.all(
      contactsWithoutProfileKey.map(contact => contact.getProfiles())
    );
  }

  if (changeMessagesToSave.length > 0) {
    try {
      await profileFetches;
    } catch (error) {
      log.error(
        `updateGroup/${logId}: failed to fetch missing profiles`,
        Errors.toLogFormat(error)
      );
    }
    await appendChangeMessages(conversation, changeMessagesToSave);
  }

  // We update group membership last to ensure that all notifications are in place before
  //   the group updates happen on the model.

  conversation.set({
    ...newAttributes,
    active_at: activeAt,
    temporaryMemberCount: !newAttributes.left
      ? undefined
      : newAttributes.temporaryMemberCount,
  });

  if (idChanged) {
    conversation.trigger('idUpdated', conversation, 'groupId', previousId);
  }

  // Save these most recent updates to conversation
  await updateConversation(conversation.attributes);

  // If we've been added by a blocked contact, then schedule a task to leave group
  const justAdded = !wasMemberOrPending && isMemberOrPending;
  const addedBy =
    newAttributes.pendingMembersV2?.find(
      item =>
        item.uuid === ourACI.toString() || item.uuid === ourPNI?.toString()
    )?.addedByUserId || newAttributes.addedBy;

  if (justAdded && addedBy) {
    const adder = window.ConversationController.get(addedBy);

    if (adder && adder.isBlocked()) {
      log.warn(
        `updateGroup/${logId}: Added to group by blocked user ${adder.idForLogging()}. Scheduling group leave.`
      );

      // Wait for empty queue to make it more likely the group update succeeds
      const waitThenLeave = async () => {
        log.warn(`waitThenLeave/${logId}: Waiting for empty event queue.`);
        await window.waitForEmptyEventQueue();
        log.warn(
          `waitThenLeave/${logId}: Empty event queue, starting group leave.`
        );

        await conversation.leaveGroupV2();
        log.warn(`waitThenLeave/${logId}: Leave complete.`);
      };

      // Cannot await here, would infinitely block queue
      waitThenLeave();
    }
  }
}

// Exported for testing
export function _mergeGroupChangeMessages(
  first: MessageAttributesType | undefined,
  second: MessageAttributesType
): MessageAttributesType | undefined {
  if (!first) {
    return undefined;
  }

  if (first.type !== 'group-v2-change' || second.type !== first.type) {
    return undefined;
  }

  const { groupV2Change: firstChange } = first;
  const { groupV2Change: secondChange } = second;
  if (!firstChange || !secondChange) {
    return undefined;
  }

  if (firstChange.details.length !== 1 && secondChange.details.length !== 1) {
    return undefined;
  }

  const [firstDetail] = firstChange.details;
  const [secondDetail] = secondChange.details;
  let isApprovalPending: boolean;
  if (secondDetail.type === 'admin-approval-add-one') {
    isApprovalPending = true;
  } else if (secondDetail.type === 'admin-approval-remove-one') {
    isApprovalPending = false;
  } else {
    return undefined;
  }

  const { uuid } = secondDetail;
  strictAssert(uuid, 'admin approval message should have uuid');

  let updatedDetail;
  // Member was previously added and is now removed
  if (
    !isApprovalPending &&
    firstDetail.type === 'admin-approval-add-one' &&
    firstDetail.uuid === uuid
  ) {
    updatedDetail = {
      type: 'admin-approval-bounce' as const,
      uuid,
      times: 1,
      isApprovalPending,
    };

    // There is an existing bounce event - merge this one into it.
  } else if (
    firstDetail.type === 'admin-approval-bounce' &&
    firstDetail.uuid === uuid &&
    firstDetail.isApprovalPending === !isApprovalPending
  ) {
    updatedDetail = {
      type: 'admin-approval-bounce' as const,
      uuid,
      times: firstDetail.times + (isApprovalPending ? 0 : 1),
      isApprovalPending,
    };
  } else {
    return undefined;
  }

  return {
    ...first,
    groupV2Change: {
      ...first.groupV2Change,
      details: [updatedDetail],
    },
  };
}

// Exported for testing
export function _isGroupChangeMessageBounceable(
  message: MessageAttributesType
): boolean {
  if (message.type !== 'group-v2-change') {
    return false;
  }

  const { groupV2Change } = message;
  if (!groupV2Change) {
    return false;
  }

  if (groupV2Change.details.length !== 1) {
    return false;
  }

  const [first] = groupV2Change.details;
  if (
    first.type === 'admin-approval-add-one' ||
    first.type === 'admin-approval-bounce'
  ) {
    return true;
  }

  return false;
}

async function appendChangeMessages(
  conversation: ConversationModel,
  messages: ReadonlyArray<MessageAttributesType>
): Promise<void> {
  const logId = conversation.idForLogging();

  log.info(
    `appendChangeMessages/${logId}: processing ${messages.length} messages`
  );

  const ourACI = window.textsecure.storage.user.getCheckedUuid(UUIDKind.ACI);

  let lastMessage = await dataInterface.getLastConversationMessage({
    conversationId: conversation.id,
  });

  if (lastMessage && !_isGroupChangeMessageBounceable(lastMessage)) {
    lastMessage = undefined;
  }

  const mergedMessages = [];
  let previousMessage = lastMessage;
  for (const message of messages) {
    const merged = _mergeGroupChangeMessages(previousMessage, message);
    if (!merged) {
      if (previousMessage && previousMessage !== lastMessage) {
        mergedMessages.push(previousMessage);
      }
      previousMessage = message;
      continue;
    }

    previousMessage = merged;
    log.info(
      `appendChangeMessages/${logId}: merged ${message.id} into ${merged.id}`
    );
  }

  if (previousMessage && previousMessage !== lastMessage) {
    mergedMessages.push(previousMessage);
  }

  // Update existing message
  if (lastMessage && mergedMessages[0]?.id === lastMessage?.id) {
    const [first, ...rest] = mergedMessages;
    strictAssert(first !== undefined, 'First message must be there');

    log.info(`appendChangeMessages/${logId}: updating ${first.id}`);
    await dataInterface.saveMessage(first, {
      ourUuid: ourACI.toString(),

      // We don't use forceSave here because this is an update of existing
      // message.
    });

    log.info(
      `appendChangeMessages/${logId}: saving ${rest.length} new messages`
    );
    await dataInterface.saveMessages(rest, {
      ourUuid: ourACI.toString(),
      forceSave: true,
    });
  } else {
    log.info(
      `appendChangeMessages/${logId}: saving ${mergedMessages.length} new messages`
    );
    await dataInterface.saveMessages(mergedMessages, {
      ourUuid: ourACI.toString(),
      forceSave: true,
    });
  }

  let newMessages = 0;
  for (const changeMessage of mergedMessages) {
    const existing = window.MessageController.getById(changeMessage.id);

    // Update existing message
    if (existing) {
      strictAssert(
        changeMessage.id === lastMessage?.id,
        'Should only update group change that was already in the database'
      );
      existing.set(changeMessage);
      continue;
    }

    const model = new window.Whisper.Message(changeMessage);
    window.MessageController.register(model.id, model);
    conversation.trigger('newmessage', model);
    newMessages += 1;
  }

  // We updated the message, but didn't add new ones - refresh left pane
  if (!newMessages && mergedMessages.length > 0) {
    await conversation.updateLastMessage();
    conversation.updateUnread();
  }
}

type GetGroupUpdatesType = Readonly<{
  dropInitialJoinMessage?: boolean;
  group: ConversationAttributesType;
  serverPublicParamsBase64: string;
  newRevision?: number;
  groupChange?: WrappedGroupChangeType;
}>;

async function getGroupUpdates({
  dropInitialJoinMessage,
  group,
  serverPublicParamsBase64,
  newRevision,
  groupChange: wrappedGroupChange,
}: GetGroupUpdatesType): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);

  log.info(`getGroupUpdates/${logId}: Starting...`);

  const currentRevision = group.revision;
  const isFirstFetch = !isNumber(group.revision);
  const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI);

  const isInitialCreationMessage = isFirstFetch && newRevision === 0;
  const weAreAwaitingApproval = (group.pendingAdminApprovalV2 || []).find(
    item => item.uuid === ourACI.toString()
  );
  const isOneVersionUp =
    isNumber(currentRevision) &&
    isNumber(newRevision) &&
    newRevision === currentRevision + 1;

  if (
    window.GV2_ENABLE_SINGLE_CHANGE_PROCESSING &&
    wrappedGroupChange &&
    isNumber(newRevision) &&
    (isInitialCreationMessage || weAreAwaitingApproval || isOneVersionUp)
  ) {
    log.info(`getGroupUpdates/${logId}: Processing just one change`);

    const groupChangeBuffer = Bytes.fromBase64(wrappedGroupChange.base64);
    const groupChange = Proto.GroupChange.decode(groupChangeBuffer);
    const isChangeSupported =
      !isNumber(groupChange.changeEpoch) ||
      groupChange.changeEpoch <= SUPPORTED_CHANGE_EPOCH;

    if (isChangeSupported) {
      if (!wrappedGroupChange.isTrusted) {
        strictAssert(
          groupChange.serverSignature && groupChange.actions,
          'Server signature must be present in untrusted group change'
        );
        try {
          verifyNotarySignature(
            serverPublicParamsBase64,
            groupChange.actions,
            groupChange.serverSignature
          );
        } catch (error) {
          log.warn(
            `getGroupUpdates/${logId}: verifyNotarySignature failed, ` +
              'dropping the message',
            Errors.toLogFormat(error)
          );
          return {
            newAttributes: group,
            groupChangeMessages: [],
            members: [],
          };
        }
      }

      return updateGroupViaSingleChange({
        group,
        newRevision,
        groupChange,
      });
    }

    log.info(
      `getGroupUpdates/${logId}: Failing over; group change unsupported`
    );
  }

  if (
    (!isFirstFetch || isNumber(newRevision)) &&
    window.GV2_ENABLE_CHANGE_PROCESSING
  ) {
    try {
      return await updateGroupViaLogs({
        group,
        newRevision,
      });
    } catch (error) {
      const nextStep = isFirstFetch
        ? `fetching logs since ${newRevision}`
        : 'fetching full state';

      if (error.code === TEMPORAL_AUTH_REJECTED_CODE) {
        // We will fail over to the updateGroupViaState call below
        log.info(
          `getGroupUpdates/${logId}: Temporal credential failure, now ${nextStep}`
        );
      } else if (error.code === GROUP_ACCESS_DENIED_CODE) {
        // We will fail over to the updateGroupViaState call below
        log.info(
          `getGroupUpdates/${logId}: Log access denied, now ${nextStep}`
        );
      } else {
        throw error;
      }
    }
  }

  if (window.GV2_ENABLE_STATE_PROCESSING) {
    try {
      return await updateGroupViaState({
        dropInitialJoinMessage,
        group,
      });
    } catch (error) {
      if (error.code === TEMPORAL_AUTH_REJECTED_CODE) {
        log.info(
          `getGroupUpdates/${logId}: Temporal credential failure. Failing; we don't know if we have access or not.`
        );
        throw error;
      } else if (error.code === GROUP_ACCESS_DENIED_CODE) {
        // We will fail over to the updateGroupViaPreJoinInfo call below
        log.info(
          `getGroupUpdates/${logId}: Failed to get group state. Attempting to fetch pre-join information.`
        );
      } else {
        throw error;
      }
    }
  }

  if (window.GV2_ENABLE_PRE_JOIN_FETCH) {
    try {
      return await updateGroupViaPreJoinInfo({
        group,
      });
    } catch (error) {
      if (error.code === GROUP_ACCESS_DENIED_CODE) {
        return generateLeftGroupChanges(group);
      }
      if (error.code === GROUP_NONEXISTENT_CODE) {
        return generateLeftGroupChanges(group);
      }

      // If we get another temporal failure, we'll fail and try again later.
      throw error;
    }
  }

  log.warn(
    `getGroupUpdates/${logId}: No processing was legal! Returning empty changeset.`
  );
  return {
    newAttributes: group,
    groupChangeMessages: [],
    members: [],
  };
}

async function updateGroupViaPreJoinInfo({
  group,
}: {
  group: ConversationAttributesType;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  const ourACI = window.textsecure.storage.user
    .getCheckedUuid(UUIDKind.ACI)
    .toString();

  const { publicParams, secretParams } = group;
  if (!secretParams) {
    throw new Error(
      'updateGroupViaPreJoinInfo: group was missing secretParams!'
    );
  }
  if (!publicParams) {
    throw new Error(
      'updateGroupViaPreJoinInfo: group was missing publicParams!'
    );
  }

  // No password, but if we're already pending approval, we can access this without it.
  const inviteLinkPassword = undefined;
  const preJoinInfo = await makeRequestWithTemporalRetry({
    logId: `getPreJoinInfo/${logId}`,
    publicParams,
    secretParams,
    request: (sender, options) =>
      sender.getGroupFromLink(inviteLinkPassword, options),
  });

  const approvalRequired =
    preJoinInfo.addFromInviteLink ===
    Proto.AccessControl.AccessRequired.ADMINISTRATOR;

  // If the group doesn't require approval to join via link, then we should never have
  //   gotten here.
  if (!approvalRequired) {
    return generateLeftGroupChanges(group);
  }

  const newAttributes: ConversationAttributesType = {
    ...group,
    description: decryptGroupDescription(
      preJoinInfo.descriptionBytes,
      secretParams
    ),
    name: decryptGroupTitle(preJoinInfo.title, secretParams),
    members: [],
    pendingMembersV2: [],
    pendingAdminApprovalV2: [
      {
        uuid: ourACI,
        timestamp: Date.now(),
      },
    ],
    revision: preJoinInfo.version,

    temporaryMemberCount: preJoinInfo.memberCount || 1,
  };

  await applyNewAvatar(dropNull(preJoinInfo.avatar), newAttributes, logId);

  return {
    newAttributes,
    groupChangeMessages: extractDiffs({
      old: group,
      current: newAttributes,
      dropInitialJoinMessage: false,
    }),
    members: [],
  };
}

async function updateGroupViaState({
  dropInitialJoinMessage,
  group,
}: {
  dropInitialJoinMessage?: boolean;
  group: ConversationAttributesType;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  const { publicParams, secretParams } = group;
  if (!secretParams) {
    throw new Error('updateGroupViaState: group was missing secretParams!');
  }
  if (!publicParams) {
    throw new Error('updateGroupViaState: group was missing publicParams!');
  }

  const groupState = await makeRequestWithTemporalRetry({
    logId: `getGroup/${logId}`,
    publicParams,
    secretParams,
    request: (sender, requestOptions) => sender.getGroup(requestOptions),
  });

  const decryptedGroupState = decryptGroupState(
    groupState,
    secretParams,
    logId
  );

  const oldVersion = group.revision;
  const newVersion = decryptedGroupState.version;
  log.info(
    `getCurrentGroupState/${logId}: Applying full group state, from version ${oldVersion} to ${newVersion}.`
  );
  const { newAttributes, newProfileKeys } = await applyGroupState({
    group,
    groupState: decryptedGroupState,
  });

  return {
    newAttributes,
    groupChangeMessages: extractDiffs({
      old: group,
      current: newAttributes,
      dropInitialJoinMessage,
    }),
    members: profileKeysToMembers(newProfileKeys),
  };
}

async function updateGroupViaSingleChange({
  group,
  groupChange,
  newRevision,
}: {
  group: ConversationAttributesType;
  groupChange: Proto.IGroupChange;
  newRevision: number;
}): Promise<UpdatesResultType> {
  const wasInGroup = !group.left;
  const result: UpdatesResultType = await integrateGroupChange({
    group,
    groupChange,
    newRevision,
  });

  const nowInGroup = !result.newAttributes.left;

  // If we were just added to the group (for example, via a join link), we go fetch the
  //   entire group state to make sure we're up to date.
  if (!wasInGroup && nowInGroup) {
    const { newAttributes, members } = await updateGroupViaState({
      group: result.newAttributes,
    });

    // We discard any change events that come out of this full group fetch, but we do
    //   keep the final group attributes generated, as well as any new members.
    return {
      ...result,
      members: [...result.members, ...members],
      newAttributes,
    };
  }

  return result;
}

async function updateGroupViaLogs({
  group,
  newRevision,
}: {
  group: ConversationAttributesType;
  newRevision: number | undefined;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  const { publicParams, secretParams } = group;
  if (!publicParams) {
    throw new Error('updateGroupViaLogs: group was missing publicParams!');
  }
  if (!secretParams) {
    throw new Error('updateGroupViaLogs: group was missing secretParams!');
  }

  log.info(
    `updateGroupViaLogs/${logId}: Getting group delta from ` +
      `${group.revision ?? '?'} to ${newRevision ?? '?'} for group ` +
      `groupv2(${group.groupId})...`
  );

  const currentRevision = group.revision;
  let includeFirstState = true;

  // The range is inclusive so make sure that we always request the revision
  // that we are currently at since we might want the latest full state in
  // `integrateGroupChanges`.
  let revisionToFetch = isNumber(currentRevision) ? currentRevision : undefined;

  let response;
  const changes: Array<Proto.IGroupChanges> = [];
  do {
    // eslint-disable-next-line no-await-in-loop
    response = await makeRequestWithTemporalRetry({
      logId: `getGroupLog/${logId}`,
      publicParams,
      secretParams,

      // eslint-disable-next-line no-loop-func
      request: (sender, requestOptions) =>
        sender.getGroupLog(
          {
            startVersion: revisionToFetch,
            includeFirstState,
            includeLastState: true,
            maxSupportedChangeEpoch: SUPPORTED_CHANGE_EPOCH,
          },
          requestOptions
        ),
    });

    changes.push(response.changes);
    if (response.end) {
      revisionToFetch = response.end + 1;
    }

    includeFirstState = false;
  } while (
    response.end &&
    (newRevision === undefined || response.end < newRevision)
  );

  // Would be nice to cache the unused groupChanges here, to reduce server roundtrips

  return integrateGroupChanges({
    changes,
    group,
    newRevision,
  });
}

async function generateLeftGroupChanges(
  group: ConversationAttributesType
): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  log.info(`generateLeftGroupChanges/${logId}: Starting...`);
  const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI).toString();
  const ourPNI = window.storage.user.getCheckedUuid(UUIDKind.PNI)?.toString();

  const { masterKey, groupInviteLinkPassword } = group;
  let { revision } = group;

  try {
    if (masterKey && groupInviteLinkPassword) {
      log.info(
        `generateLeftGroupChanges/${logId}: Have invite link. Attempting to fetch latest revision with it.`
      );
      const preJoinInfo = await getPreJoinGroupInfo(
        groupInviteLinkPassword,
        masterKey
      );

      revision = preJoinInfo.version;
    }
  } catch (error) {
    log.warn(
      'generateLeftGroupChanges: Failed to fetch latest revision via group link. Code:',
      error.code
    );
  }

  const newAttributes: ConversationAttributesType = {
    ...group,
    addedBy: undefined,
    membersV2: (group.membersV2 || []).filter(member => member.uuid !== ourACI),
    pendingMembersV2: (group.pendingMembersV2 || []).filter(
      member => member.uuid !== ourACI && member.uuid !== ourPNI
    ),
    pendingAdminApprovalV2: (group.pendingAdminApprovalV2 || []).filter(
      member => member.uuid !== ourACI
    ),
    left: true,
    revision,
  };

  return {
    newAttributes,
    groupChangeMessages: extractDiffs({
      current: newAttributes,
      old: group,
    }),
    members: [],
  };
}

function getGroupCredentials({
  authCredentialBase64,
  groupPublicParamsBase64,
  groupSecretParamsBase64,
  serverPublicParamsBase64,
}: {
  authCredentialBase64: string;
  groupPublicParamsBase64: string;
  groupSecretParamsBase64: string;
  serverPublicParamsBase64: string;
}): GroupCredentialsType {
  const authOperations = getClientZkAuthOperations(serverPublicParamsBase64);

  const presentation = getAuthCredentialPresentation(
    authOperations,
    authCredentialBase64,
    groupSecretParamsBase64
  );

  return {
    groupPublicParamsHex: Bytes.toHex(
      Bytes.fromBase64(groupPublicParamsBase64)
    ),
    authCredentialPresentationHex: Bytes.toHex(presentation),
  };
}

async function integrateGroupChanges({
  group,
  newRevision,
  changes,
}: {
  group: ConversationAttributesType;
  newRevision: number | undefined;
  changes: Array<Proto.IGroupChanges>;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  let attributes = group;
  const finalMessages: Array<Array<GroupChangeMessageType>> = [];
  const finalMembers: Array<Array<MemberType>> = [];

  const imax = changes.length;
  for (let i = 0; i < imax; i += 1) {
    const { groupChanges } = changes[i];

    if (!groupChanges) {
      continue;
    }

    const jmax = groupChanges.length;
    for (let j = 0; j < jmax; j += 1) {
      const changeState = groupChanges[j];

      const { groupChange, groupState } = changeState;

      if (!groupChange && !groupState) {
        log.warn(
          'integrateGroupChanges: item had neither groupState nor groupChange. Skipping.'
        );
        continue;
      }

      try {
        const {
          newAttributes,
          groupChangeMessages,
          members,
          // eslint-disable-next-line no-await-in-loop
        } = await integrateGroupChange({
          group: attributes,
          newRevision,
          groupChange: dropNull(groupChange),
          groupState: dropNull(groupState),
        });

        attributes = newAttributes;
        finalMessages.push(groupChangeMessages);
        finalMembers.push(members);
      } catch (error) {
        log.error(
          `integrateGroupChanges/${logId}: Failed to apply change log, continuing to apply remaining change logs.`,
          error && error.stack ? error.stack : error
        );
      }
    }
  }

  // If this is our first fetch, we will collapse this down to one set of messages
  const isFirstFetch = !isNumber(group.revision);
  if (isFirstFetch) {
    // The first array in finalMessages is from the first revision we could process. It
    //   should contain a message about how we joined the group.
    const joinMessages = finalMessages[0];
    const alreadyHaveJoinMessage = joinMessages && joinMessages.length > 0;

    // There have been other changes since that first revision, so we generate diffs for
    //   the whole of the change since then, likely without the initial join message.
    const otherMessages = extractDiffs({
      old: group,
      current: attributes,
      dropInitialJoinMessage: alreadyHaveJoinMessage,
    });

    const groupChangeMessages = alreadyHaveJoinMessage
      ? [joinMessages[0], ...otherMessages]
      : otherMessages;

    return {
      newAttributes: attributes,
      groupChangeMessages,
      members: flatten(finalMembers),
    };
  }

  return {
    newAttributes: attributes,
    groupChangeMessages: flatten(finalMessages),
    members: flatten(finalMembers),
  };
}

async function integrateGroupChange({
  group,
  groupChange,
  groupState,
  newRevision,
}: {
  group: ConversationAttributesType;
  groupChange?: Proto.IGroupChange;
  groupState?: Proto.IGroup;
  newRevision: number | undefined;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  if (!group.secretParams) {
    throw new Error(
      `integrateGroupChange/${logId}: Group was missing secretParams!`
    );
  }

  if (!groupChange && !groupState) {
    throw new Error(
      `integrateGroupChange/${logId}: Neither groupChange nor groupState received!`
    );
  }

  const isFirstFetch = !isNumber(group.revision);
  const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI);
  const ourPNI = window.storage.user.getUuid(UUIDKind.PNI);
  const weAreAwaitingApproval = (group.pendingAdminApprovalV2 || []).find(
    item =>
      item.uuid === ourACI.toString() ||
      (ourPNI && item.uuid === ourPNI.toString())
  );

  // These need to be populated from the groupChange. But we might not get one!
  let isChangeSupported = false;
  let isSameVersion = false;
  let isMoreThanOneVersionUp = false;
  let groupChangeActions: undefined | Proto.GroupChange.IActions;
  let decryptedChangeActions: undefined | DecryptedGroupChangeActions;
  let sourceUuid: undefined | UUIDStringType;

  if (groupChange) {
    groupChangeActions = Proto.GroupChange.Actions.decode(
      groupChange.actions || new Uint8Array(0)
    );

    // Version is higher that what we have in the incoming message
    if (
      groupChangeActions.version &&
      newRevision !== undefined &&
      groupChangeActions.version > newRevision
    ) {
      log.info(
        `integrateGroupChange/${logId}: Skipping ` +
          `${groupChangeActions.version}, newRevision is ${newRevision}`
      );
      return {
        newAttributes: group,
        groupChangeMessages: [],
        members: [],
      };
    }

    decryptedChangeActions = decryptGroupChange(
      groupChangeActions,
      group.secretParams,
      logId
    );

    strictAssert(
      decryptedChangeActions !== undefined,
      'Should have decrypted group actions'
    );
    ({ sourceUuid } = decryptedChangeActions);
    strictAssert(sourceUuid, 'Should have source UUID');

    isChangeSupported =
      !isNumber(groupChange.changeEpoch) ||
      groupChange.changeEpoch <= SUPPORTED_CHANGE_EPOCH;

    // Version is lower or the same as what we currently have
    if (group.revision !== undefined && groupChangeActions.version) {
      if (groupChangeActions.version < group.revision) {
        log.info(
          `integrateGroupChange/${logId}: Skipping stale version` +
            `${groupChangeActions.version}, current ` +
            `revision is ${group.revision}`
        );
        return {
          newAttributes: group,
          groupChangeMessages: [],
          members: [],
        };
      }
      if (groupChangeActions.version === group.revision) {
        isSameVersion = true;
      } else if (
        groupChangeActions.version !== group.revision + 1 ||
        (!isNumber(group.revision) && groupChangeActions.version > 0)
      ) {
        isMoreThanOneVersionUp = true;
      }
    }
  }

  let attributes = group;
  const aggregatedChangeMessages = [];
  const aggregatedMembers = [];

  const canApplyChange =
    groupChange &&
    isChangeSupported &&
    !isSameVersion &&
    !isFirstFetch &&
    (!isMoreThanOneVersionUp || weAreAwaitingApproval);

  // Apply the change first
  if (canApplyChange) {
    if (!sourceUuid || !groupChangeActions || !decryptedChangeActions) {
      throw new Error(
        `integrateGroupChange/${logId}: Missing necessary information that should have come from group actions`
      );
    }

    log.info(
      `integrateGroupChange/${logId}: Applying group change actions, ` +
        `from version ${group.revision} to ${groupChangeActions.version}`
    );

    const { newAttributes, newProfileKeys } = await applyGroupChange({
      group,
      actions: decryptedChangeActions,
      sourceUuid,
    });

    const groupChangeMessages = extractDiffs({
      old: attributes,
      current: newAttributes,
      sourceUuid,
    });

    attributes = newAttributes;
    aggregatedChangeMessages.push(groupChangeMessages);
    aggregatedMembers.push(profileKeysToMembers(newProfileKeys));
  }

  // Apply the group state afterwards to verify that we didn't miss anything
  if (groupState) {
    log.info(
      `integrateGroupChange/${logId}: Applying full group state, ` +
        `from version ${group.revision} to ${groupState.version}`,
      {
        isChangePresent: Boolean(groupChange),
        isChangeSupported,
        isFirstFetch,
        isSameVersion,
        isMoreThanOneVersionUp,
        weAreAwaitingApproval,
      }
    );

    const decryptedGroupState = decryptGroupState(
      groupState,
      group.secretParams,
      logId
    );

    const { newAttributes, newProfileKeys } = await applyGroupState({
      group: attributes,
      groupState: decryptedGroupState,
      sourceUuid: isFirstFetch ? sourceUuid : undefined,
    });

    const groupChangeMessages = extractDiffs({
      old: attributes,
      current: newAttributes,
      sourceUuid: isFirstFetch ? sourceUuid : undefined,
    });

    const newMembers = profileKeysToMembers(newProfileKeys);

    if (
      canApplyChange &&
      (groupChangeMessages.length !== 0 || newMembers.length !== 0)
    ) {
      assert(
        groupChangeMessages.length === 0,
        'Fallback group state processing should not kick in'
      );

      log.warn(
        `integrateGroupChange/${logId}: local state was different from ` +
          'the remote final state. ' +
          `Got ${groupChangeMessages.length} change messages, and ` +
          `${newMembers.length} updated members`
      );
    }

    attributes = newAttributes;
    aggregatedChangeMessages.push(groupChangeMessages);
    aggregatedMembers.push(newMembers);
  } else {
    strictAssert(
      canApplyChange,
      `integrateGroupChange/${logId}: No group state, but we can't apply changes!`
    );
  }

  return {
    newAttributes: attributes,
    groupChangeMessages: aggregatedChangeMessages.flat(),
    members: aggregatedMembers.flat(),
  };
}

function extractDiffs({
  current,
  dropInitialJoinMessage,
  old,
  sourceUuid,
}: {
  current: ConversationAttributesType;
  dropInitialJoinMessage?: boolean;
  old: ConversationAttributesType;
  sourceUuid?: UUIDStringType;
}): Array<GroupChangeMessageType> {
  const logId = idForLogging(old.groupId);
  const details: Array<GroupV2ChangeDetailType> = [];
  const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI);
  const ourPNI = window.storage.user.getUuid(UUIDKind.PNI);
  const ACCESS_ENUM = Proto.AccessControl.AccessRequired;

  let areWeInGroup = false;
  let uuidKindInvitedToGroup: UUIDKind | undefined;
  let areWePendingApproval = false;
  let whoInvitedUsUserId = null;

  // access control

  if (
    current.accessControl &&
    old.accessControl &&
    old.accessControl.attributes !== undefined &&
    old.accessControl.attributes !== current.accessControl.attributes
  ) {
    details.push({
      type: 'access-attributes',
      newPrivilege: current.accessControl.attributes,
    });
  }
  if (
    current.accessControl &&
    old.accessControl &&
    old.accessControl.members !== undefined &&
    old.accessControl.members !== current.accessControl.members
  ) {
    details.push({
      type: 'access-members',
      newPrivilege: current.accessControl.members,
    });
  }

  const linkPreviouslyEnabled = isAccessControlEnabled(
    old.accessControl?.addFromInviteLink
  );
  const linkCurrentlyEnabled = isAccessControlEnabled(
    current.accessControl?.addFromInviteLink
  );

  if (!linkPreviouslyEnabled && linkCurrentlyEnabled) {
    details.push({
      type: 'group-link-add',
      privilege: current.accessControl?.addFromInviteLink || ACCESS_ENUM.ANY,
    });
  } else if (linkPreviouslyEnabled && !linkCurrentlyEnabled) {
    details.push({
      type: 'group-link-remove',
    });
  } else if (
    linkPreviouslyEnabled &&
    linkCurrentlyEnabled &&
    old.accessControl?.addFromInviteLink !==
      current.accessControl?.addFromInviteLink
  ) {
    details.push({
      type: 'access-invite-link',
      newPrivilege: current.accessControl?.addFromInviteLink || ACCESS_ENUM.ANY,
    });
  }

  // avatar

  if (
    Boolean(old.avatar) !== Boolean(current.avatar) ||
    old.avatar?.hash !== current.avatar?.hash
  ) {
    details.push({
      type: 'avatar',
      removed: !current.avatar,
    });
  }

  // name

  if (old.name !== current.name) {
    details.push({
      type: 'title',
      newTitle: current.name,
    });
  }

  // groupInviteLinkPassword

  // Note: we only capture link resets here. Enable/disable are controlled by the
  //   accessControl.addFromInviteLink
  if (
    old.groupInviteLinkPassword &&
    current.groupInviteLinkPassword &&
    old.groupInviteLinkPassword !== current.groupInviteLinkPassword
  ) {
    details.push({
      type: 'group-link-reset',
    });
  }

  // description
  if (old.description !== current.description) {
    details.push({
      type: 'description',
      removed: !current.description,
      description: current.description,
    });
  }

  // No disappearing message timer check here - see below

  // membersV2

  const oldMemberLookup = new Map<UUIDStringType, GroupV2MemberType>(
    (old.membersV2 || []).map(member => [member.uuid, member])
  );
  const oldPendingMemberLookup = new Map<
    UUIDStringType,
    GroupV2PendingMemberType
  >((old.pendingMembersV2 || []).map(member => [member.uuid, member]));
  const oldPendingAdminApprovalLookup = new Map<
    UUIDStringType,
    GroupV2PendingAdminApprovalType
  >((old.pendingAdminApprovalV2 || []).map(member => [member.uuid, member]));
  const currentPendingMemberSet = new Set<UUIDStringType>(
    (current.pendingMembersV2 || []).map(member => member.uuid)
  );

  (current.membersV2 || []).forEach(currentMember => {
    const { uuid } = currentMember;
    const isUs = uuid === ourACI.toString();

    if (isUs) {
      areWeInGroup = true;
    }

    const oldMember = oldMemberLookup.get(uuid);
    if (!oldMember) {
      let pendingMember = oldPendingMemberLookup.get(uuid);
      if (isUs && ourPNI && !pendingMember) {
        pendingMember = oldPendingMemberLookup.get(ourPNI.toString());
      }
      if (pendingMember) {
        details.push({
          type: 'member-add-from-invite',
          uuid,
          inviter: pendingMember.addedByUserId,
        });
      } else if (currentMember.joinedFromLink) {
        details.push({
          type: 'member-add-from-link',
          uuid,
        });
      } else if (currentMember.approvedByAdmin) {
        details.push({
          type: 'member-add-from-admin-approval',
          uuid,
        });
      } else {
        details.push({
          type: 'member-add',
          uuid,
        });
      }
    } else if (oldMember.role !== currentMember.role) {
      details.push({
        type: 'member-privilege',
        uuid,
        newPrivilege: currentMember.role,
      });
    }

    // We don't want to generate an admin-approval-remove event for this newly-added
    //   member. But we don't know for sure if this is an admin approval; for that we
    //   consulted the approvedByAdmin flag saved on the member.
    oldPendingAdminApprovalLookup.delete(uuid);

    // If we capture a pending remove here, it's an 'accept invitation', and we don't
    //   want to generate a pending-remove event for it
    oldPendingMemberLookup.delete(uuid);

    // This deletion makes it easier to capture removals
    oldMemberLookup.delete(uuid);

    // Our ACI just joined (wasn't a member before) and our PNI disappeared
    // from the invite list. Treat this as a promotion from PNI to ACI and
    // pretend that the PNI wasn't pending so that we won't generate a
    // pending-add-one notification below.
    if (
      isUs &&
      ourPNI &&
      !oldMember &&
      oldPendingMemberLookup.has(ourPNI.toString()) &&
      !currentPendingMemberSet.has(ourPNI.toString())
    ) {
      oldPendingMemberLookup.delete(ourPNI.toString());
    }
  });

  const removedMemberIds = Array.from(oldMemberLookup.keys());
  removedMemberIds.forEach(uuid => {
    details.push({
      type: 'member-remove',
      uuid,
    });
  });

  // pendingMembersV2

  let lastPendingUuid: UUIDStringType | undefined;
  let pendingCount = 0;
  (current.pendingMembersV2 || []).forEach(currentPendingMember => {
    const { uuid } = currentPendingMember;
    const oldPendingMember = oldPendingMemberLookup.get(uuid);

    if (uuid === ourACI.toString() || uuid === ourPNI?.toString()) {
      if (uuid === ourACI.toString()) {
        uuidKindInvitedToGroup = UUIDKind.ACI;
      } else if (uuidKindInvitedToGroup === undefined) {
        uuidKindInvitedToGroup = UUIDKind.PNI;
      }

      whoInvitedUsUserId = currentPendingMember.addedByUserId;
    }

    if (!oldPendingMember) {
      lastPendingUuid = uuid;
      pendingCount += 1;
    }

    // This deletion makes it easier to capture removals
    oldPendingMemberLookup.delete(uuid);
  });

  if (pendingCount > 1) {
    details.push({
      type: 'pending-add-many',
      count: pendingCount,
    });
  } else if (pendingCount === 1) {
    if (lastPendingUuid) {
      details.push({
        type: 'pending-add-one',
        uuid: lastPendingUuid,
      });
    } else {
      log.warn(
        `extractDiffs/${logId}: pendingCount was 1, no last conversationId available`
      );
    }
  }

  // Note: The only members left over here should be people who were moved from the
  //   pending list but also not added to the group at the same time.
  const removedPendingMemberIds = Array.from(oldPendingMemberLookup.keys());
  if (removedPendingMemberIds.length > 1) {
    const firstUuid = removedPendingMemberIds[0];
    const firstRemovedMember = oldPendingMemberLookup.get(firstUuid);
    strictAssert(
      firstRemovedMember !== undefined,
      'First removed member not found'
    );
    const inviter = firstRemovedMember.addedByUserId;
    const allSameInviter = removedPendingMemberIds.every(
      id => oldPendingMemberLookup.get(id)?.addedByUserId === inviter
    );
    details.push({
      type: 'pending-remove-many',
      count: removedPendingMemberIds.length,
      inviter: allSameInviter ? inviter : undefined,
    });
  } else if (removedPendingMemberIds.length === 1) {
    const uuid = removedPendingMemberIds[0];
    const removedMember = oldPendingMemberLookup.get(uuid);
    strictAssert(removedMember !== undefined, 'Removed member not found');

    details.push({
      type: 'pending-remove-one',
      uuid,
      inviter: removedMember.addedByUserId,
    });
  }

  // pendingAdminApprovalV2

  (current.pendingAdminApprovalV2 || []).forEach(
    currentPendingAdminAprovalMember => {
      const { uuid } = currentPendingAdminAprovalMember;
      const oldPendingMember = oldPendingAdminApprovalLookup.get(uuid);

      if (uuid === ourACI.toString()) {
        areWePendingApproval = true;
      }

      if (!oldPendingMember) {
        details.push({
          type: 'admin-approval-add-one',
          uuid,
        });
      }

      // This deletion makes it easier to capture removals
      oldPendingAdminApprovalLookup.delete(uuid);
    }
  );

  // Note: The only members left over here should be people who were moved from the
  //   pendingAdminApproval list but also not added to the group at the same time.
  const removedPendingAdminApprovalIds = Array.from(
    oldPendingAdminApprovalLookup.keys()
  );
  removedPendingAdminApprovalIds.forEach(uuid => {
    details.push({
      type: 'admin-approval-remove-one',
      uuid,
    });
  });

  // announcementsOnly

  if (Boolean(old.announcementsOnly) !== Boolean(current.announcementsOnly)) {
    details.push({
      type: 'announcements-only',
      announcementsOnly: Boolean(current.announcementsOnly),
    });
  }

  // Note: currently no diff generated for bannedMembersV2 changes

  // final processing

  let message: GroupChangeMessageType | undefined;
  let timerNotification: GroupChangeMessageType | undefined;

  const firstUpdate = !isNumber(old.revision);
  const isFromUs = ourACI.toString() === sourceUuid;

  // Here we hardcode initial messages if this is our first time processing data this
  //   group. Ideally we can collapse it down to just one of: 'you were added',
  //   'you were invited', or 'you created.'
  if (firstUpdate && uuidKindInvitedToGroup !== undefined) {
    // Note, we will add 'you were invited' to group even if dropInitialJoinMessage = true
    message = {
      ...generateBasicMessage(),
      type: 'group-v2-change',
      groupV2Change: {
        from: whoInvitedUsUserId || sourceUuid,
        details: [
          {
            type: 'pending-add-one',
            uuid: window.storage.user
              .getCheckedUuid(uuidKindInvitedToGroup)
              .toString(),
          },
        ],
      },
      readStatus: ReadStatus.Read,
      seenStatus: isFromUs ? SeenStatus.Seen : SeenStatus.Unseen,
    };
  } else if (firstUpdate && areWePendingApproval) {
    message = {
      ...generateBasicMessage(),
      type: 'group-v2-change',
      groupV2Change: {
        from: ourACI.toString(),
        details: [
          {
            type: 'admin-approval-add-one',
            uuid: ourACI.toString(),
          },
        ],
      },
    };
  } else if (firstUpdate && dropInitialJoinMessage) {
    // None of the rest of the messages should be added if dropInitialJoinMessage = true
    message = undefined;
  } else if (
    firstUpdate &&
    current.revision === 0 &&
    sourceUuid === ourACI.toString()
  ) {
    message = {
      ...generateBasicMessage(),
      type: 'group-v2-change',
      groupV2Change: {
        from: sourceUuid,
        details: [
          {
            type: 'create',
          },
        ],
      },
      readStatus: ReadStatus.Read,
      seenStatus: isFromUs ? SeenStatus.Seen : SeenStatus.Unseen,
    };
  } else if (firstUpdate && areWeInGroup) {
    message = {
      ...generateBasicMessage(),
      type: 'group-v2-change',
      groupV2Change: {
        from: sourceUuid,
        details: [
          {
            type: 'member-add',
            uuid: ourACI.toString(),
          },
        ],
      },
      readStatus: ReadStatus.Read,
      seenStatus: isFromUs ? SeenStatus.Seen : SeenStatus.Unseen,
    };
  } else if (firstUpdate && current.revision === 0) {
    message = {
      ...generateBasicMessage(),
      type: 'group-v2-change',
      groupV2Change: {
        from: sourceUuid,
        details: [
          {
            type: 'create',
          },
        ],
      },
      readStatus: ReadStatus.Read,
      seenStatus: isFromUs ? SeenStatus.Seen : SeenStatus.Unseen,
    };
  } else if (details.length > 0) {
    message = {
      ...generateBasicMessage(),
      type: 'group-v2-change',
      sourceUuid,
      groupV2Change: {
        from: sourceUuid,
        details,
      },
      readStatus: ReadStatus.Read,
      seenStatus: isFromUs ? SeenStatus.Seen : SeenStatus.Unseen,
    };
  }

  // This is checked differently, because it needs to be its own entry in the timeline,
  //   with its own icon, etc.
  if (
    // Turn on or turned off
    Boolean(old.expireTimer) !== Boolean(current.expireTimer) ||
    // Still on, but changed value
    (Boolean(old.expireTimer) &&
      Boolean(current.expireTimer) &&
      old.expireTimer !== current.expireTimer)
  ) {
    timerNotification = {
      ...generateBasicMessage(),
      type: 'timer-notification',
      sourceUuid,
      flags: Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      expirationTimerUpdate: {
        expireTimer: current.expireTimer || 0,
        sourceUuid,
      },
    };
  }

  const result = compact([message, timerNotification]);

  log.info(
    `extractDiffs/${logId} complete, generated ${result.length} change messages`
  );

  return result;
}

function profileKeysToMembers(items: Array<GroupChangeMemberType>) {
  return items.map(item => ({
    profileKey: Bytes.toBase64(item.profileKey),
    uuid: item.uuid,
  }));
}

type GroupChangeMemberType = {
  profileKey: Uint8Array;
  uuid: UUIDStringType;
};
type GroupApplyResultType = {
  newAttributes: ConversationAttributesType;
  newProfileKeys: Array<GroupChangeMemberType>;
};

async function applyGroupChange({
  actions,
  group,
  sourceUuid,
}: {
  actions: DecryptedGroupChangeActions;
  group: ConversationAttributesType;
  sourceUuid: UUIDStringType;
}): Promise<GroupApplyResultType> {
  const logId = idForLogging(group.groupId);
  const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI).toString();

  const ACCESS_ENUM = Proto.AccessControl.AccessRequired;
  const MEMBER_ROLE_ENUM = Proto.Member.Role;

  const version = actions.version || 0;
  const result = { ...group };
  const newProfileKeys: Array<GroupChangeMemberType> = [];

  const members: Record<UUIDStringType, GroupV2MemberType> = fromPairs(
    (result.membersV2 || []).map(member => [member.uuid, member])
  );
  const pendingMembers: Record<UUIDStringType, GroupV2PendingMemberType> =
    fromPairs(
      (result.pendingMembersV2 || []).map(member => [member.uuid, member])
    );
  const pendingAdminApprovalMembers: Record<
    UUIDStringType,
    GroupV2PendingAdminApprovalType
  > = fromPairs(
    (result.pendingAdminApprovalV2 || []).map(member => [member.uuid, member])
  );
  const bannedMembers = new Map<UUIDStringType, GroupV2BannedMemberType>(
    (result.bannedMembersV2 || []).map(member => [member.uuid, member])
  );

  // version?: number;
  result.revision = version;

  // addMembers?: Array<GroupChange.Actions.AddMemberAction>;
  (actions.addMembers || []).forEach(addMember => {
    const { added } = addMember;
    if (!added || !added.userId) {
      throw new Error('applyGroupChange: addMember.added is missing');
    }

    const addedUuid = UUID.cast(added.userId);

    if (members[addedUuid]) {
      log.warn(
        `applyGroupChange/${logId}: Attempt to add member failed; already in members.`
      );
      return;
    }

    members[addedUuid] = {
      uuid: addedUuid,
      role: added.role || MEMBER_ROLE_ENUM.DEFAULT,
      joinedAtVersion: version,
      joinedFromLink: addMember.joinFromInviteLink || false,
    };

    if (pendingMembers[addedUuid]) {
      log.warn(
        `applyGroupChange/${logId}: Removing newly-added member from pendingMembers.`
      );
      delete pendingMembers[addedUuid];
    }

    // Capture who added us
    if (ourACI && sourceUuid && addedUuid === ourACI) {
      result.addedBy = sourceUuid;
    }

    if (added.profileKey) {
      newProfileKeys.push({
        profileKey: added.profileKey,
        uuid: UUID.cast(added.userId),
      });
    }
  });

  // deleteMembers?: Array<GroupChange.Actions.DeleteMemberAction>;
  (actions.deleteMembers || []).forEach(deleteMember => {
    const { deletedUserId } = deleteMember;
    if (!deletedUserId) {
      throw new Error(
        'applyGroupChange: deleteMember.deletedUserId is missing'
      );
    }

    const deletedUuid = UUID.cast(deletedUserId);
    if (members[deletedUuid]) {
      delete members[deletedUuid];
    } else {
      log.warn(
        `applyGroupChange/${logId}: Attempt to remove member failed; was not in members.`
      );
    }
  });

  // modifyMemberRoles?: Array<GroupChange.Actions.ModifyMemberRoleAction>;
  (actions.modifyMemberRoles || []).forEach(modifyMemberRole => {
    const { role, userId } = modifyMemberRole;
    if (!role || !userId) {
      throw new Error('applyGroupChange: modifyMemberRole had a missing value');
    }

    const userUuid = UUID.cast(userId);
    if (members[userUuid]) {
      members[userUuid] = {
        ...members[userUuid],
        role,
      };
    } else {
      throw new Error(
        'applyGroupChange: modifyMemberRole tried to modify nonexistent member'
      );
    }
  });

  // modifyMemberProfileKeys?:
  // Array<GroupChange.Actions.ModifyMemberProfileKeyAction>;
  (actions.modifyMemberProfileKeys || []).forEach(modifyMemberProfileKey => {
    const { profileKey, uuid } = modifyMemberProfileKey;
    if (!profileKey || !uuid) {
      throw new Error(
        'applyGroupChange: modifyMemberProfileKey had a missing value'
      );
    }

    newProfileKeys.push({
      profileKey,
      uuid: UUID.cast(uuid),
    });
  });

  // addPendingMembers?: Array<
  //   GroupChange.Actions.AddMemberPendingProfileKeyAction
  // >;
  (actions.addPendingMembers || []).forEach(addPendingMember => {
    const { added } = addPendingMember;
    if (!added || !added.member || !added.member.userId) {
      throw new Error(
        'applyGroupChange: addPendingMembers had a missing value'
      );
    }

    const addedUuid = UUID.cast(added.member.userId);

    if (members[addedUuid]) {
      log.warn(
        `applyGroupChange/${logId}: Attempt to add pendingMember failed; was already in members.`
      );
      return;
    }
    if (pendingMembers[addedUuid]) {
      log.warn(
        `applyGroupChange/${logId}: Attempt to add pendingMember failed; was already in pendingMembers.`
      );
      return;
    }

    pendingMembers[addedUuid] = {
      uuid: addedUuid,
      addedByUserId: UUID.cast(added.addedByUserId),
      timestamp: added.timestamp,
      role: added.member.role || MEMBER_ROLE_ENUM.DEFAULT,
    };

    if (added.member && added.member.profileKey) {
      newProfileKeys.push({
        profileKey: added.member.profileKey,
        uuid: addedUuid,
      });
    }
  });

  // deletePendingMembers?: Array<
  //   GroupChange.Actions.DeleteMemberPendingProfileKeyAction
  // >;
  (actions.deletePendingMembers || []).forEach(deletePendingMember => {
    const { deletedUserId } = deletePendingMember;
    if (!deletedUserId) {
      throw new Error(
        'applyGroupChange: deletePendingMember.deletedUserId is null!'
      );
    }

    const deletedUuid = UUID.cast(deletedUserId);

    if (pendingMembers[deletedUuid]) {
      delete pendingMembers[deletedUuid];
    } else {
      log.warn(
        `applyGroupChange/${logId}: Attempt to remove pendingMember failed; was not in pendingMembers.`
      );
    }
  });

  // promotePendingMembers?: Array<
  //   GroupChange.Actions.PromoteMemberPendingProfileKeyAction
  // >;
  (actions.promotePendingMembers || []).forEach(promotePendingMember => {
    const { profileKey, uuid: rawUuid } = promotePendingMember;
    if (!profileKey || !rawUuid) {
      throw new Error(
        'applyGroupChange: promotePendingMember had a missing value'
      );
    }

    const uuid = UUID.cast(rawUuid);
    const previousRecord = pendingMembers[uuid];

    if (pendingMembers[uuid]) {
      delete pendingMembers[uuid];
    } else {
      log.warn(
        `applyGroupChange/${logId}: Attempt to promote pendingMember failed; was not in pendingMembers.`
      );
    }

    if (members[uuid]) {
      log.warn(
        `applyGroupChange/${logId}: Attempt to promote pendingMember failed; was already in members.`
      );
      return;
    }

    members[uuid] = {
      uuid,
      joinedAtVersion: version,
      role: previousRecord.role || MEMBER_ROLE_ENUM.DEFAULT,
    };

    newProfileKeys.push({
      profileKey,
      uuid,
    });
  });

  // promoteMembersPendingPniAciProfileKey?: Array<
  //   GroupChange.Actions.PromoteMemberPendingPniAciProfileKeyAction
  // >;
  (actions.promoteMembersPendingPniAciProfileKey || []).forEach(
    promotePendingMember => {
      const { profileKey, aci, pni } = promotePendingMember;
      if (!profileKey || !aci || !pni) {
        throw new Error(
          'applyGroupChange: promotePendingMember had a missing value'
        );
      }

      const previousRecord = pendingMembers[pni];

      if (pendingMembers[pni]) {
        delete pendingMembers[pni];
      } else {
        log.warn(
          `applyGroupChange/${logId}: Attempt to promote pendingMember failed; was not in pendingMembers.`
        );
      }

      if (members[aci]) {
        log.warn(
          `applyGroupChange/${logId}: Attempt to promote pendingMember failed; was already in members.`
        );
        return;
      }

      members[aci] = {
        uuid: aci,
        joinedAtVersion: version,
        role: previousRecord.role || MEMBER_ROLE_ENUM.DEFAULT,
      };

      newProfileKeys.push({
        profileKey,
        uuid: aci,
      });
    }
  );

  // modifyTitle?: GroupChange.Actions.ModifyTitleAction;
  if (actions.modifyTitle) {
    const { title } = actions.modifyTitle;
    if (title && title.content === 'title') {
      result.name = dropNull(title.title);
    } else {
      log.warn(
        `applyGroupChange/${logId}: Clearing group title due to missing data.`
      );
      result.name = undefined;
    }
  }

  // modifyAvatar?: GroupChange.Actions.ModifyAvatarAction;
  if (actions.modifyAvatar) {
    const { avatar } = actions.modifyAvatar;
    await applyNewAvatar(dropNull(avatar), result, logId);
  }

  // modifyDisappearingMessagesTimer?:
  //   GroupChange.Actions.ModifyDisappearingMessagesTimerAction;
  if (actions.modifyDisappearingMessagesTimer) {
    const disappearingMessagesTimer: Proto.GroupAttributeBlob | undefined =
      actions.modifyDisappearingMessagesTimer.timer;
    if (
      disappearingMessagesTimer &&
      disappearingMessagesTimer.content === 'disappearingMessagesDuration'
    ) {
      result.expireTimer = dropNull(
        disappearingMessagesTimer.disappearingMessagesDuration
      );
    } else {
      log.warn(
        `applyGroupChange/${logId}: Clearing group expireTimer due to missing data.`
      );
      result.expireTimer = undefined;
    }
  }

  result.accessControl = result.accessControl || {
    members: ACCESS_ENUM.MEMBER,
    attributes: ACCESS_ENUM.MEMBER,
    addFromInviteLink: ACCESS_ENUM.UNSATISFIABLE,
  };

  // modifyAttributesAccess?:
  // GroupChange.Actions.ModifyAttributesAccessControlAction;
  if (actions.modifyAttributesAccess) {
    result.accessControl = {
      ...result.accessControl,
      attributes:
        actions.modifyAttributesAccess.attributesAccess || ACCESS_ENUM.MEMBER,
    };
  }

  // modifyMemberAccess?: GroupChange.Actions.ModifyMembersAccessControlAction;
  if (actions.modifyMemberAccess) {
    result.accessControl = {
      ...result.accessControl,
      members: actions.modifyMemberAccess.membersAccess || ACCESS_ENUM.MEMBER,
    };
  }

  // modifyAddFromInviteLinkAccess?:
  //   GroupChange.Actions.ModifyAddFromInviteLinkAccessControlAction;
  if (actions.modifyAddFromInviteLinkAccess) {
    result.accessControl = {
      ...result.accessControl,
      addFromInviteLink:
        actions.modifyAddFromInviteLinkAccess.addFromInviteLinkAccess ||
        ACCESS_ENUM.UNSATISFIABLE,
    };
  }

  // addMemberPendingAdminApprovals?: Array<
  //   GroupChange.Actions.AddMemberPendingAdminApprovalAction
  // >;
  (actions.addMemberPendingAdminApprovals || []).forEach(
    pendingAdminApproval => {
      const { added } = pendingAdminApproval;
      if (!added) {
        throw new Error(
          'applyGroupChange: modifyMemberProfileKey had a missing value'
        );
      }
      const addedUuid = UUID.cast(added.userId);

      if (members[addedUuid]) {
        log.warn(
          `applyGroupChange/${logId}: Attempt to add pending admin approval failed; was already in members.`
        );
        return;
      }
      if (pendingMembers[addedUuid]) {
        log.warn(
          `applyGroupChange/${logId}: Attempt to add pending admin approval failed; was already in pendingMembers.`
        );
        return;
      }
      if (pendingAdminApprovalMembers[addedUuid]) {
        log.warn(
          `applyGroupChange/${logId}: Attempt to add pending admin approval failed; was already in pendingAdminApprovalMembers.`
        );
        return;
      }

      pendingAdminApprovalMembers[addedUuid] = {
        uuid: addedUuid,
        timestamp: added.timestamp,
      };

      if (added.profileKey) {
        newProfileKeys.push({
          profileKey: added.profileKey,
          uuid: addedUuid,
        });
      }
    }
  );

  // deleteMemberPendingAdminApprovals?: Array<
  //   GroupChange.Actions.DeleteMemberPendingAdminApprovalAction
  // >;
  (actions.deleteMemberPendingAdminApprovals || []).forEach(
    deleteAdminApproval => {
      const { deletedUserId } = deleteAdminApproval;
      if (!deletedUserId) {
        throw new Error(
          'applyGroupChange: deleteAdminApproval.deletedUserId is null!'
        );
      }

      const deletedUuid = UUID.cast(deletedUserId);

      if (pendingAdminApprovalMembers[deletedUuid]) {
        delete pendingAdminApprovalMembers[deletedUuid];
      } else {
        log.warn(
          `applyGroupChange/${logId}: Attempt to remove pendingAdminApproval failed; was not in pendingAdminApprovalMembers.`
        );
      }
    }
  );

  // promoteMemberPendingAdminApprovals?: Array<
  //   GroupChange.Actions.PromoteMemberPendingAdminApprovalAction
  // >;
  (actions.promoteMemberPendingAdminApprovals || []).forEach(
    promoteAdminApproval => {
      const { userId, role } = promoteAdminApproval;
      if (!userId) {
        throw new Error(
          'applyGroupChange: promoteAdminApproval had a missing value'
        );
      }

      const userUuid = UUID.cast(userId);

      if (pendingAdminApprovalMembers[userUuid]) {
        delete pendingAdminApprovalMembers[userUuid];
      } else {
        log.warn(
          `applyGroupChange/${logId}: Attempt to promote pendingAdminApproval failed; was not in pendingAdminApprovalMembers.`
        );
      }
      if (pendingMembers[userUuid]) {
        delete pendingAdminApprovalMembers[userUuid];
        log.warn(
          `applyGroupChange/${logId}: Deleted pendingAdminApproval from pendingMembers.`
        );
      }

      if (members[userUuid]) {
        log.warn(
          `applyGroupChange/${logId}: Attempt to promote pendingMember failed; was already in members.`
        );
        return;
      }

      members[userUuid] = {
        uuid: userUuid,
        joinedAtVersion: version,
        role: role || MEMBER_ROLE_ENUM.DEFAULT,
        approvedByAdmin: true,
      };
    }
  );

  // modifyInviteLinkPassword?: GroupChange.Actions.ModifyInviteLinkPasswordAction;
  if (actions.modifyInviteLinkPassword) {
    const { inviteLinkPassword } = actions.modifyInviteLinkPassword;
    if (inviteLinkPassword) {
      result.groupInviteLinkPassword = inviteLinkPassword;
    } else {
      result.groupInviteLinkPassword = undefined;
    }
  }

  // modifyDescription?: GroupChange.Actions.ModifyDescriptionAction;
  if (actions.modifyDescription) {
    const { descriptionBytes } = actions.modifyDescription;
    if (descriptionBytes && descriptionBytes.content === 'descriptionText') {
      result.description = dropNull(descriptionBytes.descriptionText);
    } else {
      log.warn(
        `applyGroupChange/${logId}: Clearing group description due to missing data.`
      );
      result.description = undefined;
    }
  }

  if (actions.modifyAnnouncementsOnly) {
    const { announcementsOnly } = actions.modifyAnnouncementsOnly;
    result.announcementsOnly = announcementsOnly;
  }

  if (actions.addMembersBanned && actions.addMembersBanned.length > 0) {
    actions.addMembersBanned.forEach(member => {
      if (bannedMembers.has(member.uuid)) {
        log.warn(
          `applyGroupChange/${logId}: Attempt to add banned member failed; was already in banned list.`
        );
        return;
      }

      bannedMembers.set(member.uuid, member);
    });
  }

  if (actions.deleteMembersBanned && actions.deleteMembersBanned.length > 0) {
    actions.deleteMembersBanned.forEach(uuid => {
      if (!bannedMembers.has(uuid)) {
        log.warn(
          `applyGroupChange/${logId}: Attempt to remove banned member failed; was not in banned list.`
        );
        return;
      }

      bannedMembers.delete(uuid);
    });
  }

  if (ourACI) {
    result.left = !members[ourACI];
  }
  if (result.left) {
    result.addedBy = undefined;
  }

  // Go from lookups back to arrays
  result.membersV2 = values(members);
  result.pendingMembersV2 = values(pendingMembers);
  result.pendingAdminApprovalV2 = values(pendingAdminApprovalMembers);
  result.bannedMembersV2 = Array.from(bannedMembers.values());

  return {
    newAttributes: result,
    newProfileKeys,
  };
}

export async function decryptGroupAvatar(
  avatarKey: string,
  secretParamsBase64: string
): Promise<Uint8Array> {
  const sender = window.textsecure.messaging;
  if (!sender) {
    throw new Error(
      'decryptGroupAvatar: textsecure.messaging is not available!'
    );
  }

  const ciphertext = await sender.getGroupAvatar(avatarKey);
  const clientZkGroupCipher = getClientZkGroupCipher(secretParamsBase64);
  const plaintext = decryptGroupBlob(clientZkGroupCipher, ciphertext);
  const blob = Proto.GroupAttributeBlob.decode(plaintext);
  if (blob.content !== 'avatar') {
    throw new Error(
      `decryptGroupAvatar: Returned blob had incorrect content: ${blob.content}`
    );
  }

  const avatar = dropNull(blob.avatar);
  if (!avatar) {
    throw new Error('decryptGroupAvatar: Returned blob had no avatar set!');
  }

  return avatar;
}

// Ovewriting result.avatar as part of functionality
/* eslint-disable no-param-reassign */
export async function applyNewAvatar(
  newAvatar: string | undefined,
  result: Pick<ConversationAttributesType, 'avatar' | 'secretParams'>,
  logId: string
): Promise<void> {
  try {
    // Avatar has been dropped
    if (!newAvatar && result.avatar) {
      await window.Signal.Migrations.deleteAttachmentData(result.avatar.path);
      result.avatar = undefined;
    }

    // Group has avatar; has it changed?
    if (newAvatar && (!result.avatar || result.avatar.url !== newAvatar)) {
      if (!result.secretParams) {
        throw new Error('applyNewAvatar: group was missing secretParams!');
      }

      const data = await decryptGroupAvatar(newAvatar, result.secretParams);
      const hash = computeHash(data);

      if (result.avatar?.hash === hash) {
        log.info(
          `applyNewAvatar/${logId}: Hash is the same, but url was different. Saving new url.`
        );
        result.avatar = {
          ...result.avatar,
          url: newAvatar,
        };
        return;
      }

      if (result.avatar) {
        await window.Signal.Migrations.deleteAttachmentData(result.avatar.path);
      }

      const path = await window.Signal.Migrations.writeNewAttachmentData(data);
      result.avatar = {
        url: newAvatar,
        path,
        hash,
      };
    }
  } catch (error) {
    log.warn(
      `applyNewAvatar/${logId} Failed to handle avatar, clearing it`,
      error.stack
    );
    if (result.avatar && result.avatar.path) {
      await window.Signal.Migrations.deleteAttachmentData(result.avatar.path);
    }
    result.avatar = undefined;
  }
}
/* eslint-enable no-param-reassign */

async function applyGroupState({
  group,
  groupState,
  sourceUuid,
}: {
  group: ConversationAttributesType;
  groupState: DecryptedGroupState;
  sourceUuid?: UUIDStringType;
}): Promise<GroupApplyResultType> {
  const logId = idForLogging(group.groupId);
  const ACCESS_ENUM = Proto.AccessControl.AccessRequired;
  const MEMBER_ROLE_ENUM = Proto.Member.Role;
  const version = groupState.version || 0;
  const result = { ...group };
  const newProfileKeys: Array<GroupChangeMemberType> = [];

  // version
  result.revision = version;

  // title
  // Note: During decryption, title becomes a GroupAttributeBlob
  const { title } = groupState;
  if (title && title.content === 'title') {
    result.name = dropNull(title.title);
  } else {
    result.name = undefined;
  }

  // avatar
  await applyNewAvatar(dropNull(groupState.avatar), result, logId);

  // disappearingMessagesTimer
  // Note: during decryption, disappearingMessageTimer becomes a GroupAttributeBlob
  const { disappearingMessagesTimer } = groupState;
  if (
    disappearingMessagesTimer &&
    disappearingMessagesTimer.content === 'disappearingMessagesDuration'
  ) {
    result.expireTimer = dropNull(
      disappearingMessagesTimer.disappearingMessagesDuration
    );
  } else {
    result.expireTimer = undefined;
  }

  // accessControl
  const { accessControl } = groupState;
  result.accessControl = {
    attributes:
      (accessControl && accessControl.attributes) || ACCESS_ENUM.MEMBER,
    members: (accessControl && accessControl.members) || ACCESS_ENUM.MEMBER,
    addFromInviteLink:
      (accessControl && accessControl.addFromInviteLink) ||
      ACCESS_ENUM.UNSATISFIABLE,
  };

  // Optimization: we assume we have left the group unless we are found in members
  result.left = true;
  const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI).toString();

  // members
  const wasPreviouslyAMember = (result.membersV2 || []).some(
    item => item.uuid !== ourACI
  );
  if (groupState.members) {
    result.membersV2 = groupState.members.map(member => {
      if (member.userId === ourACI) {
        result.left = false;

        // Capture who added us if we were previously not in group
        if (
          sourceUuid &&
          !wasPreviouslyAMember &&
          isNumber(member.joinedAtVersion) &&
          member.joinedAtVersion === version
        ) {
          result.addedBy = sourceUuid;
        }
      }

      if (!isValidRole(member.role)) {
        throw new Error(
          `applyGroupState: Member had invalid role ${member.role}`
        );
      }

      if (member.profileKey) {
        newProfileKeys.push({
          profileKey: member.profileKey,
          uuid: UUID.cast(member.userId),
        });
      }

      return {
        role: member.role || MEMBER_ROLE_ENUM.DEFAULT,
        joinedAtVersion: member.joinedAtVersion || version,
        uuid: UUID.cast(member.userId),
      };
    });
  }

  // membersPendingProfileKey
  if (groupState.membersPendingProfileKey) {
    result.pendingMembersV2 = groupState.membersPendingProfileKey.map(
      member => {
        if (!member.member || !member.member.userId) {
          throw new Error(
            'applyGroupState: Member pending profile key did not have an associated userId'
          );
        }

        if (!member.addedByUserId) {
          throw new Error(
            'applyGroupState: Member pending profile key did not have an addedByUserID'
          );
        }

        if (!isValidRole(member.member.role)) {
          throw new Error(
            `applyGroupState: Member pending profile key had invalid role ${member.member.role}`
          );
        }

        if (member.member.profileKey) {
          newProfileKeys.push({
            profileKey: member.member.profileKey,
            uuid: UUID.cast(member.member.userId),
          });
        }

        return {
          addedByUserId: UUID.cast(member.addedByUserId),
          uuid: UUID.cast(member.member.userId),
          timestamp: member.timestamp,
          role: member.member.role || MEMBER_ROLE_ENUM.DEFAULT,
        };
      }
    );
  }

  // membersPendingAdminApproval
  if (groupState.membersPendingAdminApproval) {
    result.pendingAdminApprovalV2 = groupState.membersPendingAdminApproval.map(
      member => {
        if (member.profileKey) {
          newProfileKeys.push({
            profileKey: member.profileKey,
            uuid: UUID.cast(member.userId),
          });
        }

        return {
          uuid: UUID.cast(member.userId),
          timestamp: member.timestamp,
        };
      }
    );
  }

  // inviteLinkPassword
  const { inviteLinkPassword } = groupState;
  if (inviteLinkPassword) {
    result.groupInviteLinkPassword = inviteLinkPassword;
  } else {
    result.groupInviteLinkPassword = undefined;
  }

  // descriptionBytes
  const { descriptionBytes } = groupState;
  if (descriptionBytes && descriptionBytes.content === 'descriptionText') {
    result.description = dropNull(descriptionBytes.descriptionText);
  } else {
    result.description = undefined;
  }

  // announcementsOnly
  result.announcementsOnly = groupState.announcementsOnly;

  // membersBanned
  result.bannedMembersV2 = groupState.membersBanned;

  if (result.left) {
    result.addedBy = undefined;
  }

  return {
    newAttributes: result,
    newProfileKeys,
  };
}

function isValidRole(role?: number): role is number {
  const MEMBER_ROLE_ENUM = Proto.Member.Role;

  return (
    role === MEMBER_ROLE_ENUM.ADMINISTRATOR || role === MEMBER_ROLE_ENUM.DEFAULT
  );
}

function isValidAccess(access?: number): access is number {
  const ACCESS_ENUM = Proto.AccessControl.AccessRequired;

  return access === ACCESS_ENUM.ADMINISTRATOR || access === ACCESS_ENUM.MEMBER;
}

function isValidLinkAccess(access?: number): access is number {
  const ACCESS_ENUM = Proto.AccessControl.AccessRequired;

  return (
    access === ACCESS_ENUM.UNKNOWN ||
    access === ACCESS_ENUM.ANY ||
    access === ACCESS_ENUM.ADMINISTRATOR ||
    access === ACCESS_ENUM.UNSATISFIABLE
  );
}

function isValidProfileKey(buffer?: Uint8Array): boolean {
  return Boolean(buffer && buffer.length === 32);
}

function normalizeTimestamp(timestamp: Long | null | undefined): number {
  if (!timestamp) {
    return 0;
  }

  const asNumber = timestamp.toNumber();

  const now = Date.now();
  if (!asNumber || asNumber > now) {
    return now;
  }

  return asNumber;
}

type DecryptedGroupChangeActions = {
  version?: number;
  sourceUuid?: UUIDStringType;
  addMembers?: ReadonlyArray<{
    added: DecryptedMember;
    joinFromInviteLink: boolean;
  }>;
  deleteMembers?: ReadonlyArray<{
    deletedUserId: string;
  }>;
  modifyMemberRoles?: ReadonlyArray<{
    userId: string;
    role: Proto.Member.Role;
  }>;
  modifyMemberProfileKeys?: ReadonlyArray<{
    profileKey: Uint8Array;
    uuid: UUIDStringType;
  }>;
  addPendingMembers?: ReadonlyArray<{
    added: DecryptedMemberPendingProfileKey;
  }>;
  deletePendingMembers?: ReadonlyArray<{
    deletedUserId: string;
  }>;
  promotePendingMembers?: ReadonlyArray<{
    profileKey: Uint8Array;
    uuid: UUIDStringType;
  }>;
  promoteMembersPendingPniAciProfileKey?: ReadonlyArray<{
    profileKey: Uint8Array;
    aci: UUIDStringType;
    pni: UUIDStringType;
  }>;
  modifyTitle?: {
    title?: Proto.GroupAttributeBlob;
  };
  modifyDisappearingMessagesTimer?: {
    timer?: Proto.GroupAttributeBlob;
  };
  addMemberPendingAdminApprovals?: ReadonlyArray<{
    added: DecryptedMemberPendingAdminApproval;
  }>;
  deleteMemberPendingAdminApprovals?: ReadonlyArray<{
    deletedUserId: string;
  }>;
  promoteMemberPendingAdminApprovals?: ReadonlyArray<{
    userId: string;
    role: Proto.Member.Role;
  }>;
  modifyInviteLinkPassword?: {
    inviteLinkPassword?: string;
  };
  modifyDescription?: {
    descriptionBytes?: Proto.GroupAttributeBlob;
  };
  modifyAnnouncementsOnly?: {
    announcementsOnly: boolean;
  };
  addMembersBanned?: ReadonlyArray<GroupV2BannedMemberType>;
  deleteMembersBanned?: ReadonlyArray<UUIDStringType>;
} & Pick<
  Proto.GroupChange.IActions,
  | 'modifyAttributesAccess'
  | 'modifyMemberAccess'
  | 'modifyAddFromInviteLinkAccess'
  | 'modifyAvatar'
>;

function decryptGroupChange(
  actions: Readonly<Proto.GroupChange.IActions>,
  groupSecretParams: string,
  logId: string
): DecryptedGroupChangeActions {
  const result: DecryptedGroupChangeActions = {
    version: dropNull(actions.version),
  };

  const clientZkGroupCipher = getClientZkGroupCipher(groupSecretParams);

  if (actions.sourceUuid && actions.sourceUuid.length !== 0) {
    try {
      result.sourceUuid = UUID.cast(
        normalizeUuid(
          decryptUuid(clientZkGroupCipher, actions.sourceUuid),
          'actions.sourceUuid'
        )
      );
    } catch (error) {
      log.warn(
        `decryptGroupChange/${logId}: Unable to decrypt sourceUuid.`,
        error && error.stack ? error.stack : error
      );
    }

    if (!isValidUuid(result.sourceUuid)) {
      log.warn(
        `decryptGroupChange/${logId}: Invalid sourceUuid. Clearing sourceUuid.`
      );
      result.sourceUuid = undefined;
    }
  } else {
    throw new Error('decryptGroupChange: Missing sourceUuid');
  }

  // addMembers?: Array<GroupChange.Actions.AddMemberAction>;
  result.addMembers = compact(
    (actions.addMembers || []).map(addMember => {
      strictAssert(
        addMember.added,
        'decryptGroupChange: AddMember was missing added field!'
      );
      const decrypted = decryptMember(
        clientZkGroupCipher,
        addMember.added,
        logId
      );
      if (!decrypted) {
        return null;
      }

      return {
        added: decrypted,
        joinFromInviteLink: Boolean(addMember.joinFromInviteLink),
      };
    })
  );

  // deleteMembers?: Array<GroupChange.Actions.DeleteMemberAction>;
  result.deleteMembers = compact(
    (actions.deleteMembers || []).map(deleteMember => {
      const { deletedUserId } = deleteMember;
      strictAssert(
        Bytes.isNotEmpty(deletedUserId),
        'decryptGroupChange: deleteMember.deletedUserId was missing'
      );

      let userId: string;
      try {
        userId = normalizeUuid(
          decryptUuid(clientZkGroupCipher, deletedUserId),
          'actions.deleteMembers.deletedUserId'
        );
      } catch (error) {
        log.warn(
          `decryptGroupChange/${logId}: Unable to decrypt deleteMembers.deletedUserId. Dropping member.`,
          error && error.stack ? error.stack : error
        );
        return null;
      }

      if (!isValidUuid(userId)) {
        log.warn(
          `decryptGroupChange/${logId}: Dropping deleteMember due to invalid userId`
        );

        return null;
      }

      return { deletedUserId: userId };
    })
  );

  // modifyMemberRoles?: Array<GroupChange.Actions.ModifyMemberRoleAction>;
  result.modifyMemberRoles = compact(
    (actions.modifyMemberRoles || []).map(modifyMember => {
      strictAssert(
        Bytes.isNotEmpty(modifyMember.userId),
        'decryptGroupChange: modifyMemberRole.userId was missing'
      );

      let userId: string;
      try {
        userId = normalizeUuid(
          decryptUuid(clientZkGroupCipher, modifyMember.userId),
          'actions.modifyMemberRoles.userId'
        );
      } catch (error) {
        log.warn(
          `decryptGroupChange/${logId}: Unable to decrypt modifyMemberRole.userId. Dropping member.`,
          error && error.stack ? error.stack : error
        );
        return null;
      }

      if (!isValidUuid(userId)) {
        log.warn(
          `decryptGroupChange/${logId}: Dropping modifyMemberRole due to invalid userId`
        );

        return null;
      }

      const role = dropNull(modifyMember.role);
      if (!isValidRole(role)) {
        throw new Error(
          `decryptGroupChange: modifyMemberRole had invalid role ${modifyMember.role}`
        );
      }

      return {
        role,
        userId,
      };
    })
  );

  // modifyMemberProfileKeys?: Array<
  //   GroupChange.Actions.ModifyMemberProfileKeyAction
  // >;
  result.modifyMemberProfileKeys = compact(
    (actions.modifyMemberProfileKeys || []).map(modifyMemberProfileKey => {
      let { userId, profileKey: encryptedProfileKey } = modifyMemberProfileKey;

      // TODO: DESKTOP-3816
      if (Bytes.isEmpty(userId) || Bytes.isEmpty(encryptedProfileKey)) {
        const { presentation } = modifyMemberProfileKey;

        strictAssert(
          Bytes.isNotEmpty(presentation),
          'decryptGroupChange: modifyMemberProfileKeys.presentation was missing'
        );

        const decodedPresentation =
          decodeProfileKeyCredentialPresentation(presentation);

        ({ userId, profileKey: encryptedProfileKey } = decodedPresentation);
      }

      strictAssert(
        Bytes.isNotEmpty(userId),
        'decryptGroupChange: modifyMemberProfileKeys.userId was missing'
      );
      strictAssert(
        Bytes.isNotEmpty(encryptedProfileKey),
        'decryptGroupChange: modifyMemberProfileKeys.profileKey was missing'
      );

      let uuid: UUIDStringType;
      let profileKey: Uint8Array;
      try {
        uuid = normalizeUuid(
          decryptUuid(clientZkGroupCipher, userId),
          'actions.modifyMemberProfileKeys.userId'
        );

        profileKey = decryptProfileKey(
          clientZkGroupCipher,
          encryptedProfileKey,
          uuid
        );
      } catch (error) {
        log.warn(
          `decryptGroupChange/${logId}: Unable to decrypt ` +
            'modifyMemberProfileKeys.userId/profileKey. Dropping member.',
          Errors.toLogFormat(error)
        );
        return null;
      }

      if (!isValidProfileKey(profileKey)) {
        throw new Error(
          'decryptGroupChange: modifyMemberProfileKey had invalid profileKey'
        );
      }

      return { uuid, profileKey };
    })
  );

  // addPendingMembers?: Array<
  //   GroupChange.Actions.AddMemberPendingProfileKeyAction
  // >;
  result.addPendingMembers = compact(
    (actions.addPendingMembers || []).map(addPendingMember => {
      strictAssert(
        addPendingMember.added,
        'decryptGroupChange: addPendingMember was missing added field!'
      );
      const decrypted = decryptMemberPendingProfileKey(
        clientZkGroupCipher,
        addPendingMember.added,
        logId
      );
      if (!decrypted) {
        return null;
      }

      return {
        added: decrypted,
      };
    })
  );

  // deletePendingMembers?: Array<
  //   GroupChange.Actions.DeleteMemberPendingProfileKeyAction
  // >;
  result.deletePendingMembers = compact(
    (actions.deletePendingMembers || []).map(deletePendingMember => {
      const { deletedUserId } = deletePendingMember;
      strictAssert(
        Bytes.isNotEmpty(deletedUserId),
        'decryptGroupChange: deletePendingMembers.deletedUserId was missing'
      );
      let userId: string;
      try {
        userId = normalizeUuid(
          decryptUuid(clientZkGroupCipher, deletedUserId),
          'actions.deletePendingMembers.deletedUserId'
        );
      } catch (error) {
        log.warn(
          `decryptGroupChange/${logId}: Unable to decrypt deletePendingMembers.deletedUserId. Dropping member.`,
          error && error.stack ? error.stack : error
        );
        return null;
      }

      if (!isValidUuid(userId)) {
        log.warn(
          `decryptGroupChange/${logId}: Dropping deletePendingMember due to invalid deletedUserId`
        );

        return null;
      }

      return {
        deletedUserId: userId,
      };
    })
  );

  // promotePendingMembers?: Array<
  //   GroupChange.Actions.PromoteMemberPendingProfileKeyAction
  // >;
  result.promotePendingMembers = compact(
    (actions.promotePendingMembers || []).map(promotePendingMember => {
      let { userId, profileKey: encryptedProfileKey } = promotePendingMember;

      // TODO: DESKTOP-3816
      if (Bytes.isEmpty(userId) || Bytes.isEmpty(encryptedProfileKey)) {
        const { presentation } = promotePendingMember;

        strictAssert(
          Bytes.isNotEmpty(presentation),
          'decryptGroupChange: promotePendingMember.presentation was missing'
        );

        const decodedPresentation =
          decodeProfileKeyCredentialPresentation(presentation);

        ({ userId, profileKey: encryptedProfileKey } = decodedPresentation);
      }

      strictAssert(
        Bytes.isNotEmpty(userId),
        'decryptGroupChange: promotePendingMembers.userId was missing'
      );
      strictAssert(
        Bytes.isNotEmpty(encryptedProfileKey),
        'decryptGroupChange: promotePendingMembers.profileKey was missing'
      );

      let uuid: UUIDStringType;
      let profileKey: Uint8Array;
      try {
        uuid = normalizeUuid(
          decryptUuid(clientZkGroupCipher, userId),
          'actions.promotePendingMembers.userId'
        );

        profileKey = decryptProfileKey(
          clientZkGroupCipher,
          encryptedProfileKey,
          uuid
        );
      } catch (error) {
        log.warn(
          `decryptGroupChange/${logId}: Unable to decrypt ` +
            'promotePendingMembers.userId/profileKey. Dropping member.',
          Errors.toLogFormat(error)
        );
        return null;
      }

      if (!isValidProfileKey(profileKey)) {
        throw new Error(
          'decryptGroupChange: promotePendingMembers had invalid profileKey'
        );
      }

      return { uuid, profileKey };
    })
  );

  // promoteMembersPendingPniAciProfileKey?: Array<
  //   GroupChange.Actions.PromoteMemberPendingPniAciProfileKeyAction
  // >;
  result.promoteMembersPendingPniAciProfileKey = compact(
    (actions.promoteMembersPendingPniAciProfileKey || []).map(
      promotePendingMember => {
        strictAssert(
          Bytes.isNotEmpty(promotePendingMember.userId),
          'decryptGroupChange: ' +
            'promoteMembersPendingPniAciProfileKey.userId was missing'
        );
        strictAssert(
          Bytes.isNotEmpty(promotePendingMember.pni),
          'decryptGroupChange: ' +
            'promoteMembersPendingPniAciProfileKey.pni was missing'
        );
        strictAssert(
          Bytes.isNotEmpty(promotePendingMember.profileKey),
          'decryptGroupChange: ' +
            'promoteMembersPendingPniAciProfileKey.profileKey was missing'
        );

        let userId: string;
        let pni: string;
        let profileKey: Uint8Array;
        try {
          userId = normalizeUuid(
            decryptUuid(clientZkGroupCipher, promotePendingMember.userId),
            'actions.promoteMembersPendingPniAciProfileKey.userId'
          );
          pni = normalizeUuid(
            decryptUuid(clientZkGroupCipher, promotePendingMember.pni),
            'actions.promoteMembersPendingPniAciProfileKey.pni'
          );

          profileKey = decryptProfileKey(
            clientZkGroupCipher,
            promotePendingMember.profileKey,
            UUID.cast(userId)
          );
        } catch (error) {
          log.warn(
            `decryptGroupChange/${logId}: Unable to decrypt promoteMembersPendingPniAciProfileKey. Dropping member.`,
            Errors.toLogFormat(error)
          );
          return null;
        }

        if (!isValidUuid(userId)) {
          log.warn(
            `decryptGroupChange/${logId}: Dropping ` +
              'promoteMembersPendingPniAciProfileKey due to invalid ACI'
          );

          return null;
        }

        if (!isValidUuid(pni)) {
          log.warn(
            `decryptGroupChange/${logId}: Dropping ` +
              'promoteMembersPendingPniAciProfileKey due to invalid PNI'
          );

          return null;
        }

        if (!isValidProfileKey(profileKey)) {
          throw new Error(
            'decryptGroupChange: promoteMembersPendingPniAciProfileKey ' +
              'had invalid profileKey'
          );
        }

        return {
          aci: userId,
          pni,
          profileKey,
        };
      }
    )
  );

  // modifyTitle?: GroupChange.Actions.ModifyTitleAction;
  if (actions.modifyTitle) {
    const { title } = actions.modifyTitle;

    if (Bytes.isNotEmpty(title)) {
      try {
        result.modifyTitle = {
          title: Proto.GroupAttributeBlob.decode(
            decryptGroupBlob(clientZkGroupCipher, title)
          ),
        };
      } catch (error) {
        log.warn(
          `decryptGroupChange/${logId}: Unable to decrypt modifyTitle.title`,
          error && error.stack ? error.stack : error
        );
      }
    } else {
      result.modifyTitle = {};
    }
  }

  // modifyAvatar?: GroupChange.Actions.ModifyAvatarAction;
  // Note: decryption happens during application of the change, on download of the avatar
  result.modifyAvatar = actions.modifyAvatar;

  // modifyDisappearingMessagesTimer?:
  // GroupChange.Actions.ModifyDisappearingMessagesTimerAction;
  if (actions.modifyDisappearingMessagesTimer) {
    const { timer } = actions.modifyDisappearingMessagesTimer;

    if (Bytes.isNotEmpty(timer)) {
      try {
        result.modifyDisappearingMessagesTimer = {
          timer: Proto.GroupAttributeBlob.decode(
            decryptGroupBlob(clientZkGroupCipher, timer)
          ),
        };
      } catch (error) {
        log.warn(
          `decryptGroupChange/${logId}: Unable to decrypt modifyDisappearingMessagesTimer.timer`,
          error && error.stack ? error.stack : error
        );
      }
    } else {
      result.modifyDisappearingMessagesTimer = {};
    }
  }

  // modifyAttributesAccess?:
  // GroupChange.Actions.ModifyAttributesAccessControlAction;
  if (actions.modifyAttributesAccess) {
    const attributesAccess = dropNull(
      actions.modifyAttributesAccess.attributesAccess
    );
    strictAssert(
      isValidAccess(attributesAccess),
      `decryptGroupChange: modifyAttributesAccess.attributesAccess was not valid: ${actions.modifyAttributesAccess.attributesAccess}`
    );

    result.modifyAttributesAccess = {
      attributesAccess,
    };
  }

  // modifyMemberAccess?: GroupChange.Actions.ModifyMembersAccessControlAction;
  if (actions.modifyMemberAccess) {
    const membersAccess = dropNull(actions.modifyMemberAccess.membersAccess);
    strictAssert(
      isValidAccess(membersAccess),
      `decryptGroupChange: modifyMemberAccess.membersAccess was not valid: ${actions.modifyMemberAccess.membersAccess}`
    );

    result.modifyMemberAccess = {
      membersAccess,
    };
  }

  // modifyAddFromInviteLinkAccess?:
  //   GroupChange.Actions.ModifyAddFromInviteLinkAccessControlAction;
  if (actions.modifyAddFromInviteLinkAccess) {
    const addFromInviteLinkAccess = dropNull(
      actions.modifyAddFromInviteLinkAccess.addFromInviteLinkAccess
    );
    strictAssert(
      isValidLinkAccess(addFromInviteLinkAccess),
      `decryptGroupChange: modifyAddFromInviteLinkAccess.addFromInviteLinkAccess was not valid: ${actions.modifyAddFromInviteLinkAccess.addFromInviteLinkAccess}`
    );

    result.modifyAddFromInviteLinkAccess = {
      addFromInviteLinkAccess,
    };
  }

  // addMemberPendingAdminApprovals?: Array<
  //   GroupChange.Actions.AddMemberPendingAdminApprovalAction
  // >;
  result.addMemberPendingAdminApprovals = compact(
    (actions.addMemberPendingAdminApprovals || []).map(
      addPendingAdminApproval => {
        const { added } = addPendingAdminApproval;
        strictAssert(
          added,
          'decryptGroupChange: addPendingAdminApproval was missing added field!'
        );

        const decrypted = decryptMemberPendingAdminApproval(
          clientZkGroupCipher,
          added,
          logId
        );
        if (!decrypted) {
          log.warn(
            `decryptGroupChange/${logId}: Unable to decrypt addPendingAdminApproval.added. Dropping member.`
          );
          return null;
        }

        return { added: decrypted };
      }
    )
  );

  // deleteMemberPendingAdminApprovals?: Array<
  //   GroupChange.Actions.DeleteMemberPendingAdminApprovalAction
  // >;
  result.deleteMemberPendingAdminApprovals = compact(
    (actions.deleteMemberPendingAdminApprovals || []).map(
      deletePendingApproval => {
        const { deletedUserId } = deletePendingApproval;
        strictAssert(
          Bytes.isNotEmpty(deletedUserId),
          'decryptGroupChange: deletePendingApproval.deletedUserId was missing'
        );

        let userId: string;
        try {
          userId = normalizeUuid(
            decryptUuid(clientZkGroupCipher, deletedUserId),
            'actions.deleteMemberPendingAdminApprovals'
          );
        } catch (error) {
          log.warn(
            `decryptGroupChange/${logId}: Unable to decrypt deletePendingApproval.deletedUserId. Dropping member.`,
            error && error.stack ? error.stack : error
          );
          return null;
        }
        if (!isValidUuid(userId)) {
          log.warn(
            `decryptGroupChange/${logId}: Dropping deletePendingApproval due to invalid deletedUserId`
          );

          return null;
        }

        return { deletedUserId: userId };
      }
    )
  );

  // promoteMemberPendingAdminApprovals?: Array<
  //   GroupChange.Actions.PromoteMemberPendingAdminApprovalAction
  // >;
  result.promoteMemberPendingAdminApprovals = compact(
    (actions.promoteMemberPendingAdminApprovals || []).map(
      promoteAdminApproval => {
        const { userId } = promoteAdminApproval;
        strictAssert(
          Bytes.isNotEmpty(userId),
          'decryptGroupChange: promoteAdminApproval.userId was missing'
        );

        let decryptedUserId: string;
        try {
          decryptedUserId = normalizeUuid(
            decryptUuid(clientZkGroupCipher, userId),
            'actions.promoteMemberPendingAdminApprovals.userId'
          );
        } catch (error) {
          log.warn(
            `decryptGroupChange/${logId}: Unable to decrypt promoteAdminApproval.userId. Dropping member.`,
            error && error.stack ? error.stack : error
          );
          return null;
        }

        const role = dropNull(promoteAdminApproval.role);
        if (!isValidRole(role)) {
          throw new Error(
            `decryptGroupChange: promoteAdminApproval had invalid role ${promoteAdminApproval.role}`
          );
        }

        return { role, userId: decryptedUserId };
      }
    )
  );

  // modifyInviteLinkPassword?: GroupChange.Actions.ModifyInviteLinkPasswordAction;
  if (actions.modifyInviteLinkPassword) {
    const { inviteLinkPassword: password } = actions.modifyInviteLinkPassword;
    if (Bytes.isNotEmpty(password)) {
      result.modifyInviteLinkPassword = {
        inviteLinkPassword: Bytes.toBase64(password),
      };
    } else {
      result.modifyInviteLinkPassword = {};
    }
  }

  // modifyDescription?: GroupChange.Actions.ModifyDescriptionAction;
  if (actions.modifyDescription) {
    const { descriptionBytes } = actions.modifyDescription;
    if (Bytes.isNotEmpty(descriptionBytes)) {
      try {
        result.modifyDescription = {
          descriptionBytes: Proto.GroupAttributeBlob.decode(
            decryptGroupBlob(clientZkGroupCipher, descriptionBytes)
          ),
        };
      } catch (error) {
        log.warn(
          `decryptGroupChange/${logId}: Unable to decrypt modifyDescription.descriptionBytes`,
          error && error.stack ? error.stack : error
        );
      }
    } else {
      result.modifyDescription = {};
    }
  }

  // modifyAnnouncementsOnly
  if (actions.modifyAnnouncementsOnly) {
    const { announcementsOnly } = actions.modifyAnnouncementsOnly;
    result.modifyAnnouncementsOnly = {
      announcementsOnly: Boolean(announcementsOnly),
    };
  }

  // addMembersBanned
  if (actions.addMembersBanned && actions.addMembersBanned.length > 0) {
    result.addMembersBanned = actions.addMembersBanned
      .map(item => {
        if (!item.added || !item.added.userId) {
          log.warn(
            `decryptGroupChange/${logId}: addMembersBanned had a blank entry`
          );
          return null;
        }
        const uuid = normalizeUuid(
          decryptUuid(clientZkGroupCipher, item.added.userId),
          'addMembersBanned.added.userId'
        );
        const timestamp = normalizeTimestamp(item.added.timestamp);

        return { uuid, timestamp };
      })
      .filter(isNotNil);
  }

  // deleteMembersBanned
  if (actions.deleteMembersBanned && actions.deleteMembersBanned.length > 0) {
    result.deleteMembersBanned = actions.deleteMembersBanned
      .map(item => {
        if (!item.deletedUserId) {
          log.warn(
            `decryptGroupChange/${logId}: deleteMembersBanned had a blank entry`
          );
          return null;
        }
        return normalizeUuid(
          decryptUuid(clientZkGroupCipher, item.deletedUserId),
          'deleteMembersBanned.deletedUserId'
        );
      })
      .filter(isNotNil);
  }

  return result;
}

export function decryptGroupTitle(
  title: Uint8Array | undefined,
  secretParams: string
): string | undefined {
  const clientZkGroupCipher = getClientZkGroupCipher(secretParams);
  if (!title || !title.length) {
    return undefined;
  }
  const blob = Proto.GroupAttributeBlob.decode(
    decryptGroupBlob(clientZkGroupCipher, title)
  );

  if (blob && blob.content === 'title') {
    return dropNull(blob.title);
  }

  return undefined;
}

export function decryptGroupDescription(
  description: Uint8Array | undefined,
  secretParams: string
): string | undefined {
  const clientZkGroupCipher = getClientZkGroupCipher(secretParams);
  if (!description || !description.length) {
    return undefined;
  }

  const blob = Proto.GroupAttributeBlob.decode(
    decryptGroupBlob(clientZkGroupCipher, description)
  );

  if (blob && blob.content === 'descriptionText') {
    return dropNull(blob.descriptionText);
  }

  return undefined;
}

type DecryptedGroupState = {
  title?: Proto.GroupAttributeBlob;
  disappearingMessagesTimer?: Proto.GroupAttributeBlob;
  accessControl?: {
    attributes: number;
    members: number;
    addFromInviteLink: number;
  };
  version?: number;
  members?: ReadonlyArray<DecryptedMember>;
  membersPendingProfileKey?: ReadonlyArray<DecryptedMemberPendingProfileKey>;
  membersPendingAdminApproval?: ReadonlyArray<DecryptedMemberPendingAdminApproval>;
  inviteLinkPassword?: string;
  descriptionBytes?: Proto.GroupAttributeBlob;
  avatar?: string;
  announcementsOnly?: boolean;
  membersBanned?: Array<GroupV2BannedMemberType>;
};

function decryptGroupState(
  groupState: Readonly<Proto.IGroup>,
  groupSecretParams: string,
  logId: string
): DecryptedGroupState {
  const clientZkGroupCipher = getClientZkGroupCipher(groupSecretParams);
  const result: DecryptedGroupState = {};

  // title
  if (Bytes.isNotEmpty(groupState.title)) {
    try {
      result.title = Proto.GroupAttributeBlob.decode(
        decryptGroupBlob(clientZkGroupCipher, groupState.title)
      );
    } catch (error) {
      log.warn(
        `decryptGroupState/${logId}: Unable to decrypt title. Clearing it.`,
        error && error.stack ? error.stack : error
      );
    }
  }

  // avatar
  // Note: decryption happens during application of the change, on download of the avatar

  // disappearing message timer
  if (
    groupState.disappearingMessagesTimer &&
    groupState.disappearingMessagesTimer.length
  ) {
    try {
      result.disappearingMessagesTimer = Proto.GroupAttributeBlob.decode(
        decryptGroupBlob(
          clientZkGroupCipher,
          groupState.disappearingMessagesTimer
        )
      );
    } catch (error) {
      log.warn(
        `decryptGroupState/${logId}: Unable to decrypt disappearing message timer. Clearing it.`,
        error && error.stack ? error.stack : error
      );
    }
  }

  // accessControl
  {
    const { accessControl } = groupState;
    strictAssert(accessControl, 'No accessControl field found');

    const attributes = dropNull(accessControl.attributes);
    const members = dropNull(accessControl.members);
    const addFromInviteLink = dropNull(accessControl.addFromInviteLink);

    strictAssert(
      isValidAccess(attributes),
      `decryptGroupState: Access control for attributes is invalid: ${attributes}`
    );
    strictAssert(
      isValidAccess(members),
      `decryptGroupState: Access control for members is invalid: ${members}`
    );
    strictAssert(
      isValidLinkAccess(addFromInviteLink),
      `decryptGroupState: Access control for invite link is invalid: ${addFromInviteLink}`
    );

    result.accessControl = {
      attributes,
      members,
      addFromInviteLink,
    };
  }

  // version
  strictAssert(
    isNumber(groupState.version),
    `decryptGroupState: Expected version to be a number; it was ${groupState.version}`
  );
  result.version = groupState.version;

  // members
  if (groupState.members) {
    result.members = compact(
      groupState.members.map((member: Proto.IMember) =>
        decryptMember(clientZkGroupCipher, member, logId)
      )
    );
  }

  // membersPendingProfileKey
  if (groupState.membersPendingProfileKey) {
    result.membersPendingProfileKey = compact(
      groupState.membersPendingProfileKey.map(
        (member: Proto.IMemberPendingProfileKey) =>
          decryptMemberPendingProfileKey(clientZkGroupCipher, member, logId)
      )
    );
  }

  // membersPendingAdminApproval
  if (groupState.membersPendingAdminApproval) {
    result.membersPendingAdminApproval = compact(
      groupState.membersPendingAdminApproval.map(
        (member: Proto.IMemberPendingAdminApproval) =>
          decryptMemberPendingAdminApproval(clientZkGroupCipher, member, logId)
      )
    );
  }

  // inviteLinkPassword
  if (Bytes.isNotEmpty(groupState.inviteLinkPassword)) {
    result.inviteLinkPassword = Bytes.toBase64(groupState.inviteLinkPassword);
  }

  // descriptionBytes
  if (Bytes.isNotEmpty(groupState.descriptionBytes)) {
    try {
      result.descriptionBytes = Proto.GroupAttributeBlob.decode(
        decryptGroupBlob(clientZkGroupCipher, groupState.descriptionBytes)
      );
    } catch (error) {
      log.warn(
        `decryptGroupState/${logId}: Unable to decrypt descriptionBytes. Clearing it.`,
        error && error.stack ? error.stack : error
      );
    }
  }

  // announcementsOnly
  const { announcementsOnly } = groupState;
  result.announcementsOnly = Boolean(announcementsOnly);

  // membersBanned
  const { membersBanned } = groupState;
  if (membersBanned && membersBanned.length > 0) {
    result.membersBanned = membersBanned
      .map(item => {
        if (!item.userId) {
          log.warn(
            `decryptGroupState/${logId}: membersBanned had a blank entry`
          );
          return null;
        }
        const uuid = normalizeUuid(
          decryptUuid(clientZkGroupCipher, item.userId),
          'membersBanned.added.userId'
        );
        const timestamp = item.timestamp?.toNumber() ?? 0;

        return { uuid, timestamp };
      })
      .filter(isNotNil);
  } else {
    result.membersBanned = [];
  }

  result.avatar = dropNull(groupState.avatar);

  return result;
}

type DecryptedMember = Readonly<{
  userId: string;
  profileKey: Uint8Array;
  role: Proto.Member.Role;
  joinedAtVersion?: number;
}>;

function decryptMember(
  clientZkGroupCipher: ClientZkGroupCipher,
  member: Readonly<Proto.IMember>,
  logId: string
): DecryptedMember | undefined {
  // userId
  strictAssert(
    Bytes.isNotEmpty(member.userId),
    'decryptMember: Member had missing userId'
  );

  let userId: string;
  try {
    userId = normalizeUuid(
      decryptUuid(clientZkGroupCipher, member.userId),
      'decryptMember.userId'
    );
  } catch (error) {
    log.warn(
      `decryptMember/${logId}: Unable to decrypt member userid. Dropping member.`,
      error && error.stack ? error.stack : error
    );
    return undefined;
  }

  if (!isValidUuid(userId)) {
    log.warn(`decryptMember/${logId}: Dropping member due to invalid userId`);

    return undefined;
  }

  // profileKey
  strictAssert(
    Bytes.isNotEmpty(member.profileKey),
    'decryptMember: Member had missing profileKey'
  );
  const profileKey = decryptProfileKey(
    clientZkGroupCipher,
    member.profileKey,
    UUID.cast(userId)
  );

  if (!isValidProfileKey(profileKey)) {
    throw new Error('decryptMember: Member had invalid profileKey');
  }

  // role
  const role = dropNull(member.role);

  if (!isValidRole(role)) {
    throw new Error(`decryptMember: Member had invalid role ${member.role}`);
  }

  return {
    userId,
    profileKey,
    role,
    joinedAtVersion: dropNull(member.joinedAtVersion),
  };
}

type DecryptedMemberPendingProfileKey = {
  addedByUserId: string;
  timestamp: number;
  member: {
    userId: string;
    profileKey?: Uint8Array;
    role?: Proto.Member.Role;
  };
};

function decryptMemberPendingProfileKey(
  clientZkGroupCipher: ClientZkGroupCipher,
  member: Readonly<Proto.IMemberPendingProfileKey>,
  logId: string
): DecryptedMemberPendingProfileKey | undefined {
  // addedByUserId
  strictAssert(
    Bytes.isNotEmpty(member.addedByUserId),
    'decryptMemberPendingProfileKey: Member had missing addedByUserId'
  );

  let addedByUserId: string;
  try {
    addedByUserId = normalizeUuid(
      decryptUuid(clientZkGroupCipher, member.addedByUserId),
      'decryptMemberPendingProfileKey.addedByUserId'
    );
  } catch (error) {
    log.warn(
      `decryptMemberPendingProfileKey/${logId}: Unable to decrypt pending member addedByUserId. Dropping member.`,
      error && error.stack ? error.stack : error
    );
    return undefined;
  }

  if (!isValidUuid(addedByUserId)) {
    log.warn(
      `decryptMemberPendingProfileKey/${logId}: Dropping pending member due to invalid addedByUserId`
    );
    return undefined;
  }

  // timestamp
  const timestamp = normalizeTimestamp(member.timestamp);

  if (!member.member) {
    log.warn(
      `decryptMemberPendingProfileKey/${logId}: Dropping pending member due to missing member details`
    );

    return undefined;
  }

  const { userId, profileKey } = member.member;

  // userId
  strictAssert(
    Bytes.isNotEmpty(userId),
    'decryptMemberPendingProfileKey: Member had missing member.userId'
  );

  let decryptedUserId: string;
  try {
    decryptedUserId = normalizeUuid(
      decryptUuid(clientZkGroupCipher, userId),
      'decryptMemberPendingProfileKey.member.userId'
    );
  } catch (error) {
    log.warn(
      `decryptMemberPendingProfileKey/${logId}: Unable to decrypt pending member userId. Dropping member.`,
      error && error.stack ? error.stack : error
    );
    return undefined;
  }

  if (!isValidUuid(decryptedUserId)) {
    log.warn(
      `decryptMemberPendingProfileKey/${logId}: Dropping pending member due to invalid member.userId`
    );

    return undefined;
  }

  // profileKey
  let decryptedProfileKey: Uint8Array | undefined;
  if (Bytes.isNotEmpty(profileKey)) {
    try {
      decryptedProfileKey = decryptProfileKey(
        clientZkGroupCipher,
        profileKey,
        UUID.cast(decryptedUserId)
      );
    } catch (error) {
      log.warn(
        `decryptMemberPendingProfileKey/${logId}: Unable to decrypt pending member profileKey. Dropping profileKey.`,
        error && error.stack ? error.stack : error
      );
    }

    if (!isValidProfileKey(decryptedProfileKey)) {
      log.warn(
        `decryptMemberPendingProfileKey/${logId}: Dropping profileKey, since it was invalid`
      );
      decryptedProfileKey = undefined;
    }
  }

  // role
  const role = dropNull(member.member.role);

  strictAssert(
    isValidRole(role),
    `decryptMemberPendingProfileKey: Member had invalid role ${role}`
  );

  return {
    addedByUserId,
    timestamp,
    member: {
      userId: decryptedUserId,
      profileKey: decryptedProfileKey,
      role,
    },
  };
}

type DecryptedMemberPendingAdminApproval = {
  userId: string;
  profileKey?: Uint8Array;
  timestamp: number;
};

function decryptMemberPendingAdminApproval(
  clientZkGroupCipher: ClientZkGroupCipher,
  member: Readonly<Proto.IMemberPendingAdminApproval>,
  logId: string
): DecryptedMemberPendingAdminApproval | undefined {
  // timestamp
  const timestamp = normalizeTimestamp(member.timestamp);

  const { userId, profileKey } = member;

  // userId
  strictAssert(
    Bytes.isNotEmpty(userId),
    'decryptMemberPendingAdminApproval: Missing userId'
  );

  let decryptedUserId: string;
  try {
    decryptedUserId = normalizeUuid(
      decryptUuid(clientZkGroupCipher, userId),
      'decryptMemberPendingAdminApproval.userId'
    );
  } catch (error) {
    log.warn(
      `decryptMemberPendingAdminApproval/${logId}: Unable to decrypt pending member userId. Dropping member.`,
      error && error.stack ? error.stack : error
    );
    return undefined;
  }

  if (!isValidUuid(decryptedUserId)) {
    log.warn(
      `decryptMemberPendingAdminApproval/${logId}: Invalid userId. Dropping member.`
    );

    return undefined;
  }

  // profileKey
  let decryptedProfileKey: Uint8Array | undefined;
  if (Bytes.isNotEmpty(profileKey)) {
    try {
      decryptedProfileKey = decryptProfileKey(
        clientZkGroupCipher,
        profileKey,
        UUID.cast(decryptedUserId)
      );
    } catch (error) {
      log.warn(
        `decryptMemberPendingAdminApproval/${logId}: Unable to decrypt profileKey. Dropping profileKey.`,
        error && error.stack ? error.stack : error
      );
    }

    if (!isValidProfileKey(decryptedProfileKey)) {
      log.warn(
        `decryptMemberPendingAdminApproval/${logId}: Dropping profileKey, since it was invalid`
      );

      decryptedProfileKey = undefined;
    }
  }

  return {
    timestamp,
    userId: decryptedUserId,
    profileKey: decryptedProfileKey,
  };
}

export function getMembershipList(
  conversationId: string
): Array<{ uuid: UUIDStringType; uuidCiphertext: Uint8Array }> {
  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    throw new Error('getMembershipList: cannot find conversation');
  }

  const secretParams = conversation.get('secretParams');
  if (!secretParams) {
    throw new Error('getMembershipList: no secretParams');
  }

  const clientZkGroupCipher = getClientZkGroupCipher(secretParams);

  return conversation.getMembers().map(member => {
    const uuid = member.getCheckedUuid('getMembershipList: member has no UUID');

    const uuidCiphertext = encryptUuid(clientZkGroupCipher, uuid);
    return { uuid: uuid.toString(), uuidCiphertext };
  });
}
