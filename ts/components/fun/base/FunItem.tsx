// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ForwardedRef, MouseEvent, ReactNode } from 'react';
import React, { forwardRef } from 'react';
import {
  mergeProps,
  type PressEvent,
  useLongPress,
  usePress,
} from 'react-aria';
import type { LongPressEvent } from '@react-types/shared';

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
    tabIndex: number;
    onPress: (event: PressEvent) => void;
    onContextMenu?: (event: MouseEvent) => void;
    children: ReactNode;
  } & FunItemButtonLongPressProps
>;

export const FunItemButton = forwardRef(function FunItemButton(
  props: FunItemButtonProps,
  ref: ForwardedRef<HTMLButtonElement>
): JSX.Element {
  const { pressProps } = usePress({
    onPress: props.onPress,
  });

  const { longPressProps } = useLongPress({
    isDisabled: props.onLongPress == null,
    accessibilityDescription: props.longPressAccessibilityDescription,
    onLongPress: props.onLongPress,
  });

  return (
    <button
      ref={ref}
      type="button"
      className="FunItem__Button"
      aria-label={props['aria-label']}
      tabIndex={props.tabIndex}
      {...mergeProps(pressProps, longPressProps)}
      onContextMenu={props.onContextMenu}
    >
      {props.children}
    </button>
  );
});
