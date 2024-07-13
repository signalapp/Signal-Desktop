// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { ScrollDownButtonPropsType } from './ScrollDownButton';
import { ScrollDownButton, ScrollDownButtonVariant } from './ScrollDownButton';

const i18n = setupI18n('en', enMessages);

const createProps = (
  overrideProps: Partial<ScrollDownButtonPropsType> = {}
): ScrollDownButtonPropsType => ({
  variant: ScrollDownButtonVariant.UNREAD_MESSAGES,
  i18n,
  onClick: action('scrollDown'),
  ...overrideProps,
});

export default {
  title: 'Components/Conversation/ScrollDownButton',
  component: ScrollDownButton,
  argTypes: {
    count: {
      control: { type: 'radio' },
      options: [undefined, 5, 85, 1000],
    },
  },
} satisfies Meta<ScrollDownButtonPropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<ScrollDownButtonPropsType> = args => (
  <ScrollDownButton {...args} />
);

export const UnreadMessages = Template.bind({});
UnreadMessages.args = createProps({
  variant: ScrollDownButtonVariant.UNREAD_MESSAGES,
});

export const UnreadMentions = Template.bind({});
UnreadMentions.args = createProps({
  variant: ScrollDownButtonVariant.UNREAD_MENTIONS,
});
