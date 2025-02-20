// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useVirtualizer } from '@tanstack/react-virtual';
import { chunk } from 'lodash';
import React, { StrictMode, useCallback, useEffect, useRef } from 'react';
import { type ComponentMeta } from '../../storybook/types';
import type { FunEmojiProps } from './FunEmoji';
import { FunEmoji } from './FunEmoji';
import {
  _allEmojiVariantKeys,
  getEmojiParentByKey,
  getEmojiParentKeyByVariantKey,
  getEmojiVariantByKey,
} from './data/emojis';

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

type AllProps = Pick<FunEmojiProps, 'size'>;

export function All(props: AllProps): JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const data = Array.from(_allEmojiVariantKeys());
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
    <StrictMode>
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
                      <FunEmoji
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
    </StrictMode>
  );
}
