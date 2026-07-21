// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { unlinkSync } from 'node:fs';
import { join, normalize } from 'node:path';

import z from 'zod';
import type { ReadonlyDeep } from 'type-fest';

import { jsonToObject, objectToJSON } from '../util.std.ts';
import { ID_LENGTH } from '../../types/groups.std.ts';
import {
  getAttachmentsPath,
  getAvatarsPath,
  getDraftPath,
} from '../../../app/attachments.node.ts';
import { isPathInside } from '../../util/isPathInside.node.ts';
import { toLogFormat } from '../../types/errors.std.ts';

import type { LoggerType } from '../../types/Logging.std.ts';
import type { WritableDB } from '../Interface.std.ts';
import type { AvatarColorType } from '../../types/Colors.std.ts';
import type { AvatarIconType } from '../../types/Avatar.std.ts';

export default function updateToSchemaVersion1740(
  db: WritableDB,
  logger: LoggerType,
  _startingVersion: number,
  { userDataPath }: { userDataPath: string }
): void {
  const updateConversationStmt = db.prepare(
    `
    UPDATE conversations SET
      json = $json,
      members = $members,
      name = $name
    WHERE id = $id;
    `
  );

  const attachmentsPath = getAttachmentsPath(userDataPath);
  const avatarsPath = getAvatarsPath(userDataPath);
  const draftPath = getDraftPath(userDataPath);

  const getAbsoluteAttachmentPath = createAbsolutePathGetter(attachmentsPath);
  const getAbsoluteAvatarPath = createAbsolutePathGetter(avatarsPath);
  const getAbsoluteDraftPath = createAbsolutePathGetter(draftPath);

  const cleanConversation = (convo: ConversationAttributesType) => {
    if (
      convo.type === 'group' &&
      isGroupV2(convo) &&
      convo.active_at == null &&
      convo.messagesDeleted &&
      (convo.left || convo.terminated)
    ) {
      const logId = `cleanConversation(${convo.id}/groupv2(${convo.groupId})`;
      logger.info(`${logId}: Cleaning...`);

      const draftAttachments =
        getExternalDraftFilesForConversation(convo).map(getAbsoluteDraftPath);
      draftAttachments.forEach((item, index) => {
        try {
          unlinkSync(item);
        } catch (error) {
          logger.error(
            `${logId}: Failed to deleft draft file at index ${index}`,
            toLogFormat(error)
          );
        }
      });

      const avatarAttachments = getExternalAvatarFilesForConversation(
        convo
      ).map(getAbsoluteAttachmentPath);
      avatarAttachments.forEach((item, index) => {
        try {
          unlinkSync(item);
        } catch (error) {
          logger.error(
            `${logId}: Failed to delete avatar file at index ${index}`,
            toLogFormat(error)
          );
        }
      });

      const avatarDraftAttachments = getExternalAvatarDraftsForConversation(
        convo
      ).map(getAbsoluteAvatarPath);
      avatarDraftAttachments.forEach((item, index) => {
        try {
          unlinkSync(item);
        } catch (error) {
          logger.error(
            `${logId}: Failed to delete avatar draft index ${index}`,
            toLogFormat(error)
          );
        }
      });

      const cleaned = {
        ...convo,
        ...GENERIC_CLEANUP_FIELDS,
        ...GROUP_CLEANUP_FIELDS,
      };

      let dbMembers: string | null;
      if (cleaned.membersV2) {
        dbMembers = cleaned.membersV2.map(item => item.aci).join(' ');
      } else if (cleaned.members) {
        dbMembers = cleaned.members.join(' ');
      } else {
        dbMembers = null;
      }

      updateConversationStmt.run({
        id: cleaned.id,
        json: objectToJSON(cleaned),
        members: dbMembers,
        name: cleaned.name ?? null,
      });
    }
  };

  const allConversations = db
    .prepare(
      `
    SELECT json
    FROM conversations
    ORDER BY id ASC;
    `,
      { pluck: true }
    )
    .all<string>()
    .map(json => jsonToObject<ConversationAttributesType>(json));

  logger.info(
    `About to iterate through ${allConversations.length} conversations`
  );

  for (const convo of allConversations) {
    cleanConversation(convo);
  }
}

function isGroupV2(convo: ConversationAttributesType): boolean {
  return Boolean(
    convo.groupVersion === 2 &&
    convo.groupId &&
    Buffer.from(convo.groupId, 'base64').byteLength === ID_LENGTH
  );
}

type OpaqueType = object;

// These types are copied so this migration doesn't change meaning over time

// Copied from conversationFilePaths.std.ts
function getExternalAvatarFilesForConversation(
  conversation: Pick<ConversationAttributesType, 'avatar' | 'profileAvatar'>
): Array<string> {
  const { avatar, profileAvatar } = conversation;
  const files: Array<string> = [];

  if (avatar && avatar.path) {
    files.push(avatar.path);
  }

  if (profileAvatar && profileAvatar.path) {
    files.push(profileAvatar.path);
  }

  return files;
}

function getExternalAvatarDraftsForConversation(
  conversation: Pick<ConversationAttributesType, 'avatars'>
): Array<string> {
  const { avatars } = conversation;
  const files: Array<string> = [];

  (avatars || []).forEach(item => {
    if (item.imagePath) {
      files.push(item.imagePath);
    }
  });

  return files;
}

function getExternalDraftFilesForConversation(
  conversation: Pick<ConversationAttributesType, 'draftAttachments'>
): Array<string> {
  const draftAttachments = conversation.draftAttachments || [];
  const files: Array<string> = [];

  (draftAttachments || []).forEach(attachment => {
    if (attachment.pending) {
      return;
    }

    const { path: file, screenshotPath } = attachment;
    if (file) {
      files.push(file);
    }

    if (screenshotPath) {
      files.push(screenshotPath);
    }
  });

  return files;
}

// Copied from attachments.preload.ts - exported only for testing!
export const createAbsolutePathGetter =
  (rootPath: string) =>
  (relativePath: string): string => {
    const absolutePath = join(rootPath, relativePath);
    const normalized = normalize(absolutePath);
    if (!isPathInside(normalized, rootPath)) {
      throw new Error('Invalid relative path');
    }
    return normalized;
  };

// Copied from Mime.std.ts
export const MIMETypeSchema = z.string().brand('mimeType');
export type MIMEType = z.infer<typeof MIMETypeSchema>;

// Copied from Attachment.std.ts
export type AddressableAttachmentType = Readonly<{
  version?: 1 | 2;
  path: string;
  localKey?: string;
  size?: number;
  contentType: MIMEType;

  // In-memory data, for outgoing attachments that are not saved to disk.
  data?: Uint8Array<ArrayBuffer>;
}>;

// Copied from Avatar.std.ts
export type ContactAvatarType =
  | ({
      // Downloaded avatar
      path: string;
      url?: string;
      hash?: string;
    } & Partial<AddressableAttachmentType>)
  | {
      // Not-yet downloaded avatar
      path?: undefined;
      url: string;
      hash?: string;
    };

export type AvatarDataType = {
  id: number | string;
  buffer?: Uint8Array<ArrayBuffer>;
  color?: AvatarColorType;
  icon?: AvatarIconType;
  text?: string;
  imagePath?: string;

  // LocalAttachmentV2Type compatibility (except for `path` being `imagePath`)
  version?: 2;
  localKey?: string;
  size?: number;
};

// Copied from model-types.d.ts, most complex types replaced with OpaqueType
export type GroupV2MemberType = {
  aci: string;
  role: OpaqueType;
  joinedAtVersion: number;
  labelString?: string;
  labelEmoji?: OpaqueType;

  // Note that these are temporary flags, generated by applyGroupChange, but eliminated
  //   by applyGroupState. They are used to make our diff-generation more intelligent but
  //   not after that.
  joinedFromLink?: boolean;
  approvedByAdmin?: boolean;
};

export type ConversationAttributesType = {
  accessKey?: string | null;
  addedBy?: string;
  badges?: Array<
    | { id: string }
    | {
        id: string;
        expiresAt: number;
        isVisible: boolean;
      }
  >;
  capabilities?: OpaqueType;
  color?: string;
  // If present - the numeric value of `color` (possibly not yet supported) that
  // we got the from primary during either backup or storage service import.
  colorFromPrimary?: number;
  conversationColor?: OpaqueType;
  customColor?: OpaqueType;
  customColorId?: string;

  // Set at backup import time, exported as is.
  wallpaperPhotoPointerBase64?: string;
  wallpaperPreset?: number;
  dimWallpaperInDarkMode?: boolean;
  autoBubbleColor?: boolean;

  discoveredUnregisteredAt?: number;
  firstUnregisteredAt?: number;
  draftChanged?: boolean;
  draftAttachments?: ReadonlyArray<
    OpaqueType & { path?: string; pending?: boolean; screenshotPath?: string }
  >;
  draftBodyRanges?: OpaqueType;
  draftIsViewOnce?: boolean;
  draftTimestamp?: number | null;
  hideStory?: boolean;
  inbox_position?: number;
  // When contact is removed - it is initially placed into `justNotification`
  // removal stage. In this stage user can still send messages (which will
  // set `removalStage` to `undefined`), but if a new incoming message arrives -
  // the stage will progress to `messageRequest` and composition area will be
  // replaced with a message request.
  removalStage?: 'justNotification' | 'messageRequest';
  isPinned?: boolean;
  lastMessageDeletedForEveryone?: boolean;
  lastMessageDeletedForEveryoneByAdminAci?: OpaqueType;
  lastMessageAuthorAci?: OpaqueType | null;
  lastMessage?: string | null;
  lastMessageBodyRanges?: ReadonlyArray<OpaqueType>;
  lastMessagePrefix?: OpaqueType;
  /** @deprecated Use lastMessageAuthorAci instead */
  lastMessageAuthor?: string | null;
  lastMessageStatus?: OpaqueType | null;
  lastMessageReceivedAt?: number;
  lastMessageReceivedAtMs?: number;
  markedUnread?: boolean;
  messageCount?: number;
  messageCountBeforeMessageRequests?: number | null;
  messageRequestResponseType?: number;
  messagesDeleted?: boolean;
  muteExpiresAt?: number;
  dontNotifyForMentionsIfMuted?: boolean;
  sharingPhoneNumber?: boolean;
  profileAvatar?: ContactAvatarType | null;
  profileKeyCredential?: string | null;
  profileKeyCredentialExpiration?: number | null;
  lastProfile?: OpaqueType;
  needsTitleTransition?: boolean;
  quotedMessageId?: string | null;
  /**
   * TODO: Rename this key to be specific to the accessKey on the conversation
   * It's not used for group endorsements.
   */
  sealedSender?: OpaqueType;
  sentMessageCount?: number;
  voiceNotePlaybackRate?: number;

  id: string;
  type: 'private' | 'group';
  timestamp?: number | null;

  // Shared fields
  active_at?: number | null;
  draft?: string | null;
  draftEditMessage?: OpaqueType;
  hasPostedStory?: boolean;
  isArchived?: boolean;
  isReported?: boolean;
  name?: string;
  systemGivenName?: string;
  systemFamilyName?: string;
  systemNickname?: string;
  nicknameGivenName?: string | null;
  nicknameFamilyName?: string | null;
  note?: string | null;
  needsStorageServiceSync?: boolean;
  needsVerification?: boolean;
  profileSharing?: boolean;
  storageID?: string;
  storageVersion?: number;
  storageUnknownFields?: string;
  unreadCount?: number;
  unreadMentionsCount?: number;
  version: number;

  // Private core info
  serviceId?: OpaqueType;
  pni?: OpaqueType;
  pniSignatureVerified?: boolean;
  e164?: string;

  // Private other fields
  about?: string;
  aboutEmoji?: OpaqueType;
  profileFamilyName?: string;
  profileKey?: string;
  profileName?: string;
  verified?: number;
  profileLastUpdatedAt?: number;
  profileLastFetchedAt?: number;
  pendingUniversalTimer?: string;
  pendingRemovedContactNotification?: string;
  username?: string;
  shareMyPhoneNumber?: boolean;
  previousIdentityKey?: string;
  reportingToken?: string;

  // Group-only
  groupId?: string;
  // A shorthand, representing whether the user is part of the group. Not strictly for
  //   when the user manually left the group. But historically, that was the only way
  //   to leave a group.
  left?: boolean;
  groupVersion?: number;
  storySendMode?: OpaqueType;
  groupVerifiedNameHash?: string;

  // GroupV1 only
  members?: Array<string>;
  derivedGroupV2Id?: string;

  // GroupV2 core info
  masterKey?: string;
  secretParams?: string;
  publicParams?: string;
  revision?: number;
  senderKeyInfo?: OpaqueType;
  needsGroupUpdate?: boolean; // `true` only for groups we learned about through
  // an incoming message. Reset when we update the
  // group or fail.

  // GroupV2 other fields
  accessControl?: OpaqueType;
  announcementsOnly?: boolean;
  terminated?: boolean;
  avatar?: ContactAvatarType | null;
  avatars?: ReadonlyArray<Readonly<AvatarDataType>>;
  description?: string;
  expireTimer?: OpaqueType;
  expireTimerVersion: number;
  membersV2?: Array<GroupV2MemberType>;
  pendingMembersV2?: Array<OpaqueType>;
  pendingAdminApprovalV2?: Array<OpaqueType>;
  bannedMembersV2?: Array<OpaqueType>;
  groupInviteLinkPassword?: string;
  previousGroupV1Id?: string;
  previousGroupV1Members?: Array<string>;
  acknowledgedGroupNameCollisions?: ReadonlyDeep<OpaqueType>;

  // Used only when user is waiting for approval to join via link
  isTemporary?: boolean;
  temporaryMemberCount?: number;

  // Legacy field, mapped to above in getConversation()
  unblurredAvatarPath?: string;

  // remoteAvatarUrl
  remoteAvatarUrl?: string;

  // Only used during backup integration tests. After import, our data model merges
  // Contact and Chat frames from a backup, and we will then by default export both, even
  // if the Chat frame was not imported. That's fine in normal usage, but breaks
  // integration tests that aren't expecting to see a Chat frame on export that was not
  // there on import.
  test_chatFrameImportedFromBackup?: boolean;
};

// Copied from cleanup.preload.ts
const GENERIC_CLEANUP_FIELDS: Partial<ConversationAttributesType> = {
  draftChanged: undefined,
  draftAttachments: undefined,
  draftBodyRanges: undefined,
  draftIsViewOnce: undefined,
  draftTimestamp: undefined,

  inbox_position: undefined,

  lastMessageDeletedForEveryone: undefined,
  lastMessageDeletedForEveryoneByAdminAci: undefined,
  lastMessageAuthorAci: undefined,
  lastMessage: undefined,
  lastMessageBodyRanges: undefined,
  lastMessagePrefix: undefined,
  lastMessageAuthor: undefined,
  lastMessageStatus: undefined,
  lastMessageReceivedAt: undefined,
  lastMessageReceivedAtMs: undefined,

  markedUnread: undefined,
  messageCount: undefined,
  messageCountBeforeMessageRequests: undefined,
  messageRequestResponseType: undefined,

  messagesDeleted: true,

  quotedMessageId: undefined,

  sentMessageCount: undefined,

  timestamp: undefined,
  unreadCount: undefined,
  unreadMentionsCount: undefined,

  active_at: undefined,
  draft: undefined,
  draftEditMessage: undefined,

  isArchived: undefined,

  pendingUniversalTimer: undefined,
};

const GROUP_CLEANUP_FIELDS: Partial<ConversationAttributesType> = {
  addedBy: undefined,

  color: undefined,
  colorFromPrimary: undefined,
  conversationColor: undefined,
  customColor: undefined,
  customColorId: undefined,

  wallpaperPhotoPointerBase64: undefined,
  wallpaperPreset: undefined,
  dimWallpaperInDarkMode: undefined,
  autoBubbleColor: undefined,

  hideStory: undefined,

  isReported: undefined,
  name: undefined,

  profileSharing: undefined,

  pendingUniversalTimer: undefined,
  pendingRemovedContactNotification: undefined,
  reportingToken: undefined,

  left: undefined,
  storySendMode: undefined,
  groupVerifiedNameHash: undefined,

  members: undefined,
  derivedGroupV2Id: undefined,

  secretParams: undefined,
  publicParams: undefined,
  revision: undefined,
  senderKeyInfo: undefined,

  accessControl: undefined,
  announcementsOnly: undefined,
  terminated: undefined,
  avatar: undefined,
  avatars: undefined,
  description: undefined,
  expireTimer: undefined,
  expireTimerVersion: 1,
  membersV2: undefined,
  pendingMembersV2: undefined,
  pendingAdminApprovalV2: undefined,
  bannedMembersV2: undefined,
  groupInviteLinkPassword: undefined,
  previousGroupV1Id: undefined,
  previousGroupV1Members: undefined,
  acknowledgedGroupNameCollisions: undefined,

  isTemporary: undefined,
  temporaryMemberCount: undefined,

  unblurredAvatarPath: undefined,

  remoteAvatarUrl: undefined,
};
