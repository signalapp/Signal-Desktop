// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import type { PanelRenderType } from '../../types/Panels';
import type { StateType } from '../reducer';
import * as log from '../../logging/log';
import { ContactDetail } from '../../components/conversation/ContactDetail';
import { ConversationView } from '../../components/conversation/ConversationView';
import { PanelType } from '../../types/Panels';
import { SmartAllMedia } from './AllMedia';
import { SmartChatColorPicker } from './ChatColorPicker';
import { SmartCompositionArea } from './CompositionArea';
import { SmartConversationDetails } from './ConversationDetails';
import { SmartConversationHeader } from './ConversationHeader';
import { SmartConversationNotificationsSettings } from './ConversationNotificationsSettings';
import { SmartGV1Members } from './GV1Members';
import { SmartGroupLinkManagement } from './GroupLinkManagement';
import { SmartGroupV2Permissions } from './GroupV2Permissions';
import { SmartMessageDetail } from './MessageDetail';
import { SmartPendingInvites } from './PendingInvites';
import { SmartStickerManager } from './StickerManager';
import { SmartTimeline } from './Timeline';
import { getIntl } from '../selectors/user';
import {
  getSelectedConversationId,
  getSelectedMessageIds,
  getTopPanel,
} from '../selectors/conversations';
import { useComposerActions } from '../ducks/composer';
import { useConversationsActions } from '../ducks/conversations';

export function SmartConversationView(): JSX.Element {
  const conversationId = useSelector(getSelectedConversationId);

  if (!conversationId) {
    throw new Error('SmartConversationView: No selected conversation');
  }

  const topPanel = useSelector<StateType, PanelRenderType | undefined>(
    getTopPanel
  );
  const { startConversation, toggleSelectMode } = useConversationsActions();
  const selectedMessageIds = useSelector(getSelectedMessageIds);
  const isSelectMode = selectedMessageIds != null;

  const { processAttachments } = useComposerActions();
  const i18n = useSelector(getIntl);

  const hasOpenModal = useSelector((state: StateType) => {
    return (
      state.globalModals.forwardMessagesProps != null ||
      state.globalModals.deleteMessagesProps != null ||
      state.globalModals.hasConfirmationModal
    );
  });

  return (
    <ConversationView
      conversationId={conversationId}
      hasOpenModal={hasOpenModal}
      isSelectMode={isSelectMode}
      onExitSelectMode={() => {
        toggleSelectMode(false);
      }}
      processAttachments={processAttachments}
      renderCompositionArea={() => <SmartCompositionArea id={conversationId} />}
      renderConversationHeader={() => (
        <SmartConversationHeader id={conversationId} />
      )}
      renderTimeline={() => (
        <SmartTimeline key={conversationId} id={conversationId} />
      )}
      renderPanel={() => {
        if (!topPanel) {
          return;
        }

        if (topPanel.type === PanelType.AllMedia) {
          return (
            <div className="panel">
              <SmartAllMedia conversationId={conversationId} />
            </div>
          );
        }

        if (topPanel.type === PanelType.ChatColorEditor) {
          return (
            <div className="panel">
              <SmartChatColorPicker conversationId={conversationId} />
            </div>
          );
        }

        if (topPanel.type === PanelType.ContactDetails) {
          const { contact, signalAccount } = topPanel.args;

          return (
            <div className="panel">
              <ContactDetail
                contact={contact}
                hasSignalAccount={Boolean(signalAccount)}
                i18n={i18n}
                onSendMessage={() => {
                  if (signalAccount) {
                    startConversation(
                      signalAccount.phoneNumber,
                      signalAccount.uuid
                    );
                  }
                }}
              />
            </div>
          );
        }

        if (topPanel.type === PanelType.ConversationDetails) {
          return (
            <div className="panel conversation-details-pane">
              <SmartConversationDetails conversationId={conversationId} />
            </div>
          );
        }

        if (topPanel.type === PanelType.GroupInvites) {
          return (
            <div className="panel">
              <SmartPendingInvites
                conversationId={conversationId}
                ourUuid={window.storage.user.getCheckedUuid().toString()}
              />
            </div>
          );
        }

        if (topPanel.type === PanelType.GroupLinkManagement) {
          return (
            <div className="panel">
              <SmartGroupLinkManagement conversationId={conversationId} />
            </div>
          );
        }

        if (topPanel.type === PanelType.GroupPermissions) {
          return (
            <div className="panel">
              <SmartGroupV2Permissions conversationId={conversationId} />
            </div>
          );
        }

        if (topPanel.type === PanelType.GroupV1Members) {
          return (
            <div className="group-member-list panel">
              <SmartGV1Members conversationId={conversationId} />
            </div>
          );
        }

        if (topPanel.type === PanelType.MessageDetails) {
          return (
            <div className="panel message-detail-wrapper">
              <SmartMessageDetail />
            </div>
          );
        }

        if (topPanel.type === PanelType.NotificationSettings) {
          return (
            <div className="panel">
              <SmartConversationNotificationsSettings
                conversationId={conversationId}
              />
            </div>
          );
        }

        if (topPanel.type === PanelType.StickerManager) {
          return (
            <div className="panel sticker-manager-wrapper">
              <SmartStickerManager />
            </div>
          );
        }

        log.warn('renderPanel: Got unexpected panel', topPanel);

        return undefined;
      }}
    />
  );
}
