// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { ButtonVariant } from '../../components/Button';
import { ErrorModal } from '../../components/ErrorModal';
import { GlobalModalContainer } from '../../components/GlobalModalContainer';
import { SmartAboutContactModal } from './AboutContactModal';
import { SmartAddUserToAnotherGroupModal } from './AddUserToAnotherGroupModal';
import { SmartContactModal } from './ContactModal';
import { SmartEditHistoryMessagesModal } from './EditHistoryMessagesModal';
import { SmartForwardMessagesModal } from './ForwardMessagesModal';
import { SmartUsernameOnboardingModal } from './UsernameOnboardingModal';
import { SmartSafetyNumberModal } from './SafetyNumberModal';
import { SmartSendAnywayDialog } from './SendAnywayDialog';
import { SmartShortcutGuideModal } from './ShortcutGuideModal';
import { SmartStickerPreviewModal } from './StickerPreviewModal';
import { SmartStoriesSettingsModal } from './StoriesSettingsModal';
import { getConversationsStoppingSend } from '../selectors/conversations';
import { getIntl, getTheme } from '../selectors/user';
import { useGlobalModalActions } from '../ducks/globalModals';
import { SmartDeleteMessagesModal } from './DeleteMessagesModal';
import { SmartMessageRequestActionsConfirmation } from './MessageRequestActionsConfirmation';
import { getGlobalModalsState } from '../selectors/globalModals';
import { SmartEditNicknameAndNoteModal } from './EditNicknameAndNoteModal';
import { SmartNotePreviewModal } from './NotePreviewModal';
import { SmartCallLinkEditModal } from './CallLinkEditModal';
import { SmartCallLinkAddNameModal } from './CallLinkAddNameModal';
import { SmartConfirmLeaveCallModal } from './ConfirmLeaveCallModal';
import { SmartCallLinkPendingParticipantModal } from './CallLinkPendingParticipantModal';
import { SmartProfileNameWarningModal } from './ProfileNameWarningModal';
import { SmartDraftGifMessageSendModal } from './DraftGifMessageSendModal';
import { DebugLogErrorModal } from '../../components/DebugLogErrorModal';

function renderCallLinkAddNameModal(): JSX.Element {
  return <SmartCallLinkAddNameModal />;
}

function renderCallLinkEditModal(): JSX.Element {
  return <SmartCallLinkEditModal />;
}

function renderCallLinkPendingParticipantModal(): JSX.Element {
  return <SmartCallLinkPendingParticipantModal />;
}

function renderConfirmLeaveCallModal(): JSX.Element {
  return <SmartConfirmLeaveCallModal />;
}

function renderEditHistoryMessagesModal(): JSX.Element {
  return <SmartEditHistoryMessagesModal />;
}

function renderEditNicknameAndNoteModal(): JSX.Element {
  return <SmartEditNicknameAndNoteModal />;
}

function renderProfileNameWarningModal(): JSX.Element {
  return <SmartProfileNameWarningModal />;
}

function renderUsernameOnboarding(): JSX.Element {
  return <SmartUsernameOnboardingModal />;
}

function renderContactModal(): JSX.Element {
  return <SmartContactModal />;
}

function renderDeleteMessagesModal(): JSX.Element {
  return <SmartDeleteMessagesModal />;
}

function renderDraftGifMessageSendModal(): JSX.Element {
  return <SmartDraftGifMessageSendModal />;
}

function renderForwardMessagesModal(): JSX.Element {
  return <SmartForwardMessagesModal />;
}

function renderMessageRequestActionsConfirmation(): JSX.Element {
  return <SmartMessageRequestActionsConfirmation />;
}

function renderNotePreviewModal(): JSX.Element {
  return <SmartNotePreviewModal />;
}

function renderStoriesSettings(): JSX.Element {
  return <SmartStoriesSettingsModal />;
}

function renderSendAnywayDialog(): JSX.Element {
  return <SmartSendAnywayDialog />;
}

function renderShortcutGuideModal(): JSX.Element {
  return <SmartShortcutGuideModal />;
}

function renderAboutContactModal(): JSX.Element {
  return <SmartAboutContactModal />;
}

export const SmartGlobalModalContainer = memo(
  function SmartGlobalModalContainer() {
    const conversationsStoppingSend = useSelector(getConversationsStoppingSend);
    const i18n = useSelector(getIntl);
    const theme = useSelector(getTheme);

    const hasSafetyNumberChangeModal = conversationsStoppingSend.length > 0;

    const {
      aboutContactModalContactId,
      addUserToAnotherGroupModalContactId,
      backfillFailureModalProps,
      callLinkAddNameModalRoomId,
      callLinkEditModalRoomId,
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
      lowDiskSpaceBackupImportModal,
      mediaPermissionsModalProps,
      messageRequestActionsConfirmationProps,
      notePreviewModalProps,
      isProfileNameWarningModalVisible,
      profileNameWarningModalConversationType,
      isShortcutGuideModalVisible,
      isSignalConnectionsVisible,
      isStoriesSettingsVisible,
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
        hasSafetyNumberChangeModal={hasSafetyNumberChangeModal}
        hideBackfillFailureModal={hideBackfillFailureModal}
        hideUserNotFoundModal={hideUserNotFoundModal}
        hideWhatsNewModal={hideWhatsNewModal}
        hideTapToViewNotAvailableModal={hideTapToViewNotAvailableModal}
        i18n={i18n}
        isAboutContactModalVisible={aboutContactModalContactId != null}
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
        renderMessageRequestActionsConfirmation={
          renderMessageRequestActionsConfirmation
        }
        renderNotePreviewModal={renderNotePreviewModal}
        renderProfileNameWarningModal={renderProfileNameWarningModal}
        renderUsernameOnboarding={renderUsernameOnboarding}
        renderSafetyNumber={renderSafetyNumber}
        renderSendAnywayDialog={renderSendAnywayDialog}
        renderShortcutGuideModal={renderShortcutGuideModal}
        renderStickerPreviewModal={renderStickerPreviewModal}
        renderStoriesSettings={renderStoriesSettings}
        safetyNumberChangedBlockingData={safetyNumberChangedBlockingData}
        safetyNumberModalContactId={safetyNumberModalContactId}
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
