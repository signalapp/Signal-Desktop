// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './DeliveryIssueNotification.dom.js';
import { DeliveryIssueNotification } from './DeliveryIssueNotification.dom.js';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.js';

export default {
  title: 'Components/Conversation/DeliveryIssueNotification',
} satisfies Meta<PropsType>;

const { i18n } = window.SignalContext;
const sender = getDefaultConversation();

export function Default(): JSX.Element {
  return (
    <DeliveryIssueNotification i18n={i18n} inGroup={false} sender={sender} />
  );
}

export function WithALongName(): JSX.Element {
  const longName = '🤷🏽‍♀️❤️🐞'.repeat(50);
  return (
    <DeliveryIssueNotification
      i18n={i18n}
      inGroup={false}
      sender={getDefaultConversation({
        firstName: longName,
        name: longName,
        profileName: longName,
        title: longName,
      })}
    />
  );
}

export function InGroup(): JSX.Element {
  return <DeliveryIssueNotification i18n={i18n} inGroup sender={sender} />;
}
