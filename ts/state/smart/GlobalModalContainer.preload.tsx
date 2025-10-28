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
import { SmartCallLinkAddNameModal } from './CallLinkAddNameModal.preload.js';
import { SmartConfirmLeaveCallModal } from './ConfirmLeaveCallModal.preload.js';
import { SmartCallLinkPendingParticipantModal } from './CallLinkPendingParticipantModal.preload.js';
import { SmartProfileNameWarningModal } from './ProfileNameWarningModal.preload.js';
import { SmartDraftGifMessageSendModal } from './DraftGifMessageSendModal.preload.js';
import { DebugLogErrorModal } from '../../components/DebugLogErrorModal.dom.js';

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
