// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { ColorType } from '../types/Colors';
import { CallingPip, PropsType } from './CallingPip';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const conversation = {
  id: '3051234567',
  avatarPath: undefined,
  color: 'ultramarine' as ColorType,
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
  profileName: 'Rick Sanchez',
};

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  conversation: overrideProps.conversation || conversation,
  hangUp: action('hang-up'),
  hasLocalVideo: boolean('hasLocalVideo', overrideProps.hasLocalVideo || false),
  hasRemoteVideo: boolean(
    'hasRemoteVideo',
    overrideProps.hasRemoteVideo || false
  ),
  i18n,
  setLocalPreview: action('set-local-preview'),
  setRendererCanvas: action('set-renderer-canvas'),
  togglePip: action('toggle-pip'),
});

const story = storiesOf('Components/CallingPip', module);

story.add('Default', () => {
  const props = createProps();
  return <CallingPip {...props} />;
});

story.add('Contact (with avatar)', () => {
  const props = createProps({
    conversation: {
      ...conversation,
      avatarPath: 'https://www.fillmurray.com/64/64',
    },
  });
  return <CallingPip {...props} />;
});

story.add('Contact (no color)', () => {
  const props = createProps({
    conversation: {
      ...conversation,
      color: undefined,
    },
  });
  return <CallingPip {...props} />;
});
