// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';
import { Button, ButtonVariant } from './Button.dom.js';
import { CRITICAL_IDLE_PRIMARY_DEVICE_SUPPORT_PAGE } from './CriticalIdlePrimaryDeviceDialog.dom.js';
import { I18n } from './I18n.dom.js';

type PropsType = Readonly<{
  i18n: LocalizerType;
  onClose: () => void;
}>;

export function CriticalIdlePrimaryDeviceModal({
  i18n,
  onClose,
}: PropsType): JSX.Element {
  const learnMoreLink = (parts: Array<string | JSX.Element>) => (
    <a
      href={CRITICAL_IDLE_PRIMARY_DEVICE_SUPPORT_PAGE}
      rel="noreferrer"
      target="_blank"
    >
      {parts}
    </a>
  );
  return (
    <Modal
      modalName="CriticalIdlePrimaryDeviceModal"
      moduleClassName="CriticalIdlePrimaryDeviceModal"
      i18n={i18n}
      onClose={onClose}
    >
      <div className="CriticalIdlePrimaryDeviceModal__content">
        <div className="CriticalIdlePrimaryDeviceModal__icon" />

        <div className="CriticalIdlePrimaryDeviceModal__header">
          {i18n('icu:CriticalIdlePrimaryDeviceModal__title')}
        </div>

        <div className="CriticalIdlePrimaryDeviceModal__description">
          <I18n
            id="icu:CriticalIdlePrimaryDeviceModal__description"
            i18n={i18n}
            components={{
              learnMoreLink,
            }}
          />
        </div>

        <div className="CriticalIdlePrimaryDeviceModal__button">
          <Button onClick={onClose} variant={ButtonVariant.Primary}>
            {i18n('icu:Confirmation--confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
