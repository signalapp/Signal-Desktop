// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import { ToastDecryptionError } from './ToastDecryptionError';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  deviceId: 3,
  i18n,
  name: 'Someone Somewhere',
  onClose: action('onClose'),
  onShowDebugLog: action('onShowDebugLog'),
};

export default {
  title: 'Components/ToastDecryptionError',
};

export const _ToastDecryptionError = (): JSX.Element => (
  <ToastDecryptionError {...defaultProps} />
);

_ToastDecryptionError.story = {
  name: 'ToastDecryptionError',
};
