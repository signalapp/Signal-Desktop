// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { LocalizerType } from '../types/Util';
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
    <Toast onClick={onOpenFile} onClose={onClose}>
      {i18n('attachmentSaved')}
    </Toast>
  );
};
