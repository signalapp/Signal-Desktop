// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './AvatarUploadButton.dom.js';
import { AvatarUploadButton } from './AvatarUploadButton.dom.js';

const { i18n } = window.SignalContext;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  className: overrideProps.className || '',
  i18n,
  onChange: action('onChange'),
});

export default {
  title: 'Components/AvatarUploadButton',
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  return <AvatarUploadButton {...createProps()} />;
}
