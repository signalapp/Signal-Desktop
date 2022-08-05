// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, ReactFramework, Story } from '@storybook/react';
import type { PlayFunction } from '@storybook/csf';
import React from 'react';
import { expect } from '@storybook/jest';
import { within, userEvent } from '@storybook/testing-library';

import type { PropsType } from './MyStoriesButton';
import enMessages from '../../_locales/en/messages.json';
import { MyStoriesButton } from './MyStoriesButton';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { getFakeStoryView } from '../test-both/helpers/getFakeStory';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/MyStoriesButton',
  component: MyStoriesButton,
  argTypes: {
    hasMultiple: {
      control: 'checkbox',
      defaultValue: false,
    },
    i18n: {
      defaultValue: i18n,
    },
    me: {
      defaultValue: getDefaultConversation(),
    },
    newestStory: {
      defaultValue: getFakeStoryView(),
    },
    onAddStory: { action: true },
    onClick: { action: true },
    queueStoryDownload: { action: true },
  },
} as Meta;

const Template: Story<PropsType> = args => <MyStoriesButton {...args} />;

const interactionTest: PlayFunction<ReactFramework, PropsType> = async ({
  args,
  canvasElement,
}) => {
  const canvas = within(canvasElement);
  const [btnAddStory] = canvas.getAllByLabelText('Add a story');
  await userEvent.click(btnAddStory);
  await expect(args.onAddStory).toHaveBeenCalled();

  const [btnStory] = canvas.getAllByLabelText('Story');
  await userEvent.click(btnStory);
  await expect(args.onClick).toHaveBeenCalled();
};

export const NoStory = Template.bind({});
NoStory.args = {
  hasMultiple: false,
  newestStory: undefined,
};
NoStory.story = {
  name: 'No Story',
};
NoStory.play = interactionTest;

export const OneStory = Template.bind({});
OneStory.args = {};
OneStory.story = {
  name: 'One Story',
};
OneStory.play = interactionTest;

export const ManyStories = Template.bind({});
ManyStories.args = {
  hasMultiple: true,
};
ManyStories.story = {
  name: 'Many Stories',
};
ManyStories.play = interactionTest;
