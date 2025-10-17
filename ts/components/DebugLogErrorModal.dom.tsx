// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';
import { Button, ButtonVariant } from './Button.dom.js';

export type PropsType = {
  description?: string;
  i18n: LocalizerType;
  onClose: () => void;
  onSubmitDebugLog: () => void;
};

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export function DebugLogErrorModal(props: PropsType): JSX.Element {
  const { description, i18n, onClose, onSubmitDebugLog } = props;

  const footer = (
    <>
      <Button onClick={onClose} variant={ButtonVariant.Secondary}>
        {i18n('icu:DebugLogErrorModal__SubmitDebugLog__Cancel')}
      </Button>
      <Button
        onClick={() => {
          onSubmitDebugLog();
          onClose();
        }}
        ref={focusRef}
        variant={ButtonVariant.Primary}
      >
        {i18n('icu:DebugLogErrorModal__SubmitDebugLog')}
      </Button>
    </>
  );

  return (
    <Modal
      modalName="DebugLogErrorModal"
      i18n={i18n}
      onClose={onClose}
      title={i18n('icu:DebugLogErrorModal__UnexpectedError')}
      modalFooter={footer}
    >
      <div className="module-error-modal__description">
        {description || i18n('icu:ErrorModal--description')}
      </div>
    </Modal>
  );
}
