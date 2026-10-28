// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, FC, Ref } from 'react';
import { memo, useEffect, useRef } from 'react';
import { Slot } from 'radix-ui';
import { mergeRefs } from '@react-aria/utils';
import { tw } from '../tw.dom.tsx';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AxoButton } from '../AxoButton.dom.tsx';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';
import { assert, unreachable } from '../_internal/assert.std.tsx';

export namespace Story {
  /**
   * <Story.Stack>
   * --------------------------------------------------------------------------
   */

  export type StackProps = Readonly<{
    children: ReactNode;
  }>;

  export const Stack: FC<StackProps> = memo(props => {
    return <div className={tw('flex flex-col gap-4')}>{props.children}</div>;
  });

  Stack.displayName = 'Story.Stack';

  /**
   * <Story.Hint>
   * --------------------------------------------------------------------------
   */

  export type HintProps = Readonly<{
    children: ReactNode;
  }>;

  export const Hint: FC<HintProps> = memo(props => {
    return (
      <p
        className={tw(
          'my-2 first:mt-0 last:mb-0',
          'type-caption text-secondary'
        )}
      >
        {props.children}
      </p>
    );
  });

  Hint.displayName = 'Story.Hint';

  /**
   * <Story.Callout>
   * --------------------------------------------------------------------------
   */

  export type CalloutProps = Readonly<{
    children: ReactNode;
  }>;

  export const Callout: FC<CalloutProps> = memo(props => {
    return (
      <div
        className={tw(
          'my-2 first:mt-0 last:mb-0',
          'flex gap-2 p-2',
          'bg-warning-tint text-warning',
          'border border-dashed',
          'type-caption font-medium',
          'font-mono'
        )}
      >
        <AxoSymbol.InlineGlyph symbol="error-circle-fill" label={null} />
        <div className={tw('flex-1')}>{props.children}</div>
      </div>
    );
  });

  Callout.displayName = 'Story.Callout';

  /**
   * <Story.Legend>
   * --------------------------------------------------------------------------
   */

  export type LegendProps = Readonly<{
    label: string;
    children: ReactNode;
  }>;

  export const Legend: FC<LegendProps> = memo(props => {
    return (
      <fieldset className={tw('my-2 border border-dashed border-selected p-2')}>
        <legend className={tw('px-2 font-mono type-caption text-accent')}>
          {props.label}
        </legend>
        {props.children}
      </fieldset>
    );
  });

  Legend.displayName = 'Story.Legend';

  /**
   * <Story.AutoTrigger>
   * --------------------------------------------------------------------------
   */

  export type AutoTriggerProps = Readonly<{
    asChild?: boolean;
    ref?: Ref<HTMLElement>;
    kind?: 'click' | 'contextmenu';
    children: ReactNode;
  }>;

  /**
   * Opens the menu/select/dialog of the trigger it wraps when the story is
   * first rendered, so the story (and its screenshots) shows it open.
   *
   * @example
   * ```tsx
   * <AxoDropdownMenu.Trigger>
   *   <Story.AutoTrigger>Open</Story.AutoTrigger>
   * </AxoDropdownMenu.Trigger>
   * ```
   *
   * @example
   * ```tsx
   * <AxoContextMenu.Trigger>
   *   <Story.AutoTrigger asChild kind="contextmenu">
   *     <div>Right Click</div>
   *   </Story.AutoTrigger>
   * </AxoContextMenu.Trigger>
   * ```
   */
  export const AutoTrigger: FC<AutoTriggerProps> = memo(props => {
    const { asChild, ref: outerRef, kind = 'click', children, ...rest } = props;
    const innerRef = useRef<HTMLElement>(null);
    const ref = mergeRefs(innerRef, outerRef);
    const hasTriggeredRef = useRef(false);

    useEffect(() => {
      const element = assert(innerRef.current);

      if (hasTriggeredRef.current) {
        return;
      }
      hasTriggeredRef.current = true;

      const rect = element.getBoundingClientRect();

      const init: PointerEventInit & MouseEventInit = {
        bubbles: true,
        cancelable: true,
        button: kind === 'click' ? 0 : 2,
        buttons: kind === 'click' ? 1 : 2,
        pointerType: 'mouse',
        clientX: rect.x + rect.width / 2,
        clientY: rect.y + rect.height / 2,
      };

      if (kind === 'click') {
        element.dispatchEvent(new PointerEvent('pointerdown', init));
        element.dispatchEvent(new PointerEvent('mousedown', init));
        element.dispatchEvent(new PointerEvent('pointerup', init));
        element.dispatchEvent(new PointerEvent('mouseup', init));
        element.dispatchEvent(new PointerEvent('click', init));
      } else if (kind === 'contextmenu') {
        element.dispatchEvent(new PointerEvent('pointerdown', init));
        element.dispatchEvent(new PointerEvent('mousedown', init));
        element.dispatchEvent(new PointerEvent('contextmenu', init));
      } else {
        unreachable(kind);
      }
    }, [kind]);

    if (asChild) {
      return (
        <Slot.Root ref={ref} {...forwardExtraPropsForRadix(rest)}>
          {children}
        </Slot.Root>
      );
    }

    return (
      <AxoButton.Root
        ref={ref as Ref<HTMLButtonElement>}
        size="md"
        variant="strong-primary"
        {...forwardExtraPropsForRadix(rest)}
      >
        {children}
      </AxoButton.Root>
    );
  });

  AutoTrigger.displayName = 'Story.AutoTrigger';
}
