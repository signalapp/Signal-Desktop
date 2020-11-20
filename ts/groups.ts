// Copyright 2020 Signal Messenger, LLC
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
import dataInterface from './sql/Client';
import {
  ConversationAttributesType,
  GroupV2MemberType,
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
} from './Crypto';
import {
  GroupAttributeBlobClass,
  GroupChangeClass,
  GroupChangesClass,
  GroupClass,
  MemberClass,
  PendingMemberClass,
  ProtoBinaryType,
} from './textsecure.d';
import {
  GroupCredentialsType,
  GroupLogResponseType,
} from './textsecure/WebAPI';
import MessageSender, { CallbackResultType } from './textsecure/SendMessage';
import { CURRENT_SCHEMA_VERSION as MAX_MESSAGE_SCHEMA } from '../js/modules/types/message';
import { ConversationModel } from './models/conversations';

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
export type GroupV2AvatarChangeType = {
  type: 'avatar';
  removed: boolean;
};
export type GroupV2TitleChangeType = {
  type: 'title';
  // Allow for null, because the title could be removed entirely
  newTitle?: string;
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

export type GroupV2ChangeDetailType =
  | GroupV2AccessCreateChangeType
  | GroupV2TitleChangeType
  | GroupV2AvatarChangeType
  | GroupV2AccessAttributesChangeType
  | GroupV2AccessMembersChangeType
  | GroupV2MemberAddChangeType
  | GroupV2MemberAddFromInviteChangeType
  | GroupV2MemberRemoveChangeType
  | GroupV2MemberPrivilegeChangeType
  | GroupV2PendingAddOneChangeType
  | GroupV2PendingAddManyChangeType
  | GroupV2PendingRemoveOneChangeType
  | GroupV2PendingRemoveManyChangeType;

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

// Constants

export const MASTER_KEY_LENGTH = 32;
export const ID_V1_LENGTH = 16;
export const ID_LENGTH = 32;
const TEMPORAL_AUTH_REJECTED_CODE = 401;
const GROUP_ACCESS_DENIED_CODE = 403;
const GROUP_NONEXISTENT_CODE = 404;
const SUPPORTED_CHANGE_EPOCH = 0;

// Group Modifications

async function uploadAvatar({
  logId,
  path,
  publicParams,
  secretParams,
}: {
  logId: string;
  path: string;
  publicParams: string;
  secretParams: string;
}): Promise<{ hash: string; key: string }> {
  try {
    const clientZkGroupCipher = getClientZkGroupCipher(secretParams);

    const data = await window.Signal.Migrations.readAttachmentData(path);
    const hash = await computeHash(data);

    const blob = new window.textsecure.protobuf.GroupAttributeBlob();
    blob.avatar = data;
    const blobPlaintext = blob.toArrayBuffer();
    const ciphertext = encryptGroupBlob(clientZkGroupCipher, blobPlaintext);

    const key = await makeRequestWithTemporalRetry({
      logId: `uploadGroupAvatar/${logId}`,
      publicParams,
      secretParams,
      request: (sender, options) =>
        sender.uploadGroupAvatar(ciphertext, options),
    });

    return {
      key,
      hash,
    };
  } catch (error) {
    window.log.warn(
      `uploadAvatar/${logId} Failed to upload avatar`,
      error.stack
    );
    throw error;
  }
}

async function buildGroupProto({
  attributes,
}: {
  attributes: ConversationAttributesType;
}): Promise<GroupClass> {
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

  const titleBlob = new window.textsecure.protobuf.GroupAttributeBlob();
  titleBlob.title = attributes.name;
  const titleBlobPlaintext = titleBlob.toArrayBuffer();
  proto.title = encryptGroupBlob(clientZkGroupCipher, titleBlobPlaintext);

  if (attributes.avatar && attributes.avatar.path) {
    const { path } = attributes.avatar;
    const { key, hash } = await uploadAvatar({
      logId,
      path,
      publicParams,
      secretParams,
    });

    // eslint-disable-next-line no-param-reassign
    attributes.avatar.hash = hash;
    // eslint-disable-next-line no-param-reassign
    attributes.avatar.url = key;

    proto.avatar = key;
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
        `buildGroupProto/${logId}: member was missing profileKeyCredentia!`
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

  proto.pendingMembers = (attributes.pendingMembersV2 || []).map(item => {
    const pendingMember = new window.textsecure.protobuf.PendingMember();
    const member = new window.textsecure.protobuf.Member();

    const conversation = window.ConversationController.get(item.conversationId);
    if (!conversation) {
      throw new Error('buildGroupProto: no conversation for pending member!');
    }

    const uuid = conversation.get('uuid');
    if (!uuid) {
      throw new Error('buildGroupProto: pending member was missing uuid!');
    }

    const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);
    member.userId = uuidCipherTextBuffer;
    member.role = MEMBER_ROLE_ENUM.DEFAULT;

    pendingMember.member = member;
    pendingMember.timestamp = item.timestamp;
    pendingMember.addedByUserId = ourUuidCipherTextBuffer;

    return pendingMember;
  });

  return proto;
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

export function buildDeletePendingMemberChange({
  uuid,
  group,
}: {
  uuid: string;
  group: ConversationAttributesType;
}): GroupChangeClass.Actions {
  const actions = new window.textsecure.protobuf.GroupChange.Actions();

  if (!group.secretParams) {
    throw new Error(
      'buildDeletePendingMemberChange: group was missing secretParams!'
    );
  }
  const clientZkGroupCipher = getClientZkGroupCipher(group.secretParams);
  const uuidCipherTextBuffer = encryptUuid(clientZkGroupCipher, uuid);

  const deletePendingMember = new window.textsecure.protobuf.GroupChange.Actions.DeletePendingMemberAction();
  deletePendingMember.deletedUserId = uuidCipherTextBuffer;

  actions.version = (group.revision || 0) + 1;
  actions.deletePendingMembers = [deletePendingMember];

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

  const promotePendingMember = new window.textsecure.protobuf.GroupChange.Actions.PromotePendingMemberAction();
  promotePendingMember.presentation = presentation;

  actions.version = (group.revision || 0) + 1;
  actions.promotePendingMembers = [promotePendingMember];

  return actions;
}

export async function uploadGroupChange({
  actions,
  group,
}: {
  actions: GroupChangeClass.Actions;
  group: ConversationAttributesType;
}): Promise<GroupChangeClass> {
  const logId = idForLogging(group);

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
    request: (sender, options) => sender.modifyGroup(actions, options),
  });
}

// Utility

function idForLogging(group: ConversationAttributesType) {
  return `groupv2(${group.groupId})`;
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
    return code !== GROUP_NONEXISTENT_CODE && code !== GROUP_ACCESS_DENIED_CODE;
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

// This is called when the user chooses to migrate a GroupV1. It will update the server,
//   then let all members know about the new group.
export async function initiateMigrationToGroupV2(
  conversation: ConversationModel
): Promise<void> {
  // Ensure we have the credentials we need before attempting GroupsV2 operations
  await maybeFetchNewCredentials();

  try {
    await conversation.queueJob(async () => {
      const MEMBER_ROLE_ENUM = window.textsecure.protobuf.Member.Role;
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

      let areWeMember = false;
      let areWeInvited = false;

      const now = Date.now();

      const previousGroupV1Members = conversation.get('members') || [];
      const memberLookup: Record<string, boolean> = {};
      const membersV2: Array<GroupV2MemberType> = compact(
        await Promise.all(
          previousGroupV1Members.map(async e164 => {
            const contact = window.ConversationController.get(e164);

            if (!contact) {
              throw new Error(
                `initiateMigrationToGroupV2/${logId}: membersV2 - missing local contact for ${e164}, skipping.`
              );
            }
            if (!contact.get('uuid')) {
              window.log.warn(
                `initiateMigrationToGroupV2/${logId}: membersV2 - missing uuid for ${e164}, skipping.`
              );
              return null;
            }

            if (!contact.get('profileKey')) {
              window.log.warn(
                `initiateMigrationToGroupV2/${logId}: membersV2 - missing profileKey for member ${e164}, skipping.`
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
                `initiateMigrationToGroupV2/${logId}: membersV2 - member ${e164} is missing gv2 capability, skipping.`
              );
              return null;
            }
            if (!capabilities || !capabilities['gv1-migration']) {
              window.log.warn(
                `initiateMigrationToGroupV2/${logId}: membersV2 - member ${e164} is missing gv1-migration capability, skipping.`
              );
              return null;
            }
            if (!contact.get('profileKeyCredential')) {
              window.log.warn(
                `initiateMigrationToGroupV2/${logId}: membersV2 - no profileKeyCredential for ${e164}, skipping.`
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
              `initiateMigrationToGroupV2/${logId}: pendingMembersV2 - missing local contact for ${e164}, skipping.`
            );
          }

          const conversationId = contact.id;
          // If we've already added this contact above, we'll skip here
          if (memberLookup[conversationId]) {
            return null;
          }

          if (!contact.get('uuid')) {
            window.log.warn(
              `initiateMigrationToGroupV2/${logId}: pendingMembersV2 - missing uuid for ${e164}, skipping.`
            );
            droppedGV2MemberIds.push(conversationId);
            return null;
          }

          const capabilities = contact.get('capabilities');
          if (!capabilities || !capabilities.gv2) {
            window.log.warn(
              `initiateMigrationToGroupV2/${logId}: pendingMembersV2 - member ${e164} is missing gv2 capability, skipping.`
            );
            droppedGV2MemberIds.push(conversationId);
            return null;
          }
          if (!capabilities || !capabilities['gv1-migration']) {
            window.log.warn(
              `initiateMigrationToGroupV2/${logId}: pendingMembersV2 - member ${e164} is missing gv1-migration capability, skipping.`
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
          };
        })
      );

      if (!areWeMember) {
        throw new Error(
          `initiateMigrationToGroupV2/${logId}: After members migration, we are not a member!`
        );
      }
      if (areWeInvited) {
        throw new Error(
          `initiateMigrationToGroupV2/${logId}: After members migration, we are invited!`
        );
      }

      // Note: A few group elements don't need to change here:
      //   - avatar
      //   - name
      //   - expireTimer

      const newAttributes = {
        ...conversation.attributes,

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

      const groupProto = await buildGroupProto({ attributes: newAttributes });

      // Capture the CDK key provided by the server when we uploade
      if (groupProto.avatar && newAttributes.avatar) {
        newAttributes.avatar.url = groupProto.avatar;
      }

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
  const profileKey = conversation.get('profileKey');

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
        profileKey: profileKey ? base64ToArrayBuffer(profileKey) : undefined,
      }),
    timestamp,
  });
}

async function wrapWithSyncMessageSend({
  conversation,
  logId,
  send,
  timestamp,
}: {
  conversation: ConversationModel;
  logId: string;
  send: (sender: MessageSender) => Promise<CallbackResultType | undefined>;
  timestamp: number;
}) {
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

  // If we were not previously a member, we won't migrate
  const ourConversationId = window.ConversationController.getOurConversationId();
  const wereWePreviouslyAMember =
    !conversation.get('left') &&
    ourConversationId &&
    conversation.hasMember(ourConversationId);
  if (!ourConversationId || !wereWePreviouslyAMember) {
    window.log.info(
      `respondToGroupV2Migration: Not currently a member of ${conversation.idForLogging()}, returning early.`
    );
    return;
  }

  // Derive GroupV2 fields
  const groupV1IdBuffer = fromEncodedBinaryToArrayBuffer(previousGroupV1Id);
  const masterKeyBuffer = await deriveMasterKeyFromGroupV1(groupV1IdBuffer);
  const fields = deriveGroupFields(masterKeyBuffer);

  const groupId = arrayBufferToBase64(fields.id);
  const logId = `groupv2(${groupId})`;
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
      firstGroupState = await makeRequestWithTemporalRetry({
        logId: `getGroup/${logId}`,
        publicParams,
        secretParams,
        request: (sender, options) => sender.getGroup(options),
      });
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
  const newAttributes = await applyGroupState({
    group: attributes,
    groupState,
  });

  // Assemble items to commemorate this event for the timeline..
  const combinedConversationIds: Array<string> = [
    ...(newAttributes.membersV2 || []).map(item => item.conversationId),
    ...(newAttributes.pendingMembersV2 || []).map(item => item.conversationId),
  ];
  const droppedGV2MemberIds: Array<string> = difference(
    previousGroupV1MembersIds,
    combinedConversationIds
  ).filter(id => id && id !== ourConversationId);
  const invitedGV2Members = (newAttributes.pendingMembersV2 || []).filter(
    item => item.conversationId !== ourConversationId
  );

  // Generate notifications into the timeline
  const groupChangeMessages: Array<MessageAttributesType> = [];
  groupChangeMessages.push({
    ...generateBasicMessage(),
    type: 'group-v1-migration',
    invitedGV2Members,
    droppedGV2MemberIds,
  });

  const areWeInvited = (newAttributes.pendingMembersV2 || []).some(
    item => item.conversationId === ourConversationId
  );
  const areWeMember = (newAttributes.membersV2 || []).some(
    item => item.conversationId === ourConversationId
  );
  if (!areWeInvited && !areWeMember) {
    // Add a message to the timeline saying the user was removed
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
  } else if (areWeInvited && !areWeMember && ourConversationId) {
    // Add a message to the timeline saying we were invited to the group
    groupChangeMessages.push({
      ...generateBasicMessage(),
      type: 'group-v2-change',
      groupV2Change: {
        details: [
          {
            type: 'pending-add-one' as const,
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
      members: [],
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

  // Ensure that all generated messages are ordered properly.
  // Before the provided timestamp so update messages appear before the
  //   initiating message, or after now().
  const finalReceivedAt = receivedAt || Date.now();
  const finalSentAt = sentAt || Date.now();

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
      isInitialDataFetch && newAttributes.name
        ? finalReceivedAt
        : newAttributes.active_at,
  });

  if (idChanged) {
    conversation.trigger('idUpdated', conversation, 'groupId', previousId);
  }

  // Save all synthetic messages describing group changes
  let syntheticSentAt = finalSentAt - (groupChangeMessages.length + 1);
  const changeMessagesToSave = groupChangeMessages.map(changeMessage => {
    // We do this to preserve the order of the timeline. We only update sentAt to ensure
    //   that we don't stomp on messages received around the same time as the message
    //   which initiated this group fetch and in-conversation messages.
    syntheticSentAt += 1;

    return {
      ...changeMessage,
      conversationId: conversation.id,
      received_at: finalReceivedAt,
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
  const logId = idForLogging(group);

  window.log.info(`getGroupUpdates/${logId}: Starting...`);

  const currentRevision = group.revision;
  const isFirstFetch = !isNumber(group.revision);

  const isInitialCreationMessage = isFirstFetch && newRevision === 0;
  const isOneVersionUp =
    isNumber(currentRevision) &&
    isNumber(newRevision) &&
    newRevision === currentRevision + 1;

  if (
    groupChangeBase64 &&
    isNumber(newRevision) &&
    (isInitialCreationMessage || isOneVersionUp)
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
      return integrateGroupChange({ group, newRevision, groupChange });
    }

    window.log.info(
      `getGroupUpdates/${logId}: Failing over; group change unsupported`
    );
  }

  if (isNumber(newRevision)) {
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

  return updateGroupViaState({
    dropInitialJoinMessage,
    group,
    serverPublicParamsBase64,
  });
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
  const logId = idForLogging(group);
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

async function updateGroupViaLogs({
  group,
  serverPublicParamsBase64,
  newRevision,
}: {
  group: ConversationAttributesType;
  newRevision: number;
  serverPublicParamsBase64: string;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group);
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

function generateLeftGroupChanges(
  group: ConversationAttributesType
): UpdatesResultType {
  const logId = idForLogging(group);
  window.log.info(`generateLeftGroupChanges/${logId}: Starting...`);
  const ourConversationId = window.ConversationController.getOurConversationId();
  if (!ourConversationId) {
    throw new Error(
      'generateLeftGroupChanges: We do not have a conversationId!'
    );
  }
  const existingMembers = group.membersV2 || [];
  const newAttributes: ConversationAttributesType = {
    ...group,
    membersV2: existingMembers.filter(
      member => member.conversationId !== ourConversationId
    ),
    left: true,
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
  const logId = idForLogging(group);
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

      if (!groupChange || !groupState) {
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
  groupChange: GroupChangeClass;
  groupState?: GroupClass;
  newRevision: number;
}): Promise<UpdatesResultType> {
  const logId = idForLogging(group);
  if (!group.secretParams) {
    throw new Error(
      `integrateGroupChange/${logId}: Group was missing secretParams!`
    );
  }

  const groupChangeActions = window.textsecure.protobuf.GroupChange.Actions.decode(
    groupChange.actions.toArrayBuffer()
  );

  if (groupChangeActions.version && groupChangeActions.version > newRevision) {
    return {
      newAttributes: group,
      groupChangeMessages: [],
      members: [],
    };
  }

  const decryptedChangeActions = decryptGroupChange(
    groupChangeActions,
    group.secretParams,
    logId
  );

  const { sourceUuid } = decryptedChangeActions;
  const sourceConversation = window.ConversationController.getOrCreate(
    sourceUuid,
    'private'
  );
  const sourceConversationId = sourceConversation.id;

  const isChangeSupported =
    !isNumber(groupChange.changeEpoch) ||
    groupChange.changeEpoch <= SUPPORTED_CHANGE_EPOCH;
  const isFirstFetch = !isNumber(group.revision);
  const isMoreThanOneVersionUp =
    groupChangeActions.version &&
    isNumber(group.revision) &&
    groupChangeActions.version > group.revision + 1;

  if (!isChangeSupported || isFirstFetch || isMoreThanOneVersionUp) {
    if (!groupState) {
      throw new Error(
        `integrateGroupChange/${logId}: No group state, but we can't apply changes!`
      );
    }

    window.log.info(
      `integrateGroupChange/${logId}: Applying full group state, from version ${group.revision} to ${groupState.version}`,
      {
        isChangeSupported,
      }
    );

    const decryptedGroupState = decryptGroupState(
      groupState,
      group.secretParams,
      logId
    );

    const newAttributes = await applyGroupState({
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
      members: getMembers(decryptedGroupState),
    };
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
    members: newProfileKeys.map(item => ({
      ...item,
      profileKey: arrayBufferToBase64(item.profileKey),
    })),
  };
}

export async function getCurrentGroupState({
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
  const logId = idForLogging(group);
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

  const newAttributes = await applyGroupState({
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
    members: getMembers(decryptedGroupState),
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
  const logId = idForLogging(old);
  const details: Array<GroupV2ChangeDetailType> = [];
  const ourConversationId = window.ConversationController.getOurConversationId();

  let areWeInGroup = false;
  let areWeInvitedToGroup = false;
  let whoInvitedUsUserId = null;

  if (
    current.accessControl &&
    (!old.accessControl ||
      old.accessControl.attributes !== current.accessControl.attributes)
  ) {
    details.push({
      type: 'access-attributes',
      newPrivilege: current.accessControl.attributes,
    });
  }
  if (
    current.accessControl &&
    (!old.accessControl ||
      old.accessControl.members !== current.accessControl.members)
  ) {
    details.push({
      type: 'access-members',
      newPrivilege: current.accessControl.members,
    });
  }
  if (
    Boolean(old.avatar) !== Boolean(current.avatar) ||
    old.avatar?.hash !== current.avatar?.hash
  ) {
    details.push({
      type: 'avatar',
      removed: !current.avatar,
    });
  }
  if (old.name !== current.name) {
    details.push({
      type: 'title',
      newTitle: current.name,
    });
  }

  // No disappearing message timer check here - see below

  const oldMemberLookup: Dictionary<GroupV2MemberType> = fromPairs(
    (old.membersV2 || []).map(member => [member.conversationId, member])
  );
  const oldPendingMemberLookup: Dictionary<GroupV2PendingMemberType> = fromPairs(
    (old.pendingMembersV2 || []).map(member => [member.conversationId, member])
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
      } else {
        details.push({
          type: 'member-add',
          conversationId,
        });
      }

      // If we capture a pending remove here, it's an 'accept invitation', and we don't
      //   want to generate a generic pending-remove event for it
      delete oldPendingMemberLookup[conversationId];
    } else if (oldMember.role !== currentMember.role) {
      details.push({
        type: 'member-privilege',
        conversationId,
        newPrivilege: currentMember.role,
      });
    }

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

  let lastPendingConversationId: string | undefined;
  let count = 0;
  (current.pendingMembersV2 || []).forEach(currentPendingMember => {
    const { conversationId } = currentPendingMember;
    const oldPendingMember = oldPendingMemberLookup[conversationId];

    if (ourConversationId && conversationId === ourConversationId) {
      areWeInvitedToGroup = true;
      whoInvitedUsUserId = currentPendingMember.addedByUserId;
    }

    if (!oldPendingMember) {
      lastPendingConversationId = conversationId;
      count += 1;
    }

    // This deletion makes it easier to capture removals
    delete oldPendingMemberLookup[conversationId];
  });

  if (count > 1) {
    details.push({
      type: 'pending-add-many',
      count,
    });
  } else if (count === 1) {
    if (lastPendingConversationId) {
      details.push({
        type: 'pending-add-one',
        conversationId: lastPendingConversationId,
      });
    } else {
      window.log.warn(
        `extractDiffs/${logId}: pending-add count was 1, no last conversationId available`
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

function getMembers(groupState: GroupClass) {
  if (!groupState.members || !groupState.members.length) {
    return [];
  }

  return groupState.members.map((member: MemberClass) => ({
    profileKey: arrayBufferToBase64(member.profileKey),
    uuid: member.userId,
  }));
}

type GroupChangeMemberType = {
  profileKey: ArrayBuffer;
  uuid: string;
};
type GroupChangeResultType = {
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
}): Promise<GroupChangeResultType> {
  const logId = idForLogging(group);
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
      'private',
      {
        profileKey: added.profileKey
          ? arrayBufferToBase64(added.profileKey)
          : undefined,
      }
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

  // addPendingMembers?: Array<GroupChangeClass.Actions.AddPendingMemberAction>;
  (actions.addPendingMembers || []).forEach(addPendingMember => {
    const { added } = addPendingMember;
    if (!added || !added.member) {
      throw new Error(
        'applyGroupChange: modifyMemberProfileKey had a missing value'
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
    };

    if (added.member && added.member.profileKey) {
      newProfileKeys.push({
        profileKey: added.member.profileKey,
        uuid: added.member.userId,
      });
    }
  });

  // deletePendingMembers?: Array<GroupChangeClass.Actions.DeletePendingMemberAction>;
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

  // promotePendingMembers?: Array<GroupChangeClass.Actions.PromotePendingMemberAction>;
  (actions.promotePendingMembers || []).forEach(promotePendingMember => {
    const { profileKey, uuid } = promotePendingMember;
    if (!profileKey || !uuid) {
      throw new Error(
        'applyGroupChange: promotePendingMember had a missing value'
      );
    }

    const conversation = window.ConversationController.getOrCreate(
      uuid,
      'private',
      {
        profileKey: profileKey ? arrayBufferToBase64(profileKey) : undefined,
      }
    );

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
      role: MEMBER_ROLE_ENUM.DEFAULT,
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
  // GroupChangeClass.Actions.ModifyDisappearingMessagesTimerAction;
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

  if (ourConversationId) {
    result.left = !members[ourConversationId];
  }

  // Go from lookups back to arrays
  result.membersV2 = values(members);
  result.pendingMembersV2 = values(pendingMembers);

  return {
    newAttributes: result,
    newProfileKeys,
  };
}

// Ovewriting result.avatar as part of functionality
/* eslint-disable no-param-reassign */
async function applyNewAvatar(
  newAvatar: string | undefined,
  result: ConversationAttributesType,
  logId: string
) {
  try {
    // Avatar has been dropped
    if (!newAvatar && result.avatar) {
      await window.Signal.Migrations.deleteAttachmentData(result.avatar.path);
      result.avatar = undefined;
    }

    // Group has avatar; has it changed?
    if (newAvatar && (!result.avatar || result.avatar.url !== newAvatar)) {
      const sender = window.textsecure.messaging;
      if (!sender) {
        throw new Error(
          'applyNewAvatar: textsecure.messaging is not available!'
        );
      }

      if (!result.secretParams) {
        throw new Error('applyNewAvatar: group was missing secretParams!');
      }

      const ciphertext = await sender.getGroupAvatar(newAvatar);
      const clientZkGroupCipher = getClientZkGroupCipher(result.secretParams);
      const plaintext = decryptGroupBlob(clientZkGroupCipher, ciphertext);
      const blob = window.textsecure.protobuf.GroupAttributeBlob.decode(
        plaintext
      );
      if (blob.content !== 'avatar') {
        throw new Error(
          `applyNewAvatar: Returned blob had incorrect content: ${blob.content}`
        );
      }

      const data = blob.avatar.toArrayBuffer();
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
}): Promise<ConversationAttributesType> {
  const logId = idForLogging(group);
  const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;
  const version = groupState.version || 0;
  const result = { ...group };

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
  };

  // Optimization: we assume we have left the group unless we are found in members
  result.left = true;
  const ourConversationId = window.ConversationController.getOurConversationId();

  // members
  if (groupState.members) {
    result.membersV2 = groupState.members.map((member: MemberClass) => {
      const conversation = window.ConversationController.getOrCreate(
        member.userId,
        'private',
        {
          profileKey: member.profileKey
            ? arrayBufferToBase64(member.profileKey)
            : undefined,
        }
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

      if (
        !member.role ||
        member.role === window.textsecure.protobuf.Member.Role.UNKNOWN
      ) {
        throw new Error(
          'applyGroupState: Received false or UNKNOWN member.role'
        );
      }

      return {
        role: member.role,
        joinedAtVersion: member.joinedAtVersion || version,
        conversationId: conversation.id,
      };
    });
  }

  // pendingMembers
  if (groupState.pendingMembers) {
    result.pendingMembersV2 = groupState.pendingMembers.map(
      (member: PendingMemberClass) => {
        let pending;
        let invitedBy;

        if (member.member && member.member.userId) {
          pending = window.ConversationController.getOrCreate(
            member.member.userId,
            'private',
            {
              profileKey: member.member.profileKey
                ? arrayBufferToBase64(member.member.profileKey)
                : undefined,
            }
          );
        } else {
          throw new Error('Pending member did not have an associated userId');
        }

        if (member.addedByUserId) {
          invitedBy = window.ConversationController.getOrCreate(
            member.addedByUserId,
            'private'
          );
        } else {
          throw new Error('Pending member did not have an addedByUserID');
        }

        return {
          addedByUserId: invitedBy.id,
          conversationId: pending.id,
          timestamp: member.timestamp,
        };
      }
    );
  }

  return result;
}

function isValidRole(role?: number): boolean {
  const MEMBER_ROLE_ENUM = window.textsecure.protobuf.Member.Role;

  return (
    role === MEMBER_ROLE_ENUM.ADMINISTRATOR || role === MEMBER_ROLE_ENUM.DEFAULT
  );
}

function isValidAccess(access?: number): boolean {
  const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;

  return access === ACCESS_ENUM.ADMINISTRATOR || access === ACCESS_ENUM.MEMBER;
}

function isValidProfileKey(buffer?: ArrayBuffer): boolean {
  return Boolean(buffer && buffer.byteLength === 32);
}

function hasData(data: ProtoBinaryType): boolean {
  return data && data.limit > 0;
}

function decryptGroupChange(
  _actions: GroupChangeClass.Actions,
  groupSecretParams: string,
  logId: string
): GroupChangeClass.Actions {
  const clientZkGroupCipher = getClientZkGroupCipher(groupSecretParams);
  const actions = _actions;

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
    (actions.addMembers || []).map(_addMember => {
      const addMember = _addMember;

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
    (actions.deleteMembers || []).map(_deleteMember => {
      const deleteMember = _deleteMember;

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
    (actions.modifyMemberRoles || []).map(_modifyMember => {
      const modifyMember = _modifyMember;

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
          'decryptGroupChange: modifyMemberRole had invalid role'
        );
      }

      return modifyMember;
    })
  );

  // modifyMemberProfileKeys?:
  // Array<GroupChangeClass.Actions.ModifyMemberProfileKeyAction>;
  actions.modifyMemberProfileKeys = compact(
    (actions.modifyMemberProfileKeys || []).map(_modifyMemberProfileKey => {
      const modifyMemberProfileKey = _modifyMemberProfileKey;

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

  // addPendingMembers?: Array<GroupChangeClass.Actions.AddPendingMemberAction>;
  actions.addPendingMembers = compact(
    (actions.addPendingMembers || []).map(_addPendingMember => {
      const addPendingMember = _addPendingMember;

      if (addPendingMember.added) {
        const decrypted = decryptPendingMember(
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

  // deletePendingMembers?: Array<GroupChangeClass.Actions.DeletePendingMemberAction>;
  actions.deletePendingMembers = compact(
    (actions.deletePendingMembers || []).map(_deletePendingMember => {
      const deletePendingMember = _deletePendingMember;

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

  // promotePendingMembers?: Array<GroupChangeClass.Actions.PromotePendingMemberAction>;
  actions.promotePendingMembers = compact(
    (actions.promotePendingMembers || []).map(_promotePendingMember => {
      const promotePendingMember = _promotePendingMember;

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
      'decryptGroupChange: modifyAttributesAccess.attributesAccess was not a valid role'
    );
  }

  // modifyMemberAccess?: GroupChangeClass.Actions.ModifyMembersAccessControlAction;
  if (
    actions.modifyMemberAccess &&
    !isValidAccess(actions.modifyMemberAccess.membersAccess)
  ) {
    throw new Error(
      'decryptGroupChange: modifyMemberAccess.membersAccess was not a valid role'
    );
  }

  return actions;
}

function decryptGroupState(
  _groupState: GroupClass,
  groupSecretParams: string,
  logId: string
): GroupClass {
  const clientZkGroupCipher = getClientZkGroupCipher(groupSecretParams);
  const groupState = _groupState;

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
  if (
    !groupState.accessControl ||
    !isValidAccess(groupState.accessControl.attributes)
  ) {
    throw new Error(
      'decryptGroupState: Access control for attributes is missing or invalid'
    );
  }
  if (
    !groupState.accessControl ||
    !isValidAccess(groupState.accessControl.members)
  ) {
    throw new Error(
      'decryptGroupState: Access control for members is missing or invalid'
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

  // pending members
  if (groupState.pendingMembers) {
    groupState.pendingMembers = compact(
      groupState.pendingMembers.map((member: PendingMemberClass) =>
        decryptPendingMember(clientZkGroupCipher, member, logId)
      )
    );
  }

  return groupState;
}

function decryptMember(
  clientZkGroupCipher: ClientZkGroupCipher,
  _member: MemberClass,
  logId: string
) {
  const member = _member;

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
    throw new Error('decryptMember: Member had invalid role');
  }

  return member;
}

function decryptPendingMember(
  clientZkGroupCipher: ClientZkGroupCipher,
  _member: PendingMemberClass,
  logId: string
) {
  const member = _member;

  // addedByUserId
  if (hasData(member.addedByUserId)) {
    try {
      member.addedByUserId = decryptUuid(
        clientZkGroupCipher,
        member.addedByUserId.toArrayBuffer()
      );
    } catch (error) {
      window.log.warn(
        `decryptPendingMember/${logId}: Unable to decrypt pending member addedByUserId. Dropping member.`,
        error && error.stack ? error.stack : error
      );
      return null;
    }

    window.normalizeUuids(
      member,
      ['addedByUserId'],
      'groups.decryptPendingMember'
    );

    if (!window.isValidGuid(member.addedByUserId)) {
      window.log.warn(
        `decryptPendingMember/${logId}: Dropping pending member due to invalid addedByUserId`
      );
      return null;
    }
  } else {
    throw new Error('decryptPendingMember: Member had missing addedByUserId');
  }

  // timestamp
  if (member.timestamp) {
    member.timestamp = member.timestamp.toNumber();

    const now = Date.now();
    if (!member.timestamp || member.timestamp > now) {
      member.timestamp = now;
    }
  }

  if (!member.member) {
    window.log.warn(
      `decryptPendingMember/${logId}: Dropping pending member due to missing member details`
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
        `decryptPendingMember/${logId}: Unable to decrypt pending member userId. Dropping member.`,
        error && error.stack ? error.stack : error
      );
      return null;
    }

    window.normalizeUuids(
      member.member,
      ['userId'],
      'groups.decryptPendingMember'
    );

    if (!window.isValidGuid(member.member.userId)) {
      window.log.warn(
        `decryptPendingMember/${logId}: Dropping pending member due to invalid member.userId`
      );

      return null;
    }
  } else {
    throw new Error('decryptPendingMember: Member had missing member.userId');
  }

  // profileKey
  if (hasData(profileKey)) {
    try {
      member.member.profileKey = decryptProfileKey(
        clientZkGroupCipher,
        profileKey.toArrayBuffer(),
        userId
      );
    } catch (error) {
      window.log.warn(
        `decryptPendingMember/${logId}: Unable to decrypt pending member profileKey. Dropping profileKey.`,
        error && error.stack ? error.stack : error
      );
      member.member.profileKey = null;
    }

    if (!isValidProfileKey(member.member.profileKey)) {
      window.log.warn(
        `decryptPendingMember/${logId}: Dropping profileKey, since it was invalid`
      );

      member.member.profileKey = null;
    }
  }

  // role
  if (!isValidRole(role)) {
    throw new Error('decryptPendingMember: Member had invalid role');
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
