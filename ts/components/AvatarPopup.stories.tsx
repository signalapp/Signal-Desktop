import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean, select, text } from '@storybook/addon-knobs';

import { AvatarPopup, Props } from './AvatarPopup';
import { Colors, ColorType } from '../types/Colors';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const colorMap: Record<string, ColorType> = Colors.reduce(
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
  avatarPath: text('avatarPath', overrideProps.avatarPath || ''),
  color: select('color', colorMap, overrideProps.color || 'blue'),
  conversationType: select(
    'conversationType',
    conversationTypeMap,
    overrideProps.conversationType || 'direct'
  ),
  i18n,
  name: text('name', overrideProps.name || ''),
  noteToSelf: boolean('noteToSelf', overrideProps.noteToSelf || false),
  onClick: action('onClick'),
  onViewArchive: action('onViewArchive'),
  onViewPreferences: action('onViewPreferences'),
  phoneNumber: text('phoneNumber', overrideProps.phoneNumber || ''),
  profileName: text('profileName', overrideProps.profileName || ''),
  size: 80,
  style: {},
  title: text('title', overrideProps.title || ''),
});

const stories = storiesOf('Components/Avatar Popup', module);

stories.add('Avatar Only', () => {
  const props = createProps();

  return <AvatarPopup {...props} />;
});

stories.add('Title', () => {
  const props = createProps({
    title: 'My Great Title',
  });

  return <AvatarPopup {...props} />;
});

stories.add('Profile Name', () => {
  const props = createProps({
    profileName: 'Sam Neill',
  });

  return <AvatarPopup {...props} />;
});

stories.add('Phone Number', () => {
  const props = createProps({
    profileName: 'Sam Neill',
    phoneNumber: '(555) 867-5309',
  });

  return <AvatarPopup {...props} />;
});
