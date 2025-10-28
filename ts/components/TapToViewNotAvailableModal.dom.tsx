// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';
import { Button, ButtonVariant } from './Button.dom.js';

export type DataPropsType = {
  parameters: {
    name: string;
  };
  type: TapToViewNotAvailableType;
};

export type HousekeepingPropsType = {
  i18n: LocalizerType;
  onClose: () => void;
};

export type PropsType = DataPropsType & HousekeepingPropsType;

export enum TapToViewNotAvailableType {
  Error = 'Error',
  Expired = 'Expired',
}

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export function TapToViewNotAvailableModal(props: PropsType): JSX.Element {
  const { i18n, onClose, parameters, type } = props;

  const footer = (
    <Button onClick={onClose} ref={focusRef} variant={ButtonVariant.Primary}>
      {i18n('icu:Confirmation--confirm')}
    </Button>
  );

  const bodyText =
    type === TapToViewNotAvailableType.Expired
      ? i18n('icu:TapToViewNotAvailableModal__body--expired', parameters)
      : i18n('icu:TapToViewNotAvailableModal__body--error', parameters);

  return (
    <Modal
      modalName="TapToViewNotAvailableModal"
      moduleClassName="TapToViewNotAvailableModal"
      i18n={i18n}
      onClose={onClose}
      modalFooter={footer}
      padded={false}
    >
      <div className="module-error-modal__description">{bodyText}</div>
    </Modal>
  );
}
