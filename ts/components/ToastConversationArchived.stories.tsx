// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import { ToastConversationArchived } from './ToastConversationArchived';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  i18n,
  onClose: action('onClose'),
  undo: action('undo'),
};

export default {
  title: 'Components/ToastConversationArchived',
};

export const _ToastConversationArchived = (): JSX.Element => (
  <ToastConversationArchived {...defaultProps} />
);

_ToastConversationArchived.story = {
  name: 'ToastConversationArchived',
};
