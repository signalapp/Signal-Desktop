// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './DeliveryIssueDialog.dom.js';
import { DeliveryIssueDialog } from './DeliveryIssueDialog.dom.js';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.js';

const { i18n } = window.SignalContext;
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
