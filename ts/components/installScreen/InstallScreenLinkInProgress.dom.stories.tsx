// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './InstallScreenLinkInProgressStep.dom.js';
import { InstallScreenLinkInProgressStep } from './InstallScreenLinkInProgressStep.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/InstallScreen/InstallScreenLinkInProgressStep',
} satisfies Meta<Props>;

export function Default(): JSX.Element {
  return <InstallScreenLinkInProgressStep i18n={i18n} />;
}
