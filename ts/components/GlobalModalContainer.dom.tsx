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
} from '../state/ducks/globalModals.preload.js';
import type { LocalizerType, ThemeType } from '../types/Util.std.js';
import { UsernameOnboardingState } from '../types/globalModals.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';

import { ButtonVariant } from './Button.dom.js';
import { ConfirmationDialog } from './ConfirmationDialog.dom.js';
import { SignalConnectionsModal } from './SignalConnectionsModal.dom.js';
import { WhatsNewModal } from './WhatsNewModal.dom.js';
import { MediaPermissionsModal } from './MediaPermissionsModal.dom.js';
import type { StartCallData } from './ConfirmLeaveCallModal.dom.js';
import {
  TapToViewNotAvailableModal,
  type DataPropsType as TapToViewNotAvailablePropsType,
} from './TapToViewNotAvailableModal.dom.js';
import {
  BackfillFailureModal,
  type DataPropsType as BackfillFailureModalPropsType,
} from './BackfillFailureModal.dom.js';
import type { SmartDraftGifMessageSendModalProps } from '../state/smart/DraftGifMessageSendModal.preload.js';
import { CriticalIdlePrimaryDeviceModal } from './CriticalIdlePrimaryDeviceModal.dom.js';
import { LowDiskSpaceBackupImportModal } from './LowDiskSpaceBackupImportModal.dom.js';

// NOTE: All types should be required for this component so that the smart
// component gives you type errors when adding/removing props.
export type PropsType = {
  i18n: LocalizerType;
  theme: ThemeType;
  // AddUserToAnotherGroupModal
  addUserToAnotherGroupModalContactId: string | undefined;
  renderAddUserToAnotherGroup: () => JSX.Element;
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
  // DebugLogErrorModal
  debugLogErrorModalProps:
    | {
        description?: string;
      }
    | undefined;
  renderDebugLogErrorModal: (opts: { description?: string }) => JSX.Element;
  // DeleteMessageModal
  deleteMessagesProps: DeleteMessagesPropsType | undefined;
  renderDeleteMessagesModal: () => JSX.Element;
  // DraftGifMessageSendModal
  draftGifMessageSendModalProps: SmartDraftGifMessageSendModalProps | null;
  renderDraftGifMessageSendModal: () => JSX.Element;
  // ForwardMessageModal
  forwardMessagesProps: ForwardMessagesPropsType | undefined;
  renderForwardMessagesModal: () => JSX.Element;
  // MediaPermissionsModal
  mediaPermissionsModalProps:
    | {
        mediaType: 'camera' | 'microphone';
        requestor: 'call' | 'voiceNote';
      }
    | undefined;
  closeMediaPermissionsModal: () => void;
  openSystemMediaPermissions: (mediaType: 'camera' | 'microphone') => void;
  // MessageRequestActionsConfirmation
  messageRequestActionsConfirmationProps: MessageRequestActionsConfirmationPropsType | null;
  renderMessageRequestActionsConfirmation: () => JSX.Element;
  // NotePreviewModal
  notePreviewModalProps: { conversationId: string } | null;
  renderNotePreviewModal: () => JSX.Element;
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
  // TapToViewNotAvailableModal
  tapToViewNotAvailableModalProps: TapToViewNotAvailablePropsType | undefined;
  hideTapToViewNotAvailableModal: () => void;
  // BackfillFailureModal
  backfillFailureModalProps: BackfillFailureModalPropsType | undefined;
  hideBackfillFailureModal: () => void;
  // UserNotFoundModal
  hideUserNotFoundModal: () => unknown;
  userNotFoundModalState: UserNotFoundModalStateType | undefined;
  // WhatsNewModal
  isWhatsNewVisible: boolean;
  hideWhatsNewModal: () => unknown;
  // UsernameOnboarding
  usernameOnboardingState: UsernameOnboardingState;
  renderUsernameOnboarding: () => JSX.Element;
  isProfileNameWarningModalVisible: boolean;
  profileNameWarningModalConversationType?: string;
  renderProfileNameWarningModal: () => JSX.Element;
  // CriticalIdlePrimaryDeviceModal,
  criticalIdlePrimaryDeviceModal: boolean;
  hideCriticalIdlePrimaryDeviceModal: () => void;
  // LowDiskSpaceBackupImportModal
  lowDiskSpaceBackupImportModal: { bytesNeeded: number } | null;
  hideLowDiskSpaceBackupImportModal: () => void;
};

export function GlobalModalContainer({
  i18n,
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
  // DebugLogErrorModal
  debugLogErrorModalProps,
  renderDebugLogErrorModal,
  // DeleteMessageModal
  deleteMessagesProps,
  renderDeleteMessagesModal,
  // DraftGifMessageSendModal
  draftGifMessageSendModalProps,
  renderDraftGifMessageSendModal,
  // ForwardMessageModal
  forwardMessagesProps,
  renderForwardMessagesModal,
  // MediaPermissionsModal
  mediaPermissionsModalProps,
  closeMediaPermissionsModal,
  openSystemMediaPermissions,
  // MessageRequestActionsConfirmation
  messageRequestActionsConfirmationProps,
  renderMessageRequestActionsConfirmation,
  // NotePreviewModal
  notePreviewModalProps,
  renderNotePreviewModal,
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
  // TapToViewNotAvailableModal
  tapToViewNotAvailableModalProps,
  hideTapToViewNotAvailableModal,
  // BackfillFailureModal
  backfillFailureModalProps,
  hideBackfillFailureModal,
  // UserNotFoundModal
  hideUserNotFoundModal,
  userNotFoundModalState,
  // WhatsNewModal
  hideWhatsNewModal,
  isWhatsNewVisible,
  // UsernameOnboarding
  usernameOnboardingState,
  renderUsernameOnboarding,
  // ProfileNameWarningModal
  isProfileNameWarningModalVisible,
  renderProfileNameWarningModal,
  // CriticalIdlePrimaryDeviceModal
  criticalIdlePrimaryDeviceModal,
  hideCriticalIdlePrimaryDeviceModal,
  // LowDiskSpaceBackupImportModal
  lowDiskSpaceBackupImportModal,
  hideLowDiskSpaceBackupImportModal,
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

  // Errors where we want them to submit a debug log
  if (debugLogErrorModalProps) {
    return renderDebugLogErrorModal(debugLogErrorModalProps);
  }

  // Safety Number
  if (hasSafetyNumberChangeModal || safetyNumberChangedBlockingData) {
    return renderSendAnywayDialog();
  }

  // Forward Modal
  if (forwardMessagesProps) {
    return renderForwardMessagesModal();
  }

  // Media Permissions Modal
  if (mediaPermissionsModalProps) {
    return (
      <MediaPermissionsModal
        i18n={i18n}
        {...mediaPermissionsModalProps}
        openSystemMediaPermissions={openSystemMediaPermissions}
        onClose={closeMediaPermissionsModal}
      />
    );
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

  if (draftGifMessageSendModalProps) {
    return renderDraftGifMessageSendModal();
  }

  if (messageRequestActionsConfirmationProps) {
    return renderMessageRequestActionsConfirmation();
  }

  if (notePreviewModalProps) {
    return renderNotePreviewModal();
  }

  if (isProfileNameWarningModalVisible) {
    return renderProfileNameWarningModal();
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

  if (tapToViewNotAvailableModalProps) {
    return (
      <TapToViewNotAvailableModal
        i18n={i18n}
        onClose={hideTapToViewNotAvailableModal}
        {...tapToViewNotAvailableModalProps}
      />
    );
  }

  if (backfillFailureModalProps != null) {
    return (
      <BackfillFailureModal
        i18n={i18n}
        onClose={hideBackfillFailureModal}
        {...backfillFailureModalProps}
      />
    );
  }

  if (criticalIdlePrimaryDeviceModal) {
    return (
      <CriticalIdlePrimaryDeviceModal
        i18n={i18n}
        onClose={hideCriticalIdlePrimaryDeviceModal}
      />
    );
  }

  if (lowDiskSpaceBackupImportModal) {
    return (
      <LowDiskSpaceBackupImportModal
        bytesNeeded={lowDiskSpaceBackupImportModal.bytesNeeded}
        i18n={i18n}
        onClose={hideLowDiskSpaceBackupImportModal}
      />
    );
  }

  return null;
}
