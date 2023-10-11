// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './ChatColorPicker';
import { ChatColorPicker } from './ChatColorPicker';
import { ConversationColors } from '../types/Colors';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/ChatColorPicker',
  argTypes: {
    selectedColor: {
      control: {
        type: 'select',
        options: ConversationColors,
      },
    },
  },
  args: {
    addCustomColor: action('addCustomColor'),
    colorSelected: action('colorSelected'),
    editCustomColor: action('editCustomColor'),
    getConversationsWithCustomColor: (_: string) => Promise.resolve([]),
    i18n,
    removeCustomColor: action('removeCustomColor'),
    removeCustomColorOnConversations: action(
      'removeCustomColorOnConversations'
    ),
    resetAllChatColors: action('resetAllChatColors'),
    resetDefaultChatColor: action('resetDefaultChatColor'),
    selectedColor: 'basil',
    selectedCustomColor: {},
    setGlobalDefaultConversationColor: action(
      'setGlobalDefaultConversationColor'
    ),
  },
} satisfies Meta<PropsType>;

const SAMPLE_CUSTOM_COLOR = {
  deg: 90,
  end: { hue: 197, saturation: 100 },
  start: { hue: 315, saturation: 78 },
};

export function Default(args: PropsType): JSX.Element {
  return <ChatColorPicker {...args} />;
}

const CUSTOM_COLORS = {
  abc: {
    start: { hue: 32, saturation: 100 },
  },
  def: {
    deg: 90,
    start: { hue: 180, saturation: 100 },
    end: { hue: 0, saturation: 100 },
  },
  ghi: SAMPLE_CUSTOM_COLOR,
  jkl: {
    deg: 90,
    start: { hue: 161, saturation: 52 },
    end: { hue: 153, saturation: 89 },
  },
};

export function CustomColors(args: PropsType): JSX.Element {
  return (
    <ChatColorPicker
      {...args}
      customColors={CUSTOM_COLORS}
      selectedColor="custom"
      selectedCustomColor={{
        id: 'ghi',
        value: SAMPLE_CUSTOM_COLOR,
      }}
    />
  );
}
