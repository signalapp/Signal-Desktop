// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type {
  ContactModalStateType,
  UsernameNotFoundModalStateType,
} from '../state/ducks/globalModals';
import type { LocalizerType } from '../types/Util';

import { ButtonVariant } from './Button';
import { ConfirmationDialog } from './ConfirmationDialog';
import { WhatsNewModal } from './WhatsNewModal';

type PropsType = {
  i18n: LocalizerType;
  // ContactModal
  contactModalState?: ContactModalStateType;
  renderContactModal: () => JSX.Element;
  // ProfileEditor
  isProfileEditorVisible: boolean;
  renderProfileEditor: () => JSX.Element;
  // SafetyNumberModal
  safetyNumberModalContactId?: string;
  renderSafetyNumber: () => JSX.Element;
  // UsernameNotFoundModal
  hideUsernameNotFoundModal: () => unknown;
  usernameNotFoundModalState?: UsernameNotFoundModalStateType;
  // WhatsNewModal
  isWhatsNewVisible: boolean;
  hideWhatsNewModal: () => unknown;
};

export const GlobalModalContainer = ({
  i18n,
  // ContactModal
  contactModalState,
  renderContactModal,
  // ProfileEditor
  isProfileEditorVisible,
  renderProfileEditor,
  // SafetyNumberModal
  safetyNumberModalContactId,
  renderSafetyNumber,
  // UsernameNotFoundModal
  hideUsernameNotFoundModal,
  usernameNotFoundModalState,
  // WhatsNewModal
  hideWhatsNewModal,
  isWhatsNewVisible,
}: PropsType): JSX.Element | null => {
  if (safetyNumberModalContactId) {
    return renderSafetyNumber();
  }

  if (usernameNotFoundModalState) {
    return (
      <ConfirmationDialog
        cancelText={i18n('ok')}
        cancelButtonVariant={ButtonVariant.Secondary}
        i18n={i18n}
        onClose={hideUsernameNotFoundModal}
      >
        {i18n('startConversation--username-not-found', {
          atUsername: i18n('at-username', {
            username: usernameNotFoundModalState.username,
          }),
        })}
      </ConfirmationDialog>
    );
  }

  if (contactModalState) {
    return renderContactModal();
  }

  if (isProfileEditorVisible) {
    return renderProfileEditor();
  }

  if (isWhatsNewVisible) {
    return <WhatsNewModal hideWhatsNewModal={hideWhatsNewModal} i18n={i18n} />;
  }

  return null;
};
