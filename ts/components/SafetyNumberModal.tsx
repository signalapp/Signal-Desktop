// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Modal } from './Modal';
import type { PropsType as SafetyNumberViewerPropsType } from './SafetyNumberViewer';
import { SafetyNumberViewer } from './SafetyNumberViewer';

type PropsType = {
  toggleSafetyNumberModal: () => unknown;
} & Omit<SafetyNumberViewerPropsType, 'onClose'>;

export function SafetyNumberModal({
  i18n,
  toggleSafetyNumberModal,
  ...safetyNumberViewerProps
}: PropsType): JSX.Element | null {
  return (
    <Modal
      modalName="SafetyNumberModal"
      hasXButton
      i18n={i18n}
      moduleClassName="module-SafetyNumberViewer__modal"
      onClose={toggleSafetyNumberModal}
      title={i18n('icu:SafetyNumberModal__title')}
    >
      <SafetyNumberViewer
        i18n={i18n}
        onClose={toggleSafetyNumberModal}
        {...safetyNumberViewerProps}
      />
    </Modal>
  );
}
