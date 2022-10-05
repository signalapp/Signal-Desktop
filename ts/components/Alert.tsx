// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent, ReactNode } from 'react';
import React from 'react';

import type { LocalizerType } from '../types/Util';
import type { Theme } from '../util/theme';
import { Button } from './Button';
import { Modal } from './Modal';

type PropsType = {
  body: ReactNode;
  i18n: LocalizerType;
  onClose: () => void;
  theme?: Theme;
  title?: string;
};

export const Alert: FunctionComponent<PropsType> = ({
  body,
  i18n,
  onClose,
  theme,
  title,
}) => (
  <Modal
    i18n={i18n}
    modalFooter={
      <Button onClick={onClose}>{i18n('Confirmation--confirm')}</Button>
    }
    modalName="Alert"
    onClose={onClose}
    theme={theme}
    title={title}
  >
    {body}
  </Modal>
);
