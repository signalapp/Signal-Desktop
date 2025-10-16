// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { InstallScreenError } from '../../types/InstallScreen.std.js';
import type { Props } from './InstallScreenErrorStep.dom.js';
import { InstallScreenErrorStep } from './InstallScreenErrorStep.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/InstallScreen/InstallScreenErrorStep',
} satisfies Meta<Props>;

const defaultProps = {
  i18n,
  quit: action('quit'),
  tryAgain: action('tryAgain'),
};

export const _TooManyDevices = (): JSX.Element => (
  <InstallScreenErrorStep
    {...defaultProps}
    error={InstallScreenError.TooManyDevices}
  />
);

export const _TooOld = (): JSX.Element => (
  <InstallScreenErrorStep {...defaultProps} error={InstallScreenError.TooOld} />
);

export const __TooOld = (): JSX.Element => (
  <InstallScreenErrorStep {...defaultProps} error={InstallScreenError.TooOld} />
);

export const _ConnectionFailed = (): JSX.Element => (
  <InstallScreenErrorStep
    {...defaultProps}
    error={InstallScreenError.ConnectionFailed}
  />
);
