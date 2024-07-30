// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React, { useState } from 'react';
import { v4 as generateUuid } from 'uuid';

import { action } from '@storybook/addon-actions';
import type { PropsType } from './StoryViewsNRepliesModal';
import * as durations from '../util/durations';
import enMessages from '../../_locales/en/messages.json';
import { SendStatus } from '../messages/MessageSendState';
import { StoryViewsNRepliesModal } from './StoryViewsNRepliesModal';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import { StoryViewTargetType } from '../types/Stories';
import { DEFAULT_PREFERRED_REACTION_EMOJI } from '../reactions/constants';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/StoryViewsNRepliesModal',
  component: StoryViewsNRepliesModal,
  argTypes: {
    hasViewReceiptSetting: {
      control: 'boolean',
    },
    hasViewsCapability: {
      control: 'boolean',
    },
  },
  args: {
    authorTitle: getDefaultConversation().title,
    canReply: true,
    getPreferredBadge: () => undefined,
    hasViewReceiptSetting: true,
    hasViewsCapability: false,
    i18n,
    platform: 'darwin',
    onClose: action('onClose'),
    onSetSkinTone: action('onSetSkinTone'),
    onReact: action('onReact'),
    onReply: action('onReply'),
    onTextTooLong: action('onTextTooLong'),
    onUseEmoji: action('onUseEmoji'),
    preferredReactionEmoji: DEFAULT_PREFERRED_REACTION_EMOJI,
    renderEmojiPicker: () => <>EmojiPicker</>,
    replies: [],
    views: [],
    viewTarget: StoryViewTargetType.Views,
    onChangeViewTarget: action('onChangeViewTarget'),
  },
} satisfies Meta<PropsType>;

function getViewsAndReplies() {
  const p1 = getDefaultConversation();
  const p2 = getDefaultConversation();
  const p3 = getDefaultConversation();
  const p4 = getDefaultConversation();
  const p5 = getDefaultConversation();
  const p6 = getDefaultConversation({
    isMe: true,
  });

  const views = [
    {
      recipient: p1,
      status: SendStatus.Viewed,
      updatedAt: Date.now() - 20 * durations.MINUTE,
    },
    {
      recipient: p2,
      status: SendStatus.Viewed,
      updatedAt: Date.now() - 25 * durations.MINUTE,
    },
    {
      recipient: p3,
      status: SendStatus.Viewed,
      updatedAt: Date.now() - 15 * durations.MINUTE,
    },
    {
      recipient: p4,
      status: SendStatus.Viewed,
      updatedAt: Date.now() - 5 * durations.MINUTE,
    },
    {
      recipient: p5,
      status: SendStatus.Viewed,
      updatedAt: Date.now() - 30 * durations.MINUTE,
    },
  ];

  const replies = [
    {
      author: p2,
      body: 'So cute ❤️',
      conversationId: p2.id,
      id: generateUuid(),
      timestamp: Date.now() - 24 * durations.MINUTE,
    },
    {
      author: p3,
      body: "That's awesome",
      conversationId: p3.id,
      id: generateUuid(),
      timestamp: Date.now() - 13 * durations.MINUTE,
    },
    {
      author: p3,
      body: 'Very awesome',
      conversationId: p3.id,
      id: generateUuid(),
      timestamp: Date.now() - 13 * durations.MINUTE,
    },
    {
      author: p3,
      body: 'Did I mention how awesome this is?',
      conversationId: p3.id,
      id: generateUuid(),
      timestamp: Date.now() - 12 * durations.MINUTE,
    },
    {
      author: p4,
      conversationId: p4.id,
      id: generateUuid(),
      reactionEmoji: '❤️',
      timestamp: Date.now() - 5 * durations.MINUTE,
    },
    {
      author: p6,
      body: 'Thanks everyone!',
      conversationId: p6.id,
      id: generateUuid(),
      sendStateByConversationId: {
        [p1.id]: {
          status: SendStatus.Pending,
        },
      },
      timestamp: Date.now(),
    },
  ];

  return {
    views,
    replies,
  };
}

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => {
  const [viewTarget, setViewTarget] = useState(args.viewTarget);

  function onChangeViewTarget(newViewTarget: StoryViewTargetType) {
    args.onChangeViewTarget(newViewTarget);
    setViewTarget(newViewTarget);
  }

  return (
    <StoryViewsNRepliesModal
      {...args}
      viewTarget={viewTarget}
      onChangeViewTarget={onChangeViewTarget}
    />
  );
};

export const CanReply = Template.bind({});
CanReply.args = {};
CanReply.storyName = 'Can reply';

export const ViewsOnly = Template.bind({});
ViewsOnly.args = {
  canReply: false,
  hasViewsCapability: true,
  views: getViewsAndReplies().views,
};
ViewsOnly.storyName = 'Views only';

export const NoViews = Template.bind({});
NoViews.args = {
  canReply: false,
  hasViewsCapability: true,
  views: [],
};
NoViews.storyName = 'No views';

export const InAGroupNoReplies = Template.bind({});
InAGroupNoReplies.args = {
  group: {},
};
InAGroupNoReplies.storyName = 'In a group (no replies, can reply)';

export const InAGroup = Template.bind({});
{
  const { views, replies } = getViewsAndReplies();
  InAGroup.args = {
    hasViewsCapability: true,
    group: {},
    replies,
    views,
  };
}
InAGroup.storyName = 'In a group';

export const CantReply = Template.bind({});
CantReply.args = {
  canReply: false,
};

export const InAGroupCantReply = Template.bind({});
{
  const { views, replies } = getViewsAndReplies();
  InAGroupCantReply.args = {
    canReply: false,
    group: {},
    replies,
    views,
  };
}
InAGroupCantReply.storyName = "In a group (can't reply)";

export const ReadReceiptsTurnedOff = Template.bind({});
ReadReceiptsTurnedOff.args = {
  canReply: false,
  hasViewReceiptSetting: false,
  hasViewsCapability: true,
  views: getViewsAndReplies().views,
};
ReadReceiptsTurnedOff.storyName = 'Read receipts turned off';

export const InAGroupButLeft = Template.bind({});
{
  const { replies } = getViewsAndReplies();
  InAGroupButLeft.args = {
    group: { left: true },
    replies,
  };
}
InAGroupButLeft.storyName = 'In a group (but left)';

export const GroupReadReceiptsOff = Template.bind({});
{
  const { views, replies } = getViewsAndReplies();
  GroupReadReceiptsOff.args = {
    hasViewReceiptSetting: false,
    hasViewsCapability: true,
    group: {},
    replies,
    views,
  };
}
GroupReadReceiptsOff.storyName = 'Read receipts turned off (group)';
