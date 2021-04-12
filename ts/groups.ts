// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  compact,
  Dictionary,
  difference,
  flatten,
  fromPairs,
  isNumber,
  values,
} from 'lodash';
import { ClientZkGroupCipher } from 'zkgroup';
import { v4 as getGuid } from 'uuid';
import {
  getCredentialsForToday,
  GROUP_CREDENTIALS_KEY,
  maybeFetchNewCredentials,
} from './services/groupCredentialFetcher';
import { isStorageWriteFeatureEnabled } from './storage/isFeatureEnabled';
import dataInterface from './sql/Client';
import { toWebSafeBase64, fromWebSafeBase64 } from './util/webSafeBase64';
import { assert } from './util/assert';
import {
  ConversationAttributesType,
  GroupV2MemberType,
  GroupV2PendingAdminApprovalType,
  GroupV2PendingMemberType,
  MessageAttributesType,
} from './model-types.d';
import {
  createProfileKeyCredentialPresentation,
  decryptGroupBlob,
  decryptProfileKey,
  decryptProfileKeyCredentialPresentation,
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
} from './util/zkgroup';
import {
  arrayBufferToBase64,
  arrayBufferToHex,
  base64ToArrayBuffer,
  computeHash,
  deriveMasterKeyFromGroupV1,
  fromEncodedBinaryToArrayBuffer,
  getRandomBytes,
} from './Crypto';
import {
  AccessRequiredEnum,
  GroupAttributeBlobClass,
  GroupChangeClass,
  GroupChangesClass,
  GroupClass,
  GroupJoinInfoClass,
  MemberClass,
  MemberPendingAdminApprovalClass,
  MemberPendingProfileKeyClass,
  ProtoBigNumberType,
  ProtoBinaryType,
} from './textsecure.d';
import {
  GroupCredentialsType,
  GroupLogResponseType,
} from './textsecure/WebAPI';
import MessageSender, { CallbackResultType } from './textsecure/SendMessage';
import { CURRENT_SCHEMA_VERSION as MAX_MESSAGE_SCHEMA } from '../js/modules/types/message';
import { ConversationModel } from './models/conversations';
import { getGroupSizeHardLimit } from './groups/limits';

export { joinViaLink } from './groups/joinViaLink';

export type GroupV2AccessCreateChangeType = {
  type: 'create';
};
export type GroupV2AccessAttributesChangeType = {
  type: 'access-attributes';
  newPrivilege: number;
};
export type GroupV2AccessMembersChangeType = {
  type: 'access-members';
  newPrivilege: number;
};
export type GroupV2AccessInviteLinkChangeType = {
  type: 'access-invite-link';
  newPrivilege: number;
};
export type GroupV2AvatarChangeType = {
  type: 'avatar';
  removed: boolean;
};
export type GroupV2TitleChangeType = {
  type: 'title';
  // Allow for null, because the title could be removed entirely
  newTitle?: string;
};
export type GroupV2GroupLinkAddChangeType = {
  type: 'group-link-add';
  privilege: number;
};
export type GroupV2GroupLinkResetChangeType = {
  type: 'group-link-reset';
};
export type GroupV2GroupLinkRemoveChangeType = {
  type: 'group-link-remove';
};

// No disappearing messages timer change type - message.expirationTimerUpdate used instead

export type GroupV2MemberAddChangeType = {
  type: 'member-add';
  conversationId: string;
};
export type GroupV2MemberAddFromInviteChangeType = {
  type: 'member-add-from-invite';
  conversationId: string;
  inviter?: string;
};
export type GroupV2MemberAddFromLinkChangeType = {
  type: 'member-add-from-link';
  conversationId: string;
};
export type GroupV2MemberAddFromAdminApprovalChangeType = {
  type: 'member-add-from-admin-approval';
  conversationId: string;
};
export type GroupV2MemberPrivilegeChangeType = {
  type: 'member-privilege';
  conversationId: string;
  newPrivilege: number;
};
export type GroupV2MemberRemoveChangeType = {
  type: 'member-remove';
  conversationId: string;
};

export type GroupV2PendingAddOneChangeType = {
  type: 'pending-add-one';
  conversationId: string;
};
export type GroupV2PendingAddManyChangeType = {
  type: 'pending-add-many';
  count: number;
};
// Note: pending-remove is only used if user didn't also join the group at the same time
export type GroupV2PendingRemoveOneChangeType = {
  type: 'pending-remove-one';
  conversationId: string;
  inviter?: string;
};
// Note: pending-remove is only used if user didn't also join the group at the same time
export type GroupV2PendingRemoveManyChangeType = {
  type: 'pending-remove-many';
  count: number;
  inviter?: string;
};

export type GroupV2AdminApprovalAddOneChangeType = {
  type: 'admin-approval-add-one';
  conversationId: string;
};
// Note: admin-approval-remove-one is only used if user didn't also join the group at
//   the same time
export type GroupV2AdminApprovalRemoveOneChangeType = {
  type: 'admin-approval-remove-one';
  conversationId: string;
  inviter?: string;
};

export type GroupV2ChangeDetailType =
  | GroupV2AccessAttributesChangeType
  | GroupV2AccessCreateChangeType
  | GroupV2AccessInviteLinkChangeType
  | GroupV2AccessMembersChangeType
  | GroupV2AdminApprovalAddOneChangeType
  | GroupV2AdminApprovalRemoveOneChangeType
  | GroupV2AvatarChangeType
  | GroupV2GroupLinkAddChangeType
  | GroupV2GroupLinkResetChangeType
  | GroupV2GroupLinkRemoveChangeType
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
  from?: string;
  details: Array<GroupV2ChangeDetailType>;
};

const { updateConversation } = dataInterface;

if (!isNumber(MAX_MESSAGE_SCHEMA)) {
  throw new Error(
    'groups.ts: Unable to capture max message schema from js/modules/types/message'
  );
}

type MemberType = {
  profileKey: string;
  uuid: string;
};
type UpdatesResultType = {
  // The array of new messages to be added into the message timeline
  groupChangeMessages: Array<MessageAttributesType>;
  // The set of members in the group, and we largely just pull profile keys for each,
  //   because the group membership is updated in newAttributes
  members: Array<MemberType>;
  // To be merged into the conversation model
  newAttributes: ConversationAttributesType;
};

type UploadedAvatarType = {
  data: ArrayBuffer;
  hash: string;
  key: string;
};

// Constants

export const MASTER_KEY_LENGTH = 32;
const GROUP_TITLE_MAX_ENCRYPTED_BYTES = 1024;
export const ID_V1_LENGTH = 16;
export const ID_LENGTH = 32;
const TEMPORAL_AUTH_REJECTED_CODE = 401;
const GROUP_ACCESS_DENIED_CODE = 403;
const GROUP_NONEXISTENT_CODE = 404;
const SUPPORTED_CHANGE_EPOCH = 1;
export const LINK_VERSION_ERROR = 'LINK_VERSION_ERROR';
const GROUP_INVITE_LINK_PASSWORD_LENGTH = 16;

// Group Links

export function generateGroupInviteLinkPassword(): ArrayBuffer {
  return getRandomBytes(GROUP_INVITE_LINK_PASSWORD_LENGTH);
}

// Group Links

export async function getPreJoinGroupInfo(
  inviteLinkPasswordBase64: string,
  masterKeyBase64: string
): Promise<GroupJoinInfoClass> {
  const data = window.Signal.Groups.deriveGroupFields(
    base64ToArrayBuffer(masterKeyBase64)
  );

  return makeRequestWithTemporalRetry({
    logId: `groupv2(${data.id})`,
    publicParams: arrayBufferToBase64(data.publicParams),
    secretParams: arrayBufferToBase64(data.secretParams),
    request: (sender, options) =>
      sender.getGroupFromLink(inviteLinkPasswordBase64, options),
  });
}

export function buildGroupLink(conversation: ConversationModel): string {
  const { masterKey, groupInviteLinkPassword } = conversation.attributes;

  const subProto = new window.textsecure.protobuf.GroupInviteLink.GroupInviteLinkContentsV1();
  subProto.groupMasterKey = window.Signal.Crypto.base64ToArrayBuffer(masterKey);
  subProto.inviteLinkPassword = window.Signal.Crypto.base64ToArrayBuffer(
    groupInviteLinkPassword
  );

  const proto = new window.textsecure.protobuf.GroupInviteLink();
  proto.v1Contents = subProto;

  const bytes = proto.toArrayBuffer();
  const hash = toWebSafeBase64(window.Signal.Crypto.arrayBufferToBase64(bytes));

  return `https://signal.group/#${hash}`;
}

export function parseGroupLink(
  hash: string
): { masterKey: string; inviteLinkPassword: string } {
  const base64 = fromWebSafeBase64(hash);
  const buffer = base64ToArrayBuffer(base64);

  const inviteLinkProto = window.textsecure.protobuf.GroupInviteLink.decode(
    buffer
  );
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

  if (!hasData(inviteLinkProto.v1Contents.groupMasterKey)) {
    throw new Error('v1Contents.groupMasterKey had no data!');
  }
  if (!hasData(inviteLinkProto.v1Contents.inviteLinkPassword)) {
    throw new Error('v1Contents.inviteLinkPassword had no data!');
  }

  const masterKey: string = inviteLinkProto.v1Contents.groupMasterKey.toString(
    'base64'
  );
  if (masterKey.length !== 44) {
    throw new Error(`masterKey had unexpected length ${masterKey.length}`);
  }
  const inviteLinkPassword: string = inviteLinkProto.v1Contents.inviteLinkPassword.toString(
    'base64'
  );
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
  } & ({ path: string } | { data: ArrayBuffer })
): Promise<UploadedAvatarType> {
  const { logId, publicParams, secretParams } = options;

  try {
    const clientZkGroupCipher = getClientZkGroupCipher(secretParams);

    let data: ArrayBuffer;
    if ('data' in options) {
      ({ data } = options);
    } else {
      data = await window.Signal.Migrations.readAttachmentData(options.path);
    }

    const hash = await computeHash(data);

    const blob = new window.textsecure.protobuf.GroupAttributeBlob();
    blob.avatar = data;
    const blobPlaintext = blob.toArrayBuffer();
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
    window.log.warn(
      `uploadAvatar/${logId} Failed to upload avatar`,
      error.stack
    );
    throw error;
  }
}

function buildGroupTitleBuffer(
  clientZkGroupCipher: ClientZkGroupCipher,
  title: string
): ArrayBuffer {
  const titleBlob = new window.textsecure.protobuf.GroupAttributeBlob();
  titleBlob.title = title;
  const titleBlobPlaintext = titleBlob.toArrayBuffer();

  const result = encryptGroupBlob(clientZkGroupCipher, titleBlobPlaintext);

  if (result.byteLength > GROUP_TITLE_MAX_ENCRYPTED_BYTES) {
    throw new Error('buildGroupTitleBuffer: encrypted group title is too long');
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
): GroupClass {
  const MEMBER_ROLE_ENUM = window.textsecure.protobuf.Member.Role;
  const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;
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
  const proto = new window.textsecure.protobuf.Group();

  proto.publicKey = base64ToArrayBuffer(publicParams);
  proto.version = attributes.revision || 0;

  if (attributes.name) {
    proto.title = buildGroupTitleBuffer(clientZkGroupCipher, attributes.name);
  }

  if (attributes.avatarUrl) {
    proto.avatar = attributes.avatarUrl;
  }

  if (attributes.expireTimer) {
    const timerBlob = new window.textsecure.protobuf.GroupAttributeBlob();
    timerBlob.disappearingMessagesDuration = attributes.expireTimer;
    const timerBlobPlaintext = timerBlob.toArrayBuffer();
    proto.disappearingMessagesTimer = encryptGroupBlob(
      clientZkGroupCipher,
      timerBlobPlaintext
    );
  }

  const accessControl = new window.textsecure.protobuf.AccessControl();
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
    const member = new window.textsecure.protobuf.Member();

    const conversation = window.ConversationController.get(item.conversationId);
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

  const ourConversationId = window.ConversationController.getOurConversationId();
  if (!ourConversationId) {
    throw new Error(
      `buildGroupProto/${logId}: unable to find our own conversationId!`
    );
  }

  const me = window.ConversationController.get(ourConversationId);
  if (!me) {
    throw new Error(
      `buildGroupProto/${logId}: unable to find our own conversation!`
    );
  }

  const ourUuid = me.get('uuid');
  if (!ourUuid) {
    throw new Error(`buildGroupProto/${logId}: unable to find our own uuid!`);
  }

  const ourUuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, ourUuid);

  proto.membersPendingProfileKey = (attributes.pendingMembersV2 || []).map(
    item => {
      const pendingMember = new window.textsecure.protobuf.MemberPendingProfileKey();
      const member = new window.textsecure.protobuf.Member();

      const conversation = window.ConversationController.get(
        item.conversationId
      );
      if (!conversation) {
        throw new Error('buildGroupProto: no conversation for pending member!');
      }

      const uuid = conversation.get('uuid');
      if (!uuid) {
        throw new Error('buildGroupProto: pending member was missing uuid!');
      }

      const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);
      member.userId = uuidCipherTextBuffer;
      member.role = item.role || MEMBER_ROLE_ENUM.DEFAULT;

      pendingMember.member = member;
      pendingMember.timestamp = item.timestamp;
      pendingMember.addedByUserId = ourUuidCipherTextBuffer;

      return pendingMember;
    }
  );

  return proto;
}

export async function buildAddMembersChange(
  conversation: Pick<
    ConversationAttributesType,
    'id' | 'publicParams' | 'revision' | 'secretParams'
  >,
  conversationIds: ReadonlyArray<string>
): Promise<undefined | GroupChangeClass.Actions> {
  const MEMBER_ROLE_ENUM = window.textsecure.protobuf.Member.Role;

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

  const ourConversationId = window.ConversationController.getOurConversationIdOrThrow();
  const ourConversation = window.ConversationController.get(ourConversationId);
  const ourUuid = ourConversation?.get('uuid');
  if (!ourUuid) {
    throw new Error(
      `buildAddMembersChange/${logId}: unable to find our own UUID!`
    );
  }
  const ourUuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, ourUuid);

  const now = Date.now();

  const addMembers: Array<GroupChangeClass.Actions.AddMemberAction> = [];
  const addPendingMembers: Array<GroupChangeClass.Actions.AddMemberPendingProfileKeyAction> = [];

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

      const uuid = contact.get('uuid');
      if (!uuid) {
        assert(false, `buildAddMembersChange/${logId}: missing UUID; skipping`);
        return;
      }

      // Refresh our local data to be sure
      if (
        !contact.get('capabilities')?.gv2 ||
        !contact.get('profileKey') ||
        !contact.get('profileKeyCredential')
      ) {
        await contact.getProfiles();
      }

      if (!contact.get('capabilities')?.gv2) {
        assert(
          false,
          `buildAddMembersChange/${logId}: member is missing GV2 capability; skipping`
        );
        return;
      }

      const profileKey = contact.get('profileKey');
      const profileKeyCredential = contact.get('profileKeyCredential');

      if (!profileKey) {
        assert(
          false,
          `buildAddMembersChange/${logId}: member is missing profile key; skipping`
        );
        return;
      }

      const member = new window.textsecure.protobuf.Member();
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

        const addMemberAction = new window.textsecure.protobuf.GroupChange.Actions.AddMemberAction();
        addMemberAction.added = member;
        addMemberAction.joinFromInviteLink = false;

        addMembers.push(addMemberAction);
      } else {
        const memberPendingProfileKey = new window.textsecure.protobuf.MemberPendingProfileKey();
        memberPendingProfileKey.member = member;
        memberPendingProfileKey.addedByUserId = ourUuidCipherTextBuffer;
        memberPendingProfileKey.timestamp = now;

        const addPendingMemberAction = new window.textsecure.protobuf.GroupChange.Actions.AddMemberPendingProfileKeyAction();
        addPendingMemberAction.added = memberPendingProfileKey;

        addPendingMembers.push(addPendingMemberAction);
      }
    })
  );

  const actions = new window.textsecure.protobuf.GroupChange.Actions();
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
    avatar?: undefined | ArrayBuffer;
    title?: string;
  }>
): Promise<undefined | GroupChangeClass.Actions> {
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

  const actions = new window.textsecure.protobuf.GroupChange.Actions();

  let hasChangedSomething = false;

  const clientZkGroupCipher = getClientZkGroupCipher(secretParams);

  // There are three possible states here:
  //
  // 1. 'avatar' not in attributes: we don't want to change the avatar.
  // 2. attributes.avatar === undefined: we want to clear the avatar.
  // 3. attributes.avatar !== undefined: we want to update the avatar.
  if ('avatar' in attributes) {
    hasChangedSomething = true;

    actions.modifyAvatar = new window.textsecure.protobuf.GroupChange.Actions.ModifyAvatarAction();
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

    actions.modifyTitle = new window.textsecure.protobuf.GroupChange.Actions.ModifyTitleAction();
    actions.modifyTitle.title = buildGroupTitleBuffer(
      clientZkGroupCipher,
      title
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
  expireTimer?: number;
  group: ConversationAttributesType;
}): GroupChangeClass.Actions {
  const actions = new window.textsecure.protobuf.GroupChange.Actions();

  const blob = new window.textsecure.protobuf.GroupAttributeBlob();
  blob.disappearingMessagesDuration = expireTimer;

  if (!group.secretParams) {
    throw new Error(
      'buildDisappearingMessagesTimerChange: group was missing secretParams!'
    );
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);

  const blobPlaintext = blob.toArrayBuffer();
  const blobCipherText = encryptGroupBlob(clientZkGroupCipher, blobPlaintext);

  const timerAction = new window.textsecure.protobuf.GroupChange.Actions.ModifyDisappearingMessagesTimerAction();
  timerAction.timer = blobCipherText;

  actions.version = (group.revision || 0) + 1;
  actions.modifyDisappearingMessagesTimer = timerAction;

  return actions;
}

export function buildInviteLinkPasswordChange(
  group: ConversationAttributesType,
  inviteLinkPassword: string
): GroupChangeClass.Actions {
  const inviteLinkPasswordAction = new window.textsecure.protobuf.GroupChange.Actions.ModifyInviteLinkPasswordAction();
  inviteLinkPasswordAction.inviteLinkPassword = base64ToArrayBuffer(
    inviteLinkPassword
  );

  const actions = new window.textsecure.protobuf.GroupChange.Actions();
  actions.version = (group.revision || 0) + 1;
  actions.modifyInviteLinkPassword = inviteLinkPasswordAction;

  return actions;
}

export function buildNewGroupLinkChange(
  group: ConversationAttributesType,
  inviteLinkPassword: string,
  addFromInviteLinkAccess: AccessRequiredEnum
): GroupChangeClass.Actions {
  const accessControlAction = new window.textsecure.protobuf.GroupChange.Actions.ModifyAddFromInviteLinkAccessControlAction();
  accessControlAction.addFromInviteLinkAccess = addFromInviteLinkAccess;

  const inviteLinkPasswordAction = new window.textsecure.protobuf.GroupChange.Actions.ModifyInviteLinkPasswordAction();
  inviteLinkPasswordAction.inviteLinkPassword = base64ToArrayBuffer(
    inviteLinkPassword
  );

  const actions = new window.textsecure.protobuf.GroupChange.Actions();
  actions.version = (group.revision || 0) + 1;
  actions.modifyAddFromInviteLinkAccess = accessControlAction;
  actions.modifyInviteLinkPassword = inviteLinkPasswordAction;

  return actions;
}

export function buildAccessControlAddFromInviteLinkChange(
  group: ConversationAttributesType,
  value: AccessRequiredEnum
): GroupChangeClass.Actions {
  const accessControlAction = new window.textsecure.protobuf.GroupChange.Actions.ModifyAddFromInviteLinkAccessControlAction();
  accessControlAction.addFromInviteLinkAccess = value;

  const actions = new window.textsecure.protobuf.GroupChange.Actions();
  actions.version = (group.revision || 0) + 1;
  actions.modifyAddFromInviteLinkAccess = accessControlAction;

  return actions;
}

export function buildAccessControlAttributesChange(
  group: ConversationAttributesType,
  value: AccessRequiredEnum
): GroupChangeClass.Actions {
  const accessControlAction = new window.textsecure.protobuf.GroupChange.Actions.ModifyAttributesAccessControlAction();
  accessControlAction.attributesAccess = value;

  const actions = new window.textsecure.protobuf.GroupChange.Actions();
  actions.version = (group.revision || 0) + 1;
  actions.modifyAttributesAccess = accessControlAction;

  return actions;
}

export function buildAccessControlMembersChange(
  group: ConversationAttributesType,
  value: AccessRequiredEnum
): GroupChangeClass.Actions {
  const accessControlAction = new window.textsecure.protobuf.GroupChange.Actions.ModifyMembersAccessControlAction();
  accessControlAction.membersAccess = value;

  const actions = new window.textsecure.protobuf.GroupChange.Actions();
  actions.version = (group.revision || 0) + 1;
  actions.modifyMemberAccess = accessControlAction;

  return actions;
}

// TODO AND-1101
export function buildDeletePendingAdminApprovalMemberChange({
  group,
  uuid,
}: {
  group: ConversationAttributesType;
  uuid: string;
}): GroupChangeClass.Actions {
  const actions = new window.textsecure.protobuf.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildDeletePendingAdminApprovalMemberChange: group was missing secretParams!'
    );
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);

  const deleteMemberPendingAdminApproval = new window.textsecure.protobuf.GroupChange.Actions.DeleteMemberPendingAdminApprovalAction();
  deleteMemberPendingAdminApproval.deletedUserId = uuidCipherTextBuffer;

  actions.version = (group.revision || 0) + 1;
  actions.deleteMemberPendingAdminApprovals = [
    deleteMemberPendingAdminApproval,
  ];

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
}): GroupChangeClass.Actions {
  const actions = new window.textsecure.protobuf.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildAddPendingAdminApprovalMemberChange: group was missing secretParams!'
    );
  }
  const clientZkProfileCipher = getClientZkProfileOperations(
    serverPublicParamsBase64
  );

  const addMemberPendingAdminApproval = new window.textsecure.protobuf.GroupChange.Actions.AddMemberPendingAdminApprovalAction();
  const presentation = createProfileKeyCredentialPresentation(
    clientZkProfileCipher,
    profileKeyCredentialBase64,
    group.secretParams
  );

  const added = new window.textsecure.protobuf.MemberPendingAdminApproval();
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
}: {
  group: ConversationAttributesType;
  profileKeyCredentialBase64: string;
  serverPublicParamsBase64: string;
  joinFromInviteLink?: boolean;
}): GroupChangeClass.Actions {
  const MEMBER_ROLE_ENUM = window.textsecure.protobuf.Member.Role;

  const actions = new window.textsecure.protobuf.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error('buildAddMember: group was missing secretParams!');
  }
  const clientZkProfileCipher = getClientZkProfileOperations(
    serverPublicParamsBase64
  );

  const addMember = new window.textsecure.protobuf.GroupChange.Actions.AddMemberAction();
  const presentation = createProfileKeyCredentialPresentation(
    clientZkProfileCipher,
    profileKeyCredentialBase64,
    group.secretParams
  );

  const added = new window.textsecure.protobuf.Member();
  added.presentation = presentation;
  added.role = MEMBER_ROLE_ENUM.DEFAULT;

  addMember.added = added;

  actions.version = (group.revision || 0) + 1;
  actions.addMembers = [addMember];

  return actions;
}

export function buildDeletePendingMemberChange({
  uuids,
  group,
}: {
  uuids: Array<string>;
  group: ConversationAttributesType;
}): GroupChangeClass.Actions {
  const actions = new window.textsecure.protobuf.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildDeletePendingMemberChange: group was missing secretParams!'
    );
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);

  const deletePendingMembers = uuids.map(uuid => {
    const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);
    const deletePendingMember = new window.textsecure.protobuf.GroupChange.Actions.DeleteMemberPendingProfileKeyAction();
    deletePendingMember.deletedUserId = uuidCipherTextBuffer;
    return deletePendingMember;
  });

  actions.version = (group.revision || 0) + 1;
  actions.deletePendingMembers = deletePendingMembers;

  return actions;
}

export function buildDeleteMemberChange({
  uuid,
  group,
}: {
  uuid: string;
  group: ConversationAttributesType;
}): GroupChangeClass.Actions {
  const actions = new window.textsecure.protobuf.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error('buildDeleteMemberChange: group was missing secretParams!');
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);

  const deleteMember = new window.textsecure.protobuf.GroupChange.Actions.DeleteMemberAction();
  deleteMember.deletedUserId = uuidCipherTextBuffer;

  actions.version = (group.revision || 0) + 1;
  actions.deleteMembers = [deleteMember];

  return actions;
}

export function buildModifyMemberRoleChange({
  uuid,
  group,
  role,
}: {
  uuid: string;
  group: ConversationAttributesType;
  role: number;
}): GroupChangeClass.Actions {
  const actions = new window.textsecure.protobuf.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error('buildMakeAdminChange: group was missing secretParams!');
  }

  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);

  const toggleAdmin = new window.textsecure.protobuf.GroupChange.Actions.ModifyMemberRoleAction();
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
  uuid: string;
}): GroupChangeClass.Actions {
  const MEMBER_ROLE_ENUM = window.textsecure.protobuf.Member.Role;
  const actions = new window.textsecure.protobuf.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildAddPendingAdminApprovalMemberChange: group was missing secretParams!'
    );
  }

  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);

  const promotePendingMember = new window.textsecure.protobuf.GroupChange.Actions.PromoteMemberPendingAdminApprovalAction();
  promotePendingMember.userId = uuidCipherTextBuffer;
  promotePendingMember.role = MEMBER_ROLE_ENUM.DEFAULT;

  actions.version = (group.revision || 0) + 1;
  actions.promoteMemberPendingAdminApprovals = [promotePendingMember];

  return actions;
}

export function buildPromoteMemberChange({
  group,
  profileKeyCredentialBase64,
  serverPublicParamsBase64,
}: {
  group: ConversationAttributesType;
  profileKeyCredentialBase64: string;
  serverPublicParamsBase64: string;
}): GroupChangeClass.Actions {
  const actions = new window.textsecure.protobuf.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildDisappearingMessagesTimerChange: group was missing secretParams!'
    );
  }
  const clientZkProfileCipher = getClientZkProfileOperations(
    serverPublicParamsBase64
  );

  const presentation = createProfileKeyCredentialPresentation(
    clientZkProfileCipher,
    profileKeyCredentialBase64,
    group.secretParams
  );

  const promotePendingMember = new window.textsecure.protobuf.GroupChange.Actions.PromoteMemberPendingProfileKeyAction();
  promotePendingMember.presentation = presentation;

  actions.version = (group.revision || 0) + 1;
  actions.promotePendingMembers = [promotePendingMember];

  return actions;
}

export async function uploadGroupChange({
  actions,
  group,
  inviteLinkPassword,
}: {
  actions: GroupChangeClass.Actions;
  group: ConversationAttributesType;
  inviteLinkPassword?: string;
}): Promise<GroupChangeClass> {
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
  createGroupChange,
  extraConversationsForSend,
  inviteLinkPassword,
  name,
}: {
  conversation: ConversationModel;
  createGroupChange: () => Promise<GroupChangeClass.Actions | undefined>;
  extraConversationsForSend?: Array<string>;
  inviteLinkPassword?: string;
  name: string;
}): Promise<void> {
  const idLog = `${name}/${conversation.idForLogging()}`;

  if (!conversation.isGroupV2()) {
    throw new Error(
      `modifyGroupV2/${idLog}: Called for non-GroupV2 conversation`
    );
  }

  const ONE_MINUTE = 1000 * 60;
  const startTime = Date.now();
  const timeoutTime = startTime + ONE_MINUTE;

  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    window.log.info(`modifyGroupV2/${idLog}: Starting attempt ${attempt}`);
    try {
      // eslint-disable-next-line no-await-in-loop
      await window.waitForEmptyEventQueue();

      window.log.info(`modifyGroupV2/${idLog}: Queuing attempt ${attempt}`);

      // eslint-disable-next-line no-await-in-loop
      await conversation.queueJob(async () => {
        window.log.info(`modifyGroupV2/${idLog}: Running attempt ${attempt}`);

        const actions = await createGroupChange();
        if (!actions) {
          window.log.warn(
            `modifyGroupV2/${idLog}: No change actions. Returning early.`
          );
          return;
        }

        // The new revision has to be exactly one more than the current revision
        //   or it won't upload properly, and it won't apply in maybeUpdateGroup
        const currentRevision = conversation.get('revision');
        const newRevision = actions.version;

        if ((currentRevision || 0) + 1 !== newRevision) {
          throw new Error(
            `modifyGroupV2/${idLog}: Revision mismatch - ${currentRevision} to ${newRevision}.`
          );
        }

        // Upload. If we don't have permission, the server will return an error here.
        const groupChange = await window.Signal.Groups.uploadGroupChange({
          actions,
          inviteLinkPassword,
          group: conversation.attributes,
        });

        const groupChangeBuffer = groupChange.toArrayBuffer();
        const groupChangeBase64 = arrayBufferToBase64(groupChangeBuffer);

        // Apply change locally, just like we would with an incoming change. This will
        //   change conversation state and add change notifications to the timeline.
        await window.Signal.Groups.maybeUpdateGroup({
          conversation,
          groupChangeBase64,
          newRevision,
        });

        // Send message to notify group members (including pending members) of change
        const profileKey = conversation.get('profileSharing')
          ? window.storage.get('profileKey')
          : undefined;

        const sendOptions = conversation.getSendOptions();
        const timestamp = Date.now();

        const promise = conversation.wrapSend(
          window.textsecure.messaging.sendMessageToGroup(
            {
              groupV2: conversation.getGroupV2Info({
                groupChange: groupChangeBuffer,
                includePendingMembers: true,
                extraConversationsForSend,
              }),
              timestamp,
              profileKey,
            },
            sendOptions
          )
        );

        // We don't save this message; we just use it to ensure that a sync message is
        //   sent to our linked devices.
        const m = new window.Whisper.Message(({
          conversationId: conversation.id,
          type: 'not-to-save',
          sent_at: timestamp,
          received_at: timestamp,
          // TODO: DESKTOP-722
          // this type does not fully implement the interface it is expected to
        } as unknown) as MessageAttributesType);

        // This is to ensure that the functions in send() and sendSyncMessage()
        //   don't save anything to the database.
        m.doNotSave = true;

        await m.send(promise);
      });

      // If we've gotten here with no error, we exit!
      window.log.info(
        `modifyGroupV2/${idLog}: Update complete, with attempt ${attempt}!`
      );
      break;
    } catch (error) {
      if (error.code === 409 && Date.now() <= timeoutTime) {
        window.log.info(
          `modifyGroupV2/${idLog}: Conflict while updating. Trying again...`
        );

        // eslint-disable-next-line no-await-in-loop
        await conversation.fetchLatestGroupV2Data();
      } else if (error.code === 409) {
        window.log.error(
          `modifyGroupV2/${idLog}: Conflict while updating. Timed out; not retrying.`
        );
        // We don't wait here because we're breaking out of the loop immediately.
        conversation.fetchLatestGroupV2Data();
        throw error;
      } else {
        const errorString = error && error.stack ? error.stack : error;
        window.log.error(
          `modifyGroupV2/${idLog}: Error updating: ${errorString}`
        );
        throw error;
      }
    }
  }
}

// Utility

export function idForLogging(groupId: string | undefined): string {
  return `groupv2(${groupId})`;
}

export function deriveGroupFields(
  masterKey: ArrayBuffer
): { id: ArrayBuffer; secretParams: ArrayBuffer; publicParams: ArrayBuffer } {
  const secretParams = deriveGroupSecretParams(masterKey);
  const publicParams = deriveGroupPublicParams(secretParams);
  const id = deriveGroupID(secretParams);

  return {
    id,
    secretParams,
    publicParams,
  };
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
  const data = window.storage.get(GROUP_CREDENTIALS_KEY);
  if (!data) {
    throw new Error(
      `makeRequestWithTemporalRetry/${logId}: No group credentials!`
    );
  }
  const groupCredentials = getCredentialsForToday(data);

  const sender = window.textsecure.messaging;
  if (!sender) {
    throw new Error(
      `makeRequestWithTemporalRetry/${logId}: textsecure.messaging is not available!`
    );
  }

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
      window.log.warn(
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

export async function createGroupV2({
  name,
  avatar,
  conversationIds,
}: Readonly<{
  name: string;
  avatar: undefined | ArrayBuffer;
  conversationIds: Array<string>;
}>): Promise<ConversationModel> {
  // Ensure we have the credentials we need before attempting GroupsV2 operations
  await maybeFetchNewCredentials();

  if (!isStorageWriteFeatureEnabled()) {
    throw new Error(
      'createGroupV2: storage service write is not enabled. Cannot create the group'
    );
  }

  const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;
  const MEMBER_ROLE_ENUM = window.textsecure.protobuf.Member.Role;

  const masterKeyBuffer = getRandomBytes(32);
  const fields = deriveGroupFields(masterKeyBuffer);

  const groupId = arrayBufferToBase64(fields.id);
  const logId = `groupv2(${groupId})`;

  const masterKey = arrayBufferToBase64(masterKeyBuffer);
  const secretParams = arrayBufferToBase64(fields.secretParams);
  const publicParams = arrayBufferToBase64(fields.publicParams);

  const ourConversationId = window.ConversationController.getOurConversationIdOrThrow();
  const ourConversation = window.ConversationController.get(ourConversationId);
  if (!ourConversation) {
    throw new Error(
      `createGroupV2/${logId}: cannot get our own conversation. Cannot create the group`
    );
  }

  const membersV2: Array<GroupV2MemberType> = [
    {
      conversationId: ourConversationId,
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

      if (!contact.get('uuid')) {
        assert(false, `createGroupV2/${logId}: missing UUID; skipping`);
        return;
      }

      // Refresh our local data to be sure
      if (
        !contact.get('capabilities')?.gv2 ||
        !contact.get('profileKey') ||
        !contact.get('profileKeyCredential')
      ) {
        await contact.getProfiles();
      }

      if (!contact.get('capabilities')?.gv2) {
        assert(
          false,
          `createGroupV2/${logId}: member is missing GV2 capability; skipping`
        );
        return;
      }

      if (contact.get('profileKey') && contact.get('profileKeyCredential')) {
        membersV2.push({
          conversationId,
          role: MEMBER_ROLE_ENUM.DEFAULT,
          joinedAtVersion: 0,
        });
      } else {
        pendingMembersV2.push({
          addedByUserId: ourConversationId,
          conversationId,
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

  await makeRequestWithTemporalRetry({
    logId: `createGroupV2/${logId}`,
    publicParams,
    secretParams,
    request: (sender, options) => sender.createGroup(groupProto, options),
  });

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
      window.log.warn(
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
      addedBy: ourConversationId,
      avatar: avatarAttribute,
      groupVersion: 2,
      masterKey,
      profileSharing: true,
      timestamp: now,
      needsStorageServiceSync: true,
    }
  );

  await conversation.queueJob(() => {
    window.Signal.Services.storageServiceUploadJob();
  });

  const timestamp = Date.now();
  const profileKey = ourConversation.get('profileKey');

  const groupV2Info = conversation.getGroupV2Info({
    includePendingMembers: true,
  });

  await wrapWithSyncMessageSend({
    conversation,
    logId: `sendMessageToGroup/${logId}`,
    send: async sender =>
      sender.sendMessageToGroup({
        groupV2: groupV2Info,
        timestamp,
        profileKey: profileKey ? base64ToArrayBuffer(profileKey) : undefined,
      }),
    timestamp,
  });

  const createdTheGroupMessage: MessageAttributesType = {
    ...generateBasicMessage(),
    type: 'group-v2-change',
    sourceUuid: conversation.ourUuid,
    conversationId: conversation.id,
    received_at: window.Signal.Util.incrementMessageCounter(),
    received_at_ms: timestamp,
    sent_at: timestamp,
    groupV2Change: {
      from: ourConversationId,
      details: [{ type: 'create' }],
    },
  };
  await window.Signal.Data.saveMessages([createdTheGroupMessage], {
    forceSave: true,
  });
  const model = new window.Whisper.Message(createdTheGroupMessage);
  window.MessageController.register(model.id, model);
  conversation.trigger('newmessage', model);

  return conversation;
}

// Migrating a group

export async function hasV1GroupBeenMigrated(
  conversation: ConversationModel
): Promise<boolean> {
  const logId = conversation.idForLogging();
  const isGroupV1 = conversation.isGroupV1();
  if (!isGroupV1) {
    window.log.warn(
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

  const idBuffer = fromEncodedBinaryToArrayBuffer(groupId);
  const masterKeyBuffer = await deriveMasterKeyFromGroupV1(idBuffer);
  const fields = deriveGroupFields(masterKeyBuffer);

  try {
    await makeRequestWithTemporalRetry({
      logId: `getGroup/${logId}`,
      publicParams: arrayBufferToBase64(fields.publicParams),
      secretParams: arrayBufferToBase64(fields.secretParams),
      request: (sender, options) => sender.getGroup(options),
    });
    return true;
  } catch (error) {
    const { code } = error;
    return code !== GROUP_NONEXISTENT_CODE;
  }
}

export async function maybeDeriveGroupV2Id(
  conversation: ConversationModel
): Promise<boolean> {
  const isGroupV1 = conversation.isGroupV1();
  const groupV1Id = conversation.get('groupId');
  const derived = conversation.get('derivedGroupV2Id');

  if (!isGroupV1 || !groupV1Id || derived) {
    return false;
  }

  const v1IdBuffer = fromEncodedBinaryToArrayBuffer(groupV1Id);
  const masterKeyBuffer = await deriveMasterKeyFromGroupV1(v1IdBuffer);
  const fields = deriveGroupFields(masterKeyBuffer);
  const derivedGroupV2Id = arrayBufferToBase64(fields.id);

  conversation.set({
    derivedGroupV2Id,
  });

  return true;
}

type MigratePropsType = {
  conversation: ConversationModel;
  groupChangeBase64?: string;
  newRevision?: number;
  receivedAt?: number;
  sentAt?: number;
};

export async function isGroupEligibleToMigrate(
  conversation: ConversationModel
): Promise<boolean> {
  if (!conversation.isGroupV1()) {
    return false;
  }

  const ourConversationId = window.ConversationController.getOurConversationId();
  const areWeMember =
    !conversation.get('left') &&
    ourConversationId &&
    conversation.hasMember(ourConversationId);
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
  const MEMBER_ROLE_ENUM = window.textsecure.protobuf.Member.Role;

  const ourConversationId = window.ConversationController.getOurConversationId();
  if (!ourConversationId) {
    throw new Error(
      `getGroupMigrationMembers/${logId}: Couldn't fetch our own conversationId!`
    );
  }

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
        if (!contact.isMe() && window.GV2_MIGRATION_DISABLE_ADD) {
          window.log.warn(
            `getGroupMigrationMembers/${logId}: membersV2 - skipping ${e164} due to GV2_MIGRATION_DISABLE_ADD flag`
          );
          return null;
        }

        if (!contact.get('uuid')) {
          window.log.warn(
            `getGroupMigrationMembers/${logId}: membersV2 - missing uuid for ${e164}, skipping.`
          );
          return null;
        }

        if (!contact.get('profileKey')) {
          window.log.warn(
            `getGroupMigrationMembers/${logId}: membersV2 - missing profileKey for member ${e164}, skipping.`
          );
          return null;
        }

        let capabilities = contact.get('capabilities');

        // Refresh our local data to be sure
        if (
          !capabilities ||
          !capabilities.gv2 ||
          !capabilities['gv1-migration'] ||
          !contact.get('profileKeyCredential')
        ) {
          await contact.getProfiles();
        }

        capabilities = contact.get('capabilities');
        if (!capabilities || !capabilities.gv2) {
          window.log.warn(
            `getGroupMigrationMembers/${logId}: membersV2 - member ${e164} is missing gv2 capability, skipping.`
          );
          return null;
        }
        if (!capabilities || !capabilities['gv1-migration']) {
          window.log.warn(
            `getGroupMigrationMembers/${logId}: membersV2 - member ${e164} is missing gv1-migration capability, skipping.`
          );
          return null;
        }
        if (!contact.get('profileKeyCredential')) {
          window.log.warn(
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
          conversationId,
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

      if (!contact.isMe() && window.GV2_MIGRATION_DISABLE_INVITE) {
        window.log.warn(
          `getGroupMigrationMembers/${logId}: pendingMembersV2 - skipping ${e164} due to GV2_MIGRATION_DISABLE_INVITE flag`
        );
        droppedGV2MemberIds.push(conversationId);
        return null;
      }

      if (!contact.get('uuid')) {
        window.log.warn(
          `getGroupMigrationMembers/${logId}: pendingMembersV2 - missing uuid for ${e164}, skipping.`
        );
        droppedGV2MemberIds.push(conversationId);
        return null;
      }

      const capabilities = contact.get('capabilities');
      if (!capabilities || !capabilities.gv2) {
        window.log.warn(
          `getGroupMigrationMembers/${logId}: pendingMembersV2 - member ${e164} is missing gv2 capability, skipping.`
        );
        droppedGV2MemberIds.push(conversationId);
        return null;
      }
      if (!capabilities || !capabilities['gv1-migration']) {
        window.log.warn(
          `getGroupMigrationMembers/${logId}: pendingMembersV2 - member ${e164} is missing gv1-migration capability, skipping.`
        );
        droppedGV2MemberIds.push(conversationId);
        return null;
      }

      if (conversationId === ourConversationId) {
        areWeInvited = true;
      }

      return {
        conversationId,
        timestamp: now,
        addedByUserId: ourConversationId,
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

  let ourProfileKey: undefined | string;

  try {
    await conversation.queueJob(async () => {
      const ACCESS_ENUM =
        window.textsecure.protobuf.AccessControl.AccessRequired;

      const isEligible = isGroupEligibleToMigrate(conversation);
      const previousGroupV1Id = conversation.get('groupId');

      if (!isEligible || !previousGroupV1Id) {
        throw new Error(
          `initiateMigrationToGroupV2: conversation is not eligible to migrate! ${conversation.idForLogging()}`
        );
      }

      const groupV1IdBuffer = fromEncodedBinaryToArrayBuffer(previousGroupV1Id);
      const masterKeyBuffer = await deriveMasterKeyFromGroupV1(groupV1IdBuffer);
      const fields = deriveGroupFields(masterKeyBuffer);

      const groupId = arrayBufferToBase64(fields.id);
      const logId = `groupv2(${groupId})`;
      window.log.info(
        `initiateMigrationToGroupV2/${logId}: Migrating from ${conversation.idForLogging()}`
      );

      const masterKey = arrayBufferToBase64(masterKeyBuffer);
      const secretParams = arrayBufferToBase64(fields.secretParams);
      const publicParams = arrayBufferToBase64(fields.publicParams);

      const ourConversationId = window.ConversationController.getOurConversationId();
      if (!ourConversationId) {
        throw new Error(
          `initiateMigrationToGroupV2/${logId}: Couldn't fetch our own conversationId!`
        );
      }
      const ourConversation = window.ConversationController.get(
        ourConversationId
      );
      if (!ourConversation) {
        throw new Error(
          `initiateMigrationToGroupV2/${logId}: cannot get our own conversation. Cannot migrate`
        );
      }
      ourProfileKey = ourConversation.get('profileKey');

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
        window.log.error(
          `initiateMigrationToGroupV2/${logId}: Error creating group:`,
          error.stack
        );

        throw error;
      }

      const groupChangeMessages: Array<MessageAttributesType> = [];
      groupChangeMessages.push({
        ...generateBasicMessage(),
        type: 'group-v1-migration',
        invitedGV2Members: pendingMembersV2,
        droppedGV2MemberIds,
      });

      await updateGroup({
        conversation,
        updates: {
          newAttributes,
          groupChangeMessages,
          members: [],
        },
      });

      if (window.storage.isGroupBlocked(previousGroupV1Id)) {
        window.storage.addBlockedGroup(groupId);
      }

      // Save these most recent updates to conversation
      updateConversation(conversation.attributes);
    });
  } catch (error) {
    const logId = conversation.idForLogging();
    if (!conversation.isGroupV1()) {
      throw error;
    }

    const alreadyMigrated = await hasV1GroupBeenMigrated(conversation);
    if (!alreadyMigrated) {
      window.log.error(
        `initiateMigrationToGroupV2/${logId}: Group has not already been migrated, re-throwing error`
      );
      throw error;
    }

    await respondToGroupV2Migration({
      conversation,
    });

    return;
  }

  // We've migrated the group, now we need to let all other group members know about it
  const logId = conversation.idForLogging();
  const timestamp = Date.now();

  await wrapWithSyncMessageSend({
    conversation,
    logId: `sendMessageToGroup/${logId}`,
    send: async sender =>
      // Minimal message to notify group members about migration
      sender.sendMessageToGroup({
        groupV2: conversation.getGroupV2Info({
          includePendingMembers: true,
        }),
        timestamp,
        profileKey: ourProfileKey
          ? base64ToArrayBuffer(ourProfileKey)
          : undefined,
      }),
    timestamp,
  });
}

export async function wrapWithSyncMessageSend({
  conversation,
  logId,
  send,
  timestamp,
}: {
  conversation: ConversationModel;
  logId: string;
  send: (sender: MessageSender) => Promise<CallbackResultType | undefined>;
  timestamp: number;
}): Promise<void> {
  const sender = window.textsecure.messaging;
  if (!sender) {
    throw new Error(
      `initiateMigrationToGroupV2/${logId}: textsecure.messaging is not available!`
    );
  }

  let response: CallbackResultType | undefined;
  try {
    response = await send(sender);
  } catch (error) {
    if (conversation.processSendResponse(error)) {
      response = error;
    }
  }

  if (!response) {
    throw new Error(
      `wrapWithSyncMessageSend/${logId}: message send didn't return result!!`
    );
  }

  // Minimal implementation of sending same message to linked devices
  const { dataMessage } = response;
  if (!dataMessage) {
    throw new Error(
      `wrapWithSyncMessageSend/${logId}: dataMessage was not returned by send!`
    );
  }

  const ourConversationId = window.ConversationController.getOurConversationId();
  if (!ourConversationId) {
    throw new Error(
      `wrapWithSyncMessageSend/${logId}: Cannot get our conversationId!`
    );
  }

  const ourConversation = window.ConversationController.get(ourConversationId);
  if (!ourConversation) {
    throw new Error(
      `wrapWithSyncMessageSend/${logId}: Cannot get our conversation!`
    );
  }

  await sender.sendSyncMessage(
    dataMessage,
    timestamp,
    ourConversation.get('e164'),
    ourConversation.get('uuid'),
    null, // expirationStartTimestamp
    [], // sentTo
    [], // unidentifiedDeliveries
    undefined, // isUpdate
    undefined // options
  );
}

export async function waitThenRespondToGroupV2Migration(
  options: MigratePropsType
): Promise<void> {
  // First wait to process all incoming messages on the websocket
  await window.waitForEmptyEventQueue();

  // Then wait to process all outstanding messages for this conversation
  const { conversation } = options;

  await conversation.queueJob(async () => {
    try {
      // And finally try to migrate the group
      await respondToGroupV2Migration(options);
    } catch (error) {
      window.log.error(
        `waitThenRespondToGroupV2Migration/${conversation.idForLogging()}: respondToGroupV2Migration failure:`,
        error && error.stack ? error.stack : error
      );
    }
  });
}

export function buildMigrationBubble(
  previousGroupV1MembersIds: Array<string>,
  newAttributes: ConversationAttributesType
): MessageAttributesType {
  const ourConversationId = window.ConversationController.getOurConversationIdOrThrow();

  // Assemble items to commemorate this event for the timeline..
  const combinedConversationIds: Array<string> = [
    ...(newAttributes.membersV2 || []).map(item => item.conversationId),
    ...(newAttributes.pendingMembersV2 || []).map(item => item.conversationId),
  ];
  const droppedMemberIds: Array<string> = difference(
    previousGroupV1MembersIds,
    combinedConversationIds
  ).filter(id => id && id !== ourConversationId);
  const invitedMembers = (newAttributes.pendingMembersV2 || []).filter(
    item => item.conversationId !== ourConversationId
  );

  const areWeInvited = (newAttributes.pendingMembersV2 || []).some(
    item => item.conversationId === ourConversationId
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
  const isGroupV1 = conversation.isGroupV1();
  const previousGroupV1Id = conversation.get('groupId');

  if (!isGroupV1 || !previousGroupV1Id) {
    throw new Error(
      `joinGroupV2ViaLinkAndMigrate: Conversation is not GroupV1! ${conversation.idForLogging()}`
    );
  }

  // Derive GroupV2 fields
  const groupV1IdBuffer = fromEncodedBinaryToArrayBuffer(previousGroupV1Id);
  const masterKeyBuffer = await deriveMasterKeyFromGroupV1(groupV1IdBuffer);
  const fields = deriveGroupFields(masterKeyBuffer);

  const groupId = arrayBufferToBase64(fields.id);
  const logId = idForLogging(groupId);
  window.log.info(
    `joinGroupV2ViaLinkAndMigrate/${logId}: Migrating from ${conversation.idForLogging()}`
  );

  const masterKey = arrayBufferToBase64(masterKeyBuffer);
  const secretParams = arrayBufferToBase64(fields.secretParams);
  const publicParams = arrayBufferToBase64(fields.publicParams);

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
  const groupChangeMessages = [
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
  groupChangeBase64,
  newRevision,
  receivedAt,
  sentAt,
}: MigratePropsType): Promise<void> {
  // Ensure we have the credentials we need before attempting GroupsV2 operations
  await maybeFetchNewCredentials();

  const isGroupV1 = conversation.isGroupV1();
  const previousGroupV1Id = conversation.get('groupId');

  if (!isGroupV1 || !previousGroupV1Id) {
    throw new Error(
      `respondToGroupV2Migration: Conversation is not GroupV1! ${conversation.idForLogging()}`
    );
  }

  const ourConversationId = window.ConversationController.getOurConversationIdOrThrow();
  const wereWePreviouslyAMember =
    !conversation.get('left') &&
    ourConversationId &&
    conversation.hasMember(ourConversationId);

  // Derive GroupV2 fields
  const groupV1IdBuffer = fromEncodedBinaryToArrayBuffer(previousGroupV1Id);
  const masterKeyBuffer = await deriveMasterKeyFromGroupV1(groupV1IdBuffer);
  const fields = deriveGroupFields(masterKeyBuffer);

  const groupId = arrayBufferToBase64(fields.id);
  const logId = idForLogging(groupId);
  window.log.info(
    `respondToGroupV2Migration/${logId}: Migrating from ${conversation.idForLogging()}`
  );

  const masterKey = arrayBufferToBase64(masterKeyBuffer);
  const secretParams = arrayBufferToBase64(fields.secretParams);
  const publicParams = arrayBufferToBase64(fields.publicParams);

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

  let firstGroupState: GroupClass | undefined | null;

  try {
    const response: GroupLogResponseType = await makeRequestWithTemporalRetry({
      logId: `getGroupLog/${logId}`,
      publicParams,
      secretParams,
      request: (sender, options) => sender.getGroupLog(0, options),
    });

    // Attempt to start with the first group state, only later processing future updates
    firstGroupState = response?.changes?.groupChanges?.[0]?.groupState;
  } catch (error) {
    if (error.code === GROUP_ACCESS_DENIED_CODE) {
      window.log.info(
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
          window.log.info(
            `respondToGroupV2Migration/${logId}: Failed to access state endpoint; user is no longer part of group`
          );

          // We don't want to add another event to the timeline
          if (wereWePreviouslyAMember) {
            const ourNumber = window.textsecure.storage.user.getNumber();
            await updateGroup({
              conversation,
              receivedAt,
              sentAt,
              updates: {
                newAttributes: {
                  ...conversation.attributes,
                  left: true,
                  members: (conversation.get('members') || []).filter(
                    item => item !== ourConversationId && item !== ourNumber
                  ),
                },
                groupChangeMessages: [
                  {
                    ...generateBasicMessage(),
                    type: 'group-v2-change',
                    groupV2Change: {
                      details: [
                        {
                          type: 'member-remove' as const,
                          conversationId: ourConversationId,
                        },
                      ],
                    },
                  },
                ],
                members: [],
              },
            });
            return;
          }
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
  const groupChangeMessages: Array<MessageAttributesType> = [];

  groupChangeMessages.push(
    buildMigrationBubble(previousGroupV1MembersIds, newAttributes)
  );

  const areWeInvited = (newAttributes.pendingMembersV2 || []).some(
    item => item.conversationId === ourConversationId
  );
  const areWeMember = (newAttributes.membersV2 || []).some(
    item => item.conversationId === ourConversationId
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
            conversationId: ourConversationId,
          },
        ],
      },
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

  if (window.storage.isGroupBlocked(previousGroupV1Id)) {
    window.storage.addBlockedGroup(groupId);
  }

  // Save these most recent updates to conversation
  updateConversation(conversation.attributes);

  // Finally, check for any changes to the group since its initial creation using normal
  //   group update codepaths.
  await maybeUpdateGroup({
    conversation,
    groupChangeBase64,
    newRevision,
    receivedAt,
    sentAt,
  });
}

// Fetching and applying group changes

type MaybeUpdatePropsType = {
  conversation: ConversationModel;
  groupChangeBase64?: string;
  newRevision?: number;
  receivedAt?: number;
  sentAt?: number;
  dropInitialJoinMessage?: boolean;
};

export async function waitThenMaybeUpdateGroup(
  options: MaybeUpdatePropsType
): Promise<void> {
  // First wait to process all incoming messages on the websocket
  await window.waitForEmptyEventQueue();

  // Then wait to process all outstanding messages for this conversation
  const { conversation } = options;

  await conversation.queueJob(async () => {
    try {
      // And finally try to update the group
      await maybeUpdateGroup(options);
    } catch (error) {
      window.log.error(
        `waitThenMaybeUpdateGroup/${conversation.idForLogging()}: maybeUpdateGroup failure:`,
        error && error.stack ? error.stack : error
      );
    }
  });
}

export async function maybeUpdateGroup({
  conversation,
  dropInitialJoinMessage,
  groupChangeBase64,
  newRevision,
  receivedAt,
  sentAt,
}: MaybeUpdatePropsType): Promise<void> {
  const logId = conversation.idForLogging();

  try {
    // Ensure we have the credentials we need before attempting GroupsV2 operations
    await maybeFetchNewCredentials();

    const updates = await getGroupUpdates({
      group: conversation.attributes,
      serverPublicParamsBase64: window.getServerPublicParams(),
      newRevision,
      groupChangeBase64,
      dropInitialJoinMessage,
    });

    await updateGroup({ conversation, receivedAt, sentAt, updates });
  } catch (error) {
    window.log.error(
      `maybeUpdateGroup/${logId}: Failed to update group:`,
      error && error.stack ? error.stack : error
    );
    throw error;
  }
}

async function updateGroup({
  conversation,
  receivedAt,
  sentAt,
  updates,
}: {
  conversation: ConversationModel;
  receivedAt?: number;
  sentAt?: number;
  updates: UpdatesResultType;
}): Promise<void> {
  const { newAttributes, groupChangeMessages, members } = updates;

  const startingRevision = conversation.get('revision');
  const endingRevision = newAttributes.revision;

  const isInitialDataFetch =
    !isNumber(startingRevision) && isNumber(endingRevision);
  const isInGroup = !updates.newAttributes.left;
  const justJoinedGroup = conversation.get('left') && isInGroup;

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

  conversation.set({
    ...newAttributes,
    // We force this conversation into the left pane if this is the first time we've
    //   fetched data about it, and we were able to fetch its name. Nobody likes to see
    //   Unknown Group in the left pane.
    active_at:
      (isInitialDataFetch || justJoinedGroup) && newAttributes.name
        ? initialSentAt
        : newAttributes.active_at,
    temporaryMemberCount: isInGroup
      ? undefined
      : newAttributes.temporaryMemberCount,
  });

  if (idChanged) {
    conversation.trigger('idUpdated', conversation, 'groupId', previousId);
  }

  // Save all synthetic messages describing group changes
  let syntheticSentAt = initialSentAt - (groupChangeMessages.length + 1);
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
    };
  });

  if (changeMessagesToSave.length > 0) {
    await window.Signal.Data.saveMessages(changeMessagesToSave, {
      forceSave: true,
    });
    changeMessagesToSave.forEach(changeMessage => {
      const model = new window.Whisper.Message(changeMessage);
      window.MessageController.register(model.id, model);
      conversation.trigger('newmessage', model);
    });
  }

  // Capture profile key for each member in the group, if we don't have it yet
  members.forEach(member => {
    const contact = window.ConversationController.get(member.uuid);

    if (member.profileKey && contact && !contact.get('profileKey')) {
      contact.setProfileKey(member.profileKey);
    }
  });

  // No need for convo.updateLastMessage(), 'newmessage' handler does that
}

async function getGroupUpdates({
  dropInitialJoinMessage,
  group,
  serverPublicParamsBase64,
  newRevision,
  groupChangeBase64,
}: {
  dropInitialJoinMessage?: boolean;
  group: ConversationAttributesType;
  groupChangeBase64?: string;
  newRevision?: number;
  serverPublicParamsBase64: string;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);

  window.log.info(`getGroupUpdates/${logId}: Starting...`);

  const currentRevision = group.revision;
  const isFirstFetch = !isNumber(group.revision);
  const ourConversationId = window.ConversationController.getOurConversationId();

  const isInitialCreationMessage = isFirstFetch && newRevision === 0;
  const weAreAwaitingApproval = (group.pendingAdminApprovalV2 || []).find(
    item => item.conversationId === ourConversationId
  );
  const isOneVersionUp =
    isNumber(currentRevision) &&
    isNumber(newRevision) &&
    newRevision === currentRevision + 1;

  if (
    window.GV2_ENABLE_SINGLE_CHANGE_PROCESSING &&
    groupChangeBase64 &&
    isNumber(newRevision) &&
    (isInitialCreationMessage || weAreAwaitingApproval || isOneVersionUp)
  ) {
    window.log.info(`getGroupUpdates/${logId}: Processing just one change`);
    const groupChangeBuffer = base64ToArrayBuffer(groupChangeBase64);
    const groupChange = window.textsecure.protobuf.GroupChange.decode(
      groupChangeBuffer
    );
    const isChangeSupported =
      !isNumber(groupChange.changeEpoch) ||
      groupChange.changeEpoch <= SUPPORTED_CHANGE_EPOCH;

    if (isChangeSupported) {
      return updateGroupViaSingleChange({
        group,
        newRevision,
        groupChange,
        serverPublicParamsBase64,
      });
    }

    window.log.info(
      `getGroupUpdates/${logId}: Failing over; group change unsupported`
    );
  }

  if (isNumber(newRevision) && window.GV2_ENABLE_CHANGE_PROCESSING) {
    try {
      const result = await updateGroupViaLogs({
        group,
        serverPublicParamsBase64,
        newRevision,
      });

      return result;
    } catch (error) {
      if (error.code === TEMPORAL_AUTH_REJECTED_CODE) {
        // We will fail over to the updateGroupViaState call below
        window.log.info(
          `getGroupUpdates/${logId}: Temporal credential failure, now fetching full group state`
        );
      } else if (error.code === GROUP_ACCESS_DENIED_CODE) {
        // We will fail over to the updateGroupViaState call below
        window.log.info(
          `getGroupUpdates/${logId}: Log access denied, now fetching full group state`
        );
      } else {
        throw error;
      }
    }
  }

  if (window.GV2_ENABLE_STATE_PROCESSING) {
    return updateGroupViaState({
      dropInitialJoinMessage,
      group,
      serverPublicParamsBase64,
    });
  }

  window.log.warn(
    `getGroupUpdates/${logId}: No processing was legal! Returning empty changeset.`
  );
  return {
    newAttributes: group,
    groupChangeMessages: [],
    members: [],
  };
}

async function updateGroupViaState({
  dropInitialJoinMessage,
  group,
  serverPublicParamsBase64,
}: {
  dropInitialJoinMessage?: boolean;
  group: ConversationAttributesType;
  serverPublicParamsBase64: string;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  const data = window.storage.get(GROUP_CREDENTIALS_KEY);
  if (!data) {
    throw new Error('updateGroupViaState: No group credentials!');
  }

  const groupCredentials = getCredentialsForToday(data);

  const stateOptions = {
    dropInitialJoinMessage,
    group,
    serverPublicParamsBase64,
    authCredentialBase64: groupCredentials.today.credential,
  };
  try {
    window.log.info(
      `updateGroupViaState/${logId}: Getting full group state...`
    );
    // We await this here so our try/catch below takes effect
    const result = await getCurrentGroupState(stateOptions);

    return result;
  } catch (error) {
    if (error.code === GROUP_ACCESS_DENIED_CODE) {
      return generateLeftGroupChanges(group);
    }
    if (error.code === TEMPORAL_AUTH_REJECTED_CODE) {
      window.log.info(
        `updateGroupViaState/${logId}: Credential for today failed, failing over to tomorrow...`
      );
      try {
        const result = await getCurrentGroupState({
          ...stateOptions,
          authCredentialBase64: groupCredentials.tomorrow.credential,
        });
        return result;
      } catch (subError) {
        if (subError.code === GROUP_ACCESS_DENIED_CODE) {
          return generateLeftGroupChanges(group);
        }
      }
    }

    throw error;
  }
}

async function updateGroupViaSingleChange({
  group,
  groupChange,
  newRevision,
  serverPublicParamsBase64,
}: {
  group: ConversationAttributesType;
  groupChange: GroupChangeClass;
  newRevision: number;
  serverPublicParamsBase64: string;
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
      serverPublicParamsBase64,
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
  serverPublicParamsBase64,
  newRevision,
}: {
  group: ConversationAttributesType;
  newRevision: number;
  serverPublicParamsBase64: string;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  const data = window.storage.get(GROUP_CREDENTIALS_KEY);
  if (!data) {
    throw new Error('getGroupUpdates: No group credentials!');
  }

  const groupCredentials = getCredentialsForToday(data);
  const deltaOptions = {
    group,
    newRevision,
    serverPublicParamsBase64,
    authCredentialBase64: groupCredentials.today.credential,
  };
  try {
    window.log.info(
      `updateGroupViaLogs/${logId}: Getting group delta from ${group.revision} to ${newRevision} for group groupv2(${group.groupId})...`
    );
    const result = await getGroupDelta(deltaOptions);

    return result;
  } catch (error) {
    if (error.code === TEMPORAL_AUTH_REJECTED_CODE) {
      window.log.info(
        `updateGroupViaLogs/${logId}: Credential for today failed, failing over to tomorrow...`
      );

      return getGroupDelta({
        ...deltaOptions,
        authCredentialBase64: groupCredentials.tomorrow.credential,
      });
    }
    throw error;
  }
}

function generateBasicMessage() {
  return {
    id: getGuid(),
    schemaVersion: MAX_MESSAGE_SCHEMA,
    // this is missing most properties to fulfill this type
  } as MessageAttributesType;
}

async function generateLeftGroupChanges(
  group: ConversationAttributesType
): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  window.log.info(`generateLeftGroupChanges/${logId}: Starting...`);
  const ourConversationId = window.ConversationController.getOurConversationId();
  if (!ourConversationId) {
    throw new Error(
      'generateLeftGroupChanges: We do not have a conversationId!'
    );
  }

  const { masterKey, groupInviteLinkPassword } = group;
  let { revision } = group;

  try {
    if (masterKey && groupInviteLinkPassword) {
      window.log.info(
        `generateLeftGroupChanges/${logId}: Have invite link. Attempting to fetch latest revision with it.`
      );
      const preJoinInfo = await getPreJoinGroupInfo(
        groupInviteLinkPassword,
        masterKey
      );

      revision = preJoinInfo.version;
    }
  } catch (error) {
    window.log.warn(
      'generateLeftGroupChanges: Failed to fetch latest revision via group link. Code:',
      error.code
    );
  }

  const existingMembers = group.membersV2 || [];
  const newAttributes: ConversationAttributesType = {
    ...group,
    membersV2: existingMembers.filter(
      member => member.conversationId !== ourConversationId
    ),
    left: true,
    revision,
  };
  const isNewlyRemoved =
    existingMembers.length > (newAttributes.membersV2 || []).length;

  const youWereRemovedMessage = {
    ...generateBasicMessage(),
    type: 'group-v2-change',
    groupV2Change: {
      details: [
        {
          type: 'member-remove' as const,
          conversationId: ourConversationId,
        },
      ],
    },
  };

  return {
    newAttributes,
    groupChangeMessages: isNewlyRemoved ? [youWereRemovedMessage] : [],
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
    groupPublicParamsHex: arrayBufferToHex(
      base64ToArrayBuffer(groupPublicParamsBase64)
    ),
    authCredentialPresentationHex: arrayBufferToHex(presentation),
  };
}

async function getGroupDelta({
  group,
  newRevision,
  serverPublicParamsBase64,
  authCredentialBase64,
}: {
  group: ConversationAttributesType;
  newRevision: number;
  serverPublicParamsBase64: string;
  authCredentialBase64: string;
}): Promise<UpdatesResultType> {
  const sender = window.textsecure.messaging;
  if (!sender) {
    throw new Error('getGroupDelta: textsecure.messaging is not available!');
  }
  if (!group.publicParams) {
    throw new Error('getGroupDelta: group was missing publicParams!');
  }
  if (!group.secretParams) {
    throw new Error('getGroupDelta: group was missing secretParams!');
  }

  const options = getGroupCredentials({
    authCredentialBase64,
    groupPublicParamsBase64: group.publicParams,
    groupSecretParamsBase64: group.secretParams,
    serverPublicParamsBase64,
  });

  const currentRevision = group.revision;
  let revisionToFetch = isNumber(currentRevision) ? currentRevision + 1 : 0;

  let response;
  const changes: Array<GroupChangesClass> = [];
  do {
    // eslint-disable-next-line no-await-in-loop
    response = await sender.getGroupLog(revisionToFetch, options);
    changes.push(response.changes);
    if (response.end) {
      revisionToFetch = response.end + 1;
    }
  } while (response.end && response.end < newRevision);

  // Would be nice to cache the unused groupChanges here, to reduce server roundtrips

  return integrateGroupChanges({
    changes,
    group,
    newRevision,
  });
}

async function integrateGroupChanges({
  group,
  newRevision,
  changes,
}: {
  group: ConversationAttributesType;
  newRevision: number;
  changes: Array<GroupChangesClass>;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  let attributes = group;
  const finalMessages: Array<Array<MessageAttributesType>> = [];
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
        window.log.warn(
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
          groupChange,
          groupState,
        });

        attributes = newAttributes;
        finalMessages.push(groupChangeMessages);
        finalMembers.push(members);
      } catch (error) {
        window.log.error(
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
  groupChange?: GroupChangeClass;
  groupState?: GroupClass;
  newRevision: number;
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
  const ourConversationId = window.ConversationController.getOurConversationIdOrThrow();
  const weAreAwaitingApproval = (group.pendingAdminApprovalV2 || []).find(
    item => item.conversationId === ourConversationId
  );

  // These need to be populated from the groupChange. But we might not get one!
  let isChangeSupported = false;
  let isMoreThanOneVersionUp = false;
  let groupChangeActions: undefined | GroupChangeClass.Actions;
  let decryptedChangeActions: undefined | GroupChangeClass.Actions;
  let sourceConversationId: undefined | string;

  if (groupChange) {
    groupChangeActions = window.textsecure.protobuf.GroupChange.Actions.decode(
      groupChange.actions.toArrayBuffer()
    );

    if (
      groupChangeActions.version &&
      groupChangeActions.version > newRevision
    ) {
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

    const { sourceUuid } = decryptedChangeActions;
    const sourceConversation = window.ConversationController.getOrCreate(
      sourceUuid,
      'private'
    );
    sourceConversationId = sourceConversation.id;

    isChangeSupported =
      !isNumber(groupChange.changeEpoch) ||
      groupChange.changeEpoch <= SUPPORTED_CHANGE_EPOCH;

    isMoreThanOneVersionUp = Boolean(
      groupChangeActions.version &&
        isNumber(group.revision) &&
        groupChangeActions.version > group.revision + 1
    );
  }

  if (
    !groupChange ||
    !isChangeSupported ||
    isFirstFetch ||
    (isMoreThanOneVersionUp && !weAreAwaitingApproval)
  ) {
    if (!groupState) {
      throw new Error(
        `integrateGroupChange/${logId}: No group state, but we can't apply changes!`
      );
    }

    window.log.info(
      `integrateGroupChange/${logId}: Applying full group state, from version ${group.revision} to ${groupState.version}`,
      {
        isChangePresent: Boolean(groupChange),
        isChangeSupported,
        isFirstFetch,
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
      group,
      groupState: decryptedGroupState,
      sourceConversationId: isFirstFetch ? sourceConversationId : undefined,
    });

    return {
      newAttributes,
      groupChangeMessages: extractDiffs({
        old: group,
        current: newAttributes,
        sourceConversationId: isFirstFetch ? sourceConversationId : undefined,
      }),
      members: profileKeysToMembers(newProfileKeys),
    };
  }

  if (!sourceConversationId || !groupChangeActions || !decryptedChangeActions) {
    throw new Error(
      `integrateGroupChange/${logId}: Missing necessary information that should have come from group actions`
    );
  }

  window.log.info(
    `integrateGroupChange/${logId}: Applying group change actions, from version ${group.revision} to ${groupChangeActions.version}`
  );

  const { newAttributes, newProfileKeys } = await applyGroupChange({
    group,
    actions: decryptedChangeActions,
    sourceConversationId,
  });
  const groupChangeMessages = extractDiffs({
    old: group,
    current: newAttributes,
    sourceConversationId,
  });

  return {
    newAttributes,
    groupChangeMessages,
    members: profileKeysToMembers(newProfileKeys),
  };
}

async function getCurrentGroupState({
  authCredentialBase64,
  dropInitialJoinMessage,
  group,
  serverPublicParamsBase64,
}: {
  authCredentialBase64: string;
  dropInitialJoinMessage?: boolean;
  group: ConversationAttributesType;
  serverPublicParamsBase64: string;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group.groupId);
  const sender = window.textsecure.messaging;
  if (!sender) {
    throw new Error('textsecure.messaging is not available!');
  }
  if (!group.secretParams) {
    throw new Error('getCurrentGroupState: group was missing secretParams!');
  }
  if (!group.publicParams) {
    throw new Error('getCurrentGroupState: group was missing publicParams!');
  }

  const options = getGroupCredentials({
    authCredentialBase64,
    groupPublicParamsBase64: group.publicParams,
    groupSecretParamsBase64: group.secretParams,
    serverPublicParamsBase64,
  });

  const groupState = await sender.getGroup(options);
  const decryptedGroupState = decryptGroupState(
    groupState,
    group.secretParams,
    logId
  );

  const oldVersion = group.version;
  const newVersion = decryptedGroupState.version;
  window.log.info(
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

function extractDiffs({
  current,
  dropInitialJoinMessage,
  old,
  sourceConversationId,
}: {
  current: ConversationAttributesType;
  dropInitialJoinMessage?: boolean;
  old: ConversationAttributesType;
  sourceConversationId?: string;
}): Array<MessageAttributesType> {
  const logId = idForLogging(old.groupId);
  const details: Array<GroupV2ChangeDetailType> = [];
  const ourConversationId = window.ConversationController.getOurConversationId();
  const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;

  let areWeInGroup = false;
  let areWeInvitedToGroup = false;
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

  const linkPreviouslyEnabled =
    old.accessControl?.addFromInviteLink === ACCESS_ENUM.ANY ||
    old.accessControl?.addFromInviteLink === ACCESS_ENUM.ADMINISTRATOR;
  const linkCurrentlyEnabled =
    current.accessControl?.addFromInviteLink === ACCESS_ENUM.ANY ||
    current.accessControl?.addFromInviteLink === ACCESS_ENUM.ADMINISTRATOR;

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

  // No disappearing message timer check here - see below

  // membersV2

  const oldMemberLookup: Dictionary<GroupV2MemberType> = fromPairs(
    (old.membersV2 || []).map(member => [member.conversationId, member])
  );
  const oldPendingMemberLookup: Dictionary<GroupV2PendingMemberType> = fromPairs(
    (old.pendingMembersV2 || []).map(member => [member.conversationId, member])
  );
  const oldPendingAdminApprovalLookup: Dictionary<GroupV2PendingAdminApprovalType> = fromPairs(
    (old.pendingAdminApprovalV2 || []).map(member => [
      member.conversationId,
      member,
    ])
  );

  (current.membersV2 || []).forEach(currentMember => {
    const { conversationId } = currentMember;

    if (ourConversationId && conversationId === ourConversationId) {
      areWeInGroup = true;
    }

    const oldMember = oldMemberLookup[conversationId];
    if (!oldMember) {
      const pendingMember = oldPendingMemberLookup[conversationId];
      if (pendingMember) {
        details.push({
          type: 'member-add-from-invite',
          conversationId,
          inviter: pendingMember.addedByUserId,
        });
      } else if (currentMember.joinedFromLink) {
        details.push({
          type: 'member-add-from-link',
          conversationId,
        });
      } else if (currentMember.approvedByAdmin) {
        details.push({
          type: 'member-add-from-admin-approval',
          conversationId,
        });
      } else {
        details.push({
          type: 'member-add',
          conversationId,
        });
      }
    } else if (oldMember.role !== currentMember.role) {
      details.push({
        type: 'member-privilege',
        conversationId,
        newPrivilege: currentMember.role,
      });
    }

    // We don't want to generate an admin-approval-remove event for this newly-added
    //   member. But we don't know for sure if this is an admin approval; for that we
    //   consulted the approvedByAdmin flag saved on the member.
    delete oldPendingAdminApprovalLookup[conversationId];

    // If we capture a pending remove here, it's an 'accept invitation', and we don't
    //   want to generate a pending-remove event for it
    delete oldPendingMemberLookup[conversationId];

    // This deletion makes it easier to capture removals
    delete oldMemberLookup[conversationId];
  });

  const removedMemberIds = Object.keys(oldMemberLookup);
  removedMemberIds.forEach(conversationId => {
    details.push({
      type: 'member-remove',
      conversationId,
    });
  });

  // pendingMembersV2

  let lastPendingConversationId: string | undefined;
  let pendingCount = 0;
  (current.pendingMembersV2 || []).forEach(currentPendingMember => {
    const { conversationId } = currentPendingMember;
    const oldPendingMember = oldPendingMemberLookup[conversationId];

    if (ourConversationId && conversationId === ourConversationId) {
      areWeInvitedToGroup = true;
      whoInvitedUsUserId = currentPendingMember.addedByUserId;
    }

    if (!oldPendingMember) {
      lastPendingConversationId = conversationId;
      pendingCount += 1;
    }

    // This deletion makes it easier to capture removals
    delete oldPendingMemberLookup[conversationId];
  });

  if (pendingCount > 1) {
    details.push({
      type: 'pending-add-many',
      count: pendingCount,
    });
  } else if (pendingCount === 1) {
    if (lastPendingConversationId) {
      details.push({
        type: 'pending-add-one',
        conversationId: lastPendingConversationId,
      });
    } else {
      window.log.warn(
        `extractDiffs/${logId}: pendingCount was 1, no last conversationId available`
      );
    }
  }

  // Note: The only members left over here should be people who were moved from the
  //   pending list but also not added to the group at the same time.
  const removedPendingMemberIds = Object.keys(oldPendingMemberLookup);
  if (removedPendingMemberIds.length > 1) {
    const firstConversationId = removedPendingMemberIds[0];
    const firstRemovedMember = oldPendingMemberLookup[firstConversationId];
    const inviter = firstRemovedMember.addedByUserId;
    const allSameInviter = removedPendingMemberIds.every(
      id => oldPendingMemberLookup[id].addedByUserId === inviter
    );
    details.push({
      type: 'pending-remove-many',
      count: removedPendingMemberIds.length,
      inviter: allSameInviter ? inviter : undefined,
    });
  } else if (removedPendingMemberIds.length === 1) {
    const conversationId = removedPendingMemberIds[0];
    const removedMember = oldPendingMemberLookup[conversationId];

    details.push({
      type: 'pending-remove-one',
      conversationId,
      inviter: removedMember.addedByUserId,
    });
  }

  // pendingAdminApprovalV2

  (current.pendingAdminApprovalV2 || []).forEach(
    currentPendingAdminAprovalMember => {
      const { conversationId } = currentPendingAdminAprovalMember;
      const oldPendingMember = oldPendingAdminApprovalLookup[conversationId];

      if (!oldPendingMember) {
        details.push({
          type: 'admin-approval-add-one',
          conversationId,
        });
      }

      // This deletion makes it easier to capture removals
      delete oldPendingAdminApprovalLookup[conversationId];
    }
  );

  // Note: The only members left over here should be people who were moved from the
  //   pendingAdminApproval list but also not added to the group at the same time.
  const removedPendingAdminApprovalIds = Object.keys(
    oldPendingAdminApprovalLookup
  );
  removedPendingAdminApprovalIds.forEach(conversationId => {
    details.push({
      type: 'admin-approval-remove-one',
      conversationId,
    });
  });

  // final processing

  let message: MessageAttributesType | undefined;
  let timerNotification: MessageAttributesType | undefined;
  const conversation = sourceConversationId
    ? window.ConversationController.get(sourceConversationId)
    : null;
  const sourceUuid = conversation ? conversation.get('uuid') : undefined;

  const firstUpdate = !isNumber(old.revision);

  // Here we hardcode initial messages if this is our first time processing data this
  //   group. Ideally we can collapse it down to just one of: 'you were added',
  //   'you were invited', or 'you created.'
  if (firstUpdate && ourConversationId && areWeInvitedToGroup) {
    // Note, we will add 'you were invited' to group even if dropInitialJoinMessage = true
    message = {
      ...generateBasicMessage(),
      type: 'group-v2-change',
      groupV2Change: {
        from: whoInvitedUsUserId || sourceConversationId,
        details: [
          {
            type: 'pending-add-one',
            conversationId: ourConversationId,
          },
        ],
      },
    };
  } else if (firstUpdate && dropInitialJoinMessage) {
    // None of the rest of the messages should be added if dropInitialJoinMessage = true
    message = undefined;
  } else if (
    firstUpdate &&
    ourConversationId &&
    sourceConversationId &&
    sourceConversationId === ourConversationId
  ) {
    message = {
      ...generateBasicMessage(),
      type: 'group-v2-change',
      groupV2Change: {
        from: sourceConversationId,
        details: [
          {
            type: 'create',
          },
        ],
      },
    };
  } else if (firstUpdate && ourConversationId && areWeInGroup) {
    message = {
      ...generateBasicMessage(),
      type: 'group-v2-change',
      groupV2Change: {
        from: sourceConversationId,
        details: [
          {
            type: 'member-add',
            conversationId: ourConversationId,
          },
        ],
      },
    };
  } else if (firstUpdate) {
    message = {
      ...generateBasicMessage(),
      type: 'group-v2-change',
      groupV2Change: {
        from: sourceConversationId,
        details: [
          {
            type: 'create',
          },
        ],
      },
    };
  } else if (details.length > 0) {
    message = {
      ...generateBasicMessage(),
      type: 'group-v2-change',
      sourceUuid,
      groupV2Change: {
        from: sourceConversationId,
        details,
      },
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
      flags:
        window.textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      expirationTimerUpdate: {
        expireTimer: current.expireTimer || 0,
        sourceUuid,
      },
    };
  }

  const result = compact([message, timerNotification]);

  window.log.info(
    `extractDiffs/${logId} complete, generated ${result.length} change messages`
  );

  return result;
}

function profileKeysToMembers(items: Array<GroupChangeMemberType>) {
  return items.map(item => ({
    profileKey: arrayBufferToBase64(item.profileKey),
    uuid: item.uuid,
  }));
}

type GroupChangeMemberType = {
  profileKey: ArrayBuffer;
  uuid: string;
};
type GroupApplyResultType = {
  newAttributes: ConversationAttributesType;
  newProfileKeys: Array<GroupChangeMemberType>;
};

async function applyGroupChange({
  actions,
  group,
  sourceConversationId,
}: {
  actions: GroupChangeClass.Actions;
  group: ConversationAttributesType;
  sourceConversationId: string;
}): Promise<GroupApplyResultType> {
  const logId = idForLogging(group.groupId);
  const ourConversationId = window.ConversationController.getOurConversationId();

  const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;
  const MEMBER_ROLE_ENUM = window.textsecure.protobuf.Member.Role;

  const version = actions.version || 0;
  const result = { ...group };
  const newProfileKeys: Array<GroupChangeMemberType> = [];

  const members: Dictionary<GroupV2MemberType> = fromPairs(
    (result.membersV2 || []).map(member => [member.conversationId, member])
  );
  const pendingMembers: Dictionary<GroupV2PendingMemberType> = fromPairs(
    (result.pendingMembersV2 || []).map(member => [
      member.conversationId,
      member,
    ])
  );
  const pendingAdminApprovalMembers: Dictionary<GroupV2PendingAdminApprovalType> = fromPairs(
    (result.pendingAdminApprovalV2 || []).map(member => [
      member.conversationId,
      member,
    ])
  );

  // version?: number;
  result.revision = version;

  // addMembers?: Array<GroupChangeClass.Actions.AddMemberAction>;
  (actions.addMembers || []).forEach(addMember => {
    const { added } = addMember;
    if (!added) {
      throw new Error('applyGroupChange: addMember.added is missing');
    }

    const conversation = window.ConversationController.getOrCreate(
      added.userId,
      'private'
    );

    if (members[conversation.id]) {
      window.log.warn(
        `applyGroupChange/${logId}: Attempt to add member failed; already in members.`
      );
      return;
    }

    members[conversation.id] = {
      conversationId: conversation.id,
      role: added.role || MEMBER_ROLE_ENUM.DEFAULT,
      joinedAtVersion: version,
      joinedFromLink: addMember.joinFromInviteLink || false,
    };

    if (pendingMembers[conversation.id]) {
      window.log.warn(
        `applyGroupChange/${logId}: Removing newly-added member from pendingMembers.`
      );
      delete pendingMembers[conversation.id];
    }

    // Capture who added us
    if (
      ourConversationId &&
      sourceConversationId &&
      conversation.id === ourConversationId
    ) {
      result.addedBy = sourceConversationId;
    }

    if (added.profileKey) {
      newProfileKeys.push({
        profileKey: added.profileKey,
        uuid: added.userId,
      });
    }
  });

  // deleteMembers?: Array<GroupChangeClass.Actions.DeleteMemberAction>;
  (actions.deleteMembers || []).forEach(deleteMember => {
    const { deletedUserId } = deleteMember;
    if (!deletedUserId) {
      throw new Error(
        'applyGroupChange: deleteMember.deletedUserId is missing'
      );
    }

    const conversation = window.ConversationController.getOrCreate(
      deletedUserId,
      'private'
    );

    if (members[conversation.id]) {
      delete members[conversation.id];
    } else {
      window.log.warn(
        `applyGroupChange/${logId}: Attempt to remove member failed; was not in members.`
      );
    }
  });

  // modifyMemberRoles?: Array<GroupChangeClass.Actions.ModifyMemberRoleAction>;
  (actions.modifyMemberRoles || []).forEach(modifyMemberRole => {
    const { role, userId } = modifyMemberRole;
    if (!role || !userId) {
      throw new Error('applyGroupChange: modifyMemberRole had a missing value');
    }

    const conversation = window.ConversationController.getOrCreate(
      userId,
      'private'
    );

    if (members[conversation.id]) {
      members[conversation.id] = {
        ...members[conversation.id],
        role,
      };
    } else {
      throw new Error(
        'applyGroupChange: modifyMemberRole tried to modify nonexistent member'
      );
    }
  });

  // modifyMemberProfileKeys?:
  // Array<GroupChangeClass.Actions.ModifyMemberProfileKeyAction>;
  (actions.modifyMemberProfileKeys || []).forEach(modifyMemberProfileKey => {
    const { profileKey, uuid } = modifyMemberProfileKey;
    if (!profileKey || !uuid) {
      throw new Error(
        'applyGroupChange: modifyMemberProfileKey had a missing value'
      );
    }

    newProfileKeys.push({
      profileKey,
      uuid,
    });
  });

  // addPendingMembers?: Array<
  //   GroupChangeClass.Actions.AddMemberPendingProfileKeyAction
  // >;
  (actions.addPendingMembers || []).forEach(addPendingMember => {
    const { added } = addPendingMember;
    if (!added || !added.member) {
      throw new Error(
        'applyGroupChange: addPendingMembers had a missing value'
      );
    }

    const conversation = window.ConversationController.getOrCreate(
      added.member.userId,
      'private'
    );

    if (members[conversation.id]) {
      window.log.warn(
        `applyGroupChange/${logId}: Attempt to add pendingMember failed; was already in members.`
      );
      return;
    }
    if (pendingMembers[conversation.id]) {
      window.log.warn(
        `applyGroupChange/${logId}: Attempt to add pendingMember failed; was already in pendingMembers.`
      );
      return;
    }

    pendingMembers[conversation.id] = {
      conversationId: conversation.id,
      addedByUserId: added.addedByUserId,
      timestamp: added.timestamp,
      role: added.member.role || MEMBER_ROLE_ENUM.DEFAULT,
    };

    if (added.member && added.member.profileKey) {
      newProfileKeys.push({
        profileKey: added.member.profileKey,
        uuid: added.member.userId,
      });
    }
  });

  // deletePendingMembers?: Array<
  //   GroupChangeClass.Actions.DeleteMemberPendingProfileKeyAction
  // >;
  (actions.deletePendingMembers || []).forEach(deletePendingMember => {
    const { deletedUserId } = deletePendingMember;
    if (!deletedUserId) {
      throw new Error(
        'applyGroupChange: deletePendingMember.deletedUserId is null!'
      );
    }

    const conversation = window.ConversationController.getOrCreate(
      deletedUserId,
      'private'
    );

    if (pendingMembers[conversation.id]) {
      delete pendingMembers[conversation.id];
    } else {
      window.log.warn(
        `applyGroupChange/${logId}: Attempt to remove pendingMember failed; was not in pendingMembers.`
      );
    }
  });

  // promotePendingMembers?: Array<
  //   GroupChangeClass.Actions.PromoteMemberPendingProfileKeyAction
  // >;
  (actions.promotePendingMembers || []).forEach(promotePendingMember => {
    const { profileKey, uuid } = promotePendingMember;
    if (!profileKey || !uuid) {
      throw new Error(
        'applyGroupChange: promotePendingMember had a missing value'
      );
    }

    const conversation = window.ConversationController.getOrCreate(
      uuid,
      'private'
    );

    const previousRecord = pendingMembers[conversation.id];

    if (pendingMembers[conversation.id]) {
      delete pendingMembers[conversation.id];
    } else {
      window.log.warn(
        `applyGroupChange/${logId}: Attempt to promote pendingMember failed; was not in pendingMembers.`
      );
    }

    if (members[conversation.id]) {
      window.log.warn(
        `applyGroupChange/${logId}: Attempt to promote pendingMember failed; was already in members.`
      );
      return;
    }

    members[conversation.id] = {
      conversationId: conversation.id,
      joinedAtVersion: version,
      role: previousRecord.role || MEMBER_ROLE_ENUM.DEFAULT,
    };

    newProfileKeys.push({
      profileKey,
      uuid,
    });
  });

  // modifyTitle?: GroupChangeClass.Actions.ModifyTitleAction;
  if (actions.modifyTitle) {
    const { title } = actions.modifyTitle;
    if (title && title.content === 'title') {
      result.name = title.title;
    } else {
      window.log.warn(
        `applyGroupChange/${logId}: Clearing group title due to missing data.`
      );
      result.name = undefined;
    }
  }

  // modifyAvatar?: GroupChangeClass.Actions.ModifyAvatarAction;
  if (actions.modifyAvatar) {
    const { avatar } = actions.modifyAvatar;
    await applyNewAvatar(avatar, result, logId);
  }

  // modifyDisappearingMessagesTimer?:
  //   GroupChangeClass.Actions.ModifyDisappearingMessagesTimerAction;
  if (actions.modifyDisappearingMessagesTimer) {
    const disappearingMessagesTimer: GroupAttributeBlobClass | undefined =
      actions.modifyDisappearingMessagesTimer.timer;
    if (
      disappearingMessagesTimer &&
      disappearingMessagesTimer.content === 'disappearingMessagesDuration'
    ) {
      result.expireTimer =
        disappearingMessagesTimer.disappearingMessagesDuration;
    } else {
      window.log.warn(
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
  // GroupChangeClass.Actions.ModifyAttributesAccessControlAction;
  if (actions.modifyAttributesAccess) {
    result.accessControl = {
      ...result.accessControl,
      attributes:
        actions.modifyAttributesAccess.attributesAccess || ACCESS_ENUM.MEMBER,
    };
  }

  // modifyMemberAccess?: GroupChangeClass.Actions.ModifyMembersAccessControlAction;
  if (actions.modifyMemberAccess) {
    result.accessControl = {
      ...result.accessControl,
      members: actions.modifyMemberAccess.membersAccess || ACCESS_ENUM.MEMBER,
    };
  }

  // modifyAddFromInviteLinkAccess?:
  //   GroupChangeClass.Actions.ModifyAddFromInviteLinkAccessControlAction;
  if (actions.modifyAddFromInviteLinkAccess) {
    result.accessControl = {
      ...result.accessControl,
      addFromInviteLink:
        actions.modifyAddFromInviteLinkAccess.addFromInviteLinkAccess ||
        ACCESS_ENUM.UNSATISFIABLE,
    };
  }

  // addMemberPendingAdminApprovals?: Array<
  //   GroupChangeClass.Actions.AddMemberPendingAdminApprovalAction
  // >;
  (actions.addMemberPendingAdminApprovals || []).forEach(
    pendingAdminApproval => {
      const { added } = pendingAdminApproval;
      if (!added) {
        throw new Error(
          'applyGroupChange: modifyMemberProfileKey had a missing value'
        );
      }

      const conversation = window.ConversationController.getOrCreate(
        added.userId,
        'private'
      );

      if (members[conversation.id]) {
        window.log.warn(
          `applyGroupChange/${logId}: Attempt to add pending admin approval failed; was already in members.`
        );
        return;
      }
      if (pendingMembers[conversation.id]) {
        window.log.warn(
          `applyGroupChange/${logId}: Attempt to add pending admin approval failed; was already in pendingMembers.`
        );
        return;
      }
      if (pendingAdminApprovalMembers[conversation.id]) {
        window.log.warn(
          `applyGroupChange/${logId}: Attempt to add pending admin approval failed; was already in pendingAdminApprovalMembers.`
        );
        return;
      }

      pendingAdminApprovalMembers[conversation.id] = {
        conversationId: conversation.id,
        timestamp: added.timestamp,
      };

      if (added.profileKey) {
        newProfileKeys.push({
          profileKey: added.profileKey,
          uuid: added.userId,
        });
      }
    }
  );

  // deleteMemberPendingAdminApprovals?: Array<
  //   GroupChangeClass.Actions.DeleteMemberPendingAdminApprovalAction
  // >;
  (actions.deleteMemberPendingAdminApprovals || []).forEach(
    deleteAdminApproval => {
      const { deletedUserId } = deleteAdminApproval;
      if (!deletedUserId) {
        throw new Error(
          'applyGroupChange: deleteAdminApproval.deletedUserId is null!'
        );
      }

      const conversation = window.ConversationController.getOrCreate(
        deletedUserId,
        'private'
      );

      if (pendingAdminApprovalMembers[conversation.id]) {
        delete pendingAdminApprovalMembers[conversation.id];
      } else {
        window.log.warn(
          `applyGroupChange/${logId}: Attempt to remove pendingAdminApproval failed; was not in pendingAdminApprovalMembers.`
        );
      }
    }
  );

  // promoteMemberPendingAdminApprovals?: Array<
  //   GroupChangeClass.Actions.PromoteMemberPendingAdminApprovalAction
  // >;
  (actions.promoteMemberPendingAdminApprovals || []).forEach(
    promoteAdminApproval => {
      const { userId, role } = promoteAdminApproval;
      if (!userId) {
        throw new Error(
          'applyGroupChange: promoteAdminApproval had a missing value'
        );
      }

      const conversation = window.ConversationController.getOrCreate(
        userId,
        'private'
      );

      if (pendingAdminApprovalMembers[conversation.id]) {
        delete pendingAdminApprovalMembers[conversation.id];
      } else {
        window.log.warn(
          `applyGroupChange/${logId}: Attempt to promote pendingAdminApproval failed; was not in pendingAdminApprovalMembers.`
        );
      }
      if (pendingMembers[conversation.id]) {
        delete pendingAdminApprovalMembers[conversation.id];
        window.log.warn(
          `applyGroupChange/${logId}: Deleted pendingAdminApproval from pendingMembers.`
        );
      }

      if (members[conversation.id]) {
        window.log.warn(
          `applyGroupChange/${logId}: Attempt to promote pendingMember failed; was already in members.`
        );
        return;
      }

      members[conversation.id] = {
        conversationId: conversation.id,
        joinedAtVersion: version,
        role: role || MEMBER_ROLE_ENUM.DEFAULT,
        approvedByAdmin: true,
      };
    }
  );

  // modifyInviteLinkPassword?: GroupChangeClass.Actions.ModifyInviteLinkPasswordAction;
  if (actions.modifyInviteLinkPassword) {
    const { inviteLinkPassword } = actions.modifyInviteLinkPassword;
    if (inviteLinkPassword) {
      result.groupInviteLinkPassword = inviteLinkPassword;
    } else {
      result.groupInviteLinkPassword = undefined;
    }
  }

  if (ourConversationId) {
    result.left = !members[ourConversationId];
  }

  // Go from lookups back to arrays
  result.membersV2 = values(members);
  result.pendingMembersV2 = values(pendingMembers);
  result.pendingAdminApprovalV2 = values(pendingAdminApprovalMembers);

  return {
    newAttributes: result,
    newProfileKeys,
  };
}

export async function decryptGroupAvatar(
  avatarKey: string,
  secretParamsBase64: string
): Promise<ArrayBuffer> {
  const sender = window.textsecure.messaging;
  if (!sender) {
    throw new Error(
      'decryptGroupAvatar: textsecure.messaging is not available!'
    );
  }

  const ciphertext = await sender.getGroupAvatar(avatarKey);
  const clientZkGroupCipher = getClientZkGroupCipher(secretParamsBase64);
  const plaintext = decryptGroupBlob(clientZkGroupCipher, ciphertext);
  const blob = window.textsecure.protobuf.GroupAttributeBlob.decode(plaintext);
  if (blob.content !== 'avatar') {
    throw new Error(
      `decryptGroupAvatar: Returned blob had incorrect content: ${blob.content}`
    );
  }

  return blob.avatar.toArrayBuffer();
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
      const hash = await computeHash(data);

      if (result.avatar && result.avatar.path && result.avatar.hash !== hash) {
        await window.Signal.Migrations.deleteAttachmentData(result.avatar.path);
        result.avatar = undefined;
      }

      if (!result.avatar) {
        const path = await window.Signal.Migrations.writeNewAttachmentData(
          data
        );
        result.avatar = {
          url: newAvatar,
          path,
          hash,
        };
      }
    }
  } catch (error) {
    window.log.warn(
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
  sourceConversationId,
}: {
  group: ConversationAttributesType;
  groupState: GroupClass;
  sourceConversationId?: string;
}): Promise<GroupApplyResultType> {
  const logId = idForLogging(group.groupId);
  const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;
  const MEMBER_ROLE_ENUM = window.textsecure.protobuf.Member.Role;
  const version = groupState.version || 0;
  const result = { ...group };
  const newProfileKeys: Array<GroupChangeMemberType> = [];

  // version
  result.revision = version;

  // title
  // Note: During decryption, title becomes a GroupAttributeBlob
  const { title } = groupState;
  if (title && title.content === 'title') {
    result.name = title.title;
  } else {
    result.name = undefined;
  }

  // avatar
  await applyNewAvatar(groupState.avatar, result, logId);

  // disappearingMessagesTimer
  // Note: during decryption, disappearingMessageTimer becomes a GroupAttributeBlob
  const { disappearingMessagesTimer } = groupState;
  if (
    disappearingMessagesTimer &&
    disappearingMessagesTimer.content === 'disappearingMessagesDuration'
  ) {
    result.expireTimer = disappearingMessagesTimer.disappearingMessagesDuration;
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
  const ourConversationId = window.ConversationController.getOurConversationId();

  // members
  if (groupState.members) {
    result.membersV2 = groupState.members.map((member: MemberClass) => {
      const conversation = window.ConversationController.getOrCreate(
        member.userId,
        'private'
      );

      if (ourConversationId && conversation.id === ourConversationId) {
        result.left = false;

        // Capture who added us if we were previously not in group
        if (
          sourceConversationId &&
          (result.membersV2 || []).every(
            item => item.conversationId !== ourConversationId
          )
        ) {
          result.addedBy = sourceConversationId;
        }
      }

      if (!isValidRole(member.role)) {
        throw new Error(
          `applyGroupState: Member had invalid role ${member.role}`
        );
      }

      newProfileKeys.push({
        profileKey: member.profileKey,
        uuid: member.userId,
      });

      return {
        role: member.role || MEMBER_ROLE_ENUM.DEFAULT,
        joinedAtVersion: member.joinedAtVersion || version,
        conversationId: conversation.id,
      };
    });
  }

  // membersPendingProfileKey
  if (groupState.membersPendingProfileKey) {
    result.pendingMembersV2 = groupState.membersPendingProfileKey.map(
      (member: MemberPendingProfileKeyClass) => {
        let pending;
        let invitedBy;

        if (member.member && member.member.userId) {
          pending = window.ConversationController.getOrCreate(
            member.member.userId,
            'private'
          );
        } else {
          throw new Error(
            'applyGroupState: Member pending profile key did not have an associated userId'
          );
        }

        if (member.addedByUserId) {
          invitedBy = window.ConversationController.getOrCreate(
            member.addedByUserId,
            'private'
          );
        } else {
          throw new Error(
            'applyGroupState: Member pending profile key did not have an addedByUserID'
          );
        }

        if (!isValidRole(member.member.role)) {
          throw new Error(
            `applyGroupState: Member pending profile key had invalid role ${member.member.role}`
          );
        }

        newProfileKeys.push({
          profileKey: member.member.profileKey,
          uuid: member.member.userId,
        });

        return {
          addedByUserId: invitedBy.id,
          conversationId: pending.id,
          timestamp: member.timestamp,
          role: member.member.role || MEMBER_ROLE_ENUM.DEFAULT,
        };
      }
    );
  }

  // membersPendingAdminApproval
  if (groupState.membersPendingAdminApproval) {
    result.pendingAdminApprovalV2 = groupState.membersPendingAdminApproval.map(
      (member: MemberPendingAdminApprovalClass) => {
        let pending;

        if (member.userId) {
          pending = window.ConversationController.getOrCreate(
            member.userId,
            'private'
          );
        } else {
          throw new Error(
            'applyGroupState: Pending admin approval did not have an associated userId'
          );
        }

        return {
          conversationId: pending.id,
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

  return {
    newAttributes: result,
    newProfileKeys,
  };
}

function isValidRole(role?: number): role is number {
  const MEMBER_ROLE_ENUM = window.textsecure.protobuf.Member.Role;

  return (
    role === MEMBER_ROLE_ENUM.ADMINISTRATOR || role === MEMBER_ROLE_ENUM.DEFAULT
  );
}

function isValidAccess(access?: number): access is number {
  const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;

  return access === ACCESS_ENUM.ADMINISTRATOR || access === ACCESS_ENUM.MEMBER;
}

function isValidLinkAccess(access?: number): access is number {
  const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;

  return (
    access === ACCESS_ENUM.UNKNOWN ||
    access === ACCESS_ENUM.ANY ||
    access === ACCESS_ENUM.ADMINISTRATOR ||
    access === ACCESS_ENUM.UNSATISFIABLE
  );
}

function isValidProfileKey(buffer?: ArrayBuffer): boolean {
  return Boolean(buffer && buffer.byteLength === 32);
}

function hasData(data: ProtoBinaryType): boolean {
  return data && data.limit > 0;
}

function normalizeTimestamp(
  timestamp: ProtoBigNumberType
): number | ProtoBigNumberType {
  if (!timestamp) {
    return timestamp;
  }

  const asNumber = timestamp.toNumber();

  const now = Date.now();
  if (!asNumber || asNumber > now) {
    return now;
  }

  return asNumber;
}

/* eslint-disable no-param-reassign */

function decryptGroupChange(
  actions: GroupChangeClass.Actions,
  groupSecretParams: string,
  logId: string
): GroupChangeClass.Actions {
  const clientZkGroupCipher = getClientZkGroupCipher(groupSecretParams);

  if (hasData(actions.sourceUuid)) {
    try {
      actions.sourceUuid = decryptUuid(
        clientZkGroupCipher,
        actions.sourceUuid.toArrayBuffer()
      );
    } catch (error) {
      window.log.warn(
        `decryptGroupChange/${logId}: Unable to decrypt sourceUuid. Clearing sourceUuid.`,
        error && error.stack ? error.stack : error
      );
      actions.sourceUuid = undefined;
    }

    window.normalizeUuids(actions, ['sourceUuid'], 'groups.decryptGroupChange');

    if (!window.isValidGuid(actions.sourceUuid)) {
      window.log.warn(
        `decryptGroupChange/${logId}: Invalid sourceUuid. Clearing sourceUuid.`
      );
      actions.sourceUuid = undefined;
    }
  } else {
    throw new Error('decryptGroupChange: Missing sourceUuid');
  }

  // addMembers?: Array<GroupChangeClass.Actions.AddMemberAction>;
  actions.addMembers = compact(
    (actions.addMembers || []).map(addMember => {
      if (addMember.added) {
        const decrypted = decryptMember(
          clientZkGroupCipher,
          addMember.added,
          logId
        );
        if (!decrypted) {
          return null;
        }

        addMember.added = decrypted;
        return addMember;
      }
      throw new Error('decryptGroupChange: AddMember was missing added field!');
    })
  );

  // deleteMembers?: Array<GroupChangeClass.Actions.DeleteMemberAction>;
  actions.deleteMembers = compact(
    (actions.deleteMembers || []).map(deleteMember => {
      if (hasData(deleteMember.deletedUserId)) {
        try {
          deleteMember.deletedUserId = decryptUuid(
            clientZkGroupCipher,
            deleteMember.deletedUserId.toArrayBuffer()
          );
        } catch (error) {
          window.log.warn(
            `decryptGroupChange/${logId}: Unable to decrypt deleteMembers.deletedUserId. Dropping member.`,
            error && error.stack ? error.stack : error
          );
          return null;
        }
      } else {
        throw new Error(
          'decryptGroupChange: deleteMember.deletedUserId was missing'
        );
      }

      window.normalizeUuids(
        deleteMember,
        ['deletedUserId'],
        'groups.decryptGroupChange'
      );

      if (!window.isValidGuid(deleteMember.deletedUserId)) {
        window.log.warn(
          `decryptGroupChange/${logId}: Dropping deleteMember due to invalid userId`
        );

        return null;
      }

      return deleteMember;
    })
  );

  // modifyMemberRoles?: Array<GroupChangeClass.Actions.ModifyMemberRoleAction>;
  actions.modifyMemberRoles = compact(
    (actions.modifyMemberRoles || []).map(modifyMember => {
      if (hasData(modifyMember.userId)) {
        try {
          modifyMember.userId = decryptUuid(
            clientZkGroupCipher,
            modifyMember.userId.toArrayBuffer()
          );
        } catch (error) {
          window.log.warn(
            `decryptGroupChange/${logId}: Unable to decrypt modifyMemberRole.userId. Dropping member.`,
            error && error.stack ? error.stack : error
          );
          return null;
        }
      } else {
        throw new Error(
          'decryptGroupChange: modifyMemberRole.userId was missing'
        );
      }

      window.normalizeUuids(
        modifyMember,
        ['userId'],
        'groups.decryptGroupChange'
      );

      if (!window.isValidGuid(modifyMember.userId)) {
        window.log.warn(
          `decryptGroupChange/${logId}: Dropping modifyMemberRole due to invalid userId`
        );

        return null;
      }

      if (!isValidRole(modifyMember.role)) {
        throw new Error(
          `decryptGroupChange: modifyMemberRole had invalid role ${modifyMember.role}`
        );
      }

      return modifyMember;
    })
  );

  // modifyMemberProfileKeys?: Array<
  //   GroupChangeClass.Actions.ModifyMemberProfileKeyAction
  // >;
  actions.modifyMemberProfileKeys = compact(
    (actions.modifyMemberProfileKeys || []).map(modifyMemberProfileKey => {
      if (hasData(modifyMemberProfileKey.presentation)) {
        const { profileKey, uuid } = decryptProfileKeyCredentialPresentation(
          clientZkGroupCipher,
          modifyMemberProfileKey.presentation.toArrayBuffer()
        );

        modifyMemberProfileKey.profileKey = profileKey;
        modifyMemberProfileKey.uuid = uuid;

        if (
          !modifyMemberProfileKey.uuid ||
          !modifyMemberProfileKey.profileKey
        ) {
          throw new Error(
            'decryptGroupChange: uuid or profileKey missing after modifyMemberProfileKey decryption!'
          );
        }

        if (!window.isValidGuid(modifyMemberProfileKey.uuid)) {
          window.log.warn(
            `decryptGroupChange/${logId}: Dropping modifyMemberProfileKey due to invalid userId`
          );

          return null;
        }

        if (!isValidProfileKey(modifyMemberProfileKey.profileKey)) {
          throw new Error(
            'decryptGroupChange: modifyMemberProfileKey had invalid profileKey'
          );
        }
      } else {
        throw new Error(
          'decryptGroupChange: modifyMemberProfileKey.presentation was missing'
        );
      }

      return modifyMemberProfileKey;
    })
  );

  // addPendingMembers?: Array<
  //   GroupChangeClass.Actions.AddMemberPendingProfileKeyAction
  // >;
  actions.addPendingMembers = compact(
    (actions.addPendingMembers || []).map(addPendingMember => {
      if (addPendingMember.added) {
        const decrypted = decryptMemberPendingProfileKey(
          clientZkGroupCipher,
          addPendingMember.added,
          logId
        );
        if (!decrypted) {
          return null;
        }

        addPendingMember.added = decrypted;
        return addPendingMember;
      }
      throw new Error(
        'decryptGroupChange: addPendingMember was missing added field!'
      );
    })
  );

  // deletePendingMembers?: Array<
  //   GroupChangeClass.Actions.DeleteMemberPendingProfileKeyAction
  // >;
  actions.deletePendingMembers = compact(
    (actions.deletePendingMembers || []).map(deletePendingMember => {
      if (hasData(deletePendingMember.deletedUserId)) {
        try {
          deletePendingMember.deletedUserId = decryptUuid(
            clientZkGroupCipher,
            deletePendingMember.deletedUserId.toArrayBuffer()
          );
        } catch (error) {
          window.log.warn(
            `decryptGroupChange/${logId}: Unable to decrypt deletePendingMembers.deletedUserId. Dropping member.`,
            error && error.stack ? error.stack : error
          );
          return null;
        }
      } else {
        throw new Error(
          'decryptGroupChange: deletePendingMembers.deletedUserId was missing'
        );
      }

      window.normalizeUuids(
        deletePendingMember,
        ['deletedUserId'],
        'groups.decryptGroupChange'
      );

      if (!window.isValidGuid(deletePendingMember.deletedUserId)) {
        window.log.warn(
          `decryptGroupChange/${logId}: Dropping deletePendingMember due to invalid deletedUserId`
        );

        return null;
      }

      return deletePendingMember;
    })
  );

  // promotePendingMembers?: Array<
  //   GroupChangeClass.Actions.PromoteMemberPendingProfileKeyAction
  // >;
  actions.promotePendingMembers = compact(
    (actions.promotePendingMembers || []).map(promotePendingMember => {
      if (hasData(promotePendingMember.presentation)) {
        const { profileKey, uuid } = decryptProfileKeyCredentialPresentation(
          clientZkGroupCipher,
          promotePendingMember.presentation.toArrayBuffer()
        );

        promotePendingMember.profileKey = profileKey;
        promotePendingMember.uuid = uuid;

        if (!promotePendingMember.uuid || !promotePendingMember.profileKey) {
          throw new Error(
            'decryptGroupChange: uuid or profileKey missing after promotePendingMember decryption!'
          );
        }

        if (!window.isValidGuid(promotePendingMember.uuid)) {
          window.log.warn(
            `decryptGroupChange/${logId}: Dropping modifyMemberProfileKey due to invalid userId`
          );

          return null;
        }

        if (!isValidProfileKey(promotePendingMember.profileKey)) {
          throw new Error(
            'decryptGroupChange: modifyMemberProfileKey had invalid profileKey'
          );
        }
      } else {
        throw new Error(
          'decryptGroupChange: promotePendingMember.presentation was missing'
        );
      }

      return promotePendingMember;
    })
  );

  // modifyTitle?: GroupChangeClass.Actions.ModifyTitleAction;
  if (actions.modifyTitle && hasData(actions.modifyTitle.title)) {
    try {
      actions.modifyTitle.title = window.textsecure.protobuf.GroupAttributeBlob.decode(
        decryptGroupBlob(
          clientZkGroupCipher,
          actions.modifyTitle.title.toArrayBuffer()
        )
      );
    } catch (error) {
      window.log.warn(
        `decryptGroupChange/${logId}: Unable to decrypt modifyTitle.title`,
        error && error.stack ? error.stack : error
      );
      actions.modifyTitle.title = undefined;
    }
  } else if (actions.modifyTitle) {
    actions.modifyTitle.title = undefined;
  }

  // modifyAvatar?: GroupChangeClass.Actions.ModifyAvatarAction;
  // Note: decryption happens during application of the change, on download of the avatar

  // modifyDisappearingMessagesTimer?:
  // GroupChangeClass.Actions.ModifyDisappearingMessagesTimerAction;
  if (
    actions.modifyDisappearingMessagesTimer &&
    hasData(actions.modifyDisappearingMessagesTimer.timer)
  ) {
    try {
      actions.modifyDisappearingMessagesTimer.timer = window.textsecure.protobuf.GroupAttributeBlob.decode(
        decryptGroupBlob(
          clientZkGroupCipher,
          actions.modifyDisappearingMessagesTimer.timer.toArrayBuffer()
        )
      );
    } catch (error) {
      window.log.warn(
        `decryptGroupChange/${logId}: Unable to decrypt modifyDisappearingMessagesTimer.timer`,
        error && error.stack ? error.stack : error
      );
      actions.modifyDisappearingMessagesTimer.timer = undefined;
    }
  } else if (actions.modifyDisappearingMessagesTimer) {
    actions.modifyDisappearingMessagesTimer.timer = undefined;
  }

  // modifyAttributesAccess?:
  // GroupChangeClass.Actions.ModifyAttributesAccessControlAction;
  if (
    actions.modifyAttributesAccess &&
    !isValidAccess(actions.modifyAttributesAccess.attributesAccess)
  ) {
    throw new Error(
      `decryptGroupChange: modifyAttributesAccess.attributesAccess was not valid: ${actions.modifyAttributesAccess.attributesAccess}`
    );
  }

  // modifyMemberAccess?: GroupChangeClass.Actions.ModifyMembersAccessControlAction;
  if (
    actions.modifyMemberAccess &&
    !isValidAccess(actions.modifyMemberAccess.membersAccess)
  ) {
    throw new Error(
      `decryptGroupChange: modifyMemberAccess.membersAccess was not valid: ${actions.modifyMemberAccess.membersAccess}`
    );
  }

  // modifyAddFromInviteLinkAccess?:
  //   GroupChangeClass.Actions.ModifyAddFromInviteLinkAccessControlAction;
  if (
    actions.modifyAddFromInviteLinkAccess &&
    !isValidLinkAccess(
      actions.modifyAddFromInviteLinkAccess.addFromInviteLinkAccess
    )
  ) {
    throw new Error(
      `decryptGroupChange: modifyAddFromInviteLinkAccess.addFromInviteLinkAccess was not valid: ${actions.modifyAddFromInviteLinkAccess.addFromInviteLinkAccess}`
    );
  }

  // addMemberPendingAdminApprovals?: Array<
  //   GroupChangeClass.Actions.AddMemberPendingAdminApprovalAction
  // >;
  actions.addMemberPendingAdminApprovals = compact(
    (actions.addMemberPendingAdminApprovals || []).map(
      addPendingAdminApproval => {
        if (addPendingAdminApproval.added) {
          const decrypted = decryptMemberPendingAdminApproval(
            clientZkGroupCipher,
            addPendingAdminApproval.added,
            logId
          );
          if (!decrypted) {
            window.log.warn(
              `decryptGroupChange/${logId}: Unable to decrypt addPendingAdminApproval.added. Dropping member.`
            );
            return null;
          }

          addPendingAdminApproval.added = decrypted;
          return addPendingAdminApproval;
        }
        throw new Error(
          'decryptGroupChange: addPendingAdminApproval was missing added field!'
        );
      }
    )
  );

  // deleteMemberPendingAdminApprovals?: Array<
  //   GroupChangeClass.Actions.DeleteMemberPendingAdminApprovalAction
  // >;
  actions.deleteMemberPendingAdminApprovals = compact(
    (actions.deleteMemberPendingAdminApprovals || []).map(
      deletePendingApproval => {
        if (hasData(deletePendingApproval.deletedUserId)) {
          try {
            deletePendingApproval.deletedUserId = decryptUuid(
              clientZkGroupCipher,
              deletePendingApproval.deletedUserId.toArrayBuffer()
            );
          } catch (error) {
            window.log.warn(
              `decryptGroupChange/${logId}: Unable to decrypt deletePendingApproval.deletedUserId. Dropping member.`,
              error && error.stack ? error.stack : error
            );
            return null;
          }
        } else {
          throw new Error(
            'decryptGroupChange: deletePendingApproval.deletedUserId was missing'
          );
        }

        window.normalizeUuids(
          deletePendingApproval,
          ['deletedUserId'],
          'groups.decryptGroupChange'
        );

        if (!window.isValidGuid(deletePendingApproval.deletedUserId)) {
          window.log.warn(
            `decryptGroupChange/${logId}: Dropping deletePendingApproval due to invalid deletedUserId`
          );

          return null;
        }

        return deletePendingApproval;
      }
    )
  );

  // promoteMemberPendingAdminApprovals?: Array<
  //   GroupChangeClass.Actions.PromoteMemberPendingAdminApprovalAction
  // >;
  actions.promoteMemberPendingAdminApprovals = compact(
    (actions.promoteMemberPendingAdminApprovals || []).map(
      promoteAdminApproval => {
        if (hasData(promoteAdminApproval.userId)) {
          try {
            promoteAdminApproval.userId = decryptUuid(
              clientZkGroupCipher,
              promoteAdminApproval.userId.toArrayBuffer()
            );
          } catch (error) {
            window.log.warn(
              `decryptGroupChange/${logId}: Unable to decrypt promoteAdminApproval.userId. Dropping member.`,
              error && error.stack ? error.stack : error
            );
            return null;
          }
        } else {
          throw new Error(
            'decryptGroupChange: promoteAdminApproval.userId was missing'
          );
        }

        if (!isValidRole(promoteAdminApproval.role)) {
          throw new Error(
            `decryptGroupChange: promoteAdminApproval had invalid role ${promoteAdminApproval.role}`
          );
        }

        return promoteAdminApproval;
      }
    )
  );

  // modifyInviteLinkPassword?: GroupChangeClass.Actions.ModifyInviteLinkPasswordAction;
  if (
    actions.modifyInviteLinkPassword &&
    hasData(actions.modifyInviteLinkPassword.inviteLinkPassword)
  ) {
    actions.modifyInviteLinkPassword.inviteLinkPassword = actions.modifyInviteLinkPassword.inviteLinkPassword.toString(
      'base64'
    );
  } else {
    actions.modifyInviteLinkPassword = undefined;
  }

  return actions;
}

export function decryptGroupTitle(
  title: ProtoBinaryType,
  secretParams: string
): string | undefined {
  const clientZkGroupCipher = getClientZkGroupCipher(secretParams);
  if (hasData(title)) {
    const blob = window.textsecure.protobuf.GroupAttributeBlob.decode(
      decryptGroupBlob(clientZkGroupCipher, title.toArrayBuffer())
    );

    if (blob && blob.content === 'title') {
      return blob.title;
    }
  }

  return undefined;
}

function decryptGroupState(
  groupState: GroupClass,
  groupSecretParams: string,
  logId: string
): GroupClass {
  const clientZkGroupCipher = getClientZkGroupCipher(groupSecretParams);

  // title
  if (hasData(groupState.title)) {
    try {
      groupState.title = window.textsecure.protobuf.GroupAttributeBlob.decode(
        decryptGroupBlob(clientZkGroupCipher, groupState.title.toArrayBuffer())
      );
    } catch (error) {
      window.log.warn(
        `decryptGroupState/${logId}: Unable to decrypt title. Clearing it.`,
        error && error.stack ? error.stack : error
      );
      groupState.title = undefined;
    }
  } else {
    groupState.title = undefined;
  }

  // avatar
  // Note: decryption happens during application of the change, on download of the avatar

  // disappearing message timer
  if (hasData(groupState.disappearingMessagesTimer)) {
    try {
      groupState.disappearingMessagesTimer = window.textsecure.protobuf.GroupAttributeBlob.decode(
        decryptGroupBlob(
          clientZkGroupCipher,
          groupState.disappearingMessagesTimer.toArrayBuffer()
        )
      );
    } catch (error) {
      window.log.warn(
        `decryptGroupState/${logId}: Unable to decrypt disappearing message timer. Clearing it.`,
        error && error.stack ? error.stack : error
      );
      groupState.disappearingMessagesTimer = undefined;
    }
  } else {
    groupState.disappearingMessagesTimer = undefined;
  }

  // accessControl
  if (!isValidAccess(groupState.accessControl?.attributes)) {
    throw new Error(
      `decryptGroupState: Access control for attributes is invalid: ${groupState.accessControl?.attributes}`
    );
  }
  if (!isValidAccess(groupState.accessControl?.members)) {
    throw new Error(
      `decryptGroupState: Access control for members is invalid: ${groupState.accessControl?.members}`
    );
  }
  if (!isValidLinkAccess(groupState.accessControl?.addFromInviteLink)) {
    throw new Error(
      `decryptGroupState: Access control for invite link is invalid: ${groupState.accessControl?.addFromInviteLink}`
    );
  }

  // version
  if (!isNumber(groupState.version)) {
    throw new Error(
      `decryptGroupState: Expected version to be a number; it was ${groupState.version}`
    );
  }

  // members
  if (groupState.members) {
    groupState.members = compact(
      groupState.members.map((member: MemberClass) =>
        decryptMember(clientZkGroupCipher, member, logId)
      )
    );
  }

  // membersPendingProfileKey
  if (groupState.membersPendingProfileKey) {
    groupState.membersPendingProfileKey = compact(
      groupState.membersPendingProfileKey.map(
        (member: MemberPendingProfileKeyClass) =>
          decryptMemberPendingProfileKey(clientZkGroupCipher, member, logId)
      )
    );
  }

  // membersPendingAdminApproval
  if (groupState.membersPendingAdminApproval) {
    groupState.membersPendingAdminApproval = compact(
      groupState.membersPendingAdminApproval.map(
        (member: MemberPendingAdminApprovalClass) =>
          decryptMemberPendingAdminApproval(clientZkGroupCipher, member, logId)
      )
    );
  }

  // inviteLinkPassword
  if (hasData(groupState.inviteLinkPassword)) {
    groupState.inviteLinkPassword = groupState.inviteLinkPassword.toString(
      'base64'
    );
  } else {
    groupState.inviteLinkPassword = undefined;
  }

  return groupState;
}

function decryptMember(
  clientZkGroupCipher: ClientZkGroupCipher,
  member: MemberClass,
  logId: string
) {
  // userId
  if (hasData(member.userId)) {
    try {
      member.userId = decryptUuid(
        clientZkGroupCipher,
        member.userId.toArrayBuffer()
      );
    } catch (error) {
      window.log.warn(
        `decryptMember/${logId}: Unable to decrypt member userid. Dropping member.`,
        error && error.stack ? error.stack : error
      );
      return null;
    }

    window.normalizeUuids(member, ['userId'], 'groups.decryptMember');

    if (!window.isValidGuid(member.userId)) {
      window.log.warn(
        `decryptMember/${logId}: Dropping member due to invalid userId`
      );

      return null;
    }
  } else {
    throw new Error('decryptMember: Member had missing userId');
  }

  // profileKey
  if (hasData(member.profileKey)) {
    member.profileKey = decryptProfileKey(
      clientZkGroupCipher,
      member.profileKey.toArrayBuffer(),
      member.userId
    );

    if (!isValidProfileKey(member.profileKey)) {
      throw new Error('decryptMember: Member had invalid profileKey');
    }
  } else {
    throw new Error('decryptMember: Member had missing profileKey');
  }

  // role
  if (!isValidRole(member.role)) {
    throw new Error(`decryptMember: Member had invalid role ${member.role}`);
  }

  return member;
}

function decryptMemberPendingProfileKey(
  clientZkGroupCipher: ClientZkGroupCipher,
  member: MemberPendingProfileKeyClass,
  logId: string
) {
  // addedByUserId
  if (hasData(member.addedByUserId)) {
    try {
      member.addedByUserId = decryptUuid(
        clientZkGroupCipher,
        member.addedByUserId.toArrayBuffer()
      );
    } catch (error) {
      window.log.warn(
        `decryptMemberPendingProfileKey/${logId}: Unable to decrypt pending member addedByUserId. Dropping member.`,
        error && error.stack ? error.stack : error
      );
      return null;
    }

    window.normalizeUuids(
      member,
      ['addedByUserId'],
      'groups.decryptMemberPendingProfileKey'
    );

    if (!window.isValidGuid(member.addedByUserId)) {
      window.log.warn(
        `decryptMemberPendingProfileKey/${logId}: Dropping pending member due to invalid addedByUserId`
      );
      return null;
    }
  } else {
    throw new Error(
      'decryptMemberPendingProfileKey: Member had missing addedByUserId'
    );
  }

  // timestamp
  member.timestamp = normalizeTimestamp(member.timestamp);

  if (!member.member) {
    window.log.warn(
      `decryptMemberPendingProfileKey/${logId}: Dropping pending member due to missing member details`
    );

    return null;
  }

  const { userId, profileKey, role } = member.member;

  // userId
  if (hasData(userId)) {
    try {
      member.member.userId = decryptUuid(
        clientZkGroupCipher,
        userId.toArrayBuffer()
      );
    } catch (error) {
      window.log.warn(
        `decryptMemberPendingProfileKey/${logId}: Unable to decrypt pending member userId. Dropping member.`,
        error && error.stack ? error.stack : error
      );
      return null;
    }

    window.normalizeUuids(
      member.member,
      ['userId'],
      'groups.decryptMemberPendingProfileKey'
    );

    if (!window.isValidGuid(member.member.userId)) {
      window.log.warn(
        `decryptMemberPendingProfileKey/${logId}: Dropping pending member due to invalid member.userId`
      );

      return null;
    }
  } else {
    throw new Error(
      'decryptMemberPendingProfileKey: Member had missing member.userId'
    );
  }

  // profileKey
  if (hasData(profileKey)) {
    try {
      member.member.profileKey = decryptProfileKey(
        clientZkGroupCipher,
        profileKey.toArrayBuffer(),
        member.member.userId
      );
    } catch (error) {
      window.log.warn(
        `decryptMemberPendingProfileKey/${logId}: Unable to decrypt pending member profileKey. Dropping profileKey.`,
        error && error.stack ? error.stack : error
      );
      member.member.profileKey = null;
    }

    if (!isValidProfileKey(member.member.profileKey)) {
      window.log.warn(
        `decryptMemberPendingProfileKey/${logId}: Dropping profileKey, since it was invalid`
      );

      member.member.profileKey = null;
    }
  }

  // role
  if (!isValidRole(role)) {
    throw new Error(
      `decryptMemberPendingProfileKey: Member had invalid role ${role}`
    );
  }

  return member;
}

function decryptMemberPendingAdminApproval(
  clientZkGroupCipher: ClientZkGroupCipher,
  member: MemberPendingAdminApprovalClass,
  logId: string
) {
  // timestamp
  member.timestamp = normalizeTimestamp(member.timestamp);

  const { userId, profileKey } = member;

  // userId
  if (hasData(userId)) {
    try {
      member.userId = decryptUuid(clientZkGroupCipher, userId.toArrayBuffer());
    } catch (error) {
      window.log.warn(
        `decryptMemberPendingAdminApproval/${logId}: Unable to decrypt pending member userId. Dropping member.`,
        error && error.stack ? error.stack : error
      );
      return null;
    }

    window.normalizeUuids(
      member,
      ['userId'],
      'groups.decryptMemberPendingAdminApproval'
    );

    if (!window.isValidGuid(member.userId)) {
      window.log.warn(
        `decryptMemberPendingAdminApproval/${logId}: Invalid userId. Dropping member.`
      );

      return null;
    }
  } else {
    throw new Error('decryptMemberPendingAdminApproval: Missing userId');
  }

  // profileKey
  if (hasData(profileKey)) {
    try {
      member.profileKey = decryptProfileKey(
        clientZkGroupCipher,
        profileKey.toArrayBuffer(),
        member.userId
      );
    } catch (error) {
      window.log.warn(
        `decryptMemberPendingAdminApproval/${logId}: Unable to decrypt profileKey. Dropping profileKey.`,
        error && error.stack ? error.stack : error
      );
      member.profileKey = null;
    }

    if (!isValidProfileKey(member.profileKey)) {
      window.log.warn(
        `decryptMemberPendingAdminApproval/${logId}: Dropping profileKey, since it was invalid`
      );

      member.profileKey = null;
    }
  }

  return member;
}

export function getMembershipList(
  conversationId: string
): Array<{ uuid: string; uuidCiphertext: ArrayBuffer }> {
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
    const uuid = member.get('uuid');
    if (!uuid) {
      throw new Error('getMembershipList: member has no UUID');
    }

    const uuidCiphertext = encryptUuid(clientZkGroupCipher, uuid);
    return { uuid, uuidCiphertext };
  });
}
