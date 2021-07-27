// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { DeliveryIssueNotification } from './DeliveryIssueNotification';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);
const sender = getDefaultConversation();

storiesOf('Components/Conversation/DeliveryIssueNotification', module).add(
  'Default',
  () => {
    return (
      <DeliveryIssueNotification i18n={i18n} inGroup={false} sender={sender} />
    );
  }
);

storiesOf('Components/Conversation/DeliveryIssueNotification', module).add(
  'In Group',
  () => {
    return <DeliveryIssueNotification i18n={i18n} inGroup sender={sender} />;
  }
);
