// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, ReactRenderer, StoryFn } from '@storybook/react';
import type { PlayFunction } from '@storybook/csf';
import React from 'react';
import { expect, fn, within, userEvent } from '@storybook/test';

import { action } from '@storybook/addon-actions';
import type { PropsType } from './MyStoryButton.dom.js';
import { MyStoryButton } from './MyStoryButton.dom.js';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.js';
import { getFakeMyStory } from '../test-helpers/getFakeStory.dom.js';
import { SendStatus } from '../messages/MessageSendState.std.js';
import { ResolvedSendStatus } from '../types/Stories.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/MyStoriesButton',
  component: MyStoryButton,
  args: {
    i18n,
    me: getDefaultConversation(),
    myStories: [getFakeMyStory()],
    onAddStory: fn(action('onAddStory')) as ReturnType<typeof action>,
    onClick: fn(action('onClick')) as ReturnType<typeof action>,
    queueStoryDownload: action('queueStoryDownload'),
    showToast: action('showToast'),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => <MyStoryButton {...args} />;

const interactionTest: PlayFunction<ReactRenderer, PropsType> = async ({
  args,
  canvasElement,
}) => {
  const canvas = within(canvasElement);
  const btnAddStory = canvas.getByLabelText('Add a story');
  await userEvent.click(btnAddStory);
  const textStory = canvas.getByText('Text story');
  await userEvent.click(textStory);
  await expect(args.onAddStory).toHaveBeenCalled();
  if (args.myStories.length > 0) {
    const btnStory = canvas.getByText('My Stories');
    await userEvent.click(btnStory);
    await expect(args.onClick).toHaveBeenCalled();
  }
};

export const NoStory = Template.bind({});
NoStory.args = {
  myStories: [],
};

NoStory.play = interactionTest;

export const OneStory = Template.bind({});
OneStory.args = {};

OneStory.play = interactionTest;

export const ManyStories = Template.bind({});
ManyStories.args = {
  myStories: [getFakeMyStory(), getFakeMyStory()],
};

ManyStories.play = interactionTest;

export const SendingStory = Template.bind({});

{
  const myStory = getFakeMyStory();
  SendingStory.args = {
    myStories: [
      {
        ...myStory,
        reducedSendStatus: ResolvedSendStatus.Sending,
        stories: myStory.stories.map((story, index) => {
          if (index === 0) {
            return {
              ...story,
              sendState: [
                {
                  status: SendStatus.Pending,
                  recipient: getDefaultConversation(),
                },
              ],
            };
          }

          return story;
        }),
      },
      getFakeMyStory(),
    ],
  };
}
SendingStory.play = interactionTest;

export const FailedSendStory = Template.bind({});

{
  const myStory = getFakeMyStory();
  FailedSendStory.args = {
    myStories: [
      {
        ...myStory,
        reducedSendStatus: ResolvedSendStatus.Failed,
        stories: myStory.stories.map((story, index) => {
          if (index === 0) {
            return {
              ...story,
              sendState: [
                {
                  status: SendStatus.Failed,
                  recipient: getDefaultConversation(),
                },
              ],
            };
          }

          return story;
        }),
      },
      getFakeMyStory(),
    ],
  };
}
FailedSendStory.play = interactionTest;
