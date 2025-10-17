// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './ResetSessionNotification.dom.js';
import { ResetSessionNotification } from './ResetSessionNotification.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ResetSessionNotification',
} satisfies Meta<Props>;

export function Notification(): JSX.Element {
  return <ResetSessionNotification i18n={i18n} />;
}
