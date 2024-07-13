// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { Button, ButtonVariant } from './Button';
import { Modal } from './Modal';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  onNext: () => void;
  onSkip: () => void;
  onClose: () => void;
}>;

export function UsernameOnboardingModal({
  i18n,
  onNext,
  onSkip,
  onClose,
}: PropsType): JSX.Element {
  return (
    <Modal
      modalName="UsernameOnboardingModal"
      hasXButton
      i18n={i18n}
      onClose={onClose}
    >
      <div className="UsernameOnboardingModal">
        <div className="UsernameOnboardingModal__title">
          {i18n('icu:UsernameOnboardingModalBody__title')}
        </div>

        <div className="UsernameOnboardingModal__row">
          <div className="UsernameOnboardingModal__row__icon UsernameOnboardingModal__row__icon--number" />

          <div className="UsernameOnboardingModal__row__body">
            <h2>
              {i18n('icu:UsernameOnboardingModalBody__row__number__title')}
            </h2>
            {i18n('icu:UsernameOnboardingModalBody__row__number__body')}
          </div>
        </div>

        <div className="UsernameOnboardingModal__row">
          <div className="UsernameOnboardingModal__row__icon UsernameOnboardingModal__row__icon--username" />

          <div className="UsernameOnboardingModal__row__body">
            <h2>
              {i18n('icu:UsernameOnboardingModalBody__row__username__title')}
            </h2>
            {i18n('icu:UsernameOnboardingModalBody__row__username__body')}
          </div>
        </div>

        <div className="UsernameOnboardingModal__row">
          <div className="UsernameOnboardingModal__row__icon UsernameOnboardingModal__row__icon--qr" />

          <div className="UsernameOnboardingModal__row__body">
            <h2>{i18n('icu:UsernameOnboardingModalBody__row__qr__title')}</h2>
            {i18n('icu:UsernameOnboardingModalBody__row__qr__body')}
          </div>
        </div>

        <Button className="UsernameOnboardingModal__submit" onClick={onNext}>
          {i18n('icu:UsernameOnboardingModalBody__continue')}
        </Button>

        <Button
          className="UsernameOnboardingModal__skip"
          variant={ButtonVariant.SecondaryAffirmative}
          onClick={onSkip}
        >
          {i18n('icu:UsernameOnboardingModalBody__skip')}
        </Button>
      </div>
    </Modal>
  );
}
