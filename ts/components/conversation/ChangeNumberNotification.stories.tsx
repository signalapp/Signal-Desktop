// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import type { Props } from './ChangeNumberNotification';
import { ChangeNumberNotification } from './ChangeNumberNotification';

export default {
  title: 'Components/Conversation/ChangeNumberNotification',
} satisfies Meta<Props>;

const i18n = setupI18n('en', enMessages);

export function Default(): JSX.Element {
  return (
    <ChangeNumberNotification
      sender={getDefaultConversation()}
      timestamp={1618894800000}
      i18n={i18n}
    />
  );
}

export function LongName(): JSX.Element {
  return (
    <ChangeNumberNotification
      sender={getDefaultConversation({
        firstName: '💅😇🖋'.repeat(50),
      })}
      timestamp={1618894800000}
      i18n={i18n}
    />
  );
}
