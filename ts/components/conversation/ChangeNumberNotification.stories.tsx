// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';

import { ChangeNumberNotification } from './ChangeNumberNotification';

const story = storiesOf(
  'Components/Conversation/ChangeNumberNotification',
  module
);

const i18n = setupI18n('en', enMessages);

story.add('Default', () => (
  <ChangeNumberNotification
    sender={getDefaultConversation()}
    timestamp={1618894800000}
    i18n={i18n}
  />
));

story.add('Long name', () => (
  <ChangeNumberNotification
    sender={getDefaultConversation({
      firstName: '💅😇🖋'.repeat(50),
    })}
    timestamp={1618894800000}
    i18n={i18n}
  />
));
