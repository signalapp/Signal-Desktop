// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import { Button, ButtonVariant } from './Button';

export type PropsType = {
  buttonVariant?: ButtonVariant;
  description?: string;
  title?: string | null;

  onClose: () => void;
  i18n: LocalizerType;
};

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export function ErrorModal(props: PropsType): JSX.Element {
  const { buttonVariant, description, i18n, onClose, title } = props;

  const footer = (
    <Button
      onClick={onClose}
      ref={focusRef}
      variant={buttonVariant || ButtonVariant.Secondary}
    >
      {i18n('icu:Confirmation--confirm')}
    </Button>
  );

  return (
    <Modal
      modalName="ErrorModal"
      i18n={i18n}
      onClose={onClose}
      title={title == null ? undefined : title || i18n('icu:ErrorModal--title')}
      modalFooter={footer}
    >
      <div className="module-error-modal__description">
        {description || i18n('icu:ErrorModal--description')}
      </div>
    </Modal>
  );
}
