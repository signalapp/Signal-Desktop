// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util';
import { Toast } from './Toast';

export type ToastPropsType = {
  onOpenFile: () => unknown;
};

type PropsType = {
  i18n: LocalizerType;
  onClose: () => unknown;
} & ToastPropsType;

export const ToastFileSaved = ({
  i18n,
  onClose,
  onOpenFile,
}: PropsType): JSX.Element => {
  return (
    <Toast
      onClose={onClose}
      toastAction={{
        label: i18n('attachmentSavedShow'),
        onClick: onOpenFile,
      }}
    >
      {i18n('attachmentSaved')}
    </Toast>
  );
};
