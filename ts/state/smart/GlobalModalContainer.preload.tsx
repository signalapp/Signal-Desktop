// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { ButtonVariant } from '../../components/Button.dom.tsx';
import { ErrorModal } from '../../components/ErrorModal.dom.tsx';
import { GlobalModalContainer } from '../../components/GlobalModalContainer.dom.tsx';
import { SmartAboutContactModal } from './AboutContactModal.preload.tsx';
import { SmartAddUserToAnotherGroupModal } from './AddUserToAnotherGroupModal.preload.tsx';
import { SmartContactModal } from './ContactModal.preload.tsx';
import { SmartEditHistoryMessagesModal } from './EditHistoryMessagesModal.preload.tsx';
import { SmartForwardMessagesModal } from './ForwardMessagesModal.preload.tsx';
import { SmartUsernameOnboardingModal } from './UsernameOnboardingModal.preload.tsx';
import { SmartSafetyNumberModal } from './SafetyNumberModal.preload.tsx';
import { SmartSendAnywayDialog } from './SendAnywayDialog.preload.tsx';
import { SmartShortcutGuideModal } from './ShortcutGuideModal.preload.tsx';
import { SmartStickerPreviewModal } from './StickerPreviewModal.preload.tsx';
import { SmartStoriesSettingsModal } from './StoriesSettingsModal.preload.tsx';
import { getConversationsStoppingSend } from '../selectors/conversations.dom.ts';
import { getIntl, getTheme } from '../selectors/user.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { SmartDeleteMessagesModal } from './DeleteMessagesModal.preload.tsx';
import { SmartDiscardDraftDialog } from './DiscardDraftDialog.preload.tsx';
import { SmartMessageRequestActionsConfirmation } from './MessageRequestActionsConfirmation.preload.tsx';
import { getGlobalModalsState } from '../selectors/globalModals.std.ts';
import { SmartEditNicknameAndNoteModal } from './EditNicknameAndNoteModal.preload.tsx';
import { SmartNotePreviewModal } from './NotePreviewModal.preload.tsx';
import { SmartCallLinkEditModal } from './CallLinkEditModal.preload.tsx';
import { SmartCallQualitySurveyDialog } from './CallQualitySurveyDialog.preload.tsx';
import { SmartCallLinkAddNameModal } from './CallLinkAddNameModal.preload.tsx';
import { SmartConfirmLeaveCallModal } from './ConfirmLeaveCallModal.preload.tsx';
import { SmartCallLinkPendingParticipantModal } from './CallLinkPendingParticipantModal.preload.tsx';
import { SmartProfileNameWarningModal } from './ProfileNameWarningModal.preload.tsx';
import { SmartDraftGifMessageSendModal } from './DraftGifMessageSendModal.preload.tsx';
import { SmartKeyTransparencyErrorDialog } from './KeyTransparencyErrorDialog.preload.tsx';
import { DebugLogErrorModal } from '../../components/DebugLogErrorModal.dom.tsx';
import { SmartPlaintextExportWorkflow } from './PlaintextExportWorkflow.preload.tsx';
import { SmartLocalBackupExportWorkflow } from './LocalBackupExportWorkflow.preload.tsx';
import {
  shouldShowPlaintextWorkflow,
  shouldShowLocalBackupWorkflow,
} from '../selectors/backups.std.ts';
import { SmartPinMessageDialog } from './PinMessageDialog.preload.tsx';
import { SmartGroupMemberLabelInfoModal } from './GroupMemberLabelInfoModal.preload.tsx';
import { SmartTerminateGroupFailedModal } from './TerminateGroupFailedModal.preload.tsx';

function renderCallLinkAddNameModal(): React.JSX.Element {
  return <SmartCallLinkAddNameModal />;
}

function renderCallLinkEditModal(): React.JSX.Element {
  return <SmartCallLinkEditModal />;
}

function renderCallQualitySurvey(): React.JSX.Element {
  return <SmartCallQualitySurveyDialog />;
}

function renderCallLinkPendingParticipantModal(): React.JSX.Element {
  return <SmartCallLinkPendingParticipantModal />;
}

function renderConfirmLeaveCallModal(): React.JSX.Element {
  return <SmartConfirmLeaveCallModal />;
}

function renderEditHistoryMessagesModal(): React.JSX.Element {
  return <SmartEditHistoryMessagesModal />;
}

function renderEditNicknameAndNoteModal(): React.JSX.Element {
  return <SmartEditNicknameAndNoteModal />;
}

function renderProfileNameWarningModal(): React.JSX.Element {
  return <SmartProfileNameWarningModal />;
}

function renderUsernameOnboarding(): React.JSX.Element {
  return <SmartUsernameOnboardingModal />;
}

function renderContactModal(): React.JSX.Element {
  return <SmartContactModal />;
}

function renderDeleteMessagesModal(): React.JSX.Element {
  return <SmartDeleteMessagesModal />;
}

function renderDiscardDraftDialog(): React.JSX.Element {
  return <SmartDiscardDraftDialog />;
}

function renderDraftGifMessageSendModal(): React.JSX.Element {
  return <SmartDraftGifMessageSendModal />;
}

function renderForwardMessagesModal(): React.JSX.Element {
  return <SmartForwardMessagesModal />;
}

function renderGroupMemberLabelInfoModal(): React.JSX.Element {
  return <SmartGroupMemberLabelInfoModal />;
}

function renderKeyTransparencyErrorDialog(): React.JSX.Element {
  return <SmartKeyTransparencyErrorDialog />;
}

function renderMessageRequestActionsConfirmation(): React.JSX.Element {
  return <SmartMessageRequestActionsConfirmation />;
}

function renderNotePreviewModal(): React.JSX.Element {
  return <SmartNotePreviewModal />;
}

function renderPinMessageDialog(): React.JSX.Element {
  return <SmartPinMessageDialog />;
}

function renderPlaintextExportWorkflow(): React.JSX.Element {
  return <SmartPlaintextExportWorkflow />;
}

function renderLocalBackupExportWorkflow(): React.JSX.Element {
  return <SmartLocalBackupExportWorkflow />;
}

function renderStoriesSettings(): React.JSX.Element {
  return <SmartStoriesSettingsModal />;
}

function renderSendAnywayDialog(): React.JSX.Element {
  return <SmartSendAnywayDialog />;
}

function renderShortcutGuideModal(): React.JSX.Element {
  return <SmartShortcutGuideModal />;
}

function renderAboutContactModal(): React.JSX.Element {
  return <SmartAboutContactModal />;
}

export const SmartGlobalModalContainer = memo(
  function SmartGlobalModalContainer() {
    const conversationsStoppingSend = useSelector(getConversationsStoppingSend);
    const i18n = useSelector(getIntl);
    const theme = useSelector(getTheme);
    const shouldShowPlaintextExportWorkflow = useSelector(
      shouldShowPlaintextWorkflow
    );
    const shouldShowLocalBackupExportWorkflow = useSelector(
      shouldShowLocalBackupWorkflow
    );

    const hasSafetyNumberChangeModal = conversationsStoppingSend.length > 0;

    const {
      aboutContactModalState,
      addUserToAnotherGroupModalContactId,
      backfillFailureModalProps,
      callLinkAddNameModalRoomId,
      callLinkEditModalRoomId,
      callQualitySurveyProps,
      callLinkPendingParticipantContactId,
      confirmLeaveCallModalState,
      contactModalState,
      criticalIdlePrimaryDeviceModal,
      debugLogErrorModalProps,
      deleteMessagesProps,
      discardDraftDialogProps,
      draftGifMessageSendModalProps,
      editHistoryMessages,
      editNicknameAndNoteModalProps,
      errorModalProps,
      forwardMessagesProps,
      groupMemberLabelInfoModalState,
      lowDiskSpaceBackupImportModal,
      mediaPermissionsModalProps,
      messageRequestActionsConfirmationProps,
      notePreviewModalProps,
      pinMessageDialogData,
      isProfileNameWarningModalVisible,
      profileNameWarningModalConversationType,
      isShortcutGuideModalVisible,
      isSignalConnectionsVisible,
      isStoriesSettingsVisible,
      isKeyTransparencyErrorVisible,
      isKeyTransparencyOnboardingVisible,
      isWhatsNewVisible,
      usernameOnboardingState,
      safetyNumberChangedBlockingData,
      safetyNumberModalContactId,
      stickerPackPreviewId,
      tapToViewNotAvailableModalProps,
      terminateGroupFailedModal,
      userNotFoundModalState,
    } = useSelector(getGlobalModalsState);

    const {
      closeDebugLogErrorModal,
      closeErrorModal,
      closeMediaPermissionsModal,
      hideCriticalIdlePrimaryDeviceModal,
      hideLowDiskSpaceBackupImportModal,
      hideTapToViewNotAvailableModal,
      hideUserNotFoundModal,
      hideWhatsNewModal,
      hideBackfillFailureModal,
      hideKeyTransparencyOnboardingDialog,
      finishKeyTransparencyOnboarding,
      toggleSignalConnectionsModal,
    } = useGlobalModalActions();

    const renderAddUserToAnotherGroup = useCallback(() => {
      return (
        <SmartAddUserToAnotherGroupModal
          contactID={String(addUserToAnotherGroupModalContactId)}
        />
      );
    }, [addUserToAnotherGroupModalContactId]);

    const renderSafetyNumber = useCallback(
      () => (
        <SmartSafetyNumberModal
          contactID={String(safetyNumberModalContactId)}
        />
      ),
      [safetyNumberModalContactId]
    );

    const renderStickerPreviewModal = useCallback(
      () =>
        stickerPackPreviewId ? (
          <SmartStickerPreviewModal packId={stickerPackPreviewId} />
        ) : null,
      [stickerPackPreviewId]
    );

    const renderErrorModal = useCallback(
      ({
        buttonVariant,
        description,
        title,
      }: {
        buttonVariant?: ButtonVariant;
        description?: string;
        title?: string | null;
      }) => (
        <ErrorModal
          buttonVariant={buttonVariant}
          description={description}
          title={title}
          i18n={i18n}
          onClose={closeErrorModal}
        />
      ),
      [closeErrorModal, i18n]
    );

    const renderDebugLogErrorModal = useCallback(
      ({ description }: { description?: string }) => (
        <DebugLogErrorModal
          description={description}
          i18n={i18n}
          onClose={closeDebugLogErrorModal}
          onSubmitDebugLog={() => window.IPC.showDebugLog()}
        />
      ),
      [closeDebugLogErrorModal, i18n]
    );

    const renderTerminateGroupFailedModal = useCallback(
      () =>
        terminateGroupFailedModal ? (
          <SmartTerminateGroupFailedModal
            conversationId={terminateGroupFailedModal.conversationId}
          />
        ) : null,
      [terminateGroupFailedModal]
    );

    return (
      <GlobalModalContainer
        addUserToAnotherGroupModalContactId={
          addUserToAnotherGroupModalContactId
        }
        backfillFailureModalProps={backfillFailureModalProps}
        callLinkAddNameModalRoomId={callLinkAddNameModalRoomId}
        callLinkEditModalRoomId={callLinkEditModalRoomId}
        callQualitySurveyProps={callQualitySurveyProps}
        renderCallQualitySurvey={renderCallQualitySurvey}
        callLinkPendingParticipantContactId={
          callLinkPendingParticipantContactId
        }
        confirmLeaveCallModalState={confirmLeaveCallModalState}
        contactModalState={contactModalState}
        criticalIdlePrimaryDeviceModal={criticalIdlePrimaryDeviceModal}
        debugLogErrorModalProps={debugLogErrorModalProps}
        editHistoryMessages={editHistoryMessages}
        editNicknameAndNoteModalProps={editNicknameAndNoteModalProps}
        errorModalProps={errorModalProps}
        deleteMessagesProps={deleteMessagesProps}
        discardDraftDialogProps={discardDraftDialogProps}
        draftGifMessageSendModalProps={draftGifMessageSendModalProps}
        forwardMessagesProps={forwardMessagesProps}
        groupMemberLabelInfoModalState={groupMemberLabelInfoModalState}
        hideCriticalIdlePrimaryDeviceModal={hideCriticalIdlePrimaryDeviceModal}
        hideLowDiskSpaceBackupImportModal={hideLowDiskSpaceBackupImportModal}
        lowDiskSpaceBackupImportModal={lowDiskSpaceBackupImportModal}
        terminateGroupFailedModal={terminateGroupFailedModal}
        messageRequestActionsConfirmationProps={
          messageRequestActionsConfirmationProps
        }
        mediaPermissionsModalProps={mediaPermissionsModalProps}
        closeMediaPermissionsModal={closeMediaPermissionsModal}
        openSystemMediaPermissions={window.IPC.openSystemMediaPermissions}
        notePreviewModalProps={notePreviewModalProps}
        pinMessageDialogData={pinMessageDialogData}
        hasSafetyNumberChangeModal={hasSafetyNumberChangeModal}
        hideBackfillFailureModal={hideBackfillFailureModal}
        hideUserNotFoundModal={hideUserNotFoundModal}
        hideWhatsNewModal={hideWhatsNewModal}
        hideKeyTransparencyOnboardingDialog={
          hideKeyTransparencyOnboardingDialog
        }
        finishKeyTransparencyOnboarding={finishKeyTransparencyOnboarding}
        hideTapToViewNotAvailableModal={hideTapToViewNotAvailableModal}
        i18n={i18n}
        isAboutContactModalVisible={aboutContactModalState != null}
        isKeyTransparencyErrorVisible={isKeyTransparencyErrorVisible}
        isKeyTransparencyOnboardingVisible={isKeyTransparencyOnboardingVisible}
        isProfileNameWarningModalVisible={isProfileNameWarningModalVisible}
        isShortcutGuideModalVisible={isShortcutGuideModalVisible}
        isSignalConnectionsVisible={isSignalConnectionsVisible}
        isStoriesSettingsVisible={isStoriesSettingsVisible}
        isWhatsNewVisible={isWhatsNewVisible}
        renderAboutContactModal={renderAboutContactModal}
        renderAddUserToAnotherGroup={renderAddUserToAnotherGroup}
        renderCallLinkAddNameModal={renderCallLinkAddNameModal}
        renderCallLinkEditModal={renderCallLinkEditModal}
        renderCallLinkPendingParticipantModal={
          renderCallLinkPendingParticipantModal
        }
        renderConfirmLeaveCallModal={renderConfirmLeaveCallModal}
        renderContactModal={renderContactModal}
        renderDebugLogErrorModal={renderDebugLogErrorModal}
        renderEditHistoryMessagesModal={renderEditHistoryMessagesModal}
        renderEditNicknameAndNoteModal={renderEditNicknameAndNoteModal}
        renderErrorModal={renderErrorModal}
        renderDeleteMessagesModal={renderDeleteMessagesModal}
        renderDiscardDraftDialog={renderDiscardDraftDialog}
        renderDraftGifMessageSendModal={renderDraftGifMessageSendModal}
        renderForwardMessagesModal={renderForwardMessagesModal}
        renderGroupMemberLabelInfoModal={renderGroupMemberLabelInfoModal}
        renderKeyTransparencyErrorDialog={renderKeyTransparencyErrorDialog}
        renderMessageRequestActionsConfirmation={
          renderMessageRequestActionsConfirmation
        }
        renderNotePreviewModal={renderNotePreviewModal}
        renderPinMessageDialog={renderPinMessageDialog}
        renderPlaintextExportWorkflow={renderPlaintextExportWorkflow}
        renderLocalBackupExportWorkflow={renderLocalBackupExportWorkflow}
        renderProfileNameWarningModal={renderProfileNameWarningModal}
        renderUsernameOnboarding={renderUsernameOnboarding}
        renderSafetyNumber={renderSafetyNumber}
        renderSendAnywayDialog={renderSendAnywayDialog}
        renderShortcutGuideModal={renderShortcutGuideModal}
        renderStickerPreviewModal={renderStickerPreviewModal}
        renderStoriesSettings={renderStoriesSettings}
        renderTerminateGroupFailedModal={renderTerminateGroupFailedModal}
        safetyNumberChangedBlockingData={safetyNumberChangedBlockingData}
        safetyNumberModalContactId={safetyNumberModalContactId}
        shouldShowPlaintextExportWorkflow={shouldShowPlaintextExportWorkflow}
        shouldShowLocalBackupExportWorkflow={
          shouldShowLocalBackupExportWorkflow
        }
        stickerPackPreviewId={stickerPackPreviewId}
        tapToViewNotAvailableModalProps={tapToViewNotAvailableModalProps}
        theme={theme}
        toggleSignalConnectionsModal={toggleSignalConnectionsModal}
        userNotFoundModalState={userNotFoundModalState}
        usernameOnboardingState={usernameOnboardingState}
        profileNameWarningModalConversationType={
          profileNameWarningModalConversationType
        }
      />
    );
  }
);
