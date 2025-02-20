// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { MouseEvent, ReactNode } from 'react';
import React from 'react';
import { FunImage } from './FunImage';

/**
 * Button
 */

export type FunItemButtonProps = Readonly<{
  'aria-label': string;
  'aria-describedby'?: string;
  tabIndex: number;
  onClick: (event: MouseEvent) => void;
  children: ReactNode;
}>;

export function FunItemButton(props: FunItemButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className="FunItem__Button"
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      onClick={props.onClick}
      tabIndex={props.tabIndex}
    >
      {props.children}
    </button>
  );
}

/**
 * Sticker
 */

export type FunItemStickerProps = Readonly<{
  src: string;
}>;

export function FunItemSticker(props: FunItemStickerProps): JSX.Element {
  return (
    <FunImage
      role="presentation"
      className="FunItem__Sticker"
      src={props.src}
      width={68}
      height={68}
      alt=""
    />
  );
}

/**
 * Gif
 */

export type FunItemGifProps = Readonly<{
  src: string;
  width: number;
  height: number;
}>;

export function FunItemGif(props: FunItemGifProps): JSX.Element {
  return (
    <FunImage
      role="presentation"
      className="FunItem__Gif"
      src={props.src}
      width={props.width}
      height={props.height}
      // For presentation only
      alt=""
    />
  );
}
