// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import classNames from 'classnames';
import type { CSSProperties } from 'react';
import React, { useMemo, useState, useCallback } from 'react';
import MANIFEST from '../../../build/jumbomoji.json';
import {
  getEmojiDebugLabel,
  isSafeEmojifyEmoji,
  type EmojiVariantData,
  type EmojiVariantValue,
} from './data/emojis.std.ts';
import type { FunImageAriaProps } from './types.dom.tsx';
import { createLogger } from '../../logging/log.std.ts';

const log = createLogger('FunEmoji');

export const FUN_STATIC_EMOJI_CLASS = 'FunStaticEmoji';
const FUN_INLINE_EMOJI_CLASS = 'FunInlineEmoji';

const FUN_STATIC_EMOJI_TEXT_CLASS = 'FunStaticEmoji__Text';
const FUN_INLINE_EMOJI_IMAGE_CLASS = 'FunInlineEmoji__Image';
const FUN_INLINE_EMOJI_IMAGE_LOADED_CLASS = 'FunInlineEmoji__Image--loaded';
const FUN_INLINE_EMOJI_SMALL_CLASS = 'FunInlineEmoji__Small';
const FUN_INLINE_EMOJI_JUMBO_CLASS = 'FunInlineEmoji__Jumbo';

const KNOWN_JUMBOMOJI = new Set<string>(Object.values(MANIFEST).flat());
const MIN_JUMBOMOJI_SIZE = 33;

function getEmojiJumboUrl(
  emoji: EmojiVariantData,
  size: number | undefined
): string | null {
  if (size != null && size < MIN_JUMBOMOJI_SIZE) {
    return null;
  }
  if (KNOWN_JUMBOMOJI.has(emoji.value)) {
    return `emoji://jumbo?emoji=${encodeURIComponent(emoji.value)}`;
  }
  return null;
}

export type FunStaticEmojiSize =
  | 12
  | 14
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
  12: 'FunStaticEmoji--Size12',
  14: 'FunStaticEmoji--Size14',
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

export function FunStaticEmoji(props: FunStaticEmojiProps): React.JSX.Element {
  const [isLoaded, setIsLoaded] = useState(false);

  const onLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const jumboImage = getEmojiJumboUrl(props.emoji, props.size);
  let img: React.JSX.Element | undefined;
  if (jumboImage != null) {
    img = (
      <img
        width={props.size}
        height={props.size}
        role={props.role}
        aria-label={props['aria-label']}
        data-emoji-key={props.emoji.key}
        data-emoji-value={props.emoji.value}
        className={classNames(
          FUN_STATIC_EMOJI_CLASS,
          funStaticEmojiSizeClasses[props.size]
        )}
        style={{ display: isLoaded ? undefined : 'none' }}
        src={jumboImage}
        onLoad={onLoad}
      />
    );
  }
  return (
    <>
      {img}
      {!isLoaded && (
        <div
          role={props.role}
          aria-label={props['aria-label']}
          data-emoji-key={props.emoji.key}
          data-emoji-value={props.emoji.value}
          className={classNames(
            FUN_STATIC_EMOJI_CLASS,
            FUN_STATIC_EMOJI_TEXT_CLASS,
            funStaticEmojiSizeClasses[props.size]
          )}
          style={
            {
              '--fun-emoji-jumbo-image': jumboImage,
            } as CSSProperties
          }
        >
          {props.emoji.value}
        </div>
      )}
    </>
  );
}

export type StaticEmojiBlotProps = FunStaticEmojiProps;

/**
 * This is for Quill. It should stay in sync with <FunStaticEmoji> as much as possible.
 */
export function createStaticEmojiBlot(
  nodeParam: HTMLSpanElement,
  props: StaticEmojiBlotProps
): void {
  const node = nodeParam;

  node.role = props.role;
  node.classList.add(FUN_STATIC_EMOJI_CLASS);
  node.classList.add(funStaticEmojiSizeClasses[props.size]);
  node.classList.add(FUN_STATIC_EMOJI_TEXT_CLASS);
  node.classList.add('FunStaticEmoji--Blot');
  if (props['aria-label'] != null) {
    node.setAttribute('aria-label', props['aria-label']);
  }
  // Needed to lookup emoji value in `matchEmojiBlot`
  node.dataset.emojiKey = props.emoji.key;
  node.dataset.emojiValue = props.emoji.value;

  node.innerText = props.emoji.value;
}

export type FunInlineEmojiProps = FunImageAriaProps &
  Readonly<{
    size?: number | null;
    emoji: EmojiVariantData;
    style?: CSSProperties;
  }>;

export function FunInlineEmoji(props: FunInlineEmojiProps): React.JSX.Element {
  const [isLoaded, setIsLoaded] = useState(false);

  const onLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const jumboImage = useMemo(() => {
    // Note: we don't pass size here because appearance of jumbomoji is decided
    // in css based on the parent svg container size.
    return getEmojiJumboUrl(props.emoji, undefined);
  }, [props.emoji]);

  let img: React.JSX.Element | undefined;
  if (jumboImage) {
    img = (
      <img
        className={classNames(
          FUN_INLINE_EMOJI_IMAGE_CLASS,
          isLoaded && FUN_INLINE_EMOJI_IMAGE_LOADED_CLASS
        )}
        aria-hidden
        alt=""
        loading="lazy"
        src={jumboImage}
        onLoad={onLoad}
      />
    );
  }

  return (
    <div
      className={FUN_INLINE_EMOJI_CLASS}
      aria-label={props['aria-label']}
      // Needed to lookup emoji value in `matchEmojiBlot`
      data-emoji-key={props.emoji.key}
      data-emoji-value={props.emoji.value}
      style={
        {
          '--fun-inline-emoji-size':
            props.size != null ? `${props.size}px` : null,
          ...props.style,
        } as CSSProperties
      }
    >
      <div className={FUN_INLINE_EMOJI_SMALL_CLASS}>{props.emoji.value}</div>
      <div className={FUN_INLINE_EMOJI_JUMBO_CLASS}>
        {!isLoaded && props.emoji.value}
        {img}
      </div>
    </div>
  );
}

function isFunEmojiElement(element: HTMLElement): boolean {
  return (
    element.classList.contains(FUN_INLINE_EMOJI_CLASS) ||
    element.classList.contains(FUN_STATIC_EMOJI_CLASS)
  );
}

export function getFunEmojiElementValue(
  element: HTMLElement
): EmojiVariantValue | null {
  if (!isFunEmojiElement(element)) {
    return null;
  }

  const value = element.dataset.emojiValue;
  if (value == null) {
    log.error('Missing a data-emoji-value attribute on emoji element');
    return null;
  }

  if (!isSafeEmojifyEmoji(value)) {
    log.error(
      `Expected a valid emoji variant value, got ${getEmojiDebugLabel(value)}`
    );
    return null;
  }

  return value;
}
