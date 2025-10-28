// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './InContactsIcon.dom.js';
import { InContactsIcon } from './InContactsIcon.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/InContactsIcon',
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  return <InContactsIcon i18n={i18n} />;
}
