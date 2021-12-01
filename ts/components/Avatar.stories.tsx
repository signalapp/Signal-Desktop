// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { isBoolean } from 'lodash';

import { storiesOf } from '@storybook/react';
import { boolean, select, text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { Props } from './Avatar';
import { Avatar, AvatarBlur } from './Avatar';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { AvatarColorType } from '../types/Colors';
import { AvatarColors } from '../types/Colors';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';
import { getFakeBadge } from '../test-both/helpers/getFakeBadge';
import { ThemeType } from '../types/Util';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Avatar', module);

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

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  acceptedMessageRequest: isBoolean(overrideProps.acceptedMessageRequest)
    ? overrideProps.acceptedMessageRequest
    : true,
  avatarPath: text('avatarPath', overrideProps.avatarPath || ''),
  badge: overrideProps.badge,
  blur: overrideProps.blur,
  color: select('color', colorMap, overrideProps.color || AvatarColors[0]),
  conversationType: select(
    'conversationType',
    conversationTypeMap,
    overrideProps.conversationType || 'direct'
  ),
  i18n,
  isMe: false,
  loading: boolean('loading', overrideProps.loading || false),
  name: text('name', overrideProps.name || ''),
  noteToSelf: boolean('noteToSelf', overrideProps.noteToSelf || false),
  onClick: action('onClick'),
  onClickBadge: action('onClickBadge'),
  phoneNumber: text('phoneNumber', overrideProps.phoneNumber || ''),
  searchResult: boolean(
    'searchResult',
    typeof overrideProps.searchResult === 'boolean'
      ? overrideProps.searchResult
      : false
  ),
  sharedGroupNames: [],
  size: 80,
  title: overrideProps.title || '',
  theme: overrideProps.theme || ThemeType.light,
});

const sizes: Array<Props['size']> = [112, 96, 80, 52, 32, 28];

story.add('Avatar', () => {
  const props = createProps({
    avatarPath: '/fixtures/giphy-GVNvOUpeYmI7e.gif',
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('With badge', () => {
  const Wrapper = () => {
    const theme = React.useContext(StorybookThemeContext);
    const props = createProps({
      avatarPath: '/fixtures/kitten-3-64-64.jpg',
      badge: getFakeBadge(),
      theme,
    });

    return (
      <>
        {sizes.map(size => (
          <Avatar key={size} {...props} size={size} />
        ))}
      </>
    );
  };

  return <Wrapper />;
});

story.add('Wide image', () => {
  const props = createProps({
    avatarPath: '/fixtures/wide.jpg',
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('One-word Name', () => {
  const props = createProps({
    title: 'John',
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Two-word Name', () => {
  const props = createProps({
    title: 'John Smith',
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Wide initials', () => {
  const props = createProps({
    title: 'Walter White',
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Three-word name', () => {
  const props = createProps({
    title: 'Walter H. White',
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Note to Self', () => {
  const props = createProps({
    noteToSelf: true,
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Contact Icon', () => {
  const props = createProps();

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Group Icon', () => {
  const props = createProps({
    conversationType: 'group',
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Search Icon', () => {
  const props = createProps({
    searchResult: true,
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Colors', () => {
  const props = createProps();

  return AvatarColors.map(color => (
    <Avatar key={color} {...props} color={color} />
  ));
});

story.add('Broken Color', () => {
  const props = createProps({
    color: 'nope' as AvatarColorType,
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Broken Avatar', () => {
  const props = createProps({
    avatarPath: 'badimage.png',
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Broken Avatar for Group', () => {
  const props = createProps({
    avatarPath: 'badimage.png',
    conversationType: 'group',
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Loading', () => {
  const props = createProps({
    loading: true,
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Blurred based on props', () => {
  const props = createProps({
    acceptedMessageRequest: false,
    avatarPath: '/fixtures/kitten-3-64-64.jpg',
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Force-blurred', () => {
  const props = createProps({
    avatarPath: '/fixtures/kitten-3-64-64.jpg',
    blur: AvatarBlur.BlurPicture,
  });

  return sizes.map(size => <Avatar key={size} {...props} size={size} />);
});

story.add('Blurred with "click to view"', () => {
  const props = createProps({
    avatarPath: '/fixtures/kitten-3-64-64.jpg',
    blur: AvatarBlur.BlurPictureWithClickToView,
  });

  return <Avatar {...props} size={112} />;
});
