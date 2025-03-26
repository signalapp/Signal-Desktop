// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import classNames from 'classnames';
import type { CSSProperties } from 'react';
import React, { useMemo } from 'react';
import type { EmojiVariantData } from './data/emojis';
import type { FunImageAriaProps } from './types';

export const FUN_STATIC_EMOJI_CLASS = 'FunStaticEmoji';
export const FUN_INLINE_EMOJI_CLASS = 'FunInlineEmoji';

function getEmojiJumboUrl(emoji: EmojiVariantData): string {
  return `emoji://jumbo?emoji=${encodeURIComponent(emoji.value)}`;
}

export type FunStaticEmojiSize =
  | 16
  | 18
  | 20
  | 24
  | 28
  | 32
  | 36
  | 40
  | 48
  | 56
  | 64
  | 66;

export enum FunJumboEmojiSize {
  Small = 32,
  Medium = 36,
  Large = 40,
  ExtraLarge = 48,
  Max = 56,
}

const funStaticEmojiSizeClasses = {
  16: 'FunStaticEmoji--Size16',
  18: 'FunStaticEmoji--Size18',
  20: 'FunStaticEmoji--Size20',
  24: 'FunStaticEmoji--Size24',
  28: 'FunStaticEmoji--Size28',
  32: 'FunStaticEmoji--Size32',
  36: 'FunStaticEmoji--Size36',
  40: 'FunStaticEmoji--Size40',
  48: 'FunStaticEmoji--Size48',
  56: 'FunStaticEmoji--Size56',
  64: 'FunStaticEmoji--Size64',
  66: 'FunStaticEmoji--Size66',
} satisfies Record<FunStaticEmojiSize, string>;

export type FunStaticEmojiProps = FunImageAriaProps &
  Readonly<{
    size: FunStaticEmojiSize;
    emoji: EmojiVariantData;
  }>;

export function FunStaticEmoji(props: FunStaticEmojiProps): JSX.Element {
  const emojiJumboUrl = useMemo(() => {
    return getEmojiJumboUrl(props.emoji);
  }, [props.emoji]);
  return (
    <div
      role={props.role}
      aria-label={props['aria-label']}
      data-emoji-key={props.emoji.key}
      data-emoji-value={props.emoji.value}
      className={classNames(
        FUN_STATIC_EMOJI_CLASS,
        funStaticEmojiSizeClasses[props.size]
      )}
      style={
        {
          '--fun-emoji-sheet-x': props.emoji.sheetX,
          '--fun-emoji-sheet-y': props.emoji.sheetY,
          '--fun-emoji-jumbo-image': `url(${emojiJumboUrl})`,
        } as CSSProperties
      }
    />
  );
}

export type StaticEmojiBlotProps = FunStaticEmojiProps;

const TRANSPARENT_PIXEL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";

/**
 * This is for Quill. It should stay in sync with <FunStaticEmoji> as much as possible.
 *
 * The biggest difference between them is that the emoji blot uses an `<img>`
 * tag with a single transparent pixel in order to render the selection cursor
 * correctly in the browser when using `contenteditable`
 *
 * We need to use the `<img>` bec ause
 */
export function createStaticEmojiBlot(
  node: HTMLImageElement,
  props: StaticEmojiBlotProps
): void {
  // eslint-disable-next-line no-param-reassign
  node.src = TRANSPARENT_PIXEL;
  // eslint-disable-next-line no-param-reassign
  node.role = props.role;
  node.classList.add(FUN_STATIC_EMOJI_CLASS);
  node.classList.add(funStaticEmojiSizeClasses[props.size]);
  node.classList.add('FunStaticEmoji--Blot');
  if (props['aria-label'] != null) {
    node.setAttribute('aria-label', props['aria-label']);
  }
  node.style.setProperty('--fun-emoji-sheet-x', `${props.emoji.sheetX}`);
  node.style.setProperty('--fun-emoji-sheet-y', `${props.emoji.sheetY}`);
  node.style.setProperty(
    '--fun-emoji-jumbo-image',
    `url(${getEmojiJumboUrl(props.emoji)})`
  );
}

export type FunInlineEmojiProps = FunImageAriaProps &
  Readonly<{
    size?: number | null;
    emoji: EmojiVariantData;
  }>;

export function FunInlineEmoji(props: FunInlineEmojiProps): JSX.Element {
  const emojiJumboUrl = useMemo(() => {
    return getEmojiJumboUrl(props.emoji);
  }, [props.emoji]);
  return (
    <svg
      role="none"
      className={FUN_INLINE_EMOJI_CLASS}
      width={64}
      height={64}
      viewBox="0 0 64 64"
      data-emoji-key={props.emoji.key}
      data-emoji-value={props.emoji.value}
      style={
        {
          '--fun-inline-emoji-size':
            props.size != null ? `${props.size}px` : null,
        } as CSSProperties
      }
    >
      {/*
        <foreignObject> is used to embed HTML+CSS within SVG, the HTML+CSS gets
        rendered at a normal size then scaled by the SVG. This allows us to make
        use of CSS features that are not supported by SVG while still using SVG's
        ability to scale relative to the parent's font-size.
       */}
      <foreignObject x={0} y={0} width={64} height={64}>
        <span aria-hidden className="FunEmojiSelectionText">
          {props.emoji.value}
        </span>
        <span
          role={props.role}
          aria-label={props['aria-label']}
          className="FunInlineEmoji__Image"
          style={
            {
              '--fun-emoji-sheet-x': props.emoji.sheetX,
              '--fun-emoji-sheet-y': props.emoji.sheetY,
              '--fun-emoji-jumbo-image': `url(${emojiJumboUrl})`,
            } as CSSProperties
          }
        />
      </foreignObject>
    </svg>
  );
}
