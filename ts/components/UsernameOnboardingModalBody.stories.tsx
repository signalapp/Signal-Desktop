// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, StoryFn } from '@storybook/react';

import { action } from '@storybook/addon-actions';
import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';

import type { PropsType } from './UsernameOnboardingModalBody';
import { UsernameOnboardingModalBody } from './UsernameOnboardingModalBody';

const i18n = setupI18n('en', enMessages);

export default {
  component: UsernameOnboardingModalBody,
  title: 'Components/UsernameOnboardingModalBody',
  args: {
    i18n,
    onNext: action('onNext'),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => {
  return <UsernameOnboardingModalBody {...args} />;
};

export const Normal = Template.bind({});
