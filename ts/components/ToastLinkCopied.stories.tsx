// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import { ToastLinkCopied } from './ToastLinkCopied';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  i18n,
  onClose: action('onClose'),
};

export default {
  title: 'Components/ToastLinkCopied',
};

export const _ToastLinkCopied = (): JSX.Element => (
  <ToastLinkCopied {...defaultProps} />
);

_ToastLinkCopied.story = {
  name: 'ToastLinkCopied',
};
