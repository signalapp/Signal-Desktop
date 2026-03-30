// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { fn } from '@storybook/test';

import { StandaloneRegistration } from './StandaloneRegistration.dom.tsx';
import type { PropsType } from './StandaloneRegistration.dom.tsx';
import { SECOND } from '../util/durations/index.std.ts';
import { sleep } from '../util/sleep.std.ts';

export default {
  title: 'Components/StandaloneRegistration',
  args: {
    getCaptchaToken: fn(async () => {
      await sleep(SECOND);
      return 'captcha-token';
    }) as () => Promise<string>,
    requestVerification: fn(async () => {
      await sleep(SECOND);
      return { sessionId: 'fake-session-id' };
    }) as () => Promise<{ sessionId: string }>,
    registerSingleDevice: fn(async () => {
      await sleep(SECOND);
    }) as () => Promise<void>,
    uploadProfile: fn(async () => {
      await sleep(SECOND);
    }) as () => Promise<void>,
    onComplete: fn() as () => void,
    readyForUpdates: fn() as () => void,
  },
} satisfies Meta<PropsType & { daysAgo?: number }>;

const Template: StoryFn<PropsType> = args => {
  return <StandaloneRegistration {...args} />;
};

export const Default = Template.bind({});
