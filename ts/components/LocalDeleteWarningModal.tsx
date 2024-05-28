// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { Button, ButtonVariant } from './Button';
import { I18n } from './I18n';
import { Modal } from './Modal';

export type PropsType = {
  i18n: LocalizerType;
  onClose: () => unknown;
};

export function LocalDeleteWarningModal({
  i18n,
  onClose,
}: PropsType): JSX.Element {
  return (
    <Modal
      modalName="LocalDeleteWarningModal"
      moduleClassName="LocalDeleteWarningModal"
      i18n={i18n}
      onClose={onClose}
    >
      <div className="LocalDeleteWarningModal">
        <div className="LocalDeleteWarningModal__image">
          <img
            src="images/local-delete-sync.svg"
            height="92"
            width="138"
            alt=""
          />
        </div>

        <div className="LocalDeleteWarningModal__header">
          <I18n i18n={i18n} id="icu:LocalDeleteWarningModal__header" />
        </div>

        <div className="LocalDeleteWarningModal__description">
          <I18n i18n={i18n} id="icu:LocalDeleteWarningModal__description" />
        </div>

        <div className="LocalDeleteWarningModal__button">
          <Button onClick={onClose} variant={ButtonVariant.Primary}>
            <I18n i18n={i18n} id="icu:LocalDeleteWarningModal__confirm" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}
