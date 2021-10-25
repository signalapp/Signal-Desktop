// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { Ref, useCallback, useEffect, useRef } from 'react';
import { noop } from 'lodash';

import { refMerger } from '../util/refMerger';
import type { InteractionModeType } from '../state/ducks/conversations';

type PropsType = {
  children: React.ReactNode;
  interactionMode: InteractionModeType;
  // Matches Popper's RefHandler type
  innerRef: Ref<HTMLElement>;
  onHoverChanged: (_: boolean) => void;
};

// React doesn't reliably fire `onMouseLeave` or `onMouseOut` events if wrapping a
//   disabled button. This uses native browser events to avoid that.
//
// See <https://lecstor.com/react-disabled-button-onmouseleave/>.
export const TooltipEventWrapper: React.FC<PropsType> = ({
  onHoverChanged,
  children,
  interactionMode,
  innerRef,
}) => {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  const on = useCallback(() => {
    onHoverChanged(true);
  }, [onHoverChanged]);

  const off = useCallback(() => {
    onHoverChanged(false);
  }, [onHoverChanged]);

  const onFocus = useCallback(() => {
    if (interactionMode === 'keyboard') {
      on();
    }
  }, [on, interactionMode]);

  useEffect(() => {
    const wrapperEl = wrapperRef.current;

    if (!wrapperEl) {
      return noop;
    }

    wrapperEl.addEventListener('mouseenter', on);
    wrapperEl.addEventListener('mouseleave', off);

    return () => {
      wrapperEl.removeEventListener('mouseenter', on);
      wrapperEl.removeEventListener('mouseleave', off);
    };
  }, [on, off]);

  return (
    <span
      onFocus={onFocus}
      onBlur={off}
      ref={refMerger<HTMLSpanElement>(innerRef, wrapperRef)}
    >
      {children}
    </span>
  );
};
