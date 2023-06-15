// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useMemo, useRef } from 'react';
import classNames from 'classnames';
import { useSelector } from 'react-redux';
import type { PanelRenderType } from '../../types/Panels';
import type { StateType } from '../reducer';
import * as log from '../../logging/log';
import { ContactDetail } from '../../components/conversation/ContactDetail';
import { PanelType } from '../../types/Panels';
import { SmartAllMedia } from './AllMedia';
import { SmartChatColorPicker } from './ChatColorPicker';
import { SmartConversationDetails } from './ConversationDetails';
import { SmartConversationNotificationsSettings } from './ConversationNotificationsSettings';
import { SmartGV1Members } from './GV1Members';
import { SmartGroupLinkManagement } from './GroupLinkManagement';
import { SmartGroupV2Permissions } from './GroupV2Permissions';
import { SmartMessageDetail } from './MessageDetail';
import { SmartPendingInvites } from './PendingInvites';
import { SmartStickerManager } from './StickerManager';
import { getIntl } from '../selectors/user';
import { getTopPanel } from '../selectors/conversations';
import { useConversationsActions } from '../ducks/conversations';
import { focusableSelectors } from '../../util/focusableSelectors';

export function ConversationPanel({
  conversationId,
}: {
  conversationId: string;
}): JSX.Element | null {
  const i18n = useSelector(getIntl);
  const { startConversation } = useConversationsActions();
  const topPanel = useSelector<StateType, PanelRenderType | undefined>(
    getTopPanel
  );

  const selectors = useMemo(() => focusableSelectors.join(','), []);
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const panelNode = panelRef.current;
    if (!panelNode) {
      return;
    }

    const elements = panelNode.querySelectorAll<HTMLElement>(selectors);
    if (!elements.length) {
      return;
    }
    elements[0]?.focus();
  }, [selectors, topPanel]);

  if (!topPanel) {
    return null;
  }

  let panelChild: JSX.Element;
  let panelClassName = '';

  if (topPanel.type === PanelType.AllMedia) {
    panelChild = <SmartAllMedia conversationId={conversationId} />;
  } else if (topPanel.type === PanelType.ChatColorEditor) {
    panelChild = <SmartChatColorPicker conversationId={conversationId} />;
  } else if (topPanel.type === PanelType.ContactDetails) {
    const { contact, signalAccount } = topPanel.args;

    panelChild = (
      <ContactDetail
        contact={contact}
        hasSignalAccount={Boolean(signalAccount)}
        i18n={i18n}
        onSendMessage={() => {
          if (signalAccount) {
            startConversation(signalAccount.phoneNumber, signalAccount.uuid);
          }
        }}
      />
    );
  } else if (topPanel.type === PanelType.ConversationDetails) {
    panelClassName = 'conversation-details-pane';
    panelChild = <SmartConversationDetails conversationId={conversationId} />;
  } else if (topPanel.type === PanelType.GroupInvites) {
    panelChild = (
      <SmartPendingInvites
        conversationId={conversationId}
        ourUuid={window.storage.user.getCheckedUuid().toString()}
      />
    );
  } else if (topPanel.type === PanelType.GroupLinkManagement) {
    panelChild = <SmartGroupLinkManagement conversationId={conversationId} />;
  } else if (topPanel.type === PanelType.GroupPermissions) {
    panelChild = <SmartGroupV2Permissions conversationId={conversationId} />;
  } else if (topPanel.type === PanelType.GroupV1Members) {
    panelClassName = 'group-member-list';
    panelChild = <SmartGV1Members conversationId={conversationId} />;
  } else if (topPanel.type === PanelType.MessageDetails) {
    panelClassName = 'message-detail-wrapper';
    panelChild = <SmartMessageDetail />;
  } else if (topPanel.type === PanelType.NotificationSettings) {
    panelChild = (
      <SmartConversationNotificationsSettings conversationId={conversationId} />
    );
  } else if (topPanel.type === PanelType.StickerManager) {
    panelClassName = 'sticker-manager-wrapper';
    panelChild = <SmartStickerManager />;
  } else {
    log.warn('renderPanel: Got unexpected panel', topPanel);
    return null;
  }

  return (
    <div className={classNames('panel', panelClassName)} ref={panelRef}>
      {panelChild}
    </div>
  );
}
