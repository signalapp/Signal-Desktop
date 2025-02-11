// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  compact,
  difference,
  flatten,
  fromPairs,
  isNumber,
  omit,
  values,
} from 'lodash';
import Long from 'long';
import type { ClientZkGroupCipher } from '@signalapp/libsignal-client/zkgroup';
import { LRUCache } from 'lru-cache';
import * as log from './logging/log';
import {
  getCheckedGroupCredentialsForToday,
  maybeFetchNewCredentials,
} from './services/groupCredentialFetcher';
import { storageServiceUploadJob } from './services/storage';
import { DataReader, DataWriter } from './sql/Client';
import { toWebSafeBase64, fromWebSafeBase64 } from './util/webSafeBase64';
import { assertDev, strictAssert } from './util/assert';
import { isMoreRecentThan } from './util/timestamp';
import { MINUTE, DurationInSeconds, SECOND } from './util/durations';
import { drop } from './util/drop';
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
  decodeProfileKeyCredentialPresentation,
  decryptGroupBlob,
  decryptProfileKey,
  decryptAci,
  decryptPni,
  decryptServiceId,
  deriveGroupID,
  deriveGroupPublicParams,
  deriveGroupSecretParams,
  encryptGroupBlob,
  encryptServiceId,
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
  isGroupV2,
  isMe,
} from './util/whatTypeOfConversation';
import * as Bytes from './Bytes';
import type { AvatarDataType } from './types/Avatar';
import type { ServiceIdString, AciString, PniString } from './types/ServiceId';
import {
  ServiceIdKind,
  isPniString,
  isServiceIdString,
} from './types/ServiceId';
import { isAciString } from './util/isAciString';
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
import { incrementMessageCounter } from './util/incrementMessageCounter';
import { sleep } from './util/sleep';
import { groupInvitesRoute } from './util/signalRoutes';
import {
  decodeGroupSendEndorsementResponse,
  validateGroupSendEndorsementsExpiration,
} from './util/groupSendEndorsements';
import { getProfile } from './util/getProfile';
import { generateMessageId } from './util/generateMessageId';
import { postSaveUpdates } from './util/cleanup';
import { MessageModel } from './models/messages';

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
  aci: AciString;
};
type GroupV2MemberAddFromInviteChangeType = {
  type: 'member-add-from-invite';
  aci: AciString;
  pni?: PniString;
  inviter?: AciString;
};
type GroupV2MemberAddFromLinkChangeType = {
  type: 'member-add-from-link';
  aci: AciString;
};
type GroupV2MemberAddFromAdminApprovalChangeType = {
  type: 'member-add-from-admin-approval';
  aci: AciString;
};
type GroupV2MemberPrivilegeChangeType = {
  type: 'member-privilege';
  aci: AciString;
  newPrivilege: number;
};
type GroupV2MemberRemoveChangeType = {
  type: 'member-remove';
  aci: AciString;
};

type GroupV2PendingAddOneChangeType = {
  type: 'pending-add-one';
  serviceId: ServiceIdString;
};
type GroupV2PendingAddManyChangeType = {
  type: 'pending-add-many';
  count: number;
};
// Note: pending-remove is only used if user didn't also join the group at the same time
type GroupV2PendingRemoveOneChangeType = {
  type: 'pending-remove-one';
  serviceId: ServiceIdString;
  inviter?: AciString;
};
// Note: pending-remove is only used if user didn't also join the group at the same time
type GroupV2PendingRemoveManyChangeType = {
  type: 'pending-remove-many';
  count: number;
  inviter?: AciString;
};

type GroupV2AdminApprovalAddOneChangeType = {
  type: 'admin-approval-add-one';
  aci: AciString;
};
// Note: admin-approval-remove-one is only used if user didn't also join the group at
//   the same time
type GroupV2AdminApprovalRemoveOneChangeType = {
  type: 'admin-approval-remove-one';
  aci: AciString;
  inviter?: AciString;
};
type GroupV2AdminApprovalBounceChangeType = {
  type: 'admin-approval-bounce';
  times: number;
  isApprovalPending: boolean;
  aci: AciString;
};
export type GroupV2DescriptionChangeType = {
  type: 'description';
  removed?: boolean;
  // Adding this field; cannot remove previous field for backwards compatibility
  description?: string;
};
export type GroupV2SummaryType = {
  type: 'summary';
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
  | GroupV2SummaryType
  | GroupV2TitleChangeType;

export type GroupV2ChangeType = {
  from?: ServiceIdString;
  details: ReadonlyArray<GroupV2ChangeDetailType>;
};

export type GroupFields = {
  readonly id: Uint8Array;
  readonly secretParams: Uint8Array;
  readonly publicParams: Uint8Array;
};

const MAX_CACHED_GROUP_FIELDS = 100;

const groupFieldsCache = new LRUCache<string, GroupFields>({
  max: MAX_CACHED_GROUP_FIELDS,
});

const { updateConversation } = DataWriter;

if (!isNumber(MAX_MESSAGE_SCHEMA)) {
  throw new Error(
    'groups.ts: Unable to capture max message schema from js/modules/types/message'
  );
}

type UpdatesResultType = {
  // The array of new messages to be added into the message timeline
  groupChangeMessages: Array<GroupChangeMessageType>;
  // The map of members in the group, and we largely just pull profile keys for each,
  //   because the group membership is updated in newAttributes
  newProfileKeys: Map<AciString, string>;
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
  'readStatus' | 'seenStatus'
>;

type GroupV2ChangeMessageType = {
  type: 'group-v2-change';
} & Pick<MessageAttributesType, 'groupV2Change' | 'sourceServiceId'>;

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
  'sourceServiceId' | 'flags' | 'expirationTimerUpdate'
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

  return makeRequestWithCredentials({
    logId: `getPreJoinInfo/groupv2(${data.id})`,
    publicParams: Bytes.toBase64(data.publicParams),
    secretParams: Bytes.toBase64(data.secretParams),
    request: (sender, options) =>
      sender.getGroupFromLink(inviteLinkPasswordBase64, options),
  });
}

export function buildGroupLink(
  conversation: ConversationAttributesType
): string | undefined {
  if (!isGroupV2(conversation)) {
    return undefined;
  }

  const { masterKey, groupInviteLinkPassword } = conversation;

  if (!groupInviteLinkPassword) {
    return undefined;
  }

  strictAssert(masterKey, 'buildGroupLink requires the master key!');

  const bytes = Proto.GroupInviteLink.encode({
    v1Contents: {
      groupMasterKey: Bytes.fromBase64(masterKey),
      inviteLinkPassword: Bytes.fromBase64(groupInviteLinkPassword),
    },
  }).finish();

  const inviteCode = toWebSafeBase64(Bytes.toBase64(bytes));

  return groupInvitesRoute.toWebUrl({ inviteCode }).toString();
}

export function parseGroupLink(value: string): {
  masterKey: string;
  inviteLinkPassword: string;
} {
  const base64 = fromWebSafeBase64(value);
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

async function uploadAvatar(options: {
  logId: string;
  publicParams: string;
  secretParams: string;
  data: Uint8Array;
}): Promise<UploadedAvatarType> {
  const { logId, publicParams, secretParams, data } = options;

  try {
    const clientZkGroupCipher = getClientZkGroupCipher(secretParams);

    const hash = computeHash(data);

    const blobPlaintext = Proto.GroupAttributeBlob.encode({
      avatar: data,
    }).finish();
    const ciphertext = encryptGroupBlob(clientZkGroupCipher, blobPlaintext);

    const key = await makeRequestWithCredentials({
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
    log.warn(
      `uploadAvatar/${logId} Failed to upload avatar`,
      Errors.toLogFormat(error)
    );
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

    const conversation = window.ConversationController.get(item.aci);
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

  const ourAci = window.storage.user.getCheckedAci();

  const ourAciCipherTextBuffer = encryptServiceId(clientZkGroupCipher, ourAci);

  proto.membersPendingProfileKey = (attributes.pendingMembersV2 || []).map(
    item => {
      const pendingMember = new Proto.MemberPendingProfileKey();
      const member = new Proto.Member();

      const conversation = window.ConversationController.get(item.serviceId);
      if (!conversation) {
        throw new Error('buildGroupProto: no conversation for pending member!');
      }

      const serviceId = conversation.getCheckedServiceId(
        'buildGroupProto: pending member was missing serviceId!'
      );

      const uuidCipherTextBuffer = encryptServiceId(
        clientZkGroupCipher,
        serviceId
      );
      member.userId = uuidCipherTextBuffer;
      member.role = item.role || MEMBER_ROLE_ENUM.DEFAULT;

      pendingMember.member = member;
      pendingMember.timestamp = Long.fromNumber(item.timestamp);
      pendingMember.addedByUserId = ourAciCipherTextBuffer;

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

  const ourAci = window.storage.user.getCheckedAci();
  const ourAciCipherTextBuffer = encryptServiceId(clientZkGroupCipher, ourAci);

  const now = Date.now();

  const addMembers: Array<Proto.GroupChange.Actions.AddMemberAction> = [];
  const addPendingMembers: Array<Proto.GroupChange.Actions.AddMemberPendingProfileKeyAction> =
    [];
  const actions = new Proto.GroupChange.Actions();

  await Promise.all(
    conversationIds.map(async conversationId => {
      const contact = window.ConversationController.get(conversationId);
      if (!contact) {
        assertDev(
          false,
          `buildAddMembersChange/${logId}: missing local contact, skipping`
        );
        return;
      }

      const serviceId = contact.getServiceId();
      if (!serviceId) {
        assertDev(
          false,
          `buildAddMembersChange/${logId}: missing serviceId; skipping`
        );
        return;
      }

      // Refresh our local data to be sure
      if (!contact.get('profileKey') || !contact.get('profileKeyCredential')) {
        await contact.getProfiles();
      }

      const profileKey = contact.get('profileKey');
      const profileKeyCredential = contact.get('profileKeyCredential');

      const member = new Proto.Member();
      member.userId = encryptServiceId(clientZkGroupCipher, serviceId);
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
        memberPendingProfileKey.addedByUserId = ourAciCipherTextBuffer;
        memberPendingProfileKey.timestamp = Long.fromNumber(now);

        const addPendingMemberAction =
          new Proto.GroupChange.Actions.AddMemberPendingProfileKeyAction();
        addPendingMemberAction.added = memberPendingProfileKey;

        addPendingMembers.push(addPendingMemberAction);
      }

      const doesMemberNeedUnban = conversation.bannedMembersV2?.some(
        bannedMember => bannedMember.serviceId === serviceId
      );
      if (doesMemberNeedUnban) {
        const uuidCipherTextBuffer = encryptServiceId(
          clientZkGroupCipher,
          serviceId
        );

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
  expireTimer: DurationInSeconds;
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
  ourAci,
  serviceId,
}: {
  clientZkGroupCipher: ClientZkGroupCipher;
  group: Pick<ConversationAttributesType, 'bannedMembersV2'>;
  ourAci: AciString;
  serviceId: ServiceIdString;
}): Pick<
  Proto.GroupChange.IActions,
  'addMembersBanned' | 'deleteMembersBanned'
> {
  const doesMemberNeedBan =
    !group.bannedMembersV2?.some(member => member.serviceId === serviceId) &&
    serviceId !== ourAci;
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

      deleteMemberBannedAction.deletedUserId = encryptServiceId(
        clientZkGroupCipher,
        bannedMember.serviceId
      );

      return deleteMemberBannedAction;
    });
  }

  const addMemberBannedAction =
    new Proto.GroupChange.Actions.AddMemberBannedAction();

  const uuidCipherTextBuffer = encryptServiceId(clientZkGroupCipher, serviceId);
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
  ourAci,
  aci,
}: {
  group: ConversationAttributesType;
  ourAci: AciString;
  aci: AciString;
}): Proto.GroupChange.Actions {
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildDeletePendingAdminApprovalMemberChange: group was missing secretParams!'
    );
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const uuidCipherTextBuffer = encryptServiceId(clientZkGroupCipher, aci);

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
      ourAci,
      serviceId: aci,
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
  serviceId,
}: {
  group: ConversationAttributesType;
  profileKeyCredentialBase64: string;
  serverPublicParamsBase64: string;
  joinFromInviteLink?: boolean;
  serviceId: ServiceIdString;
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

  const doesMemberNeedUnban = group.bannedMembersV2?.some(
    member => member.serviceId === serviceId
  );
  if (doesMemberNeedUnban) {
    const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
    const userIdCipherText = encryptServiceId(clientZkGroupCipher, serviceId);

    const deleteMemberBannedAction =
      new Proto.GroupChange.Actions.DeleteMemberBannedAction();

    deleteMemberBannedAction.deletedUserId = userIdCipherText;
    actions.deleteMembersBanned = [deleteMemberBannedAction];
  }

  return actions;
}

export function buildDeletePendingMemberChange({
  serviceIds,
  group,
}: {
  serviceIds: ReadonlyArray<ServiceIdString>;
  group: ConversationAttributesType;
}): Proto.GroupChange.Actions {
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildDeletePendingMemberChange: group was missing secretParams!'
    );
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);

  const deletePendingMembers = serviceIds.map(serviceId => {
    const uuidCipherTextBuffer = encryptServiceId(
      clientZkGroupCipher,
      serviceId
    );
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
  ourAci,
  serviceId,
}: {
  group: ConversationAttributesType;
  ourAci: AciString;
  serviceId: ServiceIdString;
}): Proto.GroupChange.Actions {
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error('buildDeleteMemberChange: group was missing secretParams!');
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const uuidCipherTextBuffer = encryptServiceId(clientZkGroupCipher, serviceId);

  const deleteMember = new Proto.GroupChange.Actions.DeleteMemberAction();
  deleteMember.deletedUserId = uuidCipherTextBuffer;

  actions.version = (group.revision || 0) + 1;
  actions.deleteMembers = [deleteMember];

  const { addMembersBanned, deleteMembersBanned } =
    _maybeBuildAddBannedMemberActions({
      clientZkGroupCipher,
      group,
      ourAci,
      serviceId,
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
  serviceId,
  group,
}: {
  serviceId: ServiceIdString;
  group: ConversationAttributesType;
}): Proto.GroupChange.Actions {
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildAddBannedMemberChange: group was missing secretParams!'
    );
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const userIdCipherText = encryptServiceId(clientZkGroupCipher, serviceId);

  const addMemberBannedAction =
    new Proto.GroupChange.Actions.AddMemberBannedAction();

  addMemberBannedAction.added = new Proto.MemberBanned();
  addMemberBannedAction.added.userId = userIdCipherText;

  actions.addMembersBanned = [addMemberBannedAction];

  if (group.pendingAdminApprovalV2?.some(item => item.aci === serviceId)) {
    const deleteMemberPendingAdminApprovalAction =
      new Proto.GroupChange.Actions.DeleteMemberPendingAdminApprovalAction();

    deleteMemberPendingAdminApprovalAction.deletedUserId = userIdCipherText;

    actions.deleteMemberPendingAdminApprovals = [
      deleteMemberPendingAdminApprovalAction,
    ];
  }

  actions.version = (group.revision || 0) + 1;

  return actions;
}

export function buildModifyMemberRoleChange({
  serviceId,
  group,
  role,
}: {
  serviceId: ServiceIdString;
  group: ConversationAttributesType;
  role: number;
}): Proto.GroupChange.Actions {
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error('buildMakeAdminChange: group was missing secretParams!');
  }

  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const userIdCipherText = encryptServiceId(clientZkGroupCipher, serviceId);

  const toggleAdmin = new Proto.GroupChange.Actions.ModifyMemberRoleAction();
  toggleAdmin.userId = userIdCipherText;
  toggleAdmin.role = role;

  actions.version = (group.revision || 0) + 1;
  actions.modifyMemberRoles = [toggleAdmin];

  return actions;
}

export function buildPromotePendingAdminApprovalMemberChange({
  group,
  aci,
}: {
  group: ConversationAttributesType;
  aci: AciString;
}): Proto.GroupChange.Actions {
  const MEMBER_ROLE_ENUM = Proto.Member.Role;
  const actions = new Proto.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildAddPendingAdminApprovalMemberChange: group was missing secretParams!'
    );
  }

  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const userIdCipher = encryptServiceId(clientZkGroupCipher, aci);

  const promotePendingMember =
    new Proto.GroupChange.Actions.PromoteMemberPendingAdminApprovalAction();
  promotePendingMember.userId = userIdCipher;
  promotePendingMember.role = MEMBER_ROLE_ENUM.DEFAULT;

  actions.version = (group.revision || 0) + 1;
  actions.promoteMemberPendingAdminApprovals = [promotePendingMember];

  return actions;
}

export type BuildPromoteMemberChangeOptionsType = Readonly<{
  group: ConversationAttributesType;
  serverPublicParamsBase64: string;
  profileKeyCredentialBase64: string;
  isPendingPniAciProfileKey: boolean;
}>;

export function buildPromoteMemberChange({
  group,
  profileKeyCredentialBase64,
  serverPublicParamsBase64,
  isPendingPniAciProfileKey = false,
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

  const presentation = createProfileKeyCredentialPresentation(
    clientZkProfileCipher,
    profileKeyCredentialBase64,
    group.secretParams
  );

  if (isPendingPniAciProfileKey) {
    actions.promoteMembersPendingPniAciProfileKey = [
      {
        presentation,
      },
    ];
  } else {
    actions.promotePendingMembers = [
      {
        presentation,
      },
    ];
  }

  return actions;
}

async function uploadGroupChange({
  actions,
  groupId,
  groupPublicParamsBase64,
  groupSecretParamsBase64,
  inviteLinkPassword,
}: {
  actions: Proto.GroupChange.IActions;
  groupId: string;
  groupPublicParamsBase64: string;
  groupSecretParamsBase64: string;
  inviteLinkPassword?: string;
}): Promise<Proto.IGroupChangeResponse> {
  const logId = idForLogging(groupId);

  // Ensure we have the credentials we need before attempting GroupsV2 operations
  await maybeFetchNewCredentials();

  return makeRequestWithCredentials({
    logId: `uploadGroupChange/${logId}`,
    publicParams: groupPublicParamsBase64,
    secretParams: groupSecretParamsBase64,
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
  syncMessageOnly = false,
}: {
  conversation: ConversationModel;
  usingCredentialsFrom: ReadonlyArray<ConversationModel>;
  createGroupChange: () => Promise<Proto.GroupChange.Actions | undefined>;
  extraConversationsForSend?: ReadonlyArray<string>;
  inviteLinkPassword?: string;
  name: string;
  syncMessageOnly?: boolean;
}): Promise<void> {
  const logId = `${name}/${conversation.idForLogging()}`;

  if (!getIsGroupV2(conversation.attributes)) {
    throw new Error(
      `modifyGroupV2/${logId}: Called for non-GroupV2 conversation`
    );
  }

  const startTime = Date.now();
  const timeoutTime = startTime + MINUTE;

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

        const { groupId, secretParams, publicParams } = conversation.attributes;
        strictAssert(groupId, 'modifyGroupV2: missing groupId');
        strictAssert(secretParams, 'modifyGroupV2: missing secretParams');
        strictAssert(publicParams, 'modifyGroupV2: missing publicParams');

        // Upload. If we don't have permission, the server will return an error here.
        const groupChangeResponse = await uploadGroupChange({
          actions,
          groupId,
          groupPublicParamsBase64: publicParams,
          groupSecretParamsBase64: secretParams,
          inviteLinkPassword,
        });
        const { groupChange, groupSendEndorsementResponse } =
          groupChangeResponse;
        strictAssert(groupChange, 'modifyGroupV2: missing groupChange');

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
          recipients: syncMessageOnly ? [] : groupV2Info.members.slice(),
          revision: groupV2Info.revision,
        });

        // Read this after `maybeUpdateGroup` because it may have been updated
        const { membersV2 } = conversation.attributes;
        strictAssert(membersV2, 'modifyGroupV2: missing membersV2');

        // If we are no longer a member - endorsement won't be present
        if (Bytes.isNotEmpty(groupSendEndorsementResponse)) {
          try {
            log.info(`modifyGroupV2/${logId}: Saving group endorsements`);

            const groupEndorsementData = decodeGroupSendEndorsementResponse({
              groupId,
              groupSendEndorsementResponse,
              groupSecretParamsBase64: secretParams,
              groupMembersV2: membersV2,
            });

            await DataWriter.replaceAllEndorsementsForGroup(
              groupEndorsementData
            );
          } catch (error) {
            log.warn(
              `modifyGroupV2/${logId}: Problem saving group endorsements ${Errors.toLogFormat(error)}`
            );
          }
        }
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
        void conversation.fetchLatestGroupV2Data({ force: true });
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

async function makeRequestWithCredentials<T>({
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
  const groupCredentials = getCheckedGroupCredentialsForToday(
    `makeRequestWithCredentials/${logId}`
  );

  const sender = window.textsecure.messaging;
  if (!sender) {
    throw new Error(
      `makeRequestWithCredentials/${logId}: textsecure.messaging is not available!`
    );
  }

  log.info(`makeRequestWithCredentials/${logId}: starting`);

  const todayOptions = getGroupCredentials({
    authCredentialBase64: groupCredentials.today.credential,
    groupPublicParamsBase64: publicParams,
    groupSecretParamsBase64: secretParams,
    serverPublicParamsBase64: window.getServerPublicParams(),
  });

  return request(sender, todayOptions);
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

  const response = await makeRequestWithCredentials({
    logId: 'fetchMembershipProof',
    publicParams,
    secretParams,
    request: (sender, options) => sender.getGroupMembershipToken(options),
  });
  return dropNull(response.token);
}

// Creating a group

export async function createGroupV2(
  options: Readonly<{
    name: string;
    avatar: undefined | Uint8Array;
    expireTimer: undefined | DurationInSeconds;
    conversationIds: ReadonlyArray<string>;
    avatars?: ReadonlyArray<AvatarDataType>;
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

  const ourAci = window.storage.user.getCheckedAci();

  const ourConversation =
    window.ConversationController.getOurConversationOrThrow();
  if (ourConversation.hasProfileKeyCredentialExpired()) {
    log.info(`createGroupV2/${logId}: fetching our own credentials`);
    await ourConversation.getProfiles();
  }

  const membersV2: Array<GroupV2MemberType> = [
    {
      aci: ourAci,
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
        assertDev(
          false,
          `createGroupV2/${logId}: missing local contact, skipping`
        );
        return;
      }

      const contactServiceId = contact.getServiceId();
      if (!contactServiceId) {
        assertDev(
          false,
          `createGroupV2/${logId}: missing service id; skipping`
        );
        return;
      }

      // Refresh our local data to be sure
      if (contact.hasProfileKeyCredentialExpired()) {
        await contact.getProfiles();
      }

      if (contact.get('profileKey') && contact.get('profileKeyCredential')) {
        strictAssert(isAciString(contactServiceId), 'profile key without ACI');
        membersV2.push({
          aci: contactServiceId,
          role: MEMBER_ROLE_ENUM.DEFAULT,
          joinedAtVersion: 0,
        });
      } else {
        pendingMembersV2.push({
          addedByUserId: ourAci,
          serviceId: contactServiceId,
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

  const groupProto = buildGroupProto({
    id: groupId,
    avatarUrl: uploadedAvatar?.key,
    ...protoAndConversationAttributes,
  });

  try {
    const groupResponse = await makeRequestWithCredentials({
      logId: `createGroupV2/${logId}`,
      publicParams,
      secretParams,
      request: (sender, requestOptions) =>
        sender.createGroup(groupProto, requestOptions),
    });

    const { groupSendEndorsementResponse } = groupResponse;
    strictAssert(
      Bytes.isNotEmpty(groupSendEndorsementResponse),
      'missing groupSendEndorsementResponse'
    );

    try {
      const groupEndorsementData = decodeGroupSendEndorsementResponse({
        groupId,
        groupSendEndorsementResponse,
        groupSecretParamsBase64: secretParams,
        groupMembersV2: membersV2,
      });

      await DataWriter.replaceAllEndorsementsForGroup(groupEndorsementData);
    } catch (error) {
      log.warn(
        `createGroupV2/${logId}: Problem saving group endorsements ${Errors.toLogFormat(error)}`
      );
    }
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
        ...(await window.Signal.Migrations.writeNewAttachmentData(
          uploadedAvatar.data
        )),
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
      addedBy: ourAci,
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
    await storageServiceUploadJob({ reason: 'createGroupV2' });
  });

  const timestamp = Date.now();
  const groupV2Info = conversation.getGroupV2Info({
    includePendingMembers: true,
  });
  strictAssert(groupV2Info, 'missing groupV2Info');

  await conversationJobQueue.add({
    type: conversationQueueJobEnum.enum.GroupUpdate,
    conversationId: conversation.id,
    recipients: groupV2Info.members.slice(),
    revision: groupV2Info.revision,
  });

  const createdTheGroupMessage = new MessageModel({
    ...generateMessageId(incrementMessageCounter()),

    schemaVersion: MAX_MESSAGE_SCHEMA,
    type: 'group-v2-change',
    sourceServiceId: ourAci,
    conversationId: conversation.id,
    readStatus: ReadStatus.Read,
    received_at_ms: timestamp,
    timestamp,
    seenStatus: SeenStatus.Seen,
    sent_at: timestamp,
    groupV2Change: {
      from: ourAci,
      details: [{ type: 'create' }],
    },
  });
  await window.MessageCache.saveMessage(createdTheGroupMessage, {
    forceSave: true,
  });
  window.MessageCache.register(createdTheGroupMessage);
  drop(conversation.onNewMessage(createdTheGroupMessage));

  if (expireTimer) {
    await conversation.updateExpirationTimer(expireTimer, {
      reason: 'createGroupV2',
      version: undefined,
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
    await makeRequestWithCredentials({
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

  const ourAci = window.storage.user.getCheckedAci();
  const areWeMember =
    !conversation.get('left') && conversation.hasMember(ourAci);
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
    if (!contact.getServiceId()) {
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

  const ourAci = window.storage.user.getCheckedAci();

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
        if (
          !isMe(contact.attributes) &&
          window.Flags.GV2_MIGRATION_DISABLE_ADD
        ) {
          log.warn(
            `getGroupMigrationMembers/${logId}: membersV2 - skipping ${e164} due to GV2_MIGRATION_DISABLE_ADD flag`
          );
          return null;
        }

        const contactAci = contact.getAci();
        if (!contactAci) {
          log.warn(
            `getGroupMigrationMembers/${logId}: membersV2 - missing aci for ${e164}, skipping.`
          );
          return null;
        }

        if (!contact.get('profileKey')) {
          log.warn(
            `getGroupMigrationMembers/${logId}: membersV2 - missing profileKey for member ${e164}, skipping.`
          );
          return null;
        }

        // Refresh our local data to be sure
        if (!contact.get('profileKeyCredential')) {
          await contact.getProfiles();
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
          aci: contactAci,
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

      if (
        !isMe(contact.attributes) &&
        window.Flags.GV2_MIGRATION_DISABLE_INVITE
      ) {
        log.warn(
          `getGroupMigrationMembers/${logId}: pendingMembersV2 - skipping ${e164} due to GV2_MIGRATION_DISABLE_INVITE flag`
        );
        droppedGV2MemberIds.push(conversationId);
        return null;
      }

      const contactUuid = contact.getServiceId();
      if (!contactUuid) {
        log.warn(
          `getGroupMigrationMembers/${logId}: pendingMembersV2 - missing uuid for ${e164}, skipping.`
        );
        droppedGV2MemberIds.push(conversationId);
        return null;
      }

      if (conversationId === ourConversationId) {
        areWeInvited = true;
      }

      return {
        serviceId: contactUuid,
        timestamp: now,
        addedByUserId: ourAci,
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

      const isEligible = await isGroupEligibleToMigrate(conversation);
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

      const { avatar: currentAvatar } = conversation.attributes;
      if (currentAvatar?.path) {
        const avatarData =
          await window.Signal.Migrations.readAttachmentData(currentAvatar);
        const { hash, key } = await uploadAvatar({
          logId,
          publicParams,
          secretParams,
          data: avatarData,
        });
        avatarAttribute = {
          ...currentAvatar,
          url: key,
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

      let groupSendEndorsementResponse: Uint8Array | null | undefined;
      try {
        const groupResponse = await makeRequestWithCredentials({
          logId: `initiateMigrationToGroupV2/${logId}`,
          publicParams,
          secretParams,
          request: (sender, options) => sender.createGroup(groupProto, options),
        });

        groupSendEndorsementResponse =
          groupResponse.groupSendEndorsementResponse;
      } catch (error) {
        log.error(
          `initiateMigrationToGroupV2/${logId}: Error creating group:`,
          Errors.toLogFormat(error)
        );

        throw error;
      }

      const groupChangeMessages: Array<GroupChangeMessageType> = [];
      groupChangeMessages.push({
        type: 'group-v1-migration',
        groupMigration: {
          areWeInvited: false,
          droppedMemberIds: droppedGV2MemberIds,
          invitedMembers: pendingMembersV2.map(
            ({ serviceId: uuid, ...rest }) => {
              return { ...rest, uuid };
            }
          ),
        },
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
      });

      await updateGroup({
        conversation,
        updates: {
          newAttributes,
          groupChangeMessages,
          newProfileKeys: new Map(),
        },
      });

      if (window.storage.blocked.isGroupBlocked(previousGroupV1Id)) {
        await window.storage.blocked.addBlockedGroup(groupId);
      }

      // Save these most recent updates to conversation
      await updateConversation(conversation.attributes);

      strictAssert(
        Bytes.isNotEmpty(groupSendEndorsementResponse),
        'missing groupSendEndorsementResponse'
      );

      try {
        const groupEndorsementData = decodeGroupSendEndorsementResponse({
          groupId,
          groupSendEndorsementResponse,
          groupSecretParamsBase64: secretParams,
          groupMembersV2: membersV2,
        });

        await DataWriter.replaceAllEndorsementsForGroup(groupEndorsementData);
      } catch (error) {
        log.warn(
          `initiateMigrationToGroupV2/${logId}: Problem saving group endorsements ${Errors.toLogFormat(error)}`
        );
      }
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
    recipients: groupV2Info.members.slice(),
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
        Errors.toLogFormat(error)
      );
    }
  });
}

export function buildMigrationBubble(
  previousGroupV1MembersIds: ReadonlyArray<string>,
  newAttributes: ConversationAttributesType
): GroupChangeMessageType {
  const ourAci = window.storage.user.getCheckedAci();
  const ourPni = window.storage.user.getPni();
  const ourConversationId =
    window.ConversationController.getOurConversationId();

  // Assemble items to commemorate this event for the timeline..
  const combinedConversationIds: Array<string> = [
    ...(newAttributes.membersV2 || []).map(item => item.aci),
    ...(newAttributes.pendingMembersV2 || []).map(item => item.serviceId),
  ].map(serviceId => {
    const conversation = window.ConversationController.lookupOrCreate({
      serviceId,
      reason: 'buildMigrationBubble',
    });
    strictAssert(conversation, `Conversation not found for ${serviceId}`);
    return conversation.id;
  });
  const droppedMemberIds: Array<string> = difference(
    previousGroupV1MembersIds,
    combinedConversationIds
  ).filter(id => id && id !== ourConversationId);
  const invitedMembers = (newAttributes.pendingMembersV2 || []).filter(
    item => item.serviceId !== ourAci && !(ourPni && item.serviceId === ourPni)
  );

  const areWeInvited = (newAttributes.pendingMembersV2 || []).some(
    item => item.serviceId === ourAci || (ourPni && item.serviceId === ourPni)
  );

  return {
    type: 'group-v1-migration',
    groupMigration: {
      areWeInvited,
      invitedMembers: invitedMembers.map(({ serviceId: uuid, ...rest }) => {
        return { ...rest, uuid };
      }),
      droppedMemberIds,
    },
  };
}

export function getBasicMigrationBubble(): GroupChangeMessageType {
  return {
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
      newProfileKeys: new Map(),
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

  const ourAci = window.storage.user.getCheckedAci();
  const wereWePreviouslyAMember = conversation.hasMember(ourAci);

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
  let groupSendEndorsementResponse: Uint8Array | null | undefined;

  try {
    const fetchedAt = Date.now();
    const response: GroupLogResponseType = await makeRequestWithCredentials({
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
            cachedEndorsementsExpiration: null, // we won't have them here
          },
          options
        ),
    });
    setLastSuccessfulGroupFetch(conversation.id, fetchedAt);

    // Attempt to start with the first group state, only later processing future updates
    firstGroupState = response?.changes?.groupChanges?.[0]?.groupState;
    groupSendEndorsementResponse = response.groupSendEndorsementResponse;
  } catch (error) {
    if (error.code === GROUP_ACCESS_DENIED_CODE) {
      log.info(
        `respondToGroupV2Migration/${logId}: Failed to access log endpoint; fetching full group state`
      );
      try {
        const fetchedAt = Date.now();
        const groupResponse = await makeRequestWithCredentials({
          logId: `getGroup/${logId}`,
          publicParams,
          secretParams,
          request: (sender, options) => sender.getGroup(options),
        });
        setLastSuccessfulGroupFetch(conversation.id, fetchedAt);

        firstGroupState = groupResponse.group;
        groupSendEndorsementResponse =
          groupResponse.groupSendEndorsementResponse;
      } catch (secondError) {
        if (secondError.code === GROUP_ACCESS_DENIED_CODE) {
          log.info(
            `respondToGroupV2Migration/${logId}: Failed to access state endpoint; user is no longer part of group`
          );

          if (window.storage.blocked.isGroupBlocked(previousGroupV1Id)) {
            await window.storage.blocked.addBlockedGroup(groupId);
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
                    item => item !== ourAci && item !== ourNumber
                  ),
                },
                groupChangeMessages: [
                  {
                    ...getBasicMigrationBubble(),
                    readStatus: ReadStatus.Read,
                    seenStatus: SeenStatus.Seen,
                  },
                  {
                    type: 'group-v2-change',
                    groupV2Change: {
                      details: [
                        {
                          type: 'member-remove' as const,
                          aci: ourAci,
                        },
                      ],
                    },
                    readStatus: ReadStatus.Read,
                    seenStatus: SeenStatus.Unseen,
                  },
                ],
                newProfileKeys: new Map(),
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
              newProfileKeys: new Map(),
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
    item => item.serviceId === ourAci
  );
  const areWeMember = (newAttributes.membersV2 || []).some(
    item => item.aci === ourAci
  );
  if (!areWeInvited && !areWeMember) {
    // Add a message to the timeline saying the user was removed. This shouldn't happen.
    groupChangeMessages.push({
      type: 'group-v2-change',
      groupV2Change: {
        details: [
          {
            type: 'member-remove' as const,
            aci: ourAci,
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
      newProfileKeys: profileKeysToMap(newProfileKeys),
    },
  });

  if (window.storage.blocked.isGroupBlocked(previousGroupV1Id)) {
    await window.storage.blocked.addBlockedGroup(groupId);
  }

  // Save these most recent updates to conversation
  await updateConversation(conversation.attributes);

  // Finally, check for any changes to the group since its initial creation using normal
  //   group update codepaths.
  await maybeUpdateGroup({
    conversation,
    groupChange,
    newRevision,
    receivedAt,
    sentAt,
  });

  if (Bytes.isNotEmpty(groupSendEndorsementResponse)) {
    try {
      const { membersV2 } = conversation.attributes;
      strictAssert(membersV2, 'missing membersV2');

      const groupEndorsementData = decodeGroupSendEndorsementResponse({
        groupId,
        groupSendEndorsementResponse,
        groupSecretParamsBase64: secretParams,
        groupMembersV2: membersV2,
      });

      await DataWriter.replaceAllEndorsementsForGroup(groupEndorsementData);
    } catch (error) {
      log.warn(
        `respondToGroupV2Migration/${logId}: Problem saving group endorsements ${Errors.toLogFormat(error)}`
      );
    }
  }
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

const FIVE_MINUTES = 5 * MINUTE;

export async function waitThenMaybeUpdateGroup(
  options: MaybeUpdatePropsType,
  { viaFirstStorageSync = false } = {}
): Promise<void> {
  const { conversation } = options;
  const logId = `waitThenMaybeUpdateGroup(${conversation.idForLogging()})`;

  if (conversation.isBlocked()) {
    log.info(`${logId}: Conversation is blocked, returning early`);
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
      `${logId}: group update was fetched recently, skipping for ${waitTime}ms`
    );
    return;
  }

  log.info(`${logId}: group update was not fetched recently, queuing update`);

  // Then wait to process all outstanding messages for this conversation
  await conversation.queueJob('waitThenMaybeUpdateGroup', async () => {
    try {
      // And finally try to update the group
      await maybeUpdateGroup(options, { viaFirstStorageSync });
    } catch (error) {
      setLastSuccessfulGroupFetch(conversation.id, undefined);
      log.error(
        `${logId}: maybeUpdateGroup failure:`,
        Errors.toLogFormat(error)
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
  const logId = `maybeUpdateGroup/${conversation.idForLogging()}`;

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
    log.error(`${logId}: Failed to update group:`, Errors.toLogFormat(error));
    throw error;
  }
}

/**
 * UpdateGroup runs on the conversation's queue, and it overwrites all of conversation
 * attributes. This would be fine, except we have some time-sensitive conversation-related
 * tasks that happen off-queue, notably: updateUnread(). This is a non-exhaustive list of
 * attributes that should never be stomped by updateGroup. Attributes should be added here
 * if:
 * 1) [most importantly!] they will never be updated by updateGroup, and
 * 2) they are updated off-queue and therefore at risk of being stomped on.
 *
 * TODO (DESKTOP-7729): consider better separating conversation data to avoid this
 */
const FIELDS_UNRELATED_TO_GROUP_STATE = ['unreadCount', 'unreadMentionsOfMe'];

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

  const { newAttributes, groupChangeMessages, newProfileKeys } = updates;
  const ourAci = window.textsecure.storage.user.getCheckedAci();
  const ourPni = window.textsecure.storage.user.getPni();

  const wasMemberOrPending =
    conversation.hasMember(ourAci) ||
    conversation.isMemberPending(ourAci) ||
    (ourPni && conversation.isMemberPending(ourPni));
  const isMemberOrPending =
    !newAttributes.left ||
    newAttributes.pendingMembersV2?.some(
      item => item.serviceId === ourAci || item.serviceId === ourPni
    );

  // Ensure that all generated messages are ordered properly.
  // Before the provided timestamp so update messages appear before the
  //   initiating message, or after now().
  const finalReceivedAt = receivedAt || incrementMessageCounter();
  const initialSentAt = sentAt || Date.now();

  // GroupV1 -> GroupV2 migration changes the groupId, and we need to update our id-based
  //   lookups if there's a change on that field.
  const previousId = conversation.get('groupId');
  const idChanged = previousId && previousId !== newAttributes.groupId;

  // By updating activeAt we force this conversation into the left panel. We don't want
  //   all groups to show up on link, and we don't want Unknown Group in the left pane.
  let activeAt = conversation.get('active_at') || null;
  const justDiscoveredGroupName =
    !conversation.get('name') && newAttributes.name;
  if (
    !viaFirstStorageSync &&
    (justDiscoveredGroupName || groupChangeMessages.length)
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
      ...generateMessageId(finalReceivedAt),
      schemaVersion: MAX_MESSAGE_SCHEMA,
      conversationId: conversation.id,
      received_at_ms: syntheticSentAt,
      sent_at: syntheticSentAt,
      timestamp,
    };
  });

  const contactsWithoutProfileKey = new Array<ConversationModel>();

  // Capture profile key for each member in the group, if we don't have it yet
  for (const [aci, profileKey] of newProfileKeys) {
    const contact = window.ConversationController.getOrCreate(aci, 'private');

    if (
      !isMe(contact.attributes) &&
      profileKey &&
      profileKey.length > 0 &&
      contact.get('profileKey') !== profileKey
    ) {
      contactsWithoutProfileKey.push(contact);
      drop(contact.setProfileKey(profileKey, { reason: 'updateGroup' }));
    }
  }

  let profileFetches: Promise<Array<void>> | undefined;
  if (contactsWithoutProfileKey.length !== 0) {
    log.info(
      `updateGroup/${logId}: fetching ` +
        `${contactsWithoutProfileKey.length} missing profiles`
    );

    profileFetches = Promise.all(
      contactsWithoutProfileKey.map(contact => {
        return getProfile({
          serviceId: contact.getServiceId() ?? null,
          e164: contact.get('e164') ?? null,
          groupId: newAttributes.groupId ?? null,
        });
      })
    );
  }

  // If we've been added by a blocked contact, then schedule a task to leave group
  const justAdded = !wasMemberOrPending && isMemberOrPending;
  const addedBy =
    newAttributes.pendingMembersV2?.find(
      item => item.serviceId === ourAci || item.serviceId === ourPni
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
      drop(waitThenLeave());

      // Return early to discard group changes resulting from the blocked user's action.
      return;
    }
  }

  // We update group membership last to ensure that all notifications are in place before
  //   the group updates happen on the model.
  if (changeMessagesToSave.length > 0) {
    try {
      if (contactsWithoutProfileKey && contactsWithoutProfileKey.length > 0) {
        await Promise.race([profileFetches, sleep(30 * SECOND)]);
        log.info(
          `updateGroup/${logId}: timed out or finished fetching ${contactsWithoutProfileKey.length} profiles`
        );
      }
    } catch (error) {
      log.error(
        `updateGroup/${logId}: failed to fetch missing profiles`,
        Errors.toLogFormat(error)
      );
    }
    await appendChangeMessages(conversation, changeMessagesToSave);
  }

  conversation.set({
    ...omit(newAttributes, FIELDS_UNRELATED_TO_GROUP_STATE),
    active_at: activeAt,
  });

  if (idChanged) {
    conversation.trigger('idUpdated', conversation, 'groupId', previousId);
  }

  // Save these most recent updates to conversation
  await updateConversation(conversation.attributes);
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
  } else if (
    secondDetail.type === 'admin-approval-remove-one' &&
    (secondChange.from == null || secondChange.from === secondDetail.aci)
  ) {
    isApprovalPending = false;
  } else {
    return undefined;
  }

  const { aci } = secondDetail;
  strictAssert(aci, 'admin approval message should have aci');

  let updatedDetail;
  // Member was previously added and is now removed
  if (
    !isApprovalPending &&
    firstDetail.type === 'admin-approval-add-one' &&
    firstDetail.aci === aci
  ) {
    updatedDetail = {
      type: 'admin-approval-bounce' as const,
      aci,
      times: 1,
      isApprovalPending,
    };

    // There is an existing bounce event - merge this one into it.
  } else if (
    firstDetail.type === 'admin-approval-bounce' &&
    firstDetail.aci === aci &&
    firstDetail.isApprovalPending === !isApprovalPending
  ) {
    updatedDetail = {
      type: 'admin-approval-bounce' as const,
      aci,
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

  const ourAci = window.textsecure.storage.user.getCheckedAci();

  let lastMessage = await DataReader.getLastConversationMessage({
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
    await window.MessageCache.saveMessage(first, {
      // We don't use forceSave here because this is an update of existing
      // message.
    });

    log.info(
      `appendChangeMessages/${logId}: saving ${rest.length} new messages`
    );
    await DataWriter.saveMessages(rest, {
      ourAci,
      forceSave: true,
      postSaveUpdates,
    });
  } else {
    log.info(
      `appendChangeMessages/${logId}: saving ${mergedMessages.length} new messages`
    );
    await DataWriter.saveMessages(mergedMessages, {
      ourAci,
      forceSave: true,
      postSaveUpdates,
    });
  }

  let newMessages = 0;
  for (const changeMessage of mergedMessages) {
    const existing = window.MessageCache.getById(changeMessage.id);

    // Update existing message
    if (existing) {
      strictAssert(
        changeMessage.id === lastMessage?.id,
        'Should only update group change that was already in the database'
      );
      existing.set(changeMessage);
      continue;
    }

    const model = window.MessageCache.register(new MessageModel(changeMessage));
    drop(conversation.onNewMessage(model));
    newMessages += 1;
  }

  // We updated the message, but didn't add new ones - refresh left pane
  if (!newMessages && mergedMessages.length > 0) {
    await conversation.updateLastMessage();
    void conversation.updateUnread();
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
  const ourAci = window.storage.user.getCheckedAci();

  const isInitialCreationMessage = isFirstFetch && newRevision === 0;
  const weAreAwaitingApproval = (group.pendingAdminApprovalV2 || []).some(
    item => item.aci === ourAci
  );
  const isOneVersionUp =
    isNumber(currentRevision) &&
    isNumber(newRevision) &&
    newRevision === currentRevision + 1;

  if (
    window.Flags.GV2_ENABLE_SINGLE_CHANGE_PROCESSING &&
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
      const { isTrusted } = wrappedGroupChange;
      let isUntrustedChangeVerified = false;

      if (!isTrusted) {
        strictAssert(
          groupChange.serverSignature,
          'Server signature must be present in untrusted group change'
        );
        strictAssert(
          groupChange.actions,
          'Actions must be present in untrusted group change'
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
            newProfileKeys: new Map(),
          };
        }

        const { groupId: groupIdBytes } = Proto.GroupChange.Actions.decode(
          groupChange.actions || new Uint8Array(0)
        );
        const actionsGroupId: string | undefined =
          groupIdBytes && groupIdBytes.length !== 0
            ? Bytes.toBase64(groupIdBytes)
            : undefined;
        if (actionsGroupId && actionsGroupId === group.groupId) {
          isUntrustedChangeVerified = true;
        } else if (!actionsGroupId) {
          log.warn(
            `getGroupUpdates/${logId}: Missing groupId in group change actions`
          );
        } else {
          log.warn(
            `getGroupUpdates/${logId}: Incorrect groupId in group change actions`
          );
        }
      }

      if (isTrusted || isUntrustedChangeVerified) {
        return updateGroupViaSingleChange({
          group,
          newRevision,
          groupChange,
        });
      }
    }

    log.info(
      `getGroupUpdates/${logId}: Failing over; group change unsupported`
    );
  }

  const areWeMember = (group.membersV2 || []).some(item => item.aci === ourAci);
  const isReJoin = !isFirstFetch && !areWeMember;

  if (window.Flags.GV2_ENABLE_CHANGE_PROCESSING) {
    try {
      return await updateGroupViaLogs({
        group,
        newRevision,
      });
    } catch (error) {
      const nextStep = isReJoin
        ? 'attempting to fetch from re-join revision'
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

  if (isReJoin && window.Flags.GV2_ENABLE_CHANGE_PROCESSING) {
    try {
      return await updateGroupViaLogs({
        group,
        newRevision,
        isReJoin,
      });
    } catch (error) {
      if (error.code === TEMPORAL_AUTH_REJECTED_CODE) {
        // We will fail over to the updateGroupViaState call below
        log.info(
          `getGroupUpdates/${logId}: Temporal credential failure, now fetching full state`
        );
      } else if (error.code === GROUP_ACCESS_DENIED_CODE) {
        // We will fail over to the updateGroupViaState call below
        log.info(
          `getGroupUpdates/${logId}: Log access denied, now fetching full state`
        );
      } else {
        throw error;
      }
    }
  }

  if (window.Flags.GV2_ENABLE_STATE_PROCESSING) {
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

  if (window.Flags.GV2_ENABLE_PRE_JOIN_FETCH) {
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
    newProfileKeys: new Map(),
  };
}

async function updateGroupViaPreJoinInfo({
  group,
}: {
  group: ConversationAttributesType;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  const ourAci = window.textsecure.storage.user.getCheckedAci();

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
  const preJoinInfo = await makeRequestWithCredentials({
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

  let newAttributes: ConversationAttributesType = {
    ...group,
    description: decryptGroupDescription(
      dropNull(preJoinInfo.descriptionBytes),
      secretParams
    ),
    name: decryptGroupTitle(dropNull(preJoinInfo.title), secretParams),
    left: true,
    members: group.members || [],
    pendingMembersV2: group.pendingMembersV2 || [],
    pendingAdminApprovalV2: [
      {
        aci: ourAci,
        timestamp: Date.now(),
      },
    ],
    revision: dropNull(preJoinInfo.version),

    temporaryMemberCount: preJoinInfo.memberCount || 1,
  };

  newAttributes = {
    ...newAttributes,
    ...(await applyNewAvatar(
      dropNull(preJoinInfo.avatar),
      newAttributes,
      logId
    )),
  };

  return {
    newAttributes,
    groupChangeMessages: extractDiffs({
      old: group,
      current: newAttributes,
      dropInitialJoinMessage: false,
    }),
    newProfileKeys: new Map(),
  };
}

async function updateGroupViaState({
  dropInitialJoinMessage,
  group,
}: {
  dropInitialJoinMessage?: boolean;
  group: ConversationAttributesType;
}): Promise<UpdatesResultType> {
  const { id, publicParams, secretParams } = group;
  const logId = `updateGroupViaState/${idForLogging(group.groupId)}`;

  strictAssert(secretParams, `${logId}: Missing secretParams`);
  strictAssert(publicParams, `${logId}: Missing publicParams`);

  const fetchedAt = Date.now();
  const groupResponse = await makeRequestWithCredentials({
    logId: `getGroup/${logId}`,
    publicParams,
    secretParams,
    request: (sender, requestOptions) => sender.getGroup(requestOptions),
  });
  setLastSuccessfulGroupFetch(id, fetchedAt);

  const { group: groupState, groupSendEndorsementResponse } = groupResponse;
  strictAssert(groupState, 'updateGroupViaState: Group state must be present');

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

  // If we're not in the group, we won't receive endorsements
  if (Bytes.isNotEmpty(groupSendEndorsementResponse)) {
    try {
      // Use the latest state of the group after applying changes
      const { groupId, membersV2 } = newAttributes;
      strictAssert(groupId, 'updateGroupViaState: Group must have groupId');
      strictAssert(membersV2, 'updateGroupViaState: Group must have membersV2');

      log.info(`getCurrentGroupState/${logId}: Saving group endorsements`);

      const groupEndorsementData = decodeGroupSendEndorsementResponse({
        groupId,
        groupSendEndorsementResponse,
        groupSecretParamsBase64: secretParams,
        groupMembersV2: membersV2,
      });

      await DataWriter.replaceAllEndorsementsForGroup(groupEndorsementData);
    } catch (error) {
      log.warn(
        `updateGroupViaState/${logId}: Problem saving group endorsements ${Errors.toLogFormat(error)}`
      );
    }
  }

  return {
    newAttributes,
    groupChangeMessages: extractDiffs({
      old: group,
      current: newAttributes,
      dropInitialJoinMessage,
    }),
    newProfileKeys: profileKeysToMap(newProfileKeys),
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
  const previouslyKnewAboutThisGroup =
    isNumber(group.revision) && group.membersV2?.length;
  const wasInGroup = !group.left;

  setLastSuccessfulGroupFetch(group.id, undefined);

  const singleChangeResult: UpdatesResultType = await integrateGroupChange({
    group,
    groupChange,
    newRevision,
  });

  const nowInGroup = !singleChangeResult.newAttributes.left;

  // If we were just added to the group (for example, via a join link), we go fetch the
  //   entire group state to make sure we're up to date. Note: we fetch the group state
  //   via the log endpoint to stay at newRevision.
  if (!wasInGroup && nowInGroup) {
    const logId = idForLogging(group.groupId);
    log.info(
      `updateGroupViaSingleChange/${logId}: Just joined group; fetching entire state for revision ${newRevision}.`
    );
    const {
      newAttributes,
      newProfileKeys,
      groupChangeMessages: catchupMessages,
    } = await updateGroupViaLogs({
      group: singleChangeResult.newAttributes,
      newRevision,
    });

    const groupChangeMessages = [...singleChangeResult.groupChangeMessages];
    // If we've just been added to a group we were previously in, we do want to show
    //   a summary instead of nothing.
    if (
      groupChangeMessages.length > 0 &&
      previouslyKnewAboutThisGroup &&
      catchupMessages.length > 0
    ) {
      groupChangeMessages.push({
        type: 'group-v2-change',
        groupV2Change: {
          details: [
            {
              type: 'summary',
            },
          ],
        },
        readStatus: ReadStatus.Read,
        // For simplicity, since we don't know who this change is from here, always Seen
        seenStatus: SeenStatus.Seen,
      });
    }

    // We discard any change events that come out of this full group fetch, but we do
    //   keep the final group attributes generated, as well as any new members.
    return {
      groupChangeMessages,
      newProfileKeys: new Map([
        ...singleChangeResult.newProfileKeys,
        ...newProfileKeys,
      ]),
      newAttributes,
    };
  }

  return singleChangeResult;
}

function getLastRevisionFromChanges(
  changes: ReadonlyArray<Proto.IGroupChanges>
): number | undefined {
  for (let i = changes.length - 1; i >= 0; i -= 1) {
    const change = changes[i];
    if (!change) {
      continue;
    }

    const { groupChanges } = change;
    if (!groupChanges) {
      continue;
    }

    for (let j = groupChanges.length - 1; j >= 0; j -= 1) {
      const groupChange = groupChanges[j];
      if (!groupChange) {
        continue;
      }

      const { groupState } = groupChange;
      if (!groupState) {
        continue;
      }

      const { version } = groupState;
      if (isNumber(version)) {
        return version;
      }
    }
  }

  return undefined;
}

async function updateGroupViaLogs({
  group,
  newRevision,
  isReJoin,
}: {
  group: ConversationAttributesType;
  newRevision: number | undefined;
  isReJoin?: boolean;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  const { publicParams, secretParams } = group;
  if (!publicParams) {
    throw new Error('updateGroupViaLogs: group was missing publicParams!');
  }
  if (!secretParams) {
    throw new Error('updateGroupViaLogs: group was missing secretParams!');
  }

  const currentRevision = isReJoin ? undefined : group.revision;
  let includeFirstState = true;

  log.info(
    `updateGroupViaLogs/${logId}: Getting group delta from ` +
      `${currentRevision ?? '?'} to ${newRevision ?? '?'} for group ` +
      `groupv2(${group.groupId})...`
  );

  // The range is inclusive so make sure that we always request the revision
  // that we are currently at since we might want the latest full state in
  // `integrateGroupChanges`.
  let revisionToFetch = isNumber(currentRevision) ? currentRevision : undefined;

  const { groupId } = group;
  strictAssert(groupId != null, 'Group must have groupId');

  let cachedEndorsementsExpiration =
    await DataReader.getGroupSendCombinedEndorsementExpiration(groupId);

  if (cachedEndorsementsExpiration != null) {
    const result = validateGroupSendEndorsementsExpiration(
      cachedEndorsementsExpiration * 1000
    );
    if (!result.valid) {
      log.info(
        `updateGroupViaLogs/${logId}: Endorsements are expired (${result.reason}), fetching new endorsements`
      );
    }
    cachedEndorsementsExpiration = null;
  }

  let response: GroupLogResponseType;
  let groupSendEndorsementResponse: Uint8Array | null = null;
  const changes: Array<Proto.IGroupChanges> = [];
  do {
    const fetchedAt = Date.now();
    // eslint-disable-next-line no-await-in-loop
    response = await makeRequestWithCredentials({
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
            cachedEndorsementsExpiration,
          },
          requestOptions
        ),
    });
    setLastSuccessfulGroupFetch(group.id, fetchedAt);

    // When the log is long enough that it needs to be paginated, the server is
    // not stateful enough to only give us endorsements when we need them.
    // In this case we need to delete all endorsements and send `0` to get
    // endorsements from the next page.
    if (response.paginated && cachedEndorsementsExpiration != null) {
      log.info(
        'updateGroupViaLogs: Received paginated response, deleting group endorsements'
      );
      // eslint-disable-next-line no-await-in-loop
      await DataWriter.deleteAllEndorsementsForGroup(groupId);
      cachedEndorsementsExpiration = null; // gets sent as 0 in header
    }

    // Note: We should only get this on the final page
    if (response.groupSendEndorsementResponse != null) {
      groupSendEndorsementResponse = response.groupSendEndorsementResponse;
    }

    changes.push(response.changes);
    if (response.paginated && response.end) {
      revisionToFetch = response.end + 1;
    }

    includeFirstState = false;
  } while (
    response.paginated &&
    response.end &&
    (newRevision === undefined || response.end < newRevision)
  );

  // Would be nice to cache the unused groupChanges here, to reduce server roundtrips

  const updates = await integrateGroupChanges({
    changes,
    group,
    newRevision,
  });

  const currentVersion = response.paginated
    ? response.currentRevision
    : getLastRevisionFromChanges(changes);
  const isAtLatestVersion =
    isNumber(currentVersion) &&
    updates.newAttributes.revision === currentVersion;

  if (isAtLatestVersion && Bytes.isNotEmpty(groupSendEndorsementResponse)) {
    try {
      log.info(`updateGroupViaLogs/${logId}: Saving group endorsements`);
      // Use the latest state of the group after applying changes
      const { membersV2 } = updates.newAttributes;
      strictAssert(
        membersV2 != null,
        'updateGroupViaLogs: Group must have membersV2'
      );

      const groupEndorsementData = decodeGroupSendEndorsementResponse({
        groupId,
        groupSendEndorsementResponse,
        groupMembersV2: membersV2,
        groupSecretParamsBase64: secretParams,
      });

      await DataWriter.replaceAllEndorsementsForGroup(groupEndorsementData);
    } catch (error) {
      log.warn(
        `updateGroupViaLogs/${logId}: Problem saving group endorsements ${Errors.toLogFormat(error)}`
      );
    }
  }

  return updates;
}

async function generateLeftGroupChanges(
  group: ConversationAttributesType
): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  log.info(`generateLeftGroupChanges/${logId}: Starting...`);
  const ourAci = window.storage.user.getCheckedAci();
  const ourPni = window.storage.user.getCheckedPni();

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

      revision = dropNull(preJoinInfo.version);
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
    membersV2: (group.membersV2 || []).filter(member => member.aci !== ourAci),
    pendingMembersV2: (group.pendingMembersV2 || []).filter(
      member => member.serviceId !== ourAci && member.serviceId !== ourPni
    ),
    pendingAdminApprovalV2: (group.pendingAdminApprovalV2 || []).filter(
      member => member.aci !== ourAci
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
    newProfileKeys: new Map(),
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
  changes: ReadonlyArray<Proto.IGroupChanges>;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  let attributes = group;
  const finalMessages: Array<Array<GroupChangeMessageType>> = [];
  const finalNewProfileKeys = new Map<AciString, string>();

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
          newProfileKeys,
          // eslint-disable-next-line no-await-in-loop
        } = await integrateGroupChange({
          group: attributes,
          newRevision,
          groupChange: dropNull(groupChange),
          groupState: dropNull(groupState),
        });

        attributes = newAttributes;
        finalMessages.push(groupChangeMessages);
        for (const [aci, profileKey] of newProfileKeys) {
          finalNewProfileKeys.set(aci, profileKey);
        }
      } catch (error) {
        log.error(
          `integrateGroupChanges/${logId}: Failed to apply change log, continuing to apply remaining change logs.`,
          Errors.toLogFormat(error)
        );
      }
    }
  }

  // If this is our first fetch, we will collapse this down to one set of messages
  const isFirstFetch = !isNumber(group.revision);
  // ...but only if there has been more than one revision since creation
  const moreThanOneVersion = Boolean(attributes.revision);

  if (isFirstFetch && moreThanOneVersion) {
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
      newProfileKeys: finalNewProfileKeys,
    };
  }

  return {
    newAttributes: attributes,
    groupChangeMessages: flatten(finalMessages),
    newProfileKeys: finalNewProfileKeys,
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
  const ourAci = window.storage.user.getCheckedAci();
  const weAreAwaitingApproval = (group.pendingAdminApprovalV2 || []).some(
    item => item.aci === ourAci
  );
  const weAreInGroup = (group.membersV2 || []).some(
    item => item.aci === ourAci
  );
  const isReJoin = !isFirstFetch && !weAreInGroup;

  // These need to be populated from the groupChange. But we might not get one!
  let isChangeSupported = false;
  let isSameVersion = false;
  let isMoreThanOneVersionUp = false;
  let groupChangeActions: undefined | Proto.GroupChange.IActions;
  let decryptedChangeActions: undefined | DecryptedGroupChangeActions;
  let sourceServiceId: undefined | ServiceIdString;

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
        newProfileKeys: new Map(),
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
    ({ sourceServiceId } = decryptedChangeActions);
    strictAssert(sourceServiceId, 'Should have source service id');

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
          newProfileKeys: new Map(),
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
  const finalNewProfileKeys = new Map<AciString, string>();

  const canApplyChange =
    groupChange &&
    isChangeSupported &&
    !isSameVersion &&
    !isFirstFetch &&
    (!isMoreThanOneVersionUp || weAreAwaitingApproval);

  // Apply the change first
  if (canApplyChange) {
    if (!sourceServiceId || !groupChangeActions || !decryptedChangeActions) {
      throw new Error(
        `integrateGroupChange/${logId}: Missing necessary information that should have come from group actions`
      );
    }

    log.info(
      `integrateGroupChange/${logId}: Applying group change actions, ` +
        `from version ${group.revision} to ${groupChangeActions.version}`
    );

    const { newAttributes, newProfileKeys, promotedAciToPniMap } =
      await applyGroupChange({
        group,
        actions: decryptedChangeActions,
        sourceServiceId,
      });

    const groupChangeMessages = extractDiffs({
      old: attributes,
      current: newAttributes,
      sourceServiceId,
      promotedAciToPniMap,
    });

    attributes = newAttributes;
    aggregatedChangeMessages.push(groupChangeMessages);
    for (const [aci, profileKey] of profileKeysToMap(newProfileKeys)) {
      finalNewProfileKeys.set(aci, profileKey);
    }
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
        isReJoin,
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

    const {
      newAttributes,
      newProfileKeys: newProfileKeysList,
      otherChanges,
    } = await applyGroupState({
      group: attributes,
      groupState: decryptedGroupState,
      sourceServiceId: isFirstFetch || isReJoin ? sourceServiceId : undefined,
    });

    const groupChangeMessages = extractDiffs({
      old: attributes,
      current: newAttributes,
      sourceServiceId: isFirstFetch || isReJoin ? sourceServiceId : undefined,
      isReJoin,
    });

    const newProfileKeys = profileKeysToMap(newProfileKeysList);

    if (
      canApplyChange &&
      (groupChangeMessages.length !== 0 ||
        newProfileKeys.size !== 0 ||
        otherChanges)
    ) {
      assertDev(
        groupChangeMessages.length === 0,
        'Fallback group state processing should not kick in'
      );

      log.warn(
        `integrateGroupChange/${logId}: local state was different from ` +
          'the remote final state. ' +
          `Got ${groupChangeMessages.length} change messages, ` +
          `${newProfileKeys.size} updated members, and ` +
          `otherChanges=${otherChanges}`
      );
    }

    attributes = newAttributes;
    aggregatedChangeMessages.push(groupChangeMessages);
    for (const [aci, profileKey] of newProfileKeys) {
      finalNewProfileKeys.set(aci, profileKey);
    }
  } else {
    strictAssert(
      canApplyChange,
      `integrateGroupChange/${logId}: No group state, but we can't apply changes!`
    );
  }

  return {
    newAttributes: attributes,
    groupChangeMessages: aggregatedChangeMessages.flat(),
    newProfileKeys: finalNewProfileKeys,
  };
}

function normalizeTextField(text: string | null | undefined): string {
  return text?.trim() ?? '';
}

function extractDiffs({
  current,
  dropInitialJoinMessage,
  isReJoin,
  old,
  promotedAciToPniMap,
  sourceServiceId,
}: {
  current: ConversationAttributesType;
  dropInitialJoinMessage?: boolean;
  isReJoin?: boolean;
  old: ConversationAttributesType;
  promotedAciToPniMap?: ReadonlyMap<AciString, PniString>;
  sourceServiceId?: ServiceIdString;
}): Array<GroupChangeMessageType> {
  const logId = idForLogging(old.groupId);
  const details: Array<GroupV2ChangeDetailType> = [];
  const ourAci = window.storage.user.getCheckedAci();
  const ourPni = window.storage.user.getPni();
  const ACCESS_ENUM = Proto.AccessControl.AccessRequired;

  let areWeInGroup = false;
  let serviceIdKindInvitedToGroup: ServiceIdKind | undefined;
  let areWePendingApproval = false;
  let whoInvitedUsUserId = null;

  function isUs(serviceId: ServiceIdString): boolean {
    return serviceId === ourAci || serviceId === ourPni;
  }
  function keepOnlyOurAdds(
    list: Array<GroupV2ChangeDetailType>
  ): Array<GroupV2ChangeDetailType> {
    return list.filter(
      item =>
        (item.type === 'member-add-from-invite' && isUs(item.aci)) ||
        (item.type === 'member-add-from-link' && isUs(item.aci)) ||
        (item.type === 'member-add-from-admin-approval' && isUs(item.aci)) ||
        (item.type === 'member-add' && isUs(item.aci))
    );
  }

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

  if (old.avatar?.url !== current.avatar?.url) {
    details.push({
      type: 'avatar',
      removed: !current.avatar,
    });
  }

  // name
  const oldName = normalizeTextField(old.name);
  const newName = normalizeTextField(current.name);
  if (oldName !== newName) {
    details.push({
      type: 'title',
      newTitle: newName,
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
  const oldDescription = normalizeTextField(old.description);
  const newDescription = normalizeTextField(current.description);
  if (oldDescription !== newDescription) {
    details.push({
      type: 'description',
      removed: !newDescription,
      description: newDescription,
    });
  }

  // No disappearing message timer check here - see below

  // membersV2

  const oldMemberLookup = new Map<AciString, GroupV2MemberType>(
    (old.membersV2 || []).map(member => [member.aci, member])
  );
  const didWeStartInGroup = Boolean(ourAci && oldMemberLookup.has(ourAci));

  const oldPendingMemberLookup = new Map<
    ServiceIdString,
    GroupV2PendingMemberType
  >((old.pendingMembersV2 || []).map(member => [member.serviceId, member]));
  const oldPendingAdminApprovalLookup = new Map<
    AciString,
    GroupV2PendingAdminApprovalType
  >((old.pendingAdminApprovalV2 || []).map(member => [member.aci, member]));
  const currentPendingMemberSet = new Set<ServiceIdString>(
    (current.pendingMembersV2 || []).map(member => member.serviceId)
  );

  const aciToPniMap = new Map(promotedAciToPniMap?.entries());
  if (ourAci && ourPni) {
    aciToPniMap.set(ourAci, ourPni);
  }

  const pniToAciMap = new Map<PniString, AciString>();
  for (const [aci, pni] of aciToPniMap) {
    pniToAciMap.set(pni, aci);
  }

  (current.membersV2 || []).forEach(currentMember => {
    const { aci } = currentMember;
    const uuidIsUs = isUs(aci);

    if (uuidIsUs) {
      areWeInGroup = true;
    }

    const oldMember = oldMemberLookup.get(aci);
    if (!oldMember) {
      let pendingMember = oldPendingMemberLookup.get(aci);
      const pni = aciToPniMap.get(aci);
      if (!pendingMember && pni) {
        pendingMember = oldPendingMemberLookup.get(pni);

        // Someone's ACI just joined (wasn't a member before) and their PNI
        // disappeared from the invite list. Treat this as a promotion from PNI
        // to ACI and pretend that the PNI wasn't pending so that we won't
        // generate a pending-add-one notification below.
        if (pendingMember && !currentPendingMemberSet.has(pni)) {
          oldPendingMemberLookup.delete(pni);
        }
      }

      if (pendingMember) {
        details.push({
          type: 'member-add-from-invite',
          aci,
          pni,
          inviter: pendingMember.addedByUserId,
        });
      } else if (currentMember.joinedFromLink) {
        details.push({
          type: 'member-add-from-link',
          aci,
        });
      } else if (currentMember.approvedByAdmin) {
        details.push({
          type: 'member-add-from-admin-approval',
          aci,
        });
      } else {
        details.push({
          type: 'member-add',
          aci,
        });
      }
    } else if (oldMember.role !== currentMember.role) {
      details.push({
        type: 'member-privilege',
        aci,
        newPrivilege: currentMember.role,
      });
    }

    // We don't want to generate an admin-approval-remove event for this newly-added
    //   member. But we don't know for sure if this is an admin approval; for that we
    //   consulted the approvedByAdmin flag saved on the member.
    oldPendingAdminApprovalLookup.delete(aci);

    // If we capture a pending remove here, it's an 'accept invitation', and we don't
    //   want to generate a pending-remove event for it
    oldPendingMemberLookup.delete(aci);

    // This deletion makes it easier to capture removals
    oldMemberLookup.delete(aci);
  });

  const removedMemberIds = Array.from(oldMemberLookup.keys());
  removedMemberIds.forEach(aci => {
    details.push({
      type: 'member-remove',
      aci,
    });
  });

  // pendingMembersV2

  let lastPendingServiceId: ServiceIdString | undefined;
  let pendingCount = 0;
  (current.pendingMembersV2 || []).forEach(currentPendingMember => {
    const { serviceId } = currentPendingMember;
    const oldPendingMember = oldPendingMemberLookup.get(serviceId);

    if (isUs(serviceId)) {
      if (serviceId === ourAci) {
        serviceIdKindInvitedToGroup = ServiceIdKind.ACI;
      } else if (serviceIdKindInvitedToGroup === undefined) {
        serviceIdKindInvitedToGroup = ServiceIdKind.PNI;
      }

      whoInvitedUsUserId = currentPendingMember.addedByUserId;
    }

    if (!oldPendingMember) {
      lastPendingServiceId = serviceId;
      pendingCount += 1;
    }

    // This deletion makes it easier to capture removals
    oldPendingMemberLookup.delete(serviceId);
  });

  if (pendingCount > 1) {
    details.push({
      type: 'pending-add-many',
      count: pendingCount,
    });
  } else if (pendingCount === 1) {
    if (lastPendingServiceId) {
      details.push({
        type: 'pending-add-one',
        serviceId: lastPendingServiceId,
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
    const serviceId = removedPendingMemberIds[0];
    const removedMember = oldPendingMemberLookup.get(serviceId);
    strictAssert(removedMember !== undefined, 'Removed member not found');

    details.push({
      type: 'pending-remove-one',
      serviceId,
      inviter: removedMember.addedByUserId,
    });
  }

  // pendingAdminApprovalV2

  (current.pendingAdminApprovalV2 || []).forEach(
    currentPendingAdminAprovalMember => {
      const { aci } = currentPendingAdminAprovalMember;
      const oldPendingMember = oldPendingAdminApprovalLookup.get(aci);

      if (aci === ourAci) {
        areWePendingApproval = true;
      }

      if (!oldPendingMember) {
        details.push({
          type: 'admin-approval-add-one',
          aci,
        });
      }

      // This deletion makes it easier to capture removals
      oldPendingAdminApprovalLookup.delete(aci);
    }
  );

  // Note: The only members left over here should be people who were moved from the
  //   pendingAdminApproval list but also not added to the group at the same time.
  const removedPendingAdminApprovalIds = Array.from(
    oldPendingAdminApprovalLookup.keys()
  );
  removedPendingAdminApprovalIds.forEach(aci => {
    details.push({
      type: 'admin-approval-remove-one',
      aci,
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
  const isFromUs = ourAci === sourceServiceId;
  const justJoinedGroup = !firstUpdate && !didWeStartInGroup && areWeInGroup;

  const from =
    (sourceServiceId &&
      isPniString(sourceServiceId) &&
      pniToAciMap.get(sourceServiceId)) ||
    sourceServiceId;

  // Here we hardcode initial messages if this is our first time processing data for this
  //   group. Ideally we can collapse it down to just one of: 'you were added',
  //   'you were invited', or 'you created.'
  if (firstUpdate && serviceIdKindInvitedToGroup !== undefined) {
    // Note, we will add 'you were invited' to group even if dropInitialJoinMessage = true
    message = {
      type: 'group-v2-change',
      groupV2Change: {
        from: whoInvitedUsUserId || from,
        details: [
          {
            type: 'pending-add-one',
            serviceId: window.storage.user.getCheckedServiceId(
              serviceIdKindInvitedToGroup
            ),
          },
        ],
      },
      readStatus: ReadStatus.Read,
      seenStatus: isFromUs ? SeenStatus.Seen : SeenStatus.Unseen,
    };
  } else if (firstUpdate && areWePendingApproval) {
    message = {
      type: 'group-v2-change',
      groupV2Change: {
        from: ourAci,
        details: [
          {
            type: 'admin-approval-add-one',
            aci: ourAci,
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
    sourceServiceId === ourAci
  ) {
    message = {
      type: 'group-v2-change',
      groupV2Change: {
        from,
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
    const filteredDetails = keepOnlyOurAdds(details);

    strictAssert(
      filteredDetails.length === 1,
      'extractDiffs/firstUpdate: Should be only one self-add!'
    );

    message = {
      type: 'group-v2-change',
      groupV2Change: {
        from,
        details: filteredDetails,
      },
      readStatus: ReadStatus.Read,
      seenStatus: isFromUs ? SeenStatus.Seen : SeenStatus.Unseen,
    };
  } else if (firstUpdate && current.revision === 0) {
    message = {
      type: 'group-v2-change',
      groupV2Change: {
        from,
        details: [
          {
            type: 'create',
          },
        ],
      },
      readStatus: ReadStatus.Read,
      seenStatus: isFromUs ? SeenStatus.Seen : SeenStatus.Unseen,
    };
  } else if (justJoinedGroup) {
    const filteredDetails = keepOnlyOurAdds(details);

    strictAssert(
      filteredDetails.length === 1,
      'extractDiffs/justJoinedGroup: Should be only one self-add!'
    );

    // If we've dropped other changes, we collapse them into a single summary
    if (details.length > 1) {
      filteredDetails.push({
        type: 'summary',
      });
    }

    message = {
      type: 'group-v2-change',
      sourceServiceId,
      groupV2Change: {
        from,
        details: filteredDetails,
      },
      readStatus: ReadStatus.Read,
      seenStatus: isFromUs ? SeenStatus.Seen : SeenStatus.Unseen,
    };
  } else if (details.length > 0) {
    message = {
      type: 'group-v2-change',
      sourceServiceId,
      groupV2Change: {
        from,
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
    const expireTimer = current.expireTimer || DurationInSeconds.ZERO;
    log.info(
      `extractDiffs/${logId}: generating change notification for new ${expireTimer} timer`
    );
    timerNotification = {
      type: 'timer-notification',
      sourceServiceId: isReJoin ? undefined : sourceServiceId,
      flags: Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      expirationTimerUpdate: {
        expireTimer,
        sourceServiceId: isReJoin ? undefined : sourceServiceId,
      },
    };
  }

  const result = compact([message, timerNotification]);

  log.info(
    `extractDiffs/${logId} complete, generated ${result.length} change messages`
  );

  return result;
}

function profileKeysToMap(items: ReadonlyArray<GroupChangeMemberType>) {
  const map = new Map<AciString, string>();
  for (const { aci, profileKey } of items) {
    map.set(aci, Bytes.toBase64(profileKey));
  }
  return map;
}

type GroupChangeMemberType = {
  profileKey: Uint8Array;
  aci: AciString;
};
type GroupApplyResultType = {
  newAttributes: ConversationAttributesType;
  newProfileKeys: Array<GroupChangeMemberType>;
  otherChanges: boolean;
};

type GroupApplyChangeResultType = GroupApplyResultType & {
  promotedAciToPniMap: Map<AciString, PniString>;
};

async function applyGroupChange({
  actions,
  group,
  sourceServiceId,
}: {
  actions: DecryptedGroupChangeActions;
  group: ConversationAttributesType;
  sourceServiceId: ServiceIdString;
}): Promise<GroupApplyChangeResultType> {
  const logId = idForLogging(group.groupId);
  const ourAci = window.storage.user.getCheckedAci();

  const ACCESS_ENUM = Proto.AccessControl.AccessRequired;
  const MEMBER_ROLE_ENUM = Proto.Member.Role;

  const version = actions.version || 0;
  let result = { ...group };
  const newProfileKeys: Array<GroupChangeMemberType> = [];
  const promotedAciToPniMap = new Map<AciString, PniString>();

  const members: Record<AciString, GroupV2MemberType> = fromPairs(
    (result.membersV2 || []).map(member => [member.aci, member])
  );
  const pendingMembers: Record<ServiceIdString, GroupV2PendingMemberType> =
    fromPairs(
      (result.pendingMembersV2 || []).map(member => [member.serviceId, member])
    );
  const pendingAdminApprovalMembers: Record<
    AciString,
    GroupV2PendingAdminApprovalType
  > = fromPairs(
    (result.pendingAdminApprovalV2 || []).map(member => [member.aci, member])
  );
  const bannedMembers = new Map<ServiceIdString, GroupV2BannedMemberType>(
    (result.bannedMembersV2 || []).map(member => [member.serviceId, member])
  );

  if (result.temporaryMemberCount) {
    log.warn(
      `applyGroupChange(${logId}): temporaryMemberCount is set, and should not be!`
    );
  }

  // version?: number;
  result.revision = version;

  // addMembers?: Array<GroupChange.Actions.AddMemberAction>;
  (actions.addMembers || []).forEach(addMember => {
    const { added } = addMember;
    if (!added || !added.userId) {
      throw new Error('applyGroupChange: addMember.added is missing');
    }

    const addedUuid = added.userId;

    if (members[addedUuid]) {
      log.warn(
        `applyGroupChange/${logId}: Attempt to add member failed; already in members.`
      );
      return;
    }

    members[addedUuid] = {
      aci: addedUuid,
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
    if (addedUuid === ourAci && pendingAdminApprovalMembers[ourAci]) {
      result.addedBy = ourAci;
    } else if (addedUuid === ourAci && sourceServiceId) {
      result.addedBy = sourceServiceId;
    }

    if (pendingAdminApprovalMembers[addedUuid]) {
      log.warn(
        `applyGroupChange/${logId}: Removing newly-added member from pendingAdminApprovalMembers.`
      );
      delete pendingAdminApprovalMembers[addedUuid];
    }

    if (added.profileKey) {
      newProfileKeys.push({
        profileKey: added.profileKey,
        aci: added.userId,
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

    if (members[deletedUserId]) {
      delete members[deletedUserId];
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

    if (members[userId]) {
      members[userId] = {
        ...members[userId],
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
    const { profileKey, aci } = modifyMemberProfileKey;
    if (!profileKey || !aci) {
      throw new Error(
        'applyGroupChange: modifyMemberProfileKey had a missing value'
      );
    }

    if (aci === sourceServiceId || !hasProfileKey(aci)) {
      newProfileKeys.push({
        profileKey,
        aci,
      });
    } else {
      log.warn(
        `applyGroupChange/${logId}: Attempt to modify member profile key ` +
          'failed; sourceServiceId is not the same as change aci'
      );
    }
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

    const addedUserId = added.member.userId;

    if (isAciString(addedUserId) && members[addedUserId]) {
      log.warn(
        `applyGroupChange/${logId}: Attempt to add pendingMember failed; was already in members.`
      );
      return;
    }
    if (pendingMembers[addedUserId]) {
      log.warn(
        `applyGroupChange/${logId}: Attempt to add pendingMember failed; was already in pendingMembers.`
      );
      return;
    }

    pendingMembers[addedUserId] = {
      serviceId: addedUserId,
      addedByUserId: added.addedByUserId,
      timestamp: added.timestamp,
      role: added.member.role || MEMBER_ROLE_ENUM.DEFAULT,
    };
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

    if (pendingMembers[deletedUserId]) {
      delete pendingMembers[deletedUserId];
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
    const { profileKey, aci } = promotePendingMember;
    if (!profileKey || !aci) {
      throw new Error(
        'applyGroupChange: promotePendingMember had a missing value'
      );
    }

    const previousRecord = pendingMembers[aci];

    if (pendingMembers[aci]) {
      delete pendingMembers[aci];
    } else {
      log.warn(
        `applyGroupChange/${logId}: Attempt to promote pendingMember failed; was not in pendingMembers.`
      );
      return;
    }

    if (members[aci]) {
      log.warn(
        `applyGroupChange/${logId}: Attempt to promote pendingMember failed; was already in members.`
      );
      return;
    }

    members[aci] = {
      aci,
      joinedAtVersion: version,
      role: previousRecord.role || MEMBER_ROLE_ENUM.DEFAULT,
    };

    newProfileKeys.push({
      profileKey,
      aci,
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

      promotedAciToPniMap.set(aci, pni);

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
        aci,
        joinedAtVersion: version,
        role: previousRecord.role || MEMBER_ROLE_ENUM.DEFAULT,
      };

      newProfileKeys.push({
        profileKey,
        aci,
      });
    }
  );

  // modifyTitle?: GroupChange.Actions.ModifyTitleAction;
  if (actions.modifyTitle) {
    const { title } = actions.modifyTitle;
    if (title && title.content === 'title') {
      result.name = dropNull(title.title)?.trim();
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
    result = {
      ...result,
      ...(await applyNewAvatar(dropNull(avatar), result, logId)),
    };
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
      const duration = disappearingMessagesTimer.disappearingMessagesDuration;
      result.expireTimer =
        duration == null ? undefined : DurationInSeconds.fromSeconds(duration);
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

      if (members[added.userId]) {
        log.warn(
          `applyGroupChange/${logId}: Attempt to add pending admin approval failed; was already in members.`
        );
        return;
      }
      if (pendingMembers[added.userId]) {
        log.warn(
          `applyGroupChange/${logId}: Attempt to add pending admin approval failed; was already in pendingMembers.`
        );
        return;
      }
      if (pendingAdminApprovalMembers[added.userId]) {
        log.warn(
          `applyGroupChange/${logId}: Attempt to add pending admin approval failed; was already in pendingAdminApprovalMembers.`
        );
        return;
      }

      pendingAdminApprovalMembers[added.userId] = {
        aci: added.userId,
        timestamp: added.timestamp,
      };

      if (added.profileKey) {
        newProfileKeys.push({
          profileKey: added.profileKey,
          aci: added.userId,
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

      if (pendingAdminApprovalMembers[deletedUserId]) {
        delete pendingAdminApprovalMembers[deletedUserId];
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

      if (pendingAdminApprovalMembers[userId]) {
        delete pendingAdminApprovalMembers[userId];
      } else {
        log.warn(
          `applyGroupChange/${logId}: Attempt to promote pendingAdminApproval failed; was not in pendingAdminApprovalMembers.`
        );
        return;
      }
      if (pendingMembers[userId]) {
        delete pendingAdminApprovalMembers[userId];
        log.warn(
          `applyGroupChange/${logId}: Deleted pendingAdminApproval from pendingMembers.`
        );
      }

      if (members[userId]) {
        log.warn(
          `applyGroupChange/${logId}: Attempt to promote pendingMember failed; was already in members.`
        );
        return;
      }

      // If we had requested to join, and are approved, we added ourselves
      if (userId === ourAci) {
        result.addedBy = ourAci;
      }

      members[userId] = {
        aci: userId,
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
      result.description = dropNull(descriptionBytes.descriptionText)?.trim();
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
      if (bannedMembers.has(member.serviceId)) {
        log.warn(
          `applyGroupChange/${logId}: Attempt to add banned member failed; was already in banned list.`
        );
        return;
      }

      bannedMembers.set(member.serviceId, member);
    });
  }

  if (actions.deleteMembersBanned && actions.deleteMembersBanned.length > 0) {
    actions.deleteMembersBanned.forEach(serviceId => {
      if (!bannedMembers.has(serviceId)) {
        log.warn(
          `applyGroupChange/${logId}: Attempt to remove banned member failed; was not in banned list.`
        );
        return;
      }

      bannedMembers.delete(serviceId);
    });
  }

  if (ourAci) {
    result.left = !members[ourAci];
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
    otherChanges: false,
    promotedAciToPniMap,
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

// Overwriting result.avatar as part of functionality
export async function applyNewAvatar(
  newAvatarUrl: string | undefined,
  attributes: Readonly<
    Pick<ConversationAttributesType, 'avatar' | 'secretParams'>
  >,
  logId: string
): Promise<Pick<ConversationAttributesType, 'avatar'>> {
  const result: Pick<ConversationAttributesType, 'avatar'> = {};
  try {
    // Avatar has been dropped
    if (!newAvatarUrl && attributes.avatar) {
      if (attributes.avatar.path) {
        await window.Signal.Migrations.deleteAttachmentData(
          attributes.avatar.path
        );
      }
      result.avatar = undefined;
    }

    // Group has avatar; has it changed?
    if (
      newAvatarUrl &&
      (!attributes.avatar?.path || attributes.avatar.url !== newAvatarUrl)
    ) {
      if (!attributes.secretParams) {
        throw new Error('applyNewAvatar: group was missing secretParams!');
      }

      const data = await decryptGroupAvatar(
        newAvatarUrl,
        attributes.secretParams
      );
      const hash = computeHash(data);

      if (attributes.avatar?.hash === hash) {
        log.info(
          `applyNewAvatar/${logId}: Hash is the same, but url was different. Saving new url.`
        );
        result.avatar = {
          ...attributes.avatar,
          url: newAvatarUrl,
        };
        return result;
      }

      if (attributes.avatar?.path) {
        await window.Signal.Migrations.deleteAttachmentData(
          attributes.avatar.path
        );
      }

      const local = await window.Signal.Migrations.writeNewAttachmentData(data);
      result.avatar = {
        url: newAvatarUrl,
        ...local,
        hash,
      };
    }
  } catch (error) {
    log.warn(
      `applyNewAvatar/${logId} Failed to handle avatar, clearing it`,
      Errors.toLogFormat(error)
    );
    if (result.avatar && result.avatar.path) {
      await window.Signal.Migrations.deleteAttachmentData(result.avatar.path);
    }
    result.avatar = undefined;
  }
  return result;
}

function profileKeyHasChanged(
  userId: ServiceIdString,
  newProfileKey: Uint8Array
) {
  const conversation = window.ConversationController.get(userId);
  if (!conversation) {
    return true;
  }

  const existingBase64 = conversation.get('profileKey');
  if (!existingBase64) {
    return true;
  }

  const newBase64 = Bytes.toBase64(newProfileKey);

  return newBase64 !== existingBase64;
}

function hasProfileKey(userId: ServiceIdString) {
  const conversation = window.ConversationController.get(userId);
  if (!conversation) {
    return false;
  }

  const existingBase64 = conversation.get('profileKey');
  return existingBase64 !== undefined;
}

async function applyGroupState({
  group,
  groupState,
  sourceServiceId,
}: {
  group: ConversationAttributesType;
  groupState: DecryptedGroupState;
  sourceServiceId?: ServiceIdString;
}): Promise<GroupApplyResultType> {
  const logId = idForLogging(group.groupId);
  const ACCESS_ENUM = Proto.AccessControl.AccessRequired;
  const MEMBER_ROLE_ENUM = Proto.Member.Role;
  const version = groupState.version || 0;
  let result = { ...group };
  const newProfileKeys: Array<GroupChangeMemberType> = [];

  // Used to capture changes not already expressed in group notifications or profile keys
  let otherChanges = false;

  // Used to detect changes in these lists
  const members: Record<string, GroupV2MemberType> = fromPairs(
    (result.membersV2 || []).map(member => [member.aci, member])
  );
  const pendingMembers: Record<string, GroupV2PendingMemberType> = fromPairs(
    (result.pendingMembersV2 || []).map(member => [member.serviceId, member])
  );
  const pendingAdminApprovalMembers: Record<
    string,
    GroupV2PendingAdminApprovalType
  > = fromPairs(
    (result.pendingAdminApprovalV2 || []).map(member => [member.aci, member])
  );
  const bannedMembers = new Map<string, GroupV2BannedMemberType>(
    (result.bannedMembersV2 || []).map(member => [member.serviceId, member])
  );

  // version
  result.revision = version;

  // title
  // Note: During decryption, title becomes a GroupAttributeBlob
  const { title } = groupState;
  if (title && title.content === 'title') {
    result.name = dropNull(title.title)?.trim();
  } else {
    result.name = undefined;
  }

  // avatar
  result = {
    ...result,
    ...(await applyNewAvatar(dropNull(groupState.avatar), result, logId)),
  };

  // disappearingMessagesTimer
  // Note: during decryption, disappearingMessageTimer becomes a GroupAttributeBlob
  const { disappearingMessagesTimer } = groupState;
  if (
    disappearingMessagesTimer &&
    disappearingMessagesTimer.content === 'disappearingMessagesDuration'
  ) {
    const duration = disappearingMessagesTimer.disappearingMessagesDuration;
    result.expireTimer =
      duration == null ? undefined : DurationInSeconds.fromSeconds(duration);
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
  const ourAci = window.storage.user.getCheckedAci();

  // members
  const wasPreviouslyAMember = (result.membersV2 || []).some(
    item => item.aci !== ourAci
  );
  if (groupState.members) {
    result.membersV2 = groupState.members.map(member => {
      if (member.userId === ourAci) {
        result.left = false;

        // Capture who added us if we were previously not in group
        if (pendingAdminApprovalMembers[ourAci] && !wasPreviouslyAMember) {
          result.addedBy = sourceServiceId;
        } else if (
          sourceServiceId &&
          !wasPreviouslyAMember &&
          isNumber(member.joinedAtVersion) &&
          member.joinedAtVersion === version
        ) {
          result.addedBy = sourceServiceId;
        }
      }

      if (!isValidRole(member.role)) {
        throw new Error(
          `applyGroupState: Member had invalid role ${member.role}`
        );
      }

      const previousMember = members[member.userId];
      if (member.profileKey && !hasProfileKey(member.userId)) {
        newProfileKeys.push({
          profileKey: member.profileKey,
          aci: member.userId,
        });
      } else if (
        member.profileKey &&
        profileKeyHasChanged(member.userId, member.profileKey)
      ) {
        log.warn(
          `applyGroupState(${logId}): Member ${member.userId} had different profileKey`
        );
        otherChanges = true;
      } else if (!previousMember) {
        otherChanges = true;
      }

      if (
        previousMember &&
        previousMember.joinedAtVersion !== member.joinedAtVersion
      ) {
        otherChanges = true;
        log.warn(
          `applyGroupState(${logId}): Member ${member.userId} had different joinedAtVersion`
        );
      }
      // Note: role changes will be reflected in group update messages

      return {
        role: member.role || MEMBER_ROLE_ENUM.DEFAULT,
        joinedAtVersion: member.joinedAtVersion,
        aci: member.userId,
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

        const previousMember = pendingMembers[member.member.userId];
        otherChanges = true;

        if (
          previousMember &&
          previousMember.addedByUserId !== member.addedByUserId
        ) {
          otherChanges = true;
          log.warn(
            `applyGroupState(${logId}): Member ${member.member.userId} had different addedByUserId`
          );
        }
        if (previousMember && previousMember.timestamp !== member.timestamp) {
          otherChanges = true;
          log.warn(
            `applyGroupState(${logId}): Member ${member.member.userId} had different timestamp`
          );
        }
        if (previousMember && previousMember.role !== member.member.role) {
          otherChanges = true;
          log.warn(
            `applyGroupState(${logId}): Member ${member.member.userId} had different role`
          );
        }

        return {
          addedByUserId: member.addedByUserId,
          serviceId: member.member.userId,
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
        const previousMember = pendingAdminApprovalMembers[member.userId];
        if (member.profileKey && !hasProfileKey(member.userId)) {
          newProfileKeys.push({
            profileKey: member.profileKey,
            aci: member.userId,
          });
        } else if (
          member.profileKey &&
          profileKeyHasChanged(member.userId, member.profileKey)
        ) {
          log.warn(
            `applyGroupState(${logId}): Member ${member.userId} had different profileKey`
          );
          otherChanges = true;
        } else if (!previousMember) {
          otherChanges = true;
        }

        if (previousMember && previousMember.timestamp !== member.timestamp) {
          otherChanges = true;
          log.warn(
            `applyGroupState(${logId}): Member ${member.userId} had different timestamp`
          );
        }

        return {
          aci: member.userId,
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
    result.description = dropNull(descriptionBytes.descriptionText)?.trim();
  } else {
    result.description = undefined;
  }

  // announcementsOnly
  result.announcementsOnly = groupState.announcementsOnly;

  // membersBanned
  result.bannedMembersV2 = groupState.membersBanned?.map(member => {
    const previousMember = bannedMembers.get(member.serviceId);
    if (!previousMember) {
      otherChanges = true;
    }
    if (previousMember && previousMember.timestamp !== member.timestamp) {
      otherChanges = true;
      log.warn(
        `applyGroupState(${logId}): Member ${member.serviceId} had different timestamp`
      );
    }

    return member;
  });

  if (result.left) {
    result.addedBy = undefined;
  }

  if (result.temporaryMemberCount) {
    log.info(`applyGroupState(${logId}): Clearing temporaryMemberCount`);
    result.temporaryMemberCount = undefined;
  }

  return {
    newAttributes: result,
    newProfileKeys,
    otherChanges,
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
  sourceServiceId?: ServiceIdString;
  addMembers?: ReadonlyArray<{
    added: DecryptedMember;
    joinFromInviteLink: boolean;
  }>;
  deleteMembers?: ReadonlyArray<{
    deletedUserId: AciString;
  }>;
  modifyMemberRoles?: ReadonlyArray<{
    userId: AciString;
    role: Proto.Member.Role;
  }>;
  modifyMemberProfileKeys?: ReadonlyArray<{
    profileKey: Uint8Array;
    aci: AciString;
  }>;
  addPendingMembers?: ReadonlyArray<{
    added: DecryptedMemberPendingProfileKey;
  }>;
  deletePendingMembers?: ReadonlyArray<{
    // This might be a PNI
    deletedUserId: ServiceIdString;
  }>;
  promotePendingMembers?: ReadonlyArray<{
    profileKey: Uint8Array;
    aci: AciString;
  }>;
  promoteMembersPendingPniAciProfileKey?: ReadonlyArray<{
    profileKey: Uint8Array;
    aci: AciString;
    pni: PniString;
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
    deletedUserId: AciString;
  }>;
  promoteMemberPendingAdminApprovals?: ReadonlyArray<{
    userId: AciString;
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
  // This might be a PNI
  deleteMembersBanned?: ReadonlyArray<ServiceIdString>;
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

  if (actions.sourceUserId && actions.sourceUserId.length !== 0) {
    try {
      result.sourceServiceId = decryptServiceId(
        clientZkGroupCipher,
        actions.sourceUserId
      );
    } catch (error) {
      log.warn(
        `decryptGroupChange/${logId}: Unable to decrypt sourceServiceId.`,
        Errors.toLogFormat(error)
      );
    }

    if (!result.sourceServiceId || !isServiceIdString(result.sourceServiceId)) {
      log.warn(
        `decryptGroupChange/${logId}: Invalid sourceServiceId. Clearing sourceServiceId.`
      );
      result.sourceServiceId = undefined;
    }
  } else {
    throw new Error('decryptGroupChange: Missing sourceServiceId');
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

      let userId: AciString;
      try {
        userId = decryptAci(clientZkGroupCipher, deletedUserId);
      } catch (error) {
        log.warn(
          `decryptGroupChange/${logId}: Unable to decrypt deleteMembers.deletedUserId. Dropping member.`,
          Errors.toLogFormat(error)
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

      let userId: AciString;
      try {
        userId = decryptAci(clientZkGroupCipher, modifyMember.userId);
      } catch (error) {
        log.warn(
          `decryptGroupChange/${logId}: Unable to decrypt modifyMemberRole.userId. Dropping member.`,
          Errors.toLogFormat(error)
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

      let aci: AciString;
      let profileKey: Uint8Array;
      try {
        aci = decryptAci(clientZkGroupCipher, userId);

        profileKey = decryptProfileKey(
          clientZkGroupCipher,
          encryptedProfileKey,
          aci
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

      return { aci, profileKey };
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
      let userId: ServiceIdString;
      try {
        userId = decryptServiceId(clientZkGroupCipher, deletedUserId);
      } catch (error) {
        log.warn(
          `decryptGroupChange/${logId}: Unable to decrypt deletePendingMembers.deletedUserId. Dropping member.`,
          Errors.toLogFormat(error)
        );
        return null;
      }

      if (!isServiceIdString(userId)) {
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

      let aci: AciString;
      let profileKey: Uint8Array;
      try {
        aci = decryptAci(clientZkGroupCipher, userId);

        profileKey = decryptProfileKey(
          clientZkGroupCipher,
          encryptedProfileKey,
          aci
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

      return { aci, profileKey };
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

        let aci: AciString;
        let pni: PniString;
        let profileKey: Uint8Array;
        try {
          aci = decryptAci(clientZkGroupCipher, promotePendingMember.userId);
          pni = decryptPni(clientZkGroupCipher, promotePendingMember.pni);

          profileKey = decryptProfileKey(
            clientZkGroupCipher,
            promotePendingMember.profileKey,
            aci
          );
        } catch (error) {
          log.warn(
            `decryptGroupChange/${logId}: Unable to decrypt promoteMembersPendingPniAciProfileKey. Dropping member.`,
            Errors.toLogFormat(error)
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
          aci,
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
          Errors.toLogFormat(error)
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
          Errors.toLogFormat(error)
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

        let aci: AciString;
        try {
          aci = decryptAci(clientZkGroupCipher, deletedUserId);
        } catch (error) {
          log.warn(
            `decryptGroupChange/${logId}: Unable to decrypt deletePendingApproval.deletedUserId. Dropping member.`,
            Errors.toLogFormat(error)
          );
          return null;
        }

        return { deletedUserId: aci };
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

        let decryptedUserId: AciString;
        try {
          decryptedUserId = decryptAci(clientZkGroupCipher, userId);
        } catch (error) {
          log.warn(
            `decryptGroupChange/${logId}: Unable to decrypt promoteAdminApproval.userId. Dropping member.`,
            Errors.toLogFormat(error)
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
          Errors.toLogFormat(error)
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
        const serviceId = decryptServiceId(
          clientZkGroupCipher,
          item.added.userId
        );
        const timestamp = normalizeTimestamp(item.added.timestamp);

        return { serviceId, timestamp };
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
        return decryptServiceId(clientZkGroupCipher, item.deletedUserId);
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
        Errors.toLogFormat(error)
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
        Errors.toLogFormat(error)
      );
    }
  }

  // accessControl
  {
    const { accessControl } = groupState;
    strictAssert(accessControl, 'No accessControl field found');

    const attributes =
      accessControl.attributes ?? Proto.AccessControl.AccessRequired.UNKNOWN;
    const members =
      accessControl.members ?? Proto.AccessControl.AccessRequired.UNKNOWN;
    const addFromInviteLink =
      accessControl.addFromInviteLink ??
      Proto.AccessControl.AccessRequired.UNKNOWN;

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
  const version = groupState.version ?? 0;
  strictAssert(
    isNumber(version),
    `decryptGroupState: Expected version to be a number or null; it was ${groupState.version}`
  );
  result.version = version;

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
        Errors.toLogFormat(error)
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
        const serviceId = decryptServiceId(clientZkGroupCipher, item.userId);
        const timestamp = item.timestamp?.toNumber() ?? 0;

        return { serviceId, timestamp };
      })
      .filter(isNotNil);
  } else {
    result.membersBanned = [];
  }

  result.avatar = dropNull(groupState.avatar);

  return result;
}

type DecryptedMember = Readonly<{
  userId: AciString;
  profileKey: Uint8Array;
  role: Proto.Member.Role;
  joinedAtVersion: number;
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

  let userId: AciString;
  try {
    userId = decryptAci(clientZkGroupCipher, member.userId);
  } catch (error) {
    log.warn(
      `decryptMember/${logId}: Unable to decrypt member userid. Dropping member.`,
      Errors.toLogFormat(error)
    );
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
    userId
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
    joinedAtVersion: dropNull(member.joinedAtVersion) ?? 0,
  };
}

type DecryptedMemberPendingProfileKey = {
  addedByUserId: AciString;
  timestamp: number;
  member: {
    userId: ServiceIdString;
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

  let addedByUserId: AciString;
  try {
    addedByUserId = decryptAci(clientZkGroupCipher, member.addedByUserId);
  } catch (error) {
    log.warn(
      `decryptMemberPendingProfileKey/${logId}: Unable to decrypt pending member addedByUserId. Dropping member.`,
      Errors.toLogFormat(error)
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
  strictAssert(
    Bytes.isEmpty(profileKey),
    'decryptMemberPendingProfileKey: member has profileKey'
  );

  // userId
  strictAssert(
    Bytes.isNotEmpty(userId),
    'decryptMemberPendingProfileKey: Member had missing member.userId'
  );

  let decryptedUserId: ServiceIdString;
  try {
    decryptedUserId = decryptServiceId(clientZkGroupCipher, userId);
  } catch (error) {
    log.warn(
      `decryptMemberPendingProfileKey/${logId}: Unable to decrypt pending member userId. Dropping member.`,
      Errors.toLogFormat(error)
    );
    return undefined;
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
      role,
    },
  };
}

type DecryptedMemberPendingAdminApproval = {
  userId: AciString;
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

  let decryptedUserId: AciString;
  try {
    decryptedUserId = decryptAci(clientZkGroupCipher, userId);
  } catch (error) {
    log.warn(
      `decryptMemberPendingAdminApproval/${logId}: Unable to decrypt pending member userId. Dropping member.`,
      Errors.toLogFormat(error)
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
        decryptedUserId
      );
    } catch (error) {
      log.warn(
        `decryptMemberPendingAdminApproval/${logId}: Unable to decrypt profileKey. Dropping profileKey.`,
        Errors.toLogFormat(error)
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
): Array<{ aci: AciString; uuidCiphertext: Uint8Array }> {
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
    const aci = member.getCheckedAci('getMembershipList: member has no aci');

    const uuidCiphertext = encryptServiceId(clientZkGroupCipher, aci);
    return { aci, uuidCiphertext };
  });
}

function setLastSuccessfulGroupFetch(
  conversationId: string,
  timestamp: number | undefined
): void {
  const conversation = window.ConversationController.get(conversationId);
  strictAssert(
    conversation,
    `setLastSuccessfulGroupFetch/${idForLogging(conversationId)}: Conversation must exist`
  );
  conversation.lastSuccessfulGroupFetch = timestamp;
}
