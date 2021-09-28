// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { DeliveryIssueNotification } from './DeliveryIssueNotification';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';

const story = storiesOf(
  'Components/Conversation/DeliveryIssueNotification',
  module
);

const i18n = setupI18n('en', enMessages);
const sender = getDefaultConversation();

story.add('Default', () => {
  return (
    <DeliveryIssueNotification
      i18n={i18n}
      inGroup={false}
      learnMoreAboutDeliveryIssue={action('learnMoreAboutDeliveryIssue')}
      sender={sender}
    />
  );
});

story.add('With a long name', () => {
  const longName = '🤷🏽‍♀️❤️🐞'.repeat(50);
  return (
    <DeliveryIssueNotification
      i18n={i18n}
      inGroup={false}
      learnMoreAboutDeliveryIssue={action('learnMoreAboutDeliveryIssue')}
      sender={getDefaultConversation({
        firstName: longName,
        name: longName,
        profileName: longName,
        title: longName,
      })}
    />
  );
});

story.add('In Group', () => {
  return (
    <DeliveryIssueNotification
      i18n={i18n}
      inGroup
      learnMoreAboutDeliveryIssue={action('learnMoreAboutDeliveryIssue')}
      sender={sender}
    />
  );
});
