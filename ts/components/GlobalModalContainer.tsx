// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ContactModalStateType } from '../state/ducks/globalModals';

type PropsType = {
  // ContactModal
  contactModalState?: ContactModalStateType;
  renderContactModal: () => JSX.Element;
  // ProfileEditor
  isProfileEditorVisible: boolean;
  renderProfileEditor: () => JSX.Element;
  // SafetyNumberModal
  safetyNumberModalContactId?: string;
  renderSafetyNumber: () => JSX.Element;
};

export const GlobalModalContainer = ({
  // ContactModal
  contactModalState,
  renderContactModal,
  // ProfileEditor
  isProfileEditorVisible,
  renderProfileEditor,
  // SafetyNumberModal
  safetyNumberModalContactId,
  renderSafetyNumber,
}: PropsType): JSX.Element | null => {
  if (safetyNumberModalContactId) {
    return renderSafetyNumber();
  }

  if (contactModalState) {
    return renderContactModal();
  }

  if (isProfileEditorVisible) {
    return renderProfileEditor();
  }

  return null;
};
