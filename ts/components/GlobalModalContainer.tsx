// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type {
  ContactModalStateType,
  DeleteMessagesPropsType,
  EditHistoryMessagesType,
  EditNicknameAndNoteModalPropsType,
  ForwardMessagesPropsType,
  MessageRequestActionsConfirmationPropsType,
  SafetyNumberChangedBlockingDataType,
  UserNotFoundModalStateType,
} from '../state/ducks/globalModals';
import type { LocalizerType, ThemeType } from '../types/Util';
import { UsernameOnboardingState } from '../types/globalModals';
import { missingCaseError } from '../util/missingCaseError';

import { ButtonVariant } from './Button';
import { ConfirmationDialog } from './ConfirmationDialog';
import { SignalConnectionsModal } from './SignalConnectionsModal';
import { WhatsNewModal } from './WhatsNewModal';
import type { StartCallData } from './ConfirmLeaveCallModal';
import type { AttachmentNotAvailableModalType } from './AttachmentNotAvailableModal';

// NOTE: All types should be required for this component so that the smart
// component gives you type errors when adding/removing props.
export type PropsType = {
  i18n: LocalizerType;
  theme: ThemeType;
  // AddUserToAnotherGroupModal
  addUserToAnotherGroupModalContactId: string | undefined;
  renderAddUserToAnotherGroup: () => JSX.Element;
  // AttachmentNotAvailableModal
  attachmentNotAvailableModalType: AttachmentNotAvailableModalType | undefined;
  renderAttachmentNotAvailableModal: () => JSX.Element;
  // CallLinkAddNameModal
  callLinkAddNameModalRoomId: string | null;
  renderCallLinkAddNameModal: () => JSX.Element;
  // CallLinkEditModal
  callLinkEditModalRoomId: string | null;
  renderCallLinkEditModal: () => JSX.Element;
  // CallLinkPendingParticipantModal
  callLinkPendingParticipantContactId: string | undefined;
  renderCallLinkPendingParticipantModal: () => JSX.Element;
  // ConfirmLeaveCallModal
  confirmLeaveCallModalState: StartCallData | null;
  renderConfirmLeaveCallModal: () => JSX.Element;
  // ContactModal
  contactModalState: ContactModalStateType | undefined;
  renderContactModal: () => JSX.Element;
  // EditHistoryMessagesModal
  editHistoryMessages: EditHistoryMessagesType | undefined;
  renderEditHistoryMessagesModal: () => JSX.Element;
  // EditNicknameAndNoteModal
  editNicknameAndNoteModalProps: EditNicknameAndNoteModalPropsType | null;
  renderEditNicknameAndNoteModal: () => JSX.Element;
  // ErrorModal
  errorModalProps:
    | {
        buttonVariant?: ButtonVariant;
        description?: string;
        title?: string | null;
      }
    | undefined;
  renderErrorModal: (opts: {
    buttonVariant?: ButtonVariant;
    description?: string;
    title?: string | null;
  }) => JSX.Element;
  // DeleteMessageModal
  deleteMessagesProps: DeleteMessagesPropsType | undefined;
  renderDeleteMessagesModal: () => JSX.Element;
  // ForwardMessageModal
  forwardMessagesProps: ForwardMessagesPropsType | undefined;
  renderForwardMessagesModal: () => JSX.Element;
  // MessageRequestActionsConfirmation
  messageRequestActionsConfirmationProps: MessageRequestActionsConfirmationPropsType | null;
  renderMessageRequestActionsConfirmation: () => JSX.Element;
  // NotePreviewModal
  notePreviewModalProps: { conversationId: string } | null;
  renderNotePreviewModal: () => JSX.Element;
  // ProfileEditor
  isProfileEditorVisible: boolean;
  renderProfileEditor: () => JSX.Element;
  // SafetyNumberModal
  safetyNumberModalContactId: string | undefined;
  renderSafetyNumber: () => JSX.Element;
  // ShortcutGuideModal
  isShortcutGuideModalVisible: boolean;
  renderShortcutGuideModal: () => JSX.Element;
  // SignalConnectionsModal
  isSignalConnectionsVisible: boolean;
  toggleSignalConnectionsModal: () => unknown;
  // AboutContactModal
  isAboutContactModalVisible: boolean;
  renderAboutContactModal: () => JSX.Element | null;
  // StickerPackPreviewModal
  stickerPackPreviewId: string | undefined;
  renderStickerPreviewModal: () => JSX.Element | null;
  // StoriesSettings
  isStoriesSettingsVisible: boolean;
  renderStoriesSettings: () => JSX.Element;
  // SendAnywayDialog
  hasSafetyNumberChangeModal: boolean;
  safetyNumberChangedBlockingData:
    | SafetyNumberChangedBlockingDataType
    | undefined;
  renderSendAnywayDialog: () => JSX.Element;
  // UserNotFoundModal
  hideUserNotFoundModal: () => unknown;
  userNotFoundModalState: UserNotFoundModalStateType | undefined;
  // WhatsNewModal
  isWhatsNewVisible: boolean;
  hideWhatsNewModal: () => unknown;
  // UsernameOnboarding
  usernameOnboardingState: UsernameOnboardingState;
  renderUsernameOnboarding: () => JSX.Element;
};

export function GlobalModalContainer({
  i18n,
  // AttachmentNotAvailableModal
  attachmentNotAvailableModalType,
  renderAttachmentNotAvailableModal,
  // AddUserToAnotherGroupModal
  addUserToAnotherGroupModalContactId,
  renderAddUserToAnotherGroup,
  // CallLinkAddNameModal
  callLinkAddNameModalRoomId,
  renderCallLinkAddNameModal,
  // CallLinkEditModal
  callLinkEditModalRoomId,
  renderCallLinkEditModal,
  // CallLinkPendingParticipantModal
  callLinkPendingParticipantContactId,
  renderCallLinkPendingParticipantModal,
  // ConfirmLeaveCallModal
  confirmLeaveCallModalState,
  renderConfirmLeaveCallModal,
  // ContactModal
  contactModalState,
  renderContactModal,
  // EditHistoryMessages
  editHistoryMessages,
  renderEditHistoryMessagesModal,
  // EditNicknameAndNoteModal
  editNicknameAndNoteModalProps,
  renderEditNicknameAndNoteModal,
  // ErrorModal
  errorModalProps,
  renderErrorModal,
  // DeleteMessageModal
  deleteMessagesProps,
  renderDeleteMessagesModal,
  // ForwardMessageModal
  forwardMessagesProps,
  renderForwardMessagesModal,
  // MessageRequestActionsConfirmation
  messageRequestActionsConfirmationProps,
  renderMessageRequestActionsConfirmation,
  // NotePreviewModal
  notePreviewModalProps,
  renderNotePreviewModal,
  // ProfileEditor
  isProfileEditorVisible,
  renderProfileEditor,
  // SafetyNumberModal
  safetyNumberModalContactId,
  renderSafetyNumber,
  // ShortcutGuideModal
  isShortcutGuideModalVisible,
  renderShortcutGuideModal,
  // SignalConnectionsModal
  isSignalConnectionsVisible,
  toggleSignalConnectionsModal,
  // AboutContactModal
  isAboutContactModalVisible,
  renderAboutContactModal,
  // StickerPackPreviewModal
  stickerPackPreviewId,
  renderStickerPreviewModal,
  // StoriesSettings
  isStoriesSettingsVisible,
  renderStoriesSettings,
  // SendAnywayDialog
  hasSafetyNumberChangeModal,
  safetyNumberChangedBlockingData,
  renderSendAnywayDialog,
  // UserNotFoundModal
  hideUserNotFoundModal,
  userNotFoundModalState,
  // WhatsNewModal
  hideWhatsNewModal,
  isWhatsNewVisible,
  // UsernameOnboarding
  usernameOnboardingState,
  renderUsernameOnboarding,
}: PropsType): JSX.Element | null {
  // We want the following dialogs to show in this order:
  // 1. Errors
  // 2. Safety Number Changes
  // 3. Forward Modal, so other modals can open it
  // 4. The Rest (in no particular order, but they're ordered alphabetically)

  // Errors
  if (errorModalProps) {
    return renderErrorModal(errorModalProps);
  }

  // Safety Number
  if (hasSafetyNumberChangeModal || safetyNumberChangedBlockingData) {
    return renderSendAnywayDialog();
  }

  // Forward Modal
  if (forwardMessagesProps) {
    return renderForwardMessagesModal();
  }

  // The Rest

  if (confirmLeaveCallModalState) {
    return renderConfirmLeaveCallModal();
  }

  if (addUserToAnotherGroupModalContactId) {
    return renderAddUserToAnotherGroup();
  }

  if (callLinkAddNameModalRoomId) {
    return renderCallLinkAddNameModal();
  }

  if (callLinkEditModalRoomId) {
    return renderCallLinkEditModal();
  }

  if (editHistoryMessages) {
    return renderEditHistoryMessagesModal();
  }

  if (editNicknameAndNoteModalProps) {
    return renderEditNicknameAndNoteModal();
  }

  if (deleteMessagesProps) {
    return renderDeleteMessagesModal();
  }

  if (messageRequestActionsConfirmationProps) {
    return renderMessageRequestActionsConfirmation();
  }

  if (notePreviewModalProps) {
    return renderNotePreviewModal();
  }

  if (isProfileEditorVisible) {
    return renderProfileEditor();
  }

  if (isShortcutGuideModalVisible) {
    return renderShortcutGuideModal();
  }

  if (isSignalConnectionsVisible) {
    return (
      <SignalConnectionsModal
        i18n={i18n}
        onClose={toggleSignalConnectionsModal}
      />
    );
  }

  if (safetyNumberModalContactId) {
    return renderSafetyNumber();
  }

  if (isAboutContactModalVisible) {
    return renderAboutContactModal();
  }

  if (contactModalState) {
    return renderContactModal();
  }

  // This needs to be after the about contact modal because the pending participant modal
  // opens the about contact modal
  if (callLinkPendingParticipantContactId) {
    return renderCallLinkPendingParticipantModal();
  }

  if (isStoriesSettingsVisible) {
    return renderStoriesSettings();
  }

  if (isWhatsNewVisible) {
    return <WhatsNewModal hideWhatsNewModal={hideWhatsNewModal} i18n={i18n} />;
  }

  if (usernameOnboardingState === UsernameOnboardingState.Open) {
    return renderUsernameOnboarding();
  }

  if (stickerPackPreviewId) {
    return renderStickerPreviewModal();
  }

  if (userNotFoundModalState) {
    let content: string;
    if (userNotFoundModalState.type === 'phoneNumber') {
      content = i18n('icu:startConversation--phone-number-not-found', {
        phoneNumber: userNotFoundModalState.phoneNumber,
      });
    } else if (userNotFoundModalState.type === 'username') {
      content = i18n('icu:startConversation--username-not-found', {
        atUsername: userNotFoundModalState.username,
      });
    } else {
      throw missingCaseError(userNotFoundModalState);
    }

    return (
      <ConfirmationDialog
        dialogName="GlobalModalContainer.userNotFound"
        cancelText={i18n('icu:ok')}
        cancelButtonVariant={ButtonVariant.Secondary}
        i18n={i18n}
        onClose={hideUserNotFoundModal}
      >
        {content}
      </ConfirmationDialog>
    );
  }

  if (attachmentNotAvailableModalType) {
    return renderAttachmentNotAvailableModal();
  }

  return null;
}
