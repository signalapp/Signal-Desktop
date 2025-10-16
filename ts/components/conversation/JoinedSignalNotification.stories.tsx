// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './JoinedSignalNotification.dom.js';
import { JoinedSignalNotification } from './JoinedSignalNotification.dom.js';

export default {
  title: 'Components/Conversation/JoinedSignalNotification',
} satisfies Meta<Props>;

const { i18n } = window.SignalContext;

export function Default(): JSX.Element {
  return <JoinedSignalNotification timestamp={1618894800000} i18n={i18n} />;
}
