// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './InstallScreenLinkInProgressStep';
import { InstallScreenLinkInProgressStep } from './InstallScreenLinkInProgressStep';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/InstallScreen/InstallScreenLinkInProgressStep',
} satisfies Meta<Props>;

export function Default(): JSX.Element {
  return <InstallScreenLinkInProgressStep i18n={i18n} />;
}
