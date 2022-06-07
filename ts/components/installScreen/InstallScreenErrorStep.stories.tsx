// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

import { InstallScreenErrorStep, InstallError } from './InstallScreenErrorStep';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/InstallScreen/InstallScreenErrorStep',
};

const defaultProps = {
  i18n,
  quit: action('quit'),
  tryAgain: action('tryAgain'),
};

export const _TooManyDevices = (): JSX.Element => (
  <InstallScreenErrorStep
    {...defaultProps}
    error={InstallError.TooManyDevices}
  />
);

_TooManyDevices.story = {
  name: 'Too many devices',
};

export const _TooOld = (): JSX.Element => (
  <InstallScreenErrorStep {...defaultProps} error={InstallError.TooOld} />
);

_TooOld.story = {
  name: 'Too old',
};

export const __TooOld = (): JSX.Element => (
  <InstallScreenErrorStep {...defaultProps} error={InstallError.TooOld} />
);

__TooOld.story = {
  name: 'Too old',
};

export const _ConnectionFailed = (): JSX.Element => (
  <InstallScreenErrorStep
    {...defaultProps}
    error={InstallError.ConnectionFailed}
  />
);

_ConnectionFailed.story = {
  name: 'Connection failed',
};

export const _UnknownError = (): JSX.Element => (
  <InstallScreenErrorStep {...defaultProps} error={InstallError.UnknownError} />
);

_UnknownError.story = {
  name: 'Unknown error',
};
