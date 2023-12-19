// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util';
import { Toast } from './Toast';

export type ToastPropsType = {
  limit: number;
  units: string;
};

export type PropsType = {
  i18n: LocalizerType;
  onClose: () => unknown;
} & ToastPropsType;

export function ToastFileSize({
  i18n,
  limit,
  onClose,
  units,
}: PropsType): JSX.Element {
  return (
    <Toast onClose={onClose}>
      {i18n('icu:fileSizeWarning', { limit, units })}
    </Toast>
  );
}
