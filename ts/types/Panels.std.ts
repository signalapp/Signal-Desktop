// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

export enum PanelType {
  AllMedia = 'AllMedia',
  ChatColorEditor = 'ChatColorEditor',
  ContactDetails = 'ContactDetails',
  ConversationDetails = 'ConversationDetails',
  GroupInvites = 'GroupInvites',
  GroupLinkManagement = 'GroupLinkManagement',
  GroupPermissions = 'GroupPermissions',
  GroupV1Members = 'GroupV1Members',
  GroupMemberLabelEditor = 'GroupMemberLabelEditor',
  MessageDetails = 'MessageDetails',
  NotificationSettings = 'NotificationSettings',
  PinnedMessages = 'PinnedMessages',
  StickerManager = 'StickerManager',
}

type PanelsWithArgs = ReadonlyDeep<
  | { type: PanelType.ContactDetails; args: { messageId: string } }
  | { type: PanelType.MessageDetails; args: { messageId: string } }
>;

type PanelsWithoutArgs = Readonly<{
  type: Exclude<PanelType, PanelsWithArgs['type']>;
  // To catch mistakes if args are accientally provided
  args?: never;
}>;

export type PanelArgsType = PanelsWithArgs | PanelsWithoutArgs;
