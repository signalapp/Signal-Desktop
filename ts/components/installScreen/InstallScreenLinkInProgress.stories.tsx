// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

import { InstallScreenLinkInProgressStep } from './InstallScreenLinkInProgressStep';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/InstallScreen/InstallScreenLinkInProgressStep',
  module
);

story.add('Default', () => <InstallScreenLinkInProgressStep i18n={i18n} />);
