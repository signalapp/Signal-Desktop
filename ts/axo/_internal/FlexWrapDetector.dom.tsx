// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, type ReactNode } from 'react';
import { tw } from '../tw.dom.js';

export type FlexWrapDetectorProps = Readonly<{
  children: ReactNode;
}>;

export const FlexWrapDetector = memo(function FlexWrapDetector(
  props: FlexWrapDetectorProps
) {
  return (
    <div
      className={tw(
        // 1. Create a new container for querying scroll-state()
        '@container-[scroll-state] overflow-x-hidden',
        // 2. Make it a wrapping flex container
        'flex flex-wrap'
      )}
    >
      {/* 3. When wrapped, this will grow to fill the container */}
      <div className={tw('relative grow')}>
        {/* 4. And then this will make the scroll container overflow */}
        <div className={tw('absolute -end-px size-px')} />
      </div>
      {/* 5. When not wrapped, this item should take priority when growing the items */}
      <div className={tw('grow-[9999]')}>{props.children}</div>
    </div>
  );
});
