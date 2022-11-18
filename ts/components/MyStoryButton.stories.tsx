// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, ReactFramework, Story } from '@storybook/react';
import type { PlayFunction } from '@storybook/csf';
import React from 'react';
import { expect } from '@storybook/jest';
import { within, userEvent } from '@storybook/testing-library';

import type { PropsType } from './MyStoryButton';
import enMessages from '../../_locales/en/messages.json';
import { MyStoryButton } from './MyStoryButton';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { getFakeMyStory } from '../test-both/helpers/getFakeStory';
import { setupI18n } from '../util/setupI18n';
import { SendStatus } from '../messages/MessageSendState';
import { ResolvedSendStatus } from '../types/Stories';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/MyStoriesButton',
  component: MyStoryButton,
  argTypes: {
    i18n: {
      defaultValue: i18n,
    },
    me: {
      defaultValue: getDefaultConversation(),
    },
    myStories: {
      defaultValue: [getFakeMyStory()],
    },
    onAddStory: { action: true },
    onClick: { action: true },
    queueStoryDownload: { action: true },
    showToast: { action: true },
  },
} as Meta;

// eslint-disable-next-line react/function-component-definition
const Template: Story<PropsType> = args => <MyStoryButton {...args} />;

const interactionTest: PlayFunction<ReactFramework, PropsType> = async ({
  args,
  canvasElement,
}) => {
  const canvas = within(canvasElement);
  const btnAddStory = canvas.getByLabelText('Add a story');
  await userEvent.click(btnAddStory);
  const textStory = canvas.getByText('Text story');
  await userEvent.click(textStory);
  await expect(args.onAddStory).toHaveBeenCalled();
  const btnStory = canvas.getByText('My Stories');
  await userEvent.click(btnStory);
  await expect(args.onClick).toHaveBeenCalled();
};

export const NoStory = Template.bind({});
NoStory.args = {
  myStories: [],
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
  myStories: [getFakeMyStory(), getFakeMyStory()],
};
ManyStories.story = {
  name: 'Many Stories',
};
ManyStories.play = interactionTest;

export const SendingStory = Template.bind({});
SendingStory.story = {
  name: 'Sending Story',
};
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
FailedSendStory.story = {
  name: 'Failed Send Story',
};
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
