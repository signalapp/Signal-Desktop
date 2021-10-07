// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';
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

const story = storiesOf('Components/ToastConversationArchived', module);

story.add('ToastConversationArchived', () => (
  <ToastConversationArchived {...defaultProps} />
));
