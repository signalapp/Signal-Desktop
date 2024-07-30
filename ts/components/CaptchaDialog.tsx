// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useState } from 'react';

import type { LocalizerType } from '../types/Util';
import { Button, ButtonVariant } from './Button';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  isPending: boolean;

  onContinue: () => void;
  onSkip: () => void;
}>;

export function CaptchaDialog({
  i18n,
  isPending,
  onSkip,
  onContinue,
}: PropsType): JSX.Element {
  const [isClosing, setIsClosing] = useState(false);

  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const onCancelClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setIsClosing(false);
  };

  const onSkipClick = (event: React.MouseEvent) => {
    event.preventDefault();
    onSkip();
  };

  if (isClosing && !isPending) {
    const footer = (
      <>
        <Button onClick={onCancelClick} variant={ButtonVariant.Secondary}>
          {i18n('icu:cancel')}
        </Button>
        <Button onClick={onSkipClick} variant={ButtonVariant.Destructive}>
          {i18n('icu:CaptchaDialog--can_close__skip-verification')}
        </Button>
      </>
    );
    return (
      <Modal
        modalName="CaptchaDialog"
        moduleClassName="module-Modal"
        i18n={i18n}
        title={i18n('icu:CaptchaDialog--can-close__title')}
        onClose={() => setIsClosing(false)}
        key="skip"
        modalFooter={footer}
      >
        <section>
          <p>{i18n('icu:CaptchaDialog--can-close__body')}</p>
        </section>
      </Modal>
    );
  }

  const onContinueClick = (event: React.MouseEvent) => {
    event.preventDefault();

    onContinue();
  };

  const updateButtonRef = (button: HTMLButtonElement): void => {
    buttonRef.current = button;
    if (button) {
      button.focus();
    }
  };

  const footer = (
    <Button
      disabled={isPending}
      onClick={onContinueClick}
      ref={updateButtonRef}
      variant={ButtonVariant.Primary}
    >
      {isPending ? (
        <Spinner size="22px" svgSize="small" direction="on-primary-button" />
      ) : (
        'Continue'
      )}
    </Button>
  );

  return (
    <Modal
      modalName="CaptchaDialog.pending"
      moduleClassName="module-Modal--important"
      i18n={i18n}
      title={i18n('icu:CaptchaDialog__title')}
      hasXButton
      onClose={() => setIsClosing(true)}
      key="primary"
      modalFooter={footer}
    >
      <section>
        <p>{i18n('icu:CaptchaDialog__first-paragraph')}</p>
        <p>{i18n('icu:CaptchaDialog__second-paragraph')}</p>
      </section>
    </Modal>
  );
}
