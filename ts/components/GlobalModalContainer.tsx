// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type {
  AuthorizeArtCreatorDataType,
  ContactModalStateType,
  DeleteMessagesPropsType,
  EditHistoryMessagesType,
  FormattingWarningDataType,
  ForwardMessagesPropsType,
  SafetyNumberChangedBlockingDataType,
  SendEditWarningDataType,
  UserNotFoundModalStateType,
} from '../state/ducks/globalModals';
import type { LocalizerType, ThemeType } from '../types/Util';
import { UsernameOnboardingState } from '../types/globalModals';
import type { ExplodePromiseResultType } from '../util/explodePromise';
import { missingCaseError } from '../util/missingCaseError';

import { ButtonVariant } from './Button';
import { ConfirmationDialog } from './ConfirmationDialog';
import { FormattingWarningModal } from './FormattingWarningModal';
import { SendEditWarningModal } from './SendEditWarningModal';
import { SignalConnectionsModal } from './SignalConnectionsModal';
import { WhatsNewModal } from './WhatsNewModal';

// NOTE: All types should be required for this component so that the smart
// component gives you type errors when adding/removing props.
export type PropsType = {
  i18n: LocalizerType;
  theme: ThemeType;
  // AddUserToAnotherGroupModal
  addUserToAnotherGroupModalContactId: string | undefined;
  renderAddUserToAnotherGroup: () => JSX.Element;
  // ContactModal
  contactModalState: ContactModalStateType | undefined;
  renderContactModal: () => JSX.Element;
  // EditHistoryMessagesModal
  editHistoryMessages: EditHistoryMessagesType | undefined;
  renderEditHistoryMessagesModal: () => JSX.Element;
  // ErrorModal
  errorModalProps: { description?: string; title?: string } | undefined;
  renderErrorModal: (opts: {
    description?: string;
    title?: string;
  }) => JSX.Element;
  // DeleteMessageModal
  deleteMessagesProps: DeleteMessagesPropsType | undefined;
  renderDeleteMessagesModal: () => JSX.Element;
  // FormattingWarningModal
  showFormattingWarningModal: (
    explodedPromise: ExplodePromiseResultType<boolean> | undefined
  ) => void;
  formattingWarningData: FormattingWarningDataType | undefined;
  // ForwardMessageModal
  forwardMessagesProps: ForwardMessagesPropsType | undefined;
  renderForwardMessagesModal: () => JSX.Element;
  // ProfileEditor
  isProfileEditorVisible: boolean;
  renderProfileEditor: () => JSX.Element;
  // SafetyNumberModal
  safetyNumberModalContactId: string | undefined;
  renderSafetyNumber: () => JSX.Element;
  // SendEditWarningModal
  showSendEditWarningModal: (
    explodedPromise: ExplodePromiseResultType<boolean> | undefined
  ) => void;
  sendEditWarningData: SendEditWarningDataType | undefined;
  // ShortcutGuideModal
  isShortcutGuideModalVisible: boolean;
  renderShortcutGuideModal: () => JSX.Element;
  // SignalConnectionsModal
  isSignalConnectionsVisible: boolean;
  toggleSignalConnectionsModal: () => unknown;
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
  // AuthArtCreatorModal
  authArtCreatorData?: AuthorizeArtCreatorDataType;
  isAuthorizingArtCreator?: boolean;
  cancelAuthorizeArtCreator: () => unknown;
  confirmAuthorizeArtCreator: () => unknown;
};

export function GlobalModalContainer({
  i18n,
  // AddUserToAnotherGroupModal
  addUserToAnotherGroupModalContactId,
  renderAddUserToAnotherGroup,
  // ContactModal
  contactModalState,
  renderContactModal,
  // EditHistoryMessages
  editHistoryMessages,
  renderEditHistoryMessagesModal,
  // ErrorModal
  errorModalProps,
  renderErrorModal,
  // DeleteMessageModal
  deleteMessagesProps,
  renderDeleteMessagesModal,
  // FormattingWarningModal
  showFormattingWarningModal,
  formattingWarningData,
  // ForwardMessageModal
  forwardMessagesProps,
  renderForwardMessagesModal,
  // ProfileEditor
  isProfileEditorVisible,
  renderProfileEditor,
  // SafetyNumberModal
  safetyNumberModalContactId,
  renderSafetyNumber,
  // SendEditWarningDataType
  showSendEditWarningModal,
  sendEditWarningData,
  // ShortcutGuideModal
  isShortcutGuideModalVisible,
  renderShortcutGuideModal,
  // SignalConnectionsModal
  isSignalConnectionsVisible,
  toggleSignalConnectionsModal,
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
  // AuthArtCreatorModal
  authArtCreatorData,
  isAuthorizingArtCreator,
  cancelAuthorizeArtCreator,
  confirmAuthorizeArtCreator,
}: PropsType): JSX.Element | null {
  // We want the following dialogs to show in this order:
  // 1. Errors
  // 2. Safety Number Changes
  // 3. The Rest (in no particular order, but they're ordered alphabetically)

  // Errors
  if (errorModalProps) {
    return renderErrorModal(errorModalProps);
  }

  // Safety Number
  if (hasSafetyNumberChangeModal || safetyNumberChangedBlockingData) {
    return renderSendAnywayDialog();
  }

  // The Rest

  if (addUserToAnotherGroupModalContactId) {
    return renderAddUserToAnotherGroup();
  }

  if (contactModalState) {
    return renderContactModal();
  }

  if (editHistoryMessages) {
    return renderEditHistoryMessagesModal();
  }

  if (deleteMessagesProps) {
    return renderDeleteMessagesModal();
  }

  if (formattingWarningData) {
    const { resolve } = formattingWarningData.explodedPromise;
    return (
      <FormattingWarningModal
        i18n={i18n}
        onSendAnyway={() => {
          showFormattingWarningModal(undefined);
          resolve(true);
        }}
        onCancel={() => {
          showFormattingWarningModal(undefined);
          resolve(false);
        }}
      />
    );
  }

  if (forwardMessagesProps) {
    return renderForwardMessagesModal();
  }

  if (isProfileEditorVisible) {
    return renderProfileEditor();
  }

  if (sendEditWarningData) {
    const { resolve } = sendEditWarningData.explodedPromise;
    return (
      <SendEditWarningModal
        i18n={i18n}
        onSendAnyway={() => {
          showSendEditWarningModal(undefined);
          resolve(true);
        }}
        onCancel={() => {
          showSendEditWarningModal(undefined);
          resolve(false);
        }}
      />
    );
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

  if (isStoriesSettingsVisible) {
    return renderStoriesSettings();
  }

  if (isWhatsNewVisible) {
    return <WhatsNewModal hideWhatsNewModal={hideWhatsNewModal} i18n={i18n} />;
  }

  if (usernameOnboardingState === UsernameOnboardingState.Open) {
    return renderUsernameOnboarding();
  }

  if (safetyNumberModalContactId) {
    return renderSafetyNumber();
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

  if (authArtCreatorData) {
    return (
      <ConfirmationDialog
        dialogName="GlobalModalContainer.authArtCreator"
        cancelText={i18n('icu:AuthArtCreator--dialog--dismiss')}
        cancelButtonVariant={ButtonVariant.Secondary}
        i18n={i18n}
        isSpinning={isAuthorizingArtCreator}
        onClose={cancelAuthorizeArtCreator}
        actions={[
          {
            text: i18n('icu:AuthArtCreator--dialog--confirm'),
            style: 'affirmative',
            action: confirmAuthorizeArtCreator,
            autoClose: false,
          },
        ]}
      >
        {i18n('icu:AuthArtCreator--dialog--message')}
      </ConfirmationDialog>
    );
  }

  return null;
}
