// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util';
import { Toast } from './Toast';

type PropsType = {
  i18n: LocalizerType;
  onClose: () => unknown;
};

export const ToastCaptchaSolved = ({
  i18n,
  onClose,
}: PropsType): JSX.Element => {
  return <Toast onClose={onClose}>{i18n('verificationComplete')}</Toast>;
};
