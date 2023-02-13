// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, Story } from '@storybook/react';

import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';

import type { PropsType } from './UsernameOnboardingModalBody';
import { UsernameOnboardingModalBody } from './UsernameOnboardingModalBody';

const i18n = setupI18n('en', enMessages);

export default {
  component: UsernameOnboardingModalBody,
  title: 'Components/UsernameOnboardingModalBody',
  argTypes: {
    i18n: {
      defaultValue: i18n,
    },
    onNext: { action: true },
  },
} as Meta;

type ArgsType = PropsType;

// eslint-disable-next-line react/function-component-definition
const Template: Story<ArgsType> = args => {
  return <UsernameOnboardingModalBody {...args} />;
};

export const Normal = Template.bind({});
Normal.args = {};
Normal.story = {
  name: 'normal',
};
