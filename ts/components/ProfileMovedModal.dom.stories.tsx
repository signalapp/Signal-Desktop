// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';

import type { ComponentProps } from 'react';
import type { Meta } from '@storybook/react';

import { ProfileMovedModal } from './ProfileMovedModal.dom.js';
import { ThemeType } from '../types/Util.std.js';

import type { PropsType } from './ProfileMovedModal.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/ProfileMovedModal',
} satisfies Meta<PropsType>;

const defaultProps: ComponentProps<typeof ProfileMovedModal> = {
  i18n,
  theme: ThemeType.light,
  onClose: action('onClose'),
};

export function Default(): JSX.Element {
  return <ProfileMovedModal {...defaultProps} />;
}
