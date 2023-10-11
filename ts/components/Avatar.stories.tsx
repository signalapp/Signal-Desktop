// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import * as React from 'react';
import { action } from '@storybook/addon-actions';
import { expect, jest } from '@storybook/jest';
import { isBoolean } from 'lodash';
import { within, userEvent } from '@storybook/testing-library';
import type { AvatarColorType } from '../types/Colors';
import type { Props } from './Avatar';
import enMessages from '../../_locales/en/messages.json';
import { Avatar, AvatarBlur, AvatarSize } from './Avatar';
import { AvatarColors } from '../types/Colors';
import { HasStories } from '../types/Stories';
import { ThemeType } from '../types/Util';
import { getFakeBadge } from '../test-both/helpers/getFakeBadge';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

const colorMap: Record<string, AvatarColorType> = AvatarColors.reduce(
  (m, color) => ({
    ...m,
    [color]: color,
  }),
  {}
);

const conversationTypeMap: Record<string, Props['conversationType']> = {
  direct: 'direct',
  group: 'group',
};

export default {
  title: 'Components/Avatar',
  component: Avatar,
  argTypes: {
    badge: {
      control: false,
    },
    blur: {
      control: { type: 'radio' },
      options: {
        Undefined: undefined,
        NoBlur: AvatarBlur.NoBlur,
        BlurPicture: AvatarBlur.BlurPicture,
        BlurPictureWithClickToView: AvatarBlur.BlurPictureWithClickToView,
      },
    },
    color: {
      options: colorMap,
    },
    conversationType: {
      control: { type: 'radio' },
      options: conversationTypeMap,
    },
    size: {
      control: false,
    },
    storyRing: {
      control: { type: 'radio' },
      options: [undefined, ...Object.values(HasStories)],
    },
    theme: {
      control: { type: 'radio' },
      options: ThemeType,
    },
  },
  args: {
    blur: undefined,
    color: AvatarColors[0],
    onClick: action('onClick'),
    theme: ThemeType.light,
  },
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  acceptedMessageRequest: isBoolean(overrideProps.acceptedMessageRequest)
    ? overrideProps.acceptedMessageRequest
    : true,
  avatarPath: overrideProps.avatarPath || '',
  badge: overrideProps.badge,
  blur: overrideProps.blur,
  color: overrideProps.color || AvatarColors[0],
  conversationType: overrideProps.conversationType || 'direct',
  i18n,
  isMe: false,
  loading: Boolean(overrideProps.loading),
  noteToSelf: Boolean(overrideProps.noteToSelf),
  onClick: jest.fn(action('onClick')),
  onClickBadge: action('onClickBadge'),
  phoneNumber: overrideProps.phoneNumber || '',
  searchResult: Boolean(overrideProps.searchResult),
  sharedGroupNames: [],
  size: 80,
  title: overrideProps.title || '',
  theme: overrideProps.theme || ThemeType.light,
  storyRing: overrideProps.storyRing,
});

const sizes = Object.values(AvatarSize).filter(
  x => typeof x === 'number'
) as Array<AvatarSize>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<Props> = (args: Props) => {
  return (
    <>
      {sizes.map(size => (
        <Avatar key={size} {...args} size={size} />
      ))}
    </>
  );
};

// eslint-disable-next-line react/function-component-definition
const TemplateSingle: StoryFn<Props> = (args: Props) => (
  <Avatar {...args} size={AvatarSize.EIGHTY} />
);

export const Default = Template.bind({});
Default.args = createProps({
  avatarPath: '/fixtures/giphy-GVNvOUpeYmI7e.gif',
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Default.play = async (context: any) => {
  const { args, canvasElement } = context;
  const canvas = within(canvasElement);
  const [avatar] = canvas.getAllByRole('button');
  await userEvent.click(avatar);
  await expect(args.onClick).toHaveBeenCalled();
};

export const WithBadge = Template.bind({});
WithBadge.args = createProps({
  avatarPath: '/fixtures/kitten-3-64-64.jpg',
  badge: getFakeBadge(),
});

export const WideImage = Template.bind({});
WideImage.args = createProps({
  avatarPath: '/fixtures/wide.jpg',
});

export const OneWordName = Template.bind({});
OneWordName.args = createProps({
  title: 'John',
});

export const TwoWordName = Template.bind({});
TwoWordName.args = createProps({
  title: 'John Smith',
});

export const WideInitials = Template.bind({});
WideInitials.args = createProps({
  title: 'Walter White',
});

export const ThreeWordName = Template.bind({});
ThreeWordName.args = createProps({
  title: 'Walter H. White',
});

export const NoteToSelf = Template.bind({});
NoteToSelf.args = createProps({
  noteToSelf: true,
});

export const ContactIcon = Template.bind({});
ContactIcon.args = createProps();

export const GroupIcon = Template.bind({});
GroupIcon.args = createProps({
  conversationType: 'group',
});

export const SearchIcon = Template.bind({});
SearchIcon.args = createProps({
  searchResult: true,
});

export function Colors(): JSX.Element {
  const props = createProps();

  return (
    <>
      {AvatarColors.map(color => (
        <Avatar key={color} {...props} color={color} />
      ))}
    </>
  );
}

export const BrokenColor = Template.bind({});
BrokenColor.args = createProps({
  color: 'nope' as AvatarColorType,
});

export const BrokenAvatar = Template.bind({});
BrokenAvatar.args = createProps({
  avatarPath: 'badimage.png',
});

export const BrokenAvatarForGroup = Template.bind({});
BrokenAvatarForGroup.args = createProps({
  avatarPath: 'badimage.png',
  conversationType: 'group',
});

export const Loading = Template.bind({});
Loading.args = createProps({
  loading: true,
});

export const BlurredBasedOnProps = TemplateSingle.bind({});
BlurredBasedOnProps.args = createProps({
  acceptedMessageRequest: false,
  avatarPath: '/fixtures/kitten-3-64-64.jpg',
});

export const ForceBlurred = TemplateSingle.bind({});
ForceBlurred.args = createProps({
  avatarPath: '/fixtures/kitten-3-64-64.jpg',
  blur: AvatarBlur.BlurPicture,
});

export const BlurredWithClickToView = TemplateSingle.bind({});
BlurredWithClickToView.args = createProps({
  avatarPath: '/fixtures/kitten-3-64-64.jpg',
  blur: AvatarBlur.BlurPictureWithClickToView,
});

export const StoryUnread = TemplateSingle.bind({});
StoryUnread.args = createProps({
  avatarPath: '/fixtures/kitten-3-64-64.jpg',
  storyRing: HasStories.Unread,
});

export const StoryRead = TemplateSingle.bind({});
StoryRead.args = createProps({
  avatarPath: '/fixtures/kitten-3-64-64.jpg',
  storyRing: HasStories.Read,
});
