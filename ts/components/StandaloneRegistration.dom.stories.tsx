// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { fn } from '@storybook/test';
import { action } from '@storybook/addon-actions';
import messages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n.dom.tsx';

import { StandaloneRegistration } from './StandaloneRegistration.dom.tsx';
import type { PropsType } from './StandaloneRegistration.dom.tsx';
import { SECOND } from '../util/durations/index.std.ts';
import { sleep } from '../util/sleep.std.ts';

const i18n = setupI18n('en', messages);

export default {
  title: 'Components/StandaloneRegistration',
  args: {
    i18n,
    getCaptchaToken: fn(async (...params) => {
      // oxlint-disable-next-line no-console
      console.log('getCaptchaToken', params);
      await sleep(SECOND);
      return 'captcha-token';
    }) as () => Promise<string>,
    requestVerification: fn(async (...params) => {
      // oxlint-disable-next-line no-console
      console.log('requestVerification', params);
      await sleep(SECOND);
      return { sessionId: 'fake-session-id' };
    }) as () => Promise<{ sessionId: string }>,
    registerSingleDevice: fn(async (...params) => {
      // oxlint-disable-next-line no-console
      console.log('registerSingleDevice', params);
      await sleep(SECOND);
    }) as () => Promise<void>,
    uploadInitialProfile: fn(async (...params) => {
      // oxlint-disable-next-line no-console
      console.log('uploadInitialProfile', params);
      await sleep(SECOND);
    }) as () => Promise<void>,
    onComplete: action('onComplete'),
    readyForUpdates: action('readyForUpdates'),
  },
} satisfies Meta<PropsType & { daysAgo?: number }>;

const Template: StoryFn<PropsType> = args => {
  return <StandaloneRegistration {...args} />;
};

export const Default = Template.bind({});
