// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';

import { ResetSessionNotification } from './ResetSessionNotification';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ResetSessionNotification',
  module
);

story.add('Notification', () => {
  return <ResetSessionNotification i18n={i18n} />;
});
