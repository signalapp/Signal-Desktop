// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { Modal } from './Modal.dom.js';
import { Button, ButtonVariant } from './Button.dom.js';

export enum BackfillFailureKind {
  Timeout = 'Timeout',
  NotFound = 'NotFound',
}

export type DataPropsType = Readonly<{
  kind: BackfillFailureKind;
}>;

export type HousekeepingPropsType = Readonly<{
  i18n: LocalizerType;
  onClose: () => void;
}>;

export type PropsType = DataPropsType & HousekeepingPropsType;

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export function BackfillFailureModal(props: PropsType): JSX.Element {
  const { i18n, kind, onClose } = props;

  const footer = (
    <Button onClick={onClose} ref={focusRef} variant={ButtonVariant.Primary}>
      {i18n('icu:Confirmation--confirm')}
    </Button>
  );

  let body: string;
  if (kind === BackfillFailureKind.Timeout) {
    body = i18n('icu:BackfillFailureModal__body--timeout');
  } else if (kind === BackfillFailureKind.NotFound) {
    body = i18n('icu:BackfillFailureModal__body--not-found');
  } else {
    throw missingCaseError(kind);
  }

  return (
    <Modal
      modalName="BackfillFailureModal"
      moduleClassName="BackfillFailureModal"
      title={i18n('icu:BackfillFailureModal__title')}
      i18n={i18n}
      onClose={onClose}
      modalFooter={footer}
      padded={false}
    >
      <div className="module-error-modal__description">{body}</div>
    </Modal>
  );
}
