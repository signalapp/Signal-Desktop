// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';

import type { GlobalModalsStateType } from '../ducks/globalModals';
import type { StateType } from '../reducer';
import { ErrorModal } from '../../components/ErrorModal';
import { GlobalModalContainer } from '../../components/GlobalModalContainer';
import { SmartAddUserToAnotherGroupModal } from './AddUserToAnotherGroupModal';
import { SmartContactModal } from './ContactModal';
import { SmartForwardMessageModal } from './ForwardMessageModal';
import { SmartProfileEditorModal } from './ProfileEditorModal';
import { SmartSafetyNumberModal } from './SafetyNumberModal';
import { SmartSendAnywayDialog } from './SendAnywayDialog';
import { SmartShortcutGuideModal } from './ShortcutGuideModal';
import { SmartStickerPreviewModal } from './StickerPreviewModal';
import { SmartStoriesSettingsModal } from './StoriesSettingsModal';
import { getConversationsStoppingSend } from '../selectors/conversations';
import { getIntl, getTheme } from '../selectors/user';
import { useGlobalModalActions } from '../ducks/globalModals';

function renderProfileEditor(): JSX.Element {
  return <SmartProfileEditorModal />;
}

function renderContactModal(): JSX.Element {
  return <SmartContactModal />;
}

function renderForwardMessageModal(): JSX.Element {
  return <SmartForwardMessageModal />;
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

export function SmartGlobalModalContainer(): JSX.Element {
  const conversationsStoppingSend = useSelector(getConversationsStoppingSend);
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);

  const hasSafetyNumberChangeModal = conversationsStoppingSend.length > 0;

  const {
    addUserToAnotherGroupModalContactId,
    contactModalState,
    errorModalProps,
    forwardMessageProps,
    isProfileEditorVisible,
    isShortcutGuideModalVisible,
    isSignalConnectionsVisible,
    isStoriesSettingsVisible,
    isWhatsNewVisible,
    safetyNumberChangedBlockingData,
    safetyNumberModalContactId,
    stickerPackPreviewId,
    userNotFoundModalState,
  } = useSelector<StateType, GlobalModalsStateType>(
    state => state.globalModals
  );

  const {
    closeErrorModal,
    hideWhatsNewModal,
    hideUserNotFoundModal,
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
      <SmartSafetyNumberModal contactID={String(safetyNumberModalContactId)} />
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
    ({ description, title }: { description?: string; title?: string }) => (
      <ErrorModal
        title={title}
        description={description}
        i18n={i18n}
        onClose={closeErrorModal}
      />
    ),
    [closeErrorModal, i18n]
  );

  return (
    <GlobalModalContainer
      addUserToAnotherGroupModalContactId={addUserToAnotherGroupModalContactId}
      contactModalState={contactModalState}
      errorModalProps={errorModalProps}
      forwardMessageProps={forwardMessageProps}
      hasSafetyNumberChangeModal={hasSafetyNumberChangeModal}
      hideUserNotFoundModal={hideUserNotFoundModal}
      hideWhatsNewModal={hideWhatsNewModal}
      i18n={i18n}
      isProfileEditorVisible={isProfileEditorVisible}
      isShortcutGuideModalVisible={isShortcutGuideModalVisible}
      isSignalConnectionsVisible={isSignalConnectionsVisible}
      isStoriesSettingsVisible={isStoriesSettingsVisible}
      isWhatsNewVisible={isWhatsNewVisible}
      renderAddUserToAnotherGroup={renderAddUserToAnotherGroup}
      renderContactModal={renderContactModal}
      renderErrorModal={renderErrorModal}
      renderForwardMessageModal={renderForwardMessageModal}
      renderProfileEditor={renderProfileEditor}
      renderSafetyNumber={renderSafetyNumber}
      renderSendAnywayDialog={renderSendAnywayDialog}
      renderShortcutGuideModal={renderShortcutGuideModal}
      renderStickerPreviewModal={renderStickerPreviewModal}
      renderStoriesSettings={renderStoriesSettings}
      safetyNumberChangedBlockingData={safetyNumberChangedBlockingData}
      safetyNumberModalContactId={safetyNumberModalContactId}
      stickerPackPreviewId={stickerPackPreviewId}
      theme={theme}
      toggleSignalConnectionsModal={toggleSignalConnectionsModal}
      userNotFoundModalState={userNotFoundModalState}
    />
  );
}
