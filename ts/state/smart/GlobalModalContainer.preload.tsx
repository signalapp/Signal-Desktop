// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { ButtonVariant } from '../../components/Button.dom.js';
import { ErrorModal } from '../../components/ErrorModal.dom.js';
import { GlobalModalContainer } from '../../components/GlobalModalContainer.dom.js';
import { SmartAboutContactModal } from './AboutContactModal.preload.js';
import { SmartAddUserToAnotherGroupModal } from './AddUserToAnotherGroupModal.preload.js';
import { SmartContactModal } from './ContactModal.preload.js';
import { SmartEditHistoryMessagesModal } from './EditHistoryMessagesModal.preload.js';
import { SmartForwardMessagesModal } from './ForwardMessagesModal.preload.js';
import { SmartUsernameOnboardingModal } from './UsernameOnboardingModal.preload.js';
import { SmartSafetyNumberModal } from './SafetyNumberModal.preload.js';
import { SmartSendAnywayDialog } from './SendAnywayDialog.preload.js';
import { SmartShortcutGuideModal } from './ShortcutGuideModal.preload.js';
import { SmartStickerPreviewModal } from './StickerPreviewModal.preload.js';
import { SmartStoriesSettingsModal } from './StoriesSettingsModal.preload.js';
import { getConversationsStoppingSend } from '../selectors/conversations.dom.js';
import { getIntl, getTheme } from '../selectors/user.std.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { SmartDeleteMessagesModal } from './DeleteMessagesModal.preload.js';
import { SmartMessageRequestActionsConfirmation } from './MessageRequestActionsConfirmation.preload.js';
import { getGlobalModalsState } from '../selectors/globalModals.std.js';
import { SmartEditNicknameAndNoteModal } from './EditNicknameAndNoteModal.preload.js';
import { SmartNotePreviewModal } from './NotePreviewModal.preload.js';
import { SmartCallLinkEditModal } from './CallLinkEditModal.preload.js';
import { SmartCallQualitySurveyDialog } from './CallQualitySurveyDialog.preload.js';
import { SmartCallLinkAddNameModal } from './CallLinkAddNameModal.preload.js';
import { SmartConfirmLeaveCallModal } from './ConfirmLeaveCallModal.preload.js';
import { SmartCallLinkPendingParticipantModal } from './CallLinkPendingParticipantModal.preload.js';
import { SmartProfileNameWarningModal } from './ProfileNameWarningModal.preload.js';
import { SmartDraftGifMessageSendModal } from './DraftGifMessageSendModal.preload.js';
import { SmartKeyTransparencyErrorDialog } from './KeyTransparencyErrorDialog.preload.js';
import { DebugLogErrorModal } from '../../components/DebugLogErrorModal.dom.js';
import { SmartPlaintextExportWorkflow } from './PlaintextExportWorkflow.preload.js';
import { SmartLocalBackupExportWorkflow } from './LocalBackupExportWorkflow.preload.js';
import {
  shouldShowPlaintextWorkflow,
  shouldShowLocalBackupWorkflow,
} from '../selectors/backups.std.js';
import { SmartPinMessageDialog } from './PinMessageDialog.preload.js';
import { SmartGroupMemberLabelInfoModal } from './GroupMemberLabelInfoModal.preload.js';

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
        draftGifMessageSendModalProps={draftGifMessageSendModalProps}
        forwardMessagesProps={forwardMessagesProps}
        groupMemberLabelInfoModalState={groupMemberLabelInfoModalState}
        hideCriticalIdlePrimaryDeviceModal={hideCriticalIdlePrimaryDeviceModal}
        hideLowDiskSpaceBackupImportModal={hideLowDiskSpaceBackupImportModal}
        lowDiskSpaceBackupImportModal={lowDiskSpaceBackupImportModal}
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
