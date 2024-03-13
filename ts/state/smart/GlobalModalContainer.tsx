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
import { SmartProfileEditorModal } from './ProfileEditorModal';
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

function renderEditHistoryMessagesModal(): JSX.Element {
  return <SmartEditHistoryMessagesModal />;
}

function renderProfileEditor(): JSX.Element {
  return <SmartProfileEditorModal />;
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

function renderForwardMessagesModal(): JSX.Element {
  return <SmartForwardMessagesModal />;
}

function renderMessageRequestActionsConfirmation(): JSX.Element {
  return <SmartMessageRequestActionsConfirmation />;
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
      authArtCreatorData,
      contactModalState,
      deleteMessagesProps,
      editHistoryMessages,
      errorModalProps,
      formattingWarningData,
      forwardMessagesProps,
      messageRequestActionsConfirmationProps,
      isAuthorizingArtCreator,
      isProfileEditorVisible,
      isShortcutGuideModalVisible,
      isSignalConnectionsVisible,
      isStoriesSettingsVisible,
      isWhatsNewVisible,
      usernameOnboardingState,
      safetyNumberChangedBlockingData,
      safetyNumberModalContactId,
      sendEditWarningData,
      stickerPackPreviewId,
      userNotFoundModalState,
    } = useSelector(getGlobalModalsState);

    const {
      cancelAuthorizeArtCreator,
      closeErrorModal,
      confirmAuthorizeArtCreator,
      hideUserNotFoundModal,
      hideWhatsNewModal,
      showFormattingWarningModal,
      showSendEditWarningModal,
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
        title?: string;
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

    return (
      <GlobalModalContainer
        addUserToAnotherGroupModalContactId={
          addUserToAnotherGroupModalContactId
        }
        contactModalState={contactModalState}
        editHistoryMessages={editHistoryMessages}
        errorModalProps={errorModalProps}
        deleteMessagesProps={deleteMessagesProps}
        formattingWarningData={formattingWarningData}
        forwardMessagesProps={forwardMessagesProps}
        messageRequestActionsConfirmationProps={
          messageRequestActionsConfirmationProps
        }
        hasSafetyNumberChangeModal={hasSafetyNumberChangeModal}
        hideUserNotFoundModal={hideUserNotFoundModal}
        hideWhatsNewModal={hideWhatsNewModal}
        i18n={i18n}
        isAboutContactModalVisible={aboutContactModalContactId != null}
        isProfileEditorVisible={isProfileEditorVisible}
        isShortcutGuideModalVisible={isShortcutGuideModalVisible}
        isSignalConnectionsVisible={isSignalConnectionsVisible}
        isStoriesSettingsVisible={isStoriesSettingsVisible}
        isWhatsNewVisible={isWhatsNewVisible}
        renderAboutContactModal={renderAboutContactModal}
        renderAddUserToAnotherGroup={renderAddUserToAnotherGroup}
        renderContactModal={renderContactModal}
        renderEditHistoryMessagesModal={renderEditHistoryMessagesModal}
        renderErrorModal={renderErrorModal}
        renderDeleteMessagesModal={renderDeleteMessagesModal}
        renderForwardMessagesModal={renderForwardMessagesModal}
        renderMessageRequestActionsConfirmation={
          renderMessageRequestActionsConfirmation
        }
        renderProfileEditor={renderProfileEditor}
        renderUsernameOnboarding={renderUsernameOnboarding}
        renderSafetyNumber={renderSafetyNumber}
        renderSendAnywayDialog={renderSendAnywayDialog}
        renderShortcutGuideModal={renderShortcutGuideModal}
        renderStickerPreviewModal={renderStickerPreviewModal}
        renderStoriesSettings={renderStoriesSettings}
        safetyNumberChangedBlockingData={safetyNumberChangedBlockingData}
        safetyNumberModalContactId={safetyNumberModalContactId}
        sendEditWarningData={sendEditWarningData}
        showFormattingWarningModal={showFormattingWarningModal}
        showSendEditWarningModal={showSendEditWarningModal}
        stickerPackPreviewId={stickerPackPreviewId}
        theme={theme}
        toggleSignalConnectionsModal={toggleSignalConnectionsModal}
        userNotFoundModalState={userNotFoundModalState}
        usernameOnboardingState={usernameOnboardingState}
        isAuthorizingArtCreator={isAuthorizingArtCreator}
        authArtCreatorData={authArtCreatorData}
        cancelAuthorizeArtCreator={cancelAuthorizeArtCreator}
        confirmAuthorizeArtCreator={confirmAuthorizeArtCreator}
      />
    );
  }
);
