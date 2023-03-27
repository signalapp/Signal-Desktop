// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useRef } from 'react';
import { noop } from 'lodash';

import type { AttachmentType } from '../types/Attachment';
import type { LocalizerType } from '../types/Util';
import type { MessagePropsType } from '../state/selectors/message';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import { Message, TextDirection } from './conversation/Message';
import { Modal } from './Modal';
import { WidthBreakpoint } from './_util';
import { shouldNeverBeCalled } from '../util/shouldNeverBeCalled';
import { useTheme } from '../hooks/useTheme';

export type PropsType = {
  closeEditHistoryModal: () => unknown;
  editHistoryMessages: Array<MessagePropsType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  kickOffAttachmentDownload: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
  showLightbox: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
};

const MESSAGE_DEFAULT_PROPS = {
  canDeleteForEveryone: false,
  checkForAccount: shouldNeverBeCalled,
  clearSelectedMessage: shouldNeverBeCalled,
  clearTargetedMessage: shouldNeverBeCalled,
  containerWidthBreakpoint: WidthBreakpoint.Medium,
  doubleCheckMissingQuoteReference: shouldNeverBeCalled,
  interactionMode: 'mouse' as const,
  isBlocked: false,
  isMessageRequestAccepted: true,
  markAttachmentAsCorrupted: shouldNeverBeCalled,
  messageExpanded: shouldNeverBeCalled,
  onReplyToMessage: shouldNeverBeCalled,
  onToggleSelect: shouldNeverBeCalled,
  openGiftBadge: shouldNeverBeCalled,
  openLink: shouldNeverBeCalled,
  previews: [],
  pushPanelForConversation: shouldNeverBeCalled,
  renderAudioAttachment: () => <div />,
  renderingContext: 'EditHistoryMessagesModal',
  saveAttachment: shouldNeverBeCalled,
  scrollToQuotedMessage: shouldNeverBeCalled,
  shouldCollapseAbove: false,
  shouldCollapseBelow: false,
  shouldHideMetadata: true,
  showContactModal: shouldNeverBeCalled,
  showConversation: noop,
  showEditHistoryModal: shouldNeverBeCalled,
  showExpiredIncomingTapToViewToast: shouldNeverBeCalled,
  showExpiredOutgoingTapToViewToast: shouldNeverBeCalled,
  showLightboxForViewOnceMedia: shouldNeverBeCalled,
  startConversation: shouldNeverBeCalled,
  textDirection: TextDirection.Default,
  viewStory: shouldNeverBeCalled,
};

export function EditHistoryMessagesModal({
  closeEditHistoryModal,
  getPreferredBadge,
  editHistoryMessages,
  i18n,
  kickOffAttachmentDownload,
  showLightbox,
}: PropsType): JSX.Element {
  const containerElementRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();

  const closeAndShowLightbox = useCallback(
    (options: { attachment: AttachmentType; messageId: string }) => {
      closeEditHistoryModal();
      showLightbox(options);
    },
    [closeEditHistoryModal, showLightbox]
  );

  return (
    <Modal
      hasXButton
      i18n={i18n}
      modalName="EditHistoryMessagesModal"
      onClose={closeEditHistoryModal}
      title={i18n('icu:EditHistoryMessagesModal__title')}
    >
      <div ref={containerElementRef}>
        {editHistoryMessages.map(messageAttributes => (
          <Message
            {...MESSAGE_DEFAULT_PROPS}
            {...messageAttributes}
            containerElementRef={containerElementRef}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            key={messageAttributes.timestamp}
            kickOffAttachmentDownload={kickOffAttachmentDownload}
            showLightbox={closeAndShowLightbox}
            theme={theme}
          />
        ))}
      </div>
    </Modal>
  );
}
