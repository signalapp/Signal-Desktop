// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

import { InstallScreenErrorStep, InstallError } from './InstallScreenErrorStep';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/InstallScreen/InstallScreenErrorStep',
  module
);

const defaultProps = {
  i18n,
  quit: action('quit'),
  tryAgain: action('tryAgain'),
};

story.add('Too many devices', () => (
  <InstallScreenErrorStep
    {...defaultProps}
    error={InstallError.TooManyDevices}
  />
));

story.add('Too old', () => (
  <InstallScreenErrorStep {...defaultProps} error={InstallError.TooOld} />
));

story.add('Too old', () => (
  <InstallScreenErrorStep {...defaultProps} error={InstallError.TooOld} />
));

story.add('Connection failed', () => (
  <InstallScreenErrorStep
    {...defaultProps}
    error={InstallError.ConnectionFailed}
  />
));

story.add('Unknown error', () => (
  <InstallScreenErrorStep {...defaultProps} error={InstallError.UnknownError} />
));
