// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType } from './InstallScreenBackupImportStep';
import { InstallScreenBackupImportStep } from './InstallScreenBackupImportStep';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/InstallScreenBackupImportStep',
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = (args: PropsType) => (
  <InstallScreenBackupImportStep {...args} i18n={i18n} />
);

export const NoBytes = Template.bind({});
NoBytes.args = {
  currentBytes: undefined,
  totalBytes: undefined,
};

export const Bytes = Template.bind({});
Bytes.args = {
  currentBytes: 500,
  totalBytes: 1024,
};
