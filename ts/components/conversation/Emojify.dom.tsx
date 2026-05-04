// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { CSSProperties, JSX } from 'react';
import { useMemo } from 'react';
import type { RenderTextCallbackType } from '../../types/Util.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { FunInlineEmoji } from '../fun/FunEmoji.dom.tsx';
import { Emoji } from '../../axo/emoji.std.ts';

export type Props = {
  fontSizeOverride?: number | null;
  text: string;
  /** When behind a spoiler, this emoji needs to be visibility: hidden */
  isInvisible?: boolean;
  /** Allows you to customize now non-newlines are rendered. Simplest is just a <span>. */
  renderNonEmoji?: RenderTextCallbackType;
  style?: CSSProperties;
};

const defaultRenderNonEmoji: RenderTextCallbackType = ({ text }) => text;

export function Emojify({
  fontSizeOverride,
  text,
  renderNonEmoji = defaultRenderNonEmoji,
  style,
}: Props): JSX.Element {
  const segments = useMemo(() => {
    return Array.from(Emoji.getSegments(text));
  }, [text]);

  return (
    <>
      {segments.map(segment => {
        if (segment.kind === 'emoji') {
          return (
            <FunInlineEmoji
              key={segment.offset}
              role="img"
              aria-label={Emoji.getDisplayLabel(segment.value)}
              emoji={segment.value}
              size={fontSizeOverride}
              style={style}
            />
          );
        }

        if (segment.kind === 'text') {
          return renderNonEmoji({ text: segment.value, key: segment.offset });
        }

        throw missingCaseError(segment);
      })}
    </>
  );
}
