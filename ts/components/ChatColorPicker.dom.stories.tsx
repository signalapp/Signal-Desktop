// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { ChatColorPickerProps } from './ChatColorPicker.dom.tsx';
import { ChatColorPicker } from './ChatColorPicker.dom.tsx';
import { AxoColor } from '../axo/AxoColor.std.ts';
import type { ChatStyle } from '../types/ChatStyle.std.ts';
import { Uint32 } from '@signalapp/types';

const { i18n } = window.SignalContext;

const DEFAULT_PROPS = {
  i18n,
  conversationId: '',
  onAddCustomChatColor: action('addCustomColor'),
  onSelectBubbleColor: action('colorSelected'),
  onEditCustomChatColor: action('editCustomColor'),
  getConversationsWithCustomColor: (_: ChatStyle.CustomChatColorId) => [],

  onRemoveCustomChatColor: action('removeCustomColor'),
  onResetAllChatColors: action('resetAllChatColors'),
  onResetDefaultBubbleColor: action('resetDefaultChatColor'),
  selectedBubbleColor: { bubbleColorPreset: 'basil' },
  defaultBubbleColor: { bubbleColorPreset: 'ultramarine' },
  onChangeGlobalDefaultBubbleColor: action('onChangeGlobalDefaultBubbleColor'),
} as const satisfies Partial<ChatColorPickerProps>;

export default {
  title: 'Components/ChatColorPicker',
} satisfies Meta;

export function Default(): ReactNode {
  return <ChatColorPicker {...DEFAULT_PROPS} customChatColors={[]} />;
}

const SAMPLE_CUSTOM_COLOR: ChatStyle.CustomChatColor = {
  id: 3 as ChatStyle.CustomChatColorId,
  color: {
    gradient: {
      angle: Uint32.fromNumber(90),
      end: AxoColor.parse('hsl(197, 100%, 35.66%)').argbInt(),
      start: AxoColor.parse('hsl(315, 78%, 41.25%)').argbInt(),
    },
  },
};

const CUSTOM_COLORS: ReadonlyArray<ChatStyle.CustomChatColor> = [
  {
    id: 1 as ChatStyle.CustomChatColorId,
    color: {
      solid: AxoColor.parse('hsl(32, 100%, 37%)').argbInt(),
    },
  },
  {
    id: 2 as ChatStyle.CustomChatColorId,
    color: {
      gradient: {
        angle: Uint32.fromNumber(90),
        start: AxoColor.parse('hsl(180, 100%, 30%)').argbInt(),
        end: AxoColor.parse('hsl(0, 100%, 45%)').argbInt(),
      },
    },
  },
  SAMPLE_CUSTOM_COLOR,
  {
    id: 4 as ChatStyle.CustomChatColorId,
    color: {
      gradient: {
        angle: Uint32.fromNumber(90),
        start: AxoColor.parse('hsl(161, 52%, 30%)').argbInt(),
        end: AxoColor.parse('hsl(153, 89%, 30%)').argbInt(),
      },
    },
  },
];

export function CustomColors(): ReactNode {
  return (
    <ChatColorPicker
      {...DEFAULT_PROPS}
      customChatColors={CUSTOM_COLORS}
      selectedBubbleColor={{
        customChatColorId: SAMPLE_CUSTOM_COLOR.id,
      }}
    />
  );
}
