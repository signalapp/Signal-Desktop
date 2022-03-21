// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useState } from 'react';

import type { LocalizerType } from '../types/Util';
import { Button, ButtonVariant } from './Button';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

type PropsType = {
  i18n: LocalizerType;
  isPending: boolean;

  onContinue: () => void;
  onSkip: () => void;
};

export function CaptchaDialog(props: Readonly<PropsType>): JSX.Element {
  const { i18n, isPending, onSkip, onContinue } = props;

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
    return (
      <Modal
        moduleClassName="module-Modal"
        i18n={i18n}
        title={i18n('CaptchaDialog--can-close__title')}
        onClose={() => setIsClosing(false)}
        key="skip"
      >
        <section>
          <p>{i18n('CaptchaDialog--can-close__body')}</p>
        </section>
        <Modal.ButtonFooter>
          <Button onClick={onCancelClick} variant={ButtonVariant.Secondary}>
            {i18n('cancel')}
          </Button>
          <Button onClick={onSkipClick} variant={ButtonVariant.Destructive}>
            {i18n('CaptchaDialog--can_close__skip-verification')}
          </Button>
        </Modal.ButtonFooter>
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

  return (
    <Modal
      moduleClassName="module-Modal--important"
      i18n={i18n}
      title={i18n('CaptchaDialog__title')}
      hasXButton
      onClose={() => setIsClosing(true)}
      key="primary"
    >
      <section>
        <p>{i18n('CaptchaDialog__first-paragraph')}</p>
        <p>{i18n('CaptchaDialog__second-paragraph')}</p>
      </section>
      <Modal.ButtonFooter>
        <Button
          disabled={isPending}
          onClick={onContinueClick}
          ref={updateButtonRef}
          variant={ButtonVariant.Primary}
        >
          {isPending ? (
            <Spinner size="22px" svgSize="small" direction="on-captcha" />
          ) : (
            'Continue'
          )}
        </Button>
      </Modal.ButtonFooter>
    </Modal>
  );
}
