// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import type { Meta } from '@storybook/react';
import { FunSticker, type FunStickerProps } from './FunSticker.dom.js';

export default {
  title: 'Components/Fun/FunSticker',
} satisfies Meta<FunStickerProps>;

export function Default(): JSX.Element {
  return (
    <>
      <p>with reduce motion:</p>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div tabIndex={0}>
        <FunSticker
          src="/fixtures/giphy-GVNvOUpeYmI7e.gif"
          // src="/fixtures/kitten-1-64-64.jpg"
          size={68}
          role="img"
          aria-label="Sticker"
        />
      </div>
      <p>without reduce motion:</p>
      <FunSticker
        src="/fixtures/giphy-GVNvOUpeYmI7e.gif"
        // src="/fixtures/kitten-1-64-64.jpg"
        size={68}
        role="img"
        aria-label="Sticker"
        ignoreReducedMotion
      />
    </>
  );
}
