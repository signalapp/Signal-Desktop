// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, ReactRenderer, StoryFn } from '@storybook/react';
import type { PlayFunction } from '@storybook/csf';
import React from 'react';
import { v4 as uuid } from 'uuid';
import { expect, fn, within, userEvent } from '@storybook/test';

import { action } from '@storybook/addon-actions';
import type { PropsType } from './MyStories.dom.tsx';
import { MY_STORY_ID } from '../types/Stories.std.ts';
import { MyStories } from './MyStories.dom.tsx';
import { SendStatus } from '../messages/MessageSendState.std.ts';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.ts';
import { getFakeMyStory } from '../test-helpers/getFakeStory.dom.tsx';
import { sleep } from '../util/sleep.std.ts';

const { i18n } = window.SignalContext;

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
  // oxlint-disable-next-line typescript/no-non-null-assertion
  await userEvent.click(btnDownload!);
  await expect(args.onSave).toHaveBeenCalled();

  const btnBack = canvas.getByText('Back');
  await userEvent.click(btnBack);
  await expect(args.onBack).toHaveBeenCalled();

  const [btnCtxMenu] = canvas.getAllByLabelText('Context menu');

  // oxlint-disable-next-line typescript/no-non-null-assertion
  await userEvent.click(btnCtxMenu!);
  await sleep(300);
  const [btnFwd] = canvas.getAllByLabelText('Forward');
  // oxlint-disable-next-line typescript/no-non-null-assertion
  await userEvent.click(btnFwd!);
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
