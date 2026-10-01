// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, type ReactNode } from 'react';
import { tw } from '../tw.dom.tsx';

export type FlexWrapDetectorProps = Readonly<{
  children: ReactNode;
}>;

/**
 * Detects when flex items wrap and exposes `container-scrollable` /
 * `container-not-scrollable` container-query states to descendants.
 * Used internally by `AxoAlertDialog.Footer` to toggle between stacked
 * (full-width) and inline (equal-basis) button layouts.
 */
export const FlexWrapDetector = memo(function FlexWrapDetector(
  props: FlexWrapDetectorProps
) {
  return (
    <div
      className={tw(
        // 1. Create a new container for querying scroll-state()
        '@container-[scroll-state] overflow-x-hidden',
        // 2. Make it a wrapping flex container
        'flex flex-wrap',
        // Also subtract margins for focus rings
        '-m-1'
      )}
    >
      {/* 3. When wrapped, this will grow to fill the container */}
      <div className={tw('relative grow')}>
        {/* 4. And then this will make the scroll container overflow */}
        <div className={tw('absolute -inset-e-px size-px')} />
      </div>
      <div
        className={tw(
          // 5. When not wrapped, this item should take priority when growing the items
          'grow-9999',
          // Add padding for focus rings (need `box-sizing: content` to avoid padding contributing to flex-basis)
          'box-content p-1'
        )}
      >
        {props.children}
      </div>
    </div>
  );
});
