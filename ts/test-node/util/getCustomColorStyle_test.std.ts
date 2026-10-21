// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  getCustomColorBackground,
  resolveBubbleColorRenderData,
} from '../../util/getCustomColorStyle.std.ts';
import { AxoColor } from '../../axo/AxoColor.std.ts';
import type { ChatStyle } from '../../types/ChatStyle.std.ts';
import { DEFAULT_BUBBLE_COLOR } from '../../types/ChatStyle.std.ts';
import { Uint32 } from '@signalapp/types';

describe('getCustomColorBackground', () => {
  it('returns backgroundColor for solid colors', () => {
    const color: ChatStyle.CustomChatColor['color'] = {
      solid: AxoColor.parse('hsl(90, 100%, 30%)').argbInt(),
    };

    assert.deepEqual(getCustomColorBackground(color), 'rgba(77, 153, 0, 1)');
  });

  it('returns backgroundImage with linear-gradient for gradients', () => {
    const color: ChatStyle.CustomChatColor['color'] = {
      gradient: {
        start: AxoColor.parse('hsl(90, 100%, 30%)').argbInt(),
        end: AxoColor.parse('hsl(180, 50%, 30%)').argbInt(),
        angle: Uint32.fromNumber(270),
      },
    };

    assert.deepEqual(
      getCustomColorBackground(color),
      'linear-gradient(0deg, rgba(77, 153, 0, 1), rgba(38, 115, 115, 1))'
    );
  });
});

describe('resolveBubbleColorRenderData', () => {
  const RED: ChatStyle.CustomChatColor = {
    id: 1 as ChatStyle.CustomChatColorId,
    color: { solid: AxoColor.parse('hsl(0, 100%, 50%)').argbInt() },
  };
  const BLUE: ChatStyle.CustomChatColor = {
    id: 2 as ChatStyle.CustomChatColorId,
    color: { solid: AxoColor.parse('hsl(240, 100%, 50%)').argbInt() },
  };
  const DELETED_ID = 3 as ChatStyle.CustomChatColorId;
  const CUSTOM_CHAT_COLORS = [RED, BLUE];

  it('resolves presets', () => {
    assert.deepEqual(
      resolveBubbleColorRenderData(
        { bubbleColorPreset: 'crimson' },
        { customChatColorId: RED.id },
        CUSTOM_CHAT_COLORS
      ),
      { bubbleColorPreset: 'crimson' }
    );
  });

  it('resolves custom colors by id', () => {
    assert.deepEqual(
      resolveBubbleColorRenderData(
        { customChatColorId: BLUE.id },
        { customChatColorId: RED.id },
        CUSTOM_CHAT_COLORS
      ),
      { customColor: BLUE.color }
    );
  });

  it('falls back to the default bubble color', () => {
    assert.deepEqual(
      resolveBubbleColorRenderData(
        null,
        { customChatColorId: RED.id },
        CUSTOM_CHAT_COLORS
      ),
      { customColor: RED.color }
    );
  });

  it('falls back to the default bubble color for deleted colors', () => {
    assert.deepEqual(
      resolveBubbleColorRenderData(
        { customChatColorId: DELETED_ID },
        { bubbleColorPreset: 'crimson' },
        CUSTOM_CHAT_COLORS
      ),
      { bubbleColorPreset: 'crimson' }
    );
  });

  it('falls back to DEFAULT_BUBBLE_COLOR when the default is deleted', () => {
    assert.deepEqual(
      resolveBubbleColorRenderData(
        { customChatColorId: DELETED_ID },
        { customChatColorId: DELETED_ID },
        CUSTOM_CHAT_COLORS
      ),
      DEFAULT_BUBBLE_COLOR
    );
  });
});
