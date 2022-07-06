// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, ReactFramework, Story } from '@storybook/react';
import type { PlayFunction } from '@storybook/csf';
import React from 'react';
import { expect } from '@storybook/jest';
import { v4 as uuid } from 'uuid';
import { within, userEvent } from '@storybook/testing-library';

import type { PropsType } from './MyStories';
import enMessages from '../../_locales/en/messages.json';
import { MY_STORIES_ID } from '../types/Stories';
import { MyStories } from './MyStories';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { getFakeMyStory } from '../test-both/helpers/getFakeStory';
import { setupI18n } from '../util/setupI18n';
import { sleep } from '../util/sleep';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/MyStories',
  component: MyStories,
  argTypes: {
    i18n: {
      defaultValue: i18n,
    },
    onBack: {
      action: true,
    },
    onDelete: {
      action: true,
    },
    onForward: {
      action: true,
    },
    onSave: {
      action: true,
    },
    ourConversationId: {
      defaultValue: getDefaultConversation().id,
    },
    queueStoryDownload: {
      action: true,
    },
    renderStoryViewer: {
      action: true,
    },
    viewStory: { action: true },
  },
} as Meta;

const Template: Story<PropsType> = args => <MyStories {...args} />;

export const NoStories = Template.bind({});
NoStories.args = {
  myStories: [],
};
NoStories.story = {
  name: 'No Stories',
};

const interactionTest: PlayFunction<ReactFramework, PropsType> = async ({
  args,
  canvasElement,
}) => {
  const canvas = within(canvasElement);
  const [btnDownload] = canvas.getAllByLabelText('Download story');
  await userEvent.click(btnDownload);
  await expect(args.onSave).toHaveBeenCalled();

  const [btnBack] = canvas.getAllByLabelText('Back');
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
  myStories: [getFakeMyStory(MY_STORIES_ID)],
};
SingleListStories.play = interactionTest;
SingleListStories.story = {
  name: 'One distribution list',
};

export const MultiListStories = Template.bind({});
MultiListStories.args = {
  myStories: [
    getFakeMyStory(MY_STORIES_ID),
    getFakeMyStory(uuid(), 'Cool Peeps'),
    getFakeMyStory(uuid(), 'Family'),
  ],
};
MultiListStories.play = interactionTest;
MultiListStories.story = {
  name: 'Multiple distribution lists',
};
