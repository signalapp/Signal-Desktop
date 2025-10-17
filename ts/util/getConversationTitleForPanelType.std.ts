// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from '../types/Util.std.js';
import { createLogger } from '../logging/log.std.js';
import { PanelType } from '../types/Panels.std.js';

const log = createLogger('getConversationTitleForPanelType');

export function getConversationTitleForPanelType(
  i18n: LocalizerType,
  panelType: PanelType | undefined
): string | undefined {
  if (!panelType) {
    return undefined;
  }

  if (panelType === PanelType.AllMedia) {
    return i18n('icu:allMedia');
  }

  if (panelType === PanelType.ChatColorEditor) {
    return i18n('icu:ChatColorPicker__menu-title');
  }

  if (panelType === PanelType.ContactDetails) {
    return '';
  }

  if (panelType === PanelType.ConversationDetails) {
    return '';
  }

  if (panelType === PanelType.GroupInvites) {
    return i18n('icu:ConversationDetails--requests-and-invites');
  }

  if (panelType === PanelType.GroupLinkManagement) {
    return i18n('icu:ConversationDetails--group-link');
  }

  if (panelType === PanelType.GroupPermissions) {
    return i18n('icu:permissions');
  }

  if (panelType === PanelType.NotificationSettings) {
    return i18n('icu:ConversationDetails--notifications');
  }

  if (panelType === PanelType.StickerManager) {
    return '';
  }

  if (
    panelType === PanelType.GroupV1Members ||
    panelType === PanelType.MessageDetails
  ) {
    return undefined;
  }

  const unknownType: never = panelType;
  log.warn(`Got unexpected type ${unknownType}`);

  return undefined;
}
