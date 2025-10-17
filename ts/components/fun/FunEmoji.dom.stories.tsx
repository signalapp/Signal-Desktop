// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useVirtualizer } from '@tanstack/react-virtual';
import lodash from 'lodash';
import React, { useCallback, useEffect, useRef } from 'react';
import { type ComponentMeta } from '../../storybook/types.std.js';
import type { FunStaticEmojiProps } from './FunEmoji.dom.js';
import { FunInlineEmoji, FunStaticEmoji } from './FunEmoji.dom.js';
import {
  _getAllEmojiVariantKeys,
  EMOJI_VARIANT_KEY_CONSTANTS,
  getEmojiParentByKey,
  getEmojiParentKeyByVariantKey,
  getEmojiVariantByKey,
} from './data/emojis.std.js';

const { chunk } = lodash;

export default {
  title: 'Components/Fun/FunEmoji',
  component: All,
  args: {
    size: 16,
  },
  argTypes: {
    size: { control: { type: 'select' }, options: [16, 32] },
  },
} satisfies ComponentMeta<AllProps>;

const COLUMNS = 8;

type AllProps = Pick<FunStaticEmojiProps, 'size'>;

export function All(props: AllProps): JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const data = Array.from(_getAllEmojiVariantKeys());
  const rows = chunk(data, COLUMNS);

  const getScrollElement = useCallback(() => {
    return scrollerRef.current;
  }, []);

  const estimateSize = useCallback(() => {
    return props.size;
  }, [props.size]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement,
    estimateSize,
    gap: 4,
  });

  const lastMeasuredSizeRef = useRef(props.size);
  useEffect(() => {
    if (lastMeasuredSizeRef.current !== props.size) {
      rowVirtualizer.measure();
      lastMeasuredSizeRef.current = props.size;
    }
  }, [rowVirtualizer, props.size]);

  return (
    <div
      ref={scrollerRef}
      style={{
        overflow: 'auto',
        height: 400,
        padding: 10,
        border: '1px solid',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: rowVirtualizer.getTotalSize(),
        }}
      >
        {rowVirtualizer.getVirtualItems().map(rowItem => {
          const row = rows[rowItem.index];
          return (
            <div
              key={rowItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: rowItem.size,
                transform: `translate(0, ${rowItem.start}px)`,
                display: 'flex',
                flexDirection: 'row',
                gap: 4,
                alignItems: 'center',
              }}
            >
              {row.map(emojiVariantKey => {
                const variant = getEmojiVariantByKey(emojiVariantKey);
                const parentKey =
                  getEmojiParentKeyByVariantKey(emojiVariantKey);
                const parent = getEmojiParentByKey(parentKey);
                return (
                  <div
                    key={emojiVariantKey}
                    style={{ display: 'flex', outline: '1px solid' }}
                  >
                    <FunStaticEmoji
                      role="img"
                      aria-label={parent.englishShortNameDefault}
                      size={props.size}
                      emoji={variant}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const FRIED_SHRIMP = getEmojiVariantByKey(
  EMOJI_VARIANT_KEY_CONSTANTS.FRIED_SHRIMP
);

export function Inline(): JSX.Element {
  return (
    <div style={{ userSelect: 'none' }}>
      <p style={{ userSelect: 'text' }}>
        <FunInlineEmoji
          role="img"
          aria-label="Fried Shrimp"
          emoji={FRIED_SHRIMP}
        />{' '}
        Lorem, ipsum dolor sit amet consectetur adipisicing elit. Repellat
        voluptates, mollitia tempora alias libero repudiandae nesciunt. Deleniti
        ducimus dolorum, debitis, reprehenderit at ut deserunt fuga corrupti
        provident quae natus a!{' '}
        <FunInlineEmoji
          role="img"
          aria-label="Fried Shrimp"
          emoji={FRIED_SHRIMP}
        />{' '}
        Consectetur quibusdam accusantium magni ipsum nemo eligendi quisquam
        dolor, recusandae vero dolore reiciendis doloribus ducimus officiis
        minima! Unde accusantium ut eaque error quidem soluta! Distinctio dicta
        rem nemo aut quo.{' '}
        <FunInlineEmoji
          role="img"
          aria-label="Fried Shrimp"
          emoji={FRIED_SHRIMP}
        />
      </p>
    </div>
  );
}
