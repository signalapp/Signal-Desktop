// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import { Button, ButtonVariant } from './Button';

export type PropsType = {
  buttonText?: string;
  description?: string;
  title?: string;

  onClose: () => void;
  i18n: LocalizerType;
};

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export const ErrorModal = (props: PropsType): JSX.Element => {
  const { buttonText, description, i18n, onClose, title } = props;

  return (
    <Modal
      i18n={i18n}
      onClose={onClose}
      title={title || i18n('ErrorModal--title')}
    >
      <>
        <div className="module-error-modal__description">
          {description || i18n('ErrorModal--description')}
        </div>
        <Modal.ButtonFooter>
          <Button
            onClick={onClose}
            ref={focusRef}
            variant={ButtonVariant.Secondary}
          >
            {buttonText || i18n('Confirmation--confirm')}
          </Button>
        </Modal.ButtonFooter>
      </>
    </Modal>
  );
};
