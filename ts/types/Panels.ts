// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { EmbeddedContactType } from './EmbeddedContact';
import type { MessageAttributesType } from '../model-types.d';
import type { ServiceIdString } from './ServiceId';

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

export type PanelRequestType =
  | { type: PanelType.AllMedia }
  | { type: PanelType.ChatColorEditor }
  | {
      type: PanelType.ContactDetails;
      args: {
        contact: EmbeddedContactType;
        signalAccount?: {
          phoneNumber: string;
          serviceId: ServiceIdString;
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

export type PanelRenderType =
  | { type: PanelType.AllMedia }
  | { type: PanelType.ChatColorEditor }
  | {
      type: PanelType.ContactDetails;
      args: {
        contact: EmbeddedContactType;
        signalAccount?: {
          phoneNumber: string;
          serviceId: ServiceIdString;
        };
      };
    }
  | { type: PanelType.ConversationDetails }
  | { type: PanelType.GroupInvites }
  | { type: PanelType.GroupLinkManagement }
  | { type: PanelType.GroupPermissions }
  | { type: PanelType.GroupV1Members }
  | { type: PanelType.MessageDetails; args: { message: MessageAttributesType } }
  | { type: PanelType.NotificationSettings }
  | { type: PanelType.StickerManager };
