// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback } from 'react';

import { SafetyNumberMode } from '../types/safetyNumber';
import { isSafetyNumberNotAvailable } from '../util/isSafetyNumberNotAvailable';
import { Modal } from './Modal';
import type { PropsType as SafetyNumberViewerPropsType } from './SafetyNumberViewer';
import { SafetyNumberViewer } from './SafetyNumberViewer';
import { SafetyNumberOnboarding } from './SafetyNumberOnboarding';
import { SafetyNumberNotReady } from './SafetyNumberNotReady';

type PropsType = {
  toggleSafetyNumberModal: () => unknown;
  hasCompletedSafetyNumberOnboarding: boolean;
  markHasCompletedSafetyNumberOnboarding: () => unknown;
} & Omit<SafetyNumberViewerPropsType, 'onClose'>;

export function SafetyNumberModal({
  i18n,
  toggleSafetyNumberModal,
  hasCompletedSafetyNumberOnboarding,
  markHasCompletedSafetyNumberOnboarding,
  ...safetyNumberViewerProps
}: PropsType): JSX.Element | null {
  const { contact, safetyNumberMode } = safetyNumberViewerProps;

  const [isOnboarding, setIsOnboarding] = useState(
    safetyNumberMode !== SafetyNumberMode.JustE164 &&
      !hasCompletedSafetyNumberOnboarding
  );

  const showOnboarding = useCallback(() => {
    setIsOnboarding(true);
  }, [setIsOnboarding]);

  const hideOnboarding = useCallback(() => {
    setIsOnboarding(false);
    markHasCompletedSafetyNumberOnboarding();
  }, [setIsOnboarding, markHasCompletedSafetyNumberOnboarding]);

  const missingRequiredE164 =
    safetyNumberMode !== SafetyNumberMode.DefaultACIAndMaybeE164 &&
    !contact.e164;

  let title: string | undefined;
  let content: JSX.Element;
  let hasXButton = true;
  if (missingRequiredE164 || isSafetyNumberNotAvailable(contact)) {
    content = (
      <SafetyNumberNotReady
        i18n={i18n}
        onClose={() => toggleSafetyNumberModal()}
      />
    );
    hasXButton = false;
  } else if (isOnboarding) {
    content = <SafetyNumberOnboarding i18n={i18n} onClose={hideOnboarding} />;
  } else {
    title = i18n('icu:SafetyNumberModal__title');

    content = (
      <SafetyNumberViewer
        i18n={i18n}
        onClose={toggleSafetyNumberModal}
        showOnboarding={showOnboarding}
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
