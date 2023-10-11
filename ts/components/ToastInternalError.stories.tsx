// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './ToastInternalError';
import {
  ToastInternalError,
  ToastInternalErrorKind,
} from './ToastInternalError';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  i18n,
  onClose: action('onClose'),
  onShowDebugLog: action('onShowDebugLog'),
};

export default {
  title: 'Components/ToastInternalError',
} satisfies Meta<PropsType>;

export function ToastDecryptionError(): JSX.Element {
  return (
    <ToastInternalError
      kind={ToastInternalErrorKind.DecryptionError}
      deviceId={3}
      name="Someone Somewhere"
      {...defaultProps}
    />
  );
}

export function ToastCDSMirroringError(): JSX.Element {
  return (
    <ToastInternalError
      kind={ToastInternalErrorKind.CDSMirroringError}
      {...defaultProps}
    />
  );
}
