// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { DeliveryIssueDialog } from './DeliveryIssueDialog';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);
const sender = getDefaultConversation();

storiesOf('Components/Conversation/DeliveryIssueDialog', module).add(
  'Default',
  () => {
    return (
      <DeliveryIssueDialog
        i18n={i18n}
        sender={sender}
        inGroup={false}
        learnMoreAboutDeliveryIssue={action('learnMoreAboutDeliveryIssue')}
        onClose={action('onClose')}
      />
    );
  }
);

storiesOf('Components/Conversation/DeliveryIssueDialog', module).add(
  'In Group',
  () => {
    return (
      <DeliveryIssueDialog
        i18n={i18n}
        sender={sender}
        inGroup
        learnMoreAboutDeliveryIssue={action('learnMoreAboutDeliveryIssue')}
        onClose={action('onClose')}
      />
    );
  }
);
