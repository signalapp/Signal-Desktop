// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { StagedPlaceholderAttachment } from './StagedPlaceholderAttachment';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/StagedPlaceholderAttachment',
  module
);

story.add('Default', () => {
  return (
    <StagedPlaceholderAttachment i18n={i18n} onClick={action('onClick')} />
  );
});
