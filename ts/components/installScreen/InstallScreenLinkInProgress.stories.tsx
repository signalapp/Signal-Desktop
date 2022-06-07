// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

import { InstallScreenLinkInProgressStep } from './InstallScreenLinkInProgressStep';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/InstallScreen/InstallScreenLinkInProgressStep',
};

export const Default = (): JSX.Element => (
  <InstallScreenLinkInProgressStep i18n={i18n} />
);
