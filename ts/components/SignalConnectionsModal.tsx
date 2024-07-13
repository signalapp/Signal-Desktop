// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { I18n } from './I18n';
import { Modal } from './Modal';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  onClose: () => unknown;
}>;

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
    >
      <div className="SignalConnectionsModal">
        <i className="SignalConnectionsModal__icon" />

        <div className="SignalConnectionsModal__description">
          <I18n
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
      </div>
    </Modal>
  );
}
