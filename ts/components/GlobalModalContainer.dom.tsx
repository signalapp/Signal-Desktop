// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import type {
  CallQualitySurveyPropsType,
  DeleteMessagesPropsType,
  DiscardDraftDialogPropsType,
  EditHistoryMessagesType,
  EditNicknameAndNoteModalPropsType,
  ForwardMessagesPropsType,
  GroupMemberLabelInfoPropsType,
  MessageRequestActionsConfirmationPropsType,
  SafetyNumberChangedBlockingDataType,
  UserNotFoundModalStateType,
} from '../state/ducks/globalModals.preload.ts';
import type { LocalizerType, ThemeType } from '../types/Util.std.ts';
import {
  type ContactModalStateType,
  UsernameOnboardingState,
} from '../types/globalModals.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import type { ButtonVariant } from './Button.dom.tsx';
import { SignalConnectionsModal } from './SignalConnectionsModal.dom.tsx';
import { WhatsNewModal } from './WhatsNewModal.dom.tsx';
import { MediaPermissionsModal } from './MediaPermissionsModal.dom.tsx';
import type { StartCallData } from './ConfirmLeaveCallModal.dom.tsx';
import {
  TapToViewNotAvailableModal,
  type DataPropsType as TapToViewNotAvailablePropsType,
} from './TapToViewNotAvailableModal.dom.tsx';
import {
  BackfillFailureModal,
  type DataPropsType as BackfillFailureModalPropsType,
} from './BackfillFailureModal.dom.tsx';
import type { SmartDraftGifMessageSendModalProps } from '../state/smart/DraftGifMessageSendModal.preload.tsx';
import { CriticalIdlePrimaryDeviceModal } from './CriticalIdlePrimaryDeviceModal.dom.tsx';
import { LowDiskSpaceBackupImportModal } from './LowDiskSpaceBackupImportModal.dom.tsx';
import { KeyTransparencyOnboardingDialog } from './KeyTransparencyOnboardingDialog.dom.tsx';
import { isUsernameValid } from '../util/Username.dom.ts';
import type { PinMessageDialogData } from '../state/smart/PinMessageDialog.preload.tsx';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

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
  // CallQualitySurvey
  callQualitySurveyProps: CallQualitySurveyPropsType | null;
  renderCallQualitySurvey: () => JSX.Element;
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
  // DiscardDraftDialog
  discardDraftDialogProps: DiscardDraftDialogPropsType | null;
  renderDiscardDraftDialog: () => JSX.Element;
  // DraftGifMessageSendModal
  draftGifMessageSendModalProps: SmartDraftGifMessageSendModalProps | null;
  renderDraftGifMessageSendModal: () => JSX.Element;
  // ForwardMessageModal
  forwardMessagesProps: ForwardMessagesPropsType | undefined;
  renderForwardMessagesModal: () => JSX.Element;
  // GroupMemberLabelInfoModal
  groupMemberLabelInfoModalState: GroupMemberLabelInfoPropsType | undefined;
  renderGroupMemberLabelInfoModal: () => JSX.Element;
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
  // PinMessageDialog
  pinMessageDialogData: PinMessageDialogData | null;
  renderPinMessageDialog: () => JSX.Element;
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
  // KeyTransparencyErrorDialog
  isKeyTransparencyErrorVisible: boolean;
  renderKeyTransparencyErrorDialog: () => JSX.Element;
  // KeyTransparencyOnboardingDialog
  isKeyTransparencyOnboardingVisible: boolean;
  hideKeyTransparencyOnboardingDialog: () => void;
  finishKeyTransparencyOnboarding: () => void;
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
  // PlaintextExportWorkflow
  shouldShowPlaintextExportWorkflow: boolean;
  renderPlaintextExportWorkflow: () => JSX.Element;
  // LocalBackupExportWorkflow
  shouldShowLocalBackupExportWorkflow: boolean;
  renderLocalBackupExportWorkflow: () => JSX.Element;
  // TerminateGroupFailedModal
  terminateGroupFailedModal: { conversationId: string } | null;
  renderTerminateGroupFailedModal: () => JSX.Element | null;
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
  // CallQualitySurvey
  callQualitySurveyProps,
  renderCallQualitySurvey,
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
  // DiscardDraftDialog
  discardDraftDialogProps,
  renderDiscardDraftDialog,
  // DraftGifMessageSendModal
  draftGifMessageSendModalProps,
  renderDraftGifMessageSendModal,
  // ForwardMessageModal
  forwardMessagesProps,
  renderForwardMessagesModal,
  // GroupMemberLabelInfoModal
  groupMemberLabelInfoModalState,
  renderGroupMemberLabelInfoModal,
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
  // PinMessageDialog
  pinMessageDialogData,
  renderPinMessageDialog,
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
  // KeyTransparencyErrorDialog
  isKeyTransparencyErrorVisible,
  renderKeyTransparencyErrorDialog,
  // KeyTransparencyOnboardingDialog
  isKeyTransparencyOnboardingVisible,
  hideKeyTransparencyOnboardingDialog,
  finishKeyTransparencyOnboarding,
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
  // PlaintextExportWorkflow
  shouldShowPlaintextExportWorkflow,
  renderPlaintextExportWorkflow,
  // LocalBackupExportWorkflow
  shouldShowLocalBackupExportWorkflow,
  renderLocalBackupExportWorkflow,
  // TerminateGroupFailedModal
  terminateGroupFailedModal,
  renderTerminateGroupFailedModal,
}: PropsType): JSX.Element | null {
  // We want the following dialogs to show in this order:
  // 0. Stateful multi-modal workflows
  // 1. Errors
  // 2. Safety Number Changes
  // 3. Forward Modal, so other modals can open it
  // 4. The Rest (in no particular order, but they're ordered alphabetically)

  if (shouldShowPlaintextExportWorkflow) {
    return renderPlaintextExportWorkflow();
  }

  if (shouldShowLocalBackupExportWorkflow) {
    return renderLocalBackupExportWorkflow();
  }

  // Errors
  if (errorModalProps) {
    return renderErrorModal(errorModalProps);
  }

  // Errors where we want them to submit a debug log
  if (debugLogErrorModalProps) {
    return renderDebugLogErrorModal(debugLogErrorModalProps);
  }

  if (isKeyTransparencyErrorVisible) {
    return renderKeyTransparencyErrorDialog();
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

  if (callQualitySurveyProps) {
    return renderCallQualitySurvey();
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

  if (discardDraftDialogProps) {
    return renderDiscardDraftDialog();
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

  if (pinMessageDialogData) {
    return renderPinMessageDialog();
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

  // Intentionally above safety number since that causes onboarding flow
  if (isKeyTransparencyOnboardingVisible) {
    return (
      <KeyTransparencyOnboardingDialog
        i18n={i18n}
        open
        onOpenChange={open => {
          if (!open) {
            hideKeyTransparencyOnboardingDialog();
          }
        }}
        onContinue={finishKeyTransparencyOnboarding}
      />
    );
  }

  if (safetyNumberModalContactId) {
    return renderSafetyNumber();
  }

  if (isAboutContactModalVisible) {
    return renderAboutContactModal();
  }

  // This needs to be before the contact modal, which opens it
  if (groupMemberLabelInfoModalState) {
    return renderGroupMemberLabelInfoModal();
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
    } else if (
      userNotFoundModalState.type === 'username' &&
      !isUsernameValid(userNotFoundModalState.username)
    ) {
      content = i18n('icu:startConversation--username-not-valid', {
        atUsername: userNotFoundModalState.username,
      });
    } else if (userNotFoundModalState.type === 'username') {
      content = i18n('icu:startConversation--username-not-found', {
        atUsername: userNotFoundModalState.username,
      });
    } else {
      throw missingCaseError(userNotFoundModalState);
    }

    return (
      <AxoConfirmDialog.Root
        open
        onOpenChange={hideUserNotFoundModal}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={content}
      >
        <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
      </AxoConfirmDialog.Root>
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

  if (terminateGroupFailedModal) {
    return renderTerminateGroupFailedModal();
  }

  return null;
}
