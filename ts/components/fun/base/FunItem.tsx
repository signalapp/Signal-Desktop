// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ForwardedRef, ReactNode } from 'react';
import React, { forwardRef, useEffect, useRef } from 'react';
import { type PressEvent, useLongPress } from 'react-aria';
import type { LongPressEvent } from '@react-types/shared';
import { Button } from 'react-aria-components';
import { mergeRefs } from '@react-aria/utils';
import { PressResponder } from '@react-aria/interactions';
import { strictAssert } from '../../../util/assert';

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
    onPress: (event: PressEvent) => void;
    onContextMenu?: (event: MouseEvent) => void;
    children: ReactNode;
  } & FunItemButtonLongPressProps
>;

export const FunItemButton = forwardRef(function FunItemButton(
  props: FunItemButtonProps,
  outerRef: ForwardedRef<HTMLButtonElement>
): JSX.Element {
  const { onContextMenu } = props;
  const innerRef = useRef<HTMLButtonElement>(null);

  const { longPressProps } = useLongPress({
    isDisabled: props.onLongPress == null,
    accessibilityDescription: props.longPressAccessibilityDescription,
    onLongPress: props.onLongPress,
  });

  useEffect(() => {
    strictAssert(innerRef.current, 'Missing ref element');
    const element = innerRef.current;
    if (onContextMenu == null) {
      return () => null;
    }
    element.addEventListener('contextmenu', onContextMenu);
    return () => {
      element.removeEventListener('contextmenu', onContextMenu);
    };
  }, [onContextMenu]);

  return (
    <PressResponder {...longPressProps}>
      <Button
        ref={mergeRefs(innerRef, outerRef)}
        type="button"
        className="FunItem__Button"
        aria-label={props['aria-label']}
        excludeFromTabOrder={props.excludeFromTabOrder}
        onPress={props.onPress}
      >
        {props.children}
      </Button>
    </PressResponder>
  );
});
