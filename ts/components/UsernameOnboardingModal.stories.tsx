// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, StoryFn } from '@storybook/react';

import { action } from '@storybook/addon-actions';
import type { PropsType } from './UsernameOnboardingModal.dom.js';
import { UsernameOnboardingModal } from './UsernameOnboardingModal.dom.js';

const { i18n } = window.SignalContext;

export default {
  component: UsernameOnboardingModal,
  title: 'Components/UsernameOnboardingModal',
  args: {
    i18n,
    onNext: action('onNext'),
    onSkip: action('onSkip'),
    onClose: action('onClose'),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => {
  return <UsernameOnboardingModal {...args} />;
};

export const Normal = Template.bind({});
