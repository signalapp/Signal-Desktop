// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent, ReactNode } from 'react';
import React from 'react';

import type { LocalizerType } from '../types/Util';
import { Button } from './Button';
import { Modal } from './Modal';

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
  <Modal i18n={i18n} onClose={onClose} title={title}>
    {body}
    <Modal.ButtonFooter>
      <Button onClick={onClose}>{i18n('Confirmation--confirm')}</Button>
    </Modal.ButtonFooter>
  </Modal>
);
