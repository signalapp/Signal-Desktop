// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type {
  ForwardedRef,
  ReactNode,
  DOMAttributes,
  PointerEvent,
} from 'react';
import React, { forwardRef, useCallback, useEffect, useMemo } from 'react';
import { mergeProps } from '@react-aria/utils';
import { strictAssert } from '../../../util/assert.std.js';

/**
 * Button
 */

export type FunItemButtonLongPressProps = Readonly<
  | {
      longPressAccessibilityDescription?: never;
      onLongPress?: never;
    }
  | {
      longPressAccessibilityDescription: string;
      onLongPress: (event: LongPressEvent) => void;
    }
>;

export type FunItemButtonProps = Readonly<
  {
    'aria-label': string;
    excludeFromTabOrder: boolean;
    onClick: (event: PointerEvent) => void;
    onContextMenu?: (event: PointerEvent) => void;
    children: ReactNode;
  } & FunItemButtonLongPressProps
>;

export const FunItemButton = forwardRef(function FunItemButton(
  props: FunItemButtonProps,
  ref: ForwardedRef<HTMLButtonElement>
): JSX.Element {
  const {
    'aria-label': ariaLabel,
    excludeFromTabOrder,
    onClick,
    onContextMenu,
    children,
    longPressAccessibilityDescription,
    onLongPress,
    ...rest
  } = props;

  const longPressProps = useLongPress(onLongPress ?? null);

  const handleClick = useCallback(
    (event: PointerEvent) => {
      if (!event.defaultPrevented) {
        onClick(event);
      }
    },
    [onClick]
  );

  return (
    // eslint-disable-next-line jsx-a11y/role-supports-aria-props
    <button
      ref={ref}
      type="button"
      className="FunItem__Button"
      aria-label={ariaLabel}
      aria-description={longPressAccessibilityDescription}
      tabIndex={excludeFromTabOrder ? -1 : undefined}
      {...mergeProps(
        longPressProps,
        {
          onClick: handleClick,
          onContextMenu,
        },
        rest
      )}
    >
      {children}
    </button>
  );
});

type LongPressEvent = Readonly<{
  pointerType: PointerEvent['pointerType'];
}>;

function useLongPress(
  onLongPress: ((event: LongPressEvent) => void) | null
): DOMAttributes<Element> {
  const { cleanup, props } = useMemo(() => {
    if (onLongPress == null) {
      return { props: {} };
    }

    let timer: ReturnType<typeof setTimeout>;
    let isLongPressed = false;
    let lastLongPress: number | null = null;

    function reset() {
      clearTimeout(timer);
      isLongPressed = false;
    }

    function handleCancel(event: PointerEvent) {
      if (isLongPressed) {
        lastLongPress = event.timeStamp;
      }
      reset();
    }

    function handleStart(event: PointerEvent) {
      const press: LongPressEvent = { pointerType: event.pointerType };
      reset();
      timer = setTimeout(() => {
        isLongPressed = true;
        strictAssert(onLongPress != null, 'Missing callback');
        onLongPress(press);
      }, 500);
    }

    function handleClick(event: PointerEvent) {
      if (event.timeStamp === lastLongPress) {
        event.preventDefault();
      }
    }

    return {
      cleanup: reset,
      props: {
        onPointerDown: handleStart,
        onPointerUp: handleCancel,
        onPointerCancel: handleCancel,
        onPointerLeave: handleCancel,
        onClick: handleClick,
      } satisfies DOMAttributes<Element>,
    };
  }, [onLongPress]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return props;
}
