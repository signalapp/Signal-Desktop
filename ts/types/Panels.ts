// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { EmbeddedContactType } from './EmbeddedContact';
import type { UUIDStringType } from './UUID';

export enum PanelType {
  AllMedia = 'AllMedia',
  ChatColorEditor = 'ChatColorEditor',
  ContactDetails = 'ContactDetails',
  ConversationDetails = 'ConversationDetails',
  GroupInvites = 'GroupInvites',
  GroupLinkManagement = 'GroupLinkManagement',
  GroupPermissions = 'GroupPermissions',
  GroupV1Members = 'GroupV1Members',
  MessageDetails = 'MessageDetails',
  NotificationSettings = 'NotificationSettings',
  StickerManager = 'StickerManager',
}

export type ReactPanelRenderType =
  | { type: PanelType.AllMedia }
  | { type: PanelType.ChatColorEditor }
  | {
      type: PanelType.ContactDetails;
      args: {
        contact: EmbeddedContactType;
        signalAccount?: {
          phoneNumber: string;
          uuid: UUIDStringType;
        };
      };
    }
  | { type: PanelType.ConversationDetails }
  | { type: PanelType.GroupInvites }
  | { type: PanelType.GroupLinkManagement }
  | { type: PanelType.GroupPermissions }
  | { type: PanelType.GroupV1Members }
  | { type: PanelType.NotificationSettings }
  | { type: PanelType.StickerManager };

export type BackbonePanelRenderType = {
  type: PanelType.MessageDetails;
  args: { messageId: string };
};

export type PanelRenderType = ReactPanelRenderType | BackbonePanelRenderType;

export function isPanelHandledByReact(
  panel: PanelRenderType
): panel is ReactPanelRenderType {
  if (!panel) {
    return false;
  }

  return (
    panel.type === PanelType.AllMedia ||
    panel.type === PanelType.ChatColorEditor ||
    panel.type === PanelType.ContactDetails ||
    panel.type === PanelType.ConversationDetails ||
    panel.type === PanelType.GroupInvites ||
    panel.type === PanelType.GroupLinkManagement ||
    panel.type === PanelType.GroupPermissions ||
    panel.type === PanelType.GroupV1Members ||
    panel.type === PanelType.NotificationSettings ||
    panel.type === PanelType.StickerManager
  );
}
