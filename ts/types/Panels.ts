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

export type ReactPanelRenderType = { type: PanelType.ChatColorEditor };

export type BackbonePanelRenderType =
  | { type: PanelType.AllMedia }
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
  | { type: PanelType.MessageDetails; args: { messageId: string } }
  | { type: PanelType.NotificationSettings }
  | { type: PanelType.StickerManager };

export type PanelRenderType = ReactPanelRenderType | BackbonePanelRenderType;

export function isPanelHandledByReact(
  panel: PanelRenderType
): panel is ReactPanelRenderType {
  if (!panel) {
    return false;
  }

  return panel.type === PanelType.ChatColorEditor;
}
