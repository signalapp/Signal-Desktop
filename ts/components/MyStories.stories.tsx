// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, ReactRenderer, StoryFn } from '@storybook/react';
import type { PlayFunction } from '@storybook/csf';
import React from 'react';
import { v4 as uuid } from 'uuid';
import { expect, fn, within, userEvent } from '@storybook/test';

import { action } from '@storybook/addon-actions';
import type { PropsType } from './MyStories';
import enMessages from '../../_locales/en/messages.json';
import { MY_STORY_ID } from '../types/Stories';
import { MyStories } from './MyStories';
import { SendStatus } from '../messages/MessageSendState';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { getFakeMyStory } from '../test-both/helpers/getFakeStory';
import { setupI18n } from '../util/setupI18n';
import { sleep } from '../util/sleep';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/MyStories',
  component: MyStories,
  argTypes: {
    hasViewReceiptSetting: {
      control: 'boolean',
    },
  },
  args: {
    i18n,
    onBack: fn(action('onBack')) as ReturnType<typeof action>,
    onDelete: action('onDelete'),
    onForward: fn(action('onForward')) as ReturnType<typeof action>,
    onSave: fn(action('onSave')) as ReturnType<typeof action>,
    hasViewReceiptSetting: false,
    renderToastManager: () => <i />,
    queueStoryDownload: action('queueStoryDownload'),
    retryMessageSend: action('retryMessageSend'),
    viewStory: action('viewStory'),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => <MyStories {...args} />;

export const NoStories = Template.bind({});
NoStories.args = {
  myStories: [],
};

const interactionTest: PlayFunction<ReactRenderer, PropsType> = async ({
  args,
  canvasElement,
}) => {
  const canvas = within(canvasElement);
  const [btnDownload] = canvas.getAllByLabelText('Download story');
  await userEvent.click(btnDownload);
  await expect(args.onSave).toHaveBeenCalled();

  const btnBack = canvas.getByText('Back');
  await userEvent.click(btnBack);
  await expect(args.onBack).toHaveBeenCalled();

  const [btnCtxMenu] = canvas.getAllByLabelText('Context menu');

  await userEvent.click(btnCtxMenu);
  await sleep(300);
  const [btnFwd] = canvas.getAllByLabelText('Forward');
  await userEvent.click(btnFwd);
  await expect(args.onForward).toHaveBeenCalled();
};

export const SingleListStories = Template.bind({});
SingleListStories.args = {
  myStories: [getFakeMyStory(MY_STORY_ID)],
};
SingleListStories.play = interactionTest;

export const MultiListStories = Template.bind({});
MultiListStories.args = {
  myStories: [
    getFakeMyStory(MY_STORY_ID),
    getFakeMyStory(uuid(), 'Cool Peeps'),
    getFakeMyStory(uuid(), 'Family'),
  ],
};
MultiListStories.play = interactionTest;

export const FailedSentStory = Template.bind({});
{
  const myStory = getFakeMyStory(MY_STORY_ID);
  FailedSentStory.args = {
    myStories: [
      {
        ...myStory,
        stories: myStory.stories.map((story, index) => {
          if (index === 0) {
            return {
              ...story,
              sendState: [
                {
                  recipient: getDefaultConversation(),
                  status: SendStatus.Failed,
                },
              ],
            };
          }
          return story;
        }),
      },
      getFakeMyStory(uuid(), 'Cool Peeps'),
    ],
  };
}
