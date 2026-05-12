// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import classNames from 'classnames';
import type { CSSProperties, JSX } from 'react';
import { useMemo, useState, useCallback } from 'react';
import MANIFEST from '../../../build/jumbomoji.json';
import type { FunImageAriaProps } from './types.dom.tsx';
import { createLogger } from '../../logging/log.std.ts';
import { Emoji } from '../../axo/emoji.std.ts';

const log = createLogger('FunEmoji');

export const FUN_STATIC_EMOJI_CLASS = 'FunStaticEmoji';
const FUN_INLINE_EMOJI_CLASS = 'FunInlineEmoji';
const FUN_STATIC_EMOJI_TEXT_CLASS = 'FunStaticEmoji__Text';

const KNOWN_JUMBOMOJI = new Set<string>(Object.values(MANIFEST).flat());
const MIN_JUMBOMOJI_SIZE = 33;

function getEmojiJumboUrl(
  emoji: Emoji.Variant,
  size: number | undefined
): string | null {
  if (size != null && size < MIN_JUMBOMOJI_SIZE) {
    return null;
  }
  if (KNOWN_JUMBOMOJI.has(emoji)) {
    return `emoji://jumbo?emoji=${encodeURIComponent(emoji)}`;
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
    emoji: Emoji.Variant;
  }>;

export function FunStaticEmoji(props: FunStaticEmojiProps): JSX.Element {
  const [isLoaded, setIsLoaded] = useState(false);

  const onLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const jumboImage = getEmojiJumboUrl(props.emoji, props.size);
  let img: JSX.Element | undefined;
  if (jumboImage != null) {
    img = (
      <img
        width={props.size}
        height={props.size}
        role={props.role}
        aria-label={props['aria-label']}
        data-emoji={props.emoji}
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
        <span
          role={props.role}
          aria-label={props['aria-label']}
          data-emoji={props.emoji}
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
          {props.emoji}
        </span>
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

  node.innerText = props.emoji;
}

export type FunInlineEmojiProps = FunImageAriaProps &
  Readonly<{
    size?: number | null;
    emoji: Emoji.Variant;
    style?: CSSProperties;
  }>;

export function FunInlineEmoji(props: FunInlineEmojiProps): JSX.Element {
  const [isLoaded, setIsLoaded] = useState(false);

  const onLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const jumboImage = useMemo(() => {
    // Note: we don't pass size here because appearance of jumbomoji is decided
    // in css based on the parent svg container size.
    return getEmojiJumboUrl(props.emoji, undefined);
  }, [props.emoji]);

  let img: JSX.Element | undefined;
  if (jumboImage) {
    img = (
      <img
        className={classNames(
          'FunInlineEmoji__Image',
          isLoaded && 'FunInlineEmoji__Image--loaded'
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
    <span
      className={FUN_INLINE_EMOJI_CLASS}
      aria-label={props['aria-label']}
      // Needed to lookup emoji value in `matchEmojiBlot`
      data-emoji={props.emoji}
      style={
        {
          '--fun-inline-emoji-size':
            props.size != null ? `${props.size}px` : null,
          ...props.style,
        } as CSSProperties
      }
    >
      <span
        className={classNames(
          'FunInlineEmoji__Small',
          isLoaded && 'FunInlineEmoji__Small--Hidden'
        )}
      >
        {props.emoji}
      </span>
      {img != null && (
        <span className="FunInlineEmoji__Jumbo" aria-hidden>
          {img}
        </span>
      )}
    </span>
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
): Emoji.Variant | null {
  if (!isFunEmojiElement(element)) {
    return null;
  }

  const value = element.dataset.emoji;
  if (value == null) {
    log.error('Missing a data-emoji attribute on emoji element');
    return null;
  }

  if (!Emoji.isEmoji(value)) {
    log.error(
      `Expected a valid emoji variant value, got ${Emoji.getDebugLabel(value)}`
    );
    return null;
  }

  return Emoji.ignorePreferredSkinTone(value);
}
