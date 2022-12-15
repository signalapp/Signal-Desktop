// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import type { CompositionAreaPropsType } from './CompositionArea';
import type { OwnProps as ConversationHeaderPropsType } from './ConversationHeader';
import type { StateType } from '../reducer';
import type { ReactPanelRenderType } from '../../types/Panels';
import type { TimelinePropsType } from './Timeline';
import * as log from '../../logging/log';
import { ContactDetail } from '../../components/conversation/ContactDetail';
import { ConversationView } from '../../components/conversation/ConversationView';
import { PanelType } from '../../types/Panels';
import { SmartChatColorPicker } from './ChatColorPicker';
import { SmartCompositionArea } from './CompositionArea';
import { SmartConversationNotificationsSettings } from './ConversationNotificationsSettings';
import { SmartConversationHeader } from './ConversationHeader';
import { SmartGroupLinkManagement } from './GroupLinkManagement';
import { SmartGroupV2Permissions } from './GroupV2Permissions';
import { SmartGV1Members } from './GV1Members';
import { SmartPendingInvites } from './PendingInvites';
import { SmartStickerManager } from './StickerManager';
import { SmartTimeline } from './Timeline';
import { getIntl } from '../selectors/user';
import { getTopPanelRenderableByReact } from '../selectors/conversations';
import { startConversation } from '../../util/startConversation';
import { useComposerActions } from '../ducks/composer';

export type PropsType = {
  conversationId: string;
  compositionAreaProps: Pick<
    CompositionAreaPropsType,
    | 'id'
    | 'onCancelJoinRequest'
    | 'onClearAttachments'
    | 'onCloseLinkPreview'
    | 'onEditorStateChange'
    | 'onSelectMediaQuality'
    | 'onTextTooLong'
  >;
  conversationHeaderProps: ConversationHeaderPropsType;
  timelineProps: TimelinePropsType;
};

export function SmartConversationView({
  compositionAreaProps,
  conversationHeaderProps,
  conversationId,
  timelineProps,
}: PropsType): JSX.Element {
  const topPanel = useSelector<StateType, ReactPanelRenderType | undefined>(
    getTopPanelRenderableByReact
  );

  const { processAttachments } = useComposerActions();
  const i18n = useSelector(getIntl);

  return (
    <ConversationView
      conversationId={conversationId}
      processAttachments={processAttachments}
      renderCompositionArea={() => (
        <SmartCompositionArea {...compositionAreaProps} />
      )}
      renderConversationHeader={() => (
        <SmartConversationHeader {...conversationHeaderProps} />
      )}
      renderTimeline={() => <SmartTimeline {...timelineProps} />}
      renderPanel={() => {
        if (!topPanel) {
          return;
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
