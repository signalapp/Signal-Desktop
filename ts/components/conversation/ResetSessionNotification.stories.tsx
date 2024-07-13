// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './ResetSessionNotification';
import { ResetSessionNotification } from './ResetSessionNotification';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/ResetSessionNotification',
} satisfies Meta<Props>;

export function Notification(): JSX.Element {
  return <ResetSessionNotification i18n={i18n} />;
}
