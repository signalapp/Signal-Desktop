// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util';
import { Toast } from './Toast';

export type ToastPropsType = {
  i18n: LocalizerType;
  isIncoming: boolean;
  onClose: () => unknown;
};

export const ToastCannotOpenGiftBadge = ({
  i18n,
  isIncoming,
  onClose,
}: ToastPropsType): JSX.Element => {
  const key = `message--giftBadge--unopened--toast--${
    isIncoming ? 'incoming' : 'outgoing'
  }`;

  return <Toast onClose={onClose}>{i18n(key)}</Toast>;
};
