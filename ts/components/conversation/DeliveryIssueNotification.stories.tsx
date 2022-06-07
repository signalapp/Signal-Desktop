// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { DeliveryIssueNotification } from './DeliveryIssueNotification';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';

export default {
  title: 'Components/Conversation/DeliveryIssueNotification',
};

const i18n = setupI18n('en', enMessages);
const sender = getDefaultConversation();

export const Default = (): JSX.Element => {
  return (
    <DeliveryIssueNotification
      i18n={i18n}
      inGroup={false}
      learnMoreAboutDeliveryIssue={action('learnMoreAboutDeliveryIssue')}
      sender={sender}
    />
  );
};

export const WithALongName = (): JSX.Element => {
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
};

WithALongName.story = {
  name: 'With a long name',
};

export const InGroup = (): JSX.Element => {
  return (
    <DeliveryIssueNotification
      i18n={i18n}
      inGroup
      learnMoreAboutDeliveryIssue={action('learnMoreAboutDeliveryIssue')}
      sender={sender}
    />
  );
};
