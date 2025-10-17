// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { isSafetyNumberNotAvailable } from '../util/isSafetyNumberNotAvailable.std.js';
import { Modal } from './Modal.dom.js';
import type { PropsType as SafetyNumberViewerPropsType } from './SafetyNumberViewer.dom.js';
import { SafetyNumberViewer } from './SafetyNumberViewer.dom.js';
import { SafetyNumberNotReady } from './SafetyNumberNotReady.dom.js';

type PropsType = {
  toggleSafetyNumberModal: () => unknown;
} & Omit<SafetyNumberViewerPropsType, 'onClose'>;

export function SafetyNumberModal({
  i18n,
  toggleSafetyNumberModal,
  ...safetyNumberViewerProps
}: PropsType): JSX.Element | null {
  const { contact } = safetyNumberViewerProps;

  let title: string | undefined;
  let content: JSX.Element;
  let hasXButton = true;
  if (isSafetyNumberNotAvailable(contact)) {
    content = (
      <SafetyNumberNotReady
        i18n={i18n}
        onClose={() => toggleSafetyNumberModal()}
      />
    );
    hasXButton = false;
  } else {
    title = i18n('icu:SafetyNumberModal__title');

    content = (
      <SafetyNumberViewer
        i18n={i18n}
        onClose={toggleSafetyNumberModal}
        {...safetyNumberViewerProps}
      />
    );
  }

  return (
    <Modal
      modalName="SafetyNumberModal"
      hasXButton={hasXButton}
      i18n={i18n}
      moduleClassName="module-SafetyNumberViewer__modal"
      onClose={toggleSafetyNumberModal}
      title={title}
    >
      {content}
    </Modal>
  );
}
