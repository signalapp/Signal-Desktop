// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType } from './DeliveryIssueDialog';
import { DeliveryIssueDialog } from './DeliveryIssueDialog';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);
const sender = getDefaultConversation();

export default {
  title: 'Components/Conversation/DeliveryIssueDialog',
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  return (
    <DeliveryIssueDialog
      i18n={i18n}
      sender={sender}
      inGroup={false}
      onClose={action('onClose')}
    />
  );
}

export function InGroup(): JSX.Element {
  return (
    <DeliveryIssueDialog
      i18n={i18n}
      sender={sender}
      inGroup
      onClose={action('onClose')}
    />
  );
}
