// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ComponentProps } from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { BackupMediaDownloadProgressBanner } from './BackupMediaDownloadProgress';

const i18n = setupI18n('en', enMessages);

type PropsType = ComponentProps<typeof BackupMediaDownloadProgressBanner>;

export default {
  title: 'Components/BackupMediaDownloadProgress',
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = (args: PropsType) => (
  <BackupMediaDownloadProgressBanner {...args} i18n={i18n} />
);

export const InProgress = Template.bind({});
InProgress.args = {
  downloadedBytes: 92048023,
  totalBytes: 1024102532,
};
