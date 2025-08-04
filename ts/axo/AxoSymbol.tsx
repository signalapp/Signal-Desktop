// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC } from 'react';
import React, { memo } from 'react';
import { Direction } from 'radix-ui';
import { VisuallyHidden } from 'react-aria';
import { assert } from './_internal/assert';

const { useDirection } = Direction;

const Namespace = 'AxoSymbol';

type AxoSymbolDef = string | { ltr: string; rtl: string };

const AllAxoSymbolDefs = {
  logo: '\u{E000}',
  album: '\u{E001}',
  appearance: '\u{E031}',
  'arrow-[start]': { ltr: '\u{2190}', rtl: '\u{2192}' },
  'arrow-[end]': { ltr: '\u{2192}', rtl: '\u{2190}' },
  'arrow-up': '\u{2191}',
  'arrow-down': '\u{2193}',
  'arrow-up_[start]': { ltr: '\u{2196}', rtl: '\u{2197}' },
  'arrow-up_[end]': { ltr: '\u{2197}', rtl: '\u{2196}' },
  'arrow-down_[start]': { ltr: '\u{2199}', rtl: '\u{2198}' },
  'arrow-down_[end]': { ltr: '\u{2198}', rtl: '\u{2199}' },
  'arrow-circle-[start]': { ltr: '\u{E00B}', rtl: '\u{E00C}' },
  'arrow-circle-[end]': { ltr: '\u{E00C}', rtl: '\u{E00B}' },
  'arrow-circle-up': '\u{E00D}',
  'arrow-circle-down': '\u{E00E}',
  'arrow-circle-up_[start]': { ltr: '\u{E00F}', rtl: '\u{E010}' },
  'arrow-circle-up_[end]': { ltr: '\u{E010}', rtl: '\u{E00F}' },
  'arrow-circle-down_[start]': { ltr: '\u{E011}', rtl: '\u{E012}' },
  'arrow-circle-down_[end]': { ltr: '\u{E012}', rtl: '\u{E011}' },
  'arrow-square-[start]': { ltr: '\u{E013}', rtl: '\u{E014}' },
  'arrow-square-[end]': { ltr: '\u{E014}', rtl: '\u{E013}' },
  'arrow-square-up': '\u{E015}',
  'arrow-square-down': '\u{E016}',
  'arrow-square-up_[start]': { ltr: '\u{E017}', rtl: '\u{E018}' },
  'arrow-square-up_[end]': { ltr: '\u{E018}', rtl: '\u{E017}' },
  'arrow-square-down_[start]': { ltr: '\u{E019}', rtl: '\u{E01A}' },
  'arrow-square-down_[end]': { ltr: '\u{E01A}', rtl: '\u{E019}' },
  'arrow-dash-down': '\u{E021}',
  'arrow-circle-[start]-fill': { ltr: '\u{E003}', rtl: '\u{E004}' },
  'arrow-circle-[end]-fill': { ltr: '\u{E004}', rtl: '\u{E003}' },
  'arrow-circle-up-fill': '\u{E005}',
  'arrow-circle-down-fill': '\u{E006}',
  'arrow-circle-up_[start]-fill': { ltr: '\u{E007}', rtl: '\u{E008}' },
  'arrow-circle-up_[end]-fill': { ltr: '\u{E008}', rtl: '\u{E007}' },
  'arrow-circle-down_[start]-fill': { ltr: '\u{E009}', rtl: '\u{E00A}' },
  'arrow-circle-down_[end]-fill': { ltr: '\u{E00A}', rtl: '\u{E009}' },
  'arrow-square-[start]-fill': { ltr: '\u{E08A}', rtl: '\u{E08B}' },
  'arrow-square-[end]-fill': { ltr: '\u{E08B}', rtl: '\u{E08A}' },
  'arrow-square-up-fill': '\u{E08C}',
  'arrow-square-down-fill': '\u{E08D}',
  'arrow-square-up_[start]-fill': { ltr: '\u{E08E}', rtl: '\u{E08F}' },
  'arrow-square-up_[end]-fill': { ltr: '\u{E08F}', rtl: '\u{E08E}' },
  'arrow-square-down_[start]-fill': { ltr: '\u{E090}', rtl: '\u{E091}' },
  'arrow-square-down_[end]-fill': { ltr: '\u{E091}', rtl: '\u{E090}' },
  at: '\u{E01B}',
  attach: '\u{E058}',
  audio: '\u{E01C}',
  'audio-rectangle': '\u{E01D}',
  badge: '\u{E099}',
  'badge-fill': '\u{E09A}',
  bell: '\u{E01E}',
  'bell-slash': '\u{E01F}',
  'bell-ring': '\u{E020}',
  block: '\u{E002}',
  calender: '\u{E0A2}',
  'calender-blank': '\u{E0A3}',
  check: '\u{2713}',
  'check-circle': '\u{E022}',
  'check-square': '\u{E023}',
  'chevron-[start]': { ltr: '\u{E024}', rtl: '\u{E025}' },
  'chevron-[end]': { ltr: '\u{E025}', rtl: '\u{E024}' },
  'chevron-up': '\u{E026}',
  'chevron-down': '\u{E027}',
  'chevron-circle-[start]': { ltr: '\u{E028}', rtl: '\u{E029}' },
  'chevron-circle-[end]': { ltr: '\u{E029}', rtl: '\u{E028}' },
  'chevron-circle-up': '\u{E02A}',
  'chevron-circle-down': '\u{E02B}',
  'chevron-square-[start]': { ltr: '\u{E02C}', rtl: '\u{E02D}' },
  'chevron-square-[end]': { ltr: '\u{E02D}', rtl: '\u{E02C}' },
  'chevron-square-up': '\u{E02E}',
  'chevron-square-down': '\u{E02F}',
  'dropdown-down': '\u{E07F}',
  'dropdown-up': '\u{E080}',
  'dropdown-triangle-down': '\u{E082}',
  'dropdown-triangle-up': '\u{E083}',
  'dropdown-double': '\u{E081}',
  edit: '\u{E030}',
  emoji: '\u{263A}',
  error: '\u{E032}',
  'error-triangle': '\u{E092}',
  'error-fill': '\u{E093}',
  'error-triangle-fill': '\u{E094}',
  file: '\u{E034}',
  forward: '\u{E035}',
  'forward-fill': '\u{E036}',
  gif: '\u{E037}',
  'gif-rectangle': '\u{E097}',
  'gif-rectangle-fill': '\u{E098}',
  gift: '\u{E0B5}',
  globe: '\u{E0B6}',
  group: '\u{E038}',
  'group-x': '\u{E0AE}',
  heart: '\u{E039}',
  help: '\u{E0D8}',
  incoming: '\u{E03A}',
  info: '\u{E03B}',
  leave: { ltr: '\u{E03C}', rtl: '\u{E03D}' },
  link: '\u{E03E}',
  'link-android': '\u{E03F}',
  'link-broken': '\u{E057}',
  'link-slash': '\u{E040}',
  lock: '\u{E041}',
  'lock-open': '\u{E07D}',
  megaphone: '\u{E042}',
  merge: '\u{E043}',
  message: '\u{E0A6}',
  'message_status-sending': '\u{E044}',
  'message_status-sent': '\u{E045}',
  'message_status-read': '\u{E047}',
  'message_status-delivered': '\u{E046}',
  'message_timer-00': '\u{E048}',
  'message_timer-05': '\u{E049}',
  'message_timer-10': '\u{E04A}',
  'message_timer-15': '\u{E04B}',
  'message_timer-20': '\u{E04C}',
  'message_timer-25': '\u{E04D}',
  'message_timer-30': '\u{E04E}',
  'message_timer-35': '\u{E04F}',
  'message_timer-40': '\u{E050}',
  'message_timer-45': '\u{E051}',
  'message_timer-50': '\u{E052}',
  'message_timer-55': '\u{E053}',
  'message_timer-60': '\u{E054}',
  mic: '\u{E055}',
  'mic-slash': '\u{E056}',
  minus: '\u{2212}',
  'minus-circle': '\u{2296}',
  'minus-square': '\u{E059}',
  'missed-incoming': '\u{E05A}',
  'missed-outgoing': '\u{E05B}',
  note: { ltr: '\u{E095}', rtl: '\u{E096}' },
  official_badge: '\u{E086}',
  'official_badge-fill': '\u{E087}',
  outgoing: '\u{E05C}',
  person: '\u{E05D}',
  'person-circle': '\u{E05E}',
  'person-check': '\u{E05F}',
  'person-x': '\u{E060}',
  'person-plus': '\u{E061}',
  'person-minus': '\u{E062}',
  'person-question': '\u{E06A}',
  phone: '\u{E063}',
  'phone-fill': '\u{E064}',
  photo: '\u{E065}',
  'photo-slash': '\u{E066}',
  play: '\u{E067}',
  'play-circle': '\u{E068}',
  'play-square': '\u{E069}',
  plus: '\u{002B}',
  'plus-circle': '\u{2295}',
  'plus-square': '\u{E06C}',
  raise_hand: '\u{E07E}',
  'raise_hand-fill': '\u{E084}',
  refresh: '\u{E0C4}',
  reply: '\u{E06D}',
  'reply-fill': '\u{E06E}',
  safety_number: '\u{E06F}',
  spam: '\u{E033}',
  sticker: '\u{E070}',
  thread: '\u{E071}',
  'thread-fill': '\u{E072}',
  timer: '\u{E073}',
  'timer-slash': '\u{E074}',
  video_camera: '\u{E075}',
  'video_camera-slash': '\u{E076}',
  'video_camera-fill': '\u{E077}',
  video: '\u{E088}',
  'video-slash': '\u{E089}',
  view_once: '\u{E078}',
  'view_once-dash': '\u{E079}',
  'view_once-viewed': '\u{E07A}',
  x: '\u{00D7}',
  'x-circle': '\u{2297}',
  'x-square': '\u{2327}',
  space: '\u{0020}',
} as const satisfies Record<string, AxoSymbolDef>;

export type AxoSymbolName = keyof typeof AllAxoSymbolDefs;

export function _getAllAxoSymbolNames(): ReadonlyArray<AxoSymbolName> {
  return Object.keys(AllAxoSymbolDefs) as Array<AxoSymbolName>;
}

export function _getAxoSymbol(
  symbolName: AxoSymbolName,
  dir: 'ltr' | 'rtl'
): string {
  const symbolDef = assert(
    AllAxoSymbolDefs[symbolName],
    `${Namespace}:Invalid name: ${symbolName}`
  );
  const symbol = typeof symbolDef === 'string' ? symbolDef : symbolDef[dir];
  return symbol;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AxoSymbol {
  /**
   * Component: <AxoSymbol.InlineGlyph>
   * --------------------------------------
   */

  export type InlineGlyphProps = Readonly<{
    symbol: AxoSymbolName;
    label: string | null;
  }>;

  export const InlineGlyph: FC<InlineGlyphProps> = memo(props => {
    const direction = useDirection();
    const symbol = _getAxoSymbol(props.symbol, direction);
    return (
      <>
        <span aria-hidden className="font-symbols select-none">
          {symbol}
        </span>
        {props.label != null && (
          <VisuallyHidden className="select-none">{props.label}</VisuallyHidden>
        )}
      </>
    );
  });

  InlineGlyph.displayName = `${Namespace}.InlineGlyph`;

  /**
   * Component: <AxoSymbol.Icon>
   * --------------------------------------
   */

  export type IconProps = Readonly<{
    size: 14 | 16 | 20;
    symbol: AxoSymbolName;
    label: string | null;
  }>;

  export const Icon: FC<IconProps> = memo(props => {
    return (
      <span
        className="inline-flex size-[1em] shrink-0 items-center justify-center"
        style={{ fontSize: props.size }}
      >
        <AxoSymbol.InlineGlyph symbol={props.symbol} label={props.label} />
      </span>
    );
  });

  Icon.displayName = `${Namespace}.Icon`;
}
