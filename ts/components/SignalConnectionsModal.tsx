// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { Button, ButtonVariant } from './Button';
import { Intl } from './Intl';
import { Modal } from './Modal';

export type PropsType = {
  i18n: LocalizerType;
  onClose: () => unknown;
};

export const SignalConnectionsModal = ({
  i18n,
  onClose,
}: PropsType): JSX.Element => {
  return (
    <Modal hasXButton i18n={i18n} onClose={onClose}>
      <div className="SignalConnectionsModal">
        <i className="SignalConnectionsModal__icon" />

        <div className="SignalConnectionsModal__description">
          <Intl
            components={{
              connections: (
                <strong>{i18n('SignalConnectionsModal__title')}</strong>
              ),
            }}
            i18n={i18n}
            id="SignalConnectionsModal__header"
          />
        </div>

        <ul className="SignalConnectionsModal__list">
          <li>{i18n('SignalConnectionsModal__bullet--1')}</li>
          <li>{i18n('SignalConnectionsModal__bullet--2')}</li>
          <li>{i18n('SignalConnectionsModal__bullet--3')}</li>
        </ul>

        <div className="SignalConnectionsModal__description">
          {i18n('SignalConnectionsModal__footer')}
        </div>

        <div className="SignalConnectionsModal__button">
          <Button onClick={onClose} variant={ButtonVariant.Primary}>
            {i18n('Confirmation--confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
