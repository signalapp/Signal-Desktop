// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { Button, ButtonVariant } from './Button';
import { Intl } from './Intl';
import { Modal } from './Modal';
import { STORIES_COLOR_THEME } from './Stories';

export type PropsType = {
  i18n: LocalizerType;
  onClose: () => unknown;
};

export function SignalConnectionsModal({
  i18n,
  onClose,
}: PropsType): JSX.Element {
  return (
    <Modal
      modalName="SignalConnectionsModal"
      hasXButton
      i18n={i18n}
      onClose={onClose}
      theme={STORIES_COLOR_THEME}
    >
      <div className="SignalConnectionsModal">
        <i className="SignalConnectionsModal__icon" />

        <div className="SignalConnectionsModal__description">
          <Intl
            components={{
              connections: (
                <strong>{i18n('icu:SignalConnectionsModal__title')}</strong>
              ),
            }}
            i18n={i18n}
            id="icu:SignalConnectionsModal__header"
          />
        </div>

        <ul className="SignalConnectionsModal__list">
          <li>{i18n('icu:SignalConnectionsModal__bullet--1')}</li>
          <li>{i18n('icu:SignalConnectionsModal__bullet--2')}</li>
          <li>{i18n('icu:SignalConnectionsModal__bullet--3')}</li>
        </ul>

        <div className="SignalConnectionsModal__description">
          {i18n('icu:SignalConnectionsModal__footer')}
        </div>

        <div className="SignalConnectionsModal__button">
          <Button onClick={onClose} variant={ButtonVariant.Primary}>
            {i18n('icu:Confirmation--confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
