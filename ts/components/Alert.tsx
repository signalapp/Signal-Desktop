// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { FunctionComponent, ReactNode } from 'react';

import { LocalizerType } from '../types/Util';
import { Button } from './Button';
import { ModalHost } from './ModalHost';

type PropsType = {
  title?: string;
  body: ReactNode;
  i18n: LocalizerType;
  onClose: () => void;
};

export const Alert: FunctionComponent<PropsType> = ({
  body,
  i18n,
  onClose,
  title,
}) => (
  <ModalHost onClose={onClose}>
    <div className="module-Alert">
      {title && <h1 className="module-Alert__title">{title}</h1>}
      <p className="module-Alert__body">{body}</p>
      <div className="module-Alert__button-container">
        <Button onClick={onClose}>{i18n('Confirmation--confirm')}</Button>
      </div>
    </div>
  </ModalHost>
);
