// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import type { Theme } from '../util/theme.std.js';
import { Button } from './Button.dom.js';
import { Modal } from './Modal.dom.js';

export type PropsType = {
  body: ReactNode;
  i18n: LocalizerType;
  onClose: () => void;
  theme?: Theme;
  title?: string;
};

export function Alert({
  body,
  i18n,
  onClose,
  theme,
  title,
}: PropsType): JSX.Element {
  return (
    <Modal
      i18n={i18n}
      modalFooter={
        <Button onClick={onClose}>{i18n('icu:Confirmation--confirm')}</Button>
      }
      modalName="Alert"
      onClose={onClose}
      theme={theme}
      title={title}
    >
      {body}
    </Modal>
  );
}
