// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import * as React from 'react';
import { action } from '@storybook/addon-actions';
import { expect, fn, within, userEvent } from '@storybook/test';
import type { AvatarColorType } from '../types/Colors.std.js';
import type { Props } from './Avatar.dom.js';
import { Avatar, AvatarBlur, AvatarSize } from './Avatar.dom.js';
import { AvatarColors } from '../types/Colors.std.js';
import { HasStories } from '../types/Stories.std.js';
import { ThemeType } from '../types/Util.std.js';
import { getFakeBadge } from '../test-helpers/getFakeBadge.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Avatar',
  component: Avatar,
  argTypes: {
    badge: {
      control: false,
    },
    blur: {
      control: { type: 'radio' },
      options: [
        undefined,
        AvatarBlur.NoBlur,
        AvatarBlur.BlurPicture,
        AvatarBlur.BlurPictureWithClickToView,
      ],
    },
    color: {
      options: AvatarColors,
    },
    conversationType: {
      control: { type: 'radio' },
      options: ['direct', 'group'],
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
      options: [ThemeType.light, ThemeType.dark],
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
  avatarUrl: overrideProps.avatarUrl || '',
  badge: overrideProps.badge,
  blur: overrideProps.blur,
  color: overrideProps.color || AvatarColors[0],
  conversationType: overrideProps.conversationType || 'direct',
  hasAvatar:
    Boolean(overrideProps.hasAvatar) ||
    (overrideProps.avatarUrl != null && overrideProps.avatarUrl.length > 0),
  i18n,
  loading: Boolean(overrideProps.loading),
  noteToSelf: Boolean(overrideProps.noteToSelf),
  onClick: fn(action('onClick')),
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
  avatarUrl: '/fixtures/giphy-GVNvOUpeYmI7e.gif',
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
  avatarUrl: '/fixtures/kitten-3-64-64.jpg',
  badge: getFakeBadge(),
});

export const WideImage = Template.bind({});
WideImage.args = createProps({
  avatarUrl: '/fixtures/wide.jpg',
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
  avatarUrl: 'badimage.png',
});

export const BrokenAvatarForGroup = Template.bind({});
BrokenAvatarForGroup.args = createProps({
  avatarUrl: 'badimage.png',
  conversationType: 'group',
});

export const Loading = Template.bind({});
Loading.args = createProps({
  loading: true,
});

export const BlurredBasedOnProps = TemplateSingle.bind({});
BlurredBasedOnProps.args = createProps({
  hasAvatar: true,
  avatarUrl: '/fixtures/kitten-3-64-64.jpg',
  blur: AvatarBlur.BlurPicture,
});

export const ForceBlurred = TemplateSingle.bind({});
ForceBlurred.args = createProps({
  avatarUrl: '/fixtures/kitten-3-64-64.jpg',
  blur: AvatarBlur.BlurPicture,
});

export const BlurredWithClickToView = TemplateSingle.bind({});
BlurredWithClickToView.args = createProps({
  avatarUrl: '/fixtures/kitten-3-64-64.jpg',
  blur: AvatarBlur.BlurPictureWithClickToView,
});

export const StoryUnread = TemplateSingle.bind({});
StoryUnread.args = createProps({
  avatarUrl: '/fixtures/kitten-3-64-64.jpg',
  storyRing: HasStories.Unread,
});

export const StoryRead = TemplateSingle.bind({});
StoryRead.args = createProps({
  avatarUrl: '/fixtures/kitten-3-64-64.jpg',
  storyRing: HasStories.Read,
});
