// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, MouseEvent, ReactNode, Ref } from 'react';
import { memo, useCallback, useId, useMemo } from 'react';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { AxoButton } from '../AxoButton.dom.tsx';
import type { TimestampMs } from '@signalapp/types';
import { variants } from '../_internal/variants.dom.tsx';
import {
  createStrictContext,
  useStrictContext,
} from '../_internal/StrictContext.dom.tsx';

/**
 * @example Anatomy
 * ```tsx
 * <AxoChatEvent.Root>
 *   <AxoChatEvent.Body>
 *     <AxoChatEvent.InlineAction/>
 *     <AxoChatEvent.Timestamp/>
 *   </AxoChatEvent.Body>
 *   <AxoChatEvent.Action/>
 * </AxoChatEvent.Root>
 */
export namespace AxoChatEvent {
  /**
   * <AxoChatEvent.Root>
   * --------------------------------------------------------------------------
   */

  type RootContextType = Readonly<{
    id: string;
  }>;

  const RootContext = createStrictContext<RootContextType>('AxoChatEvent.Root');

  export type RootProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * A chat event to render in a timeline with an icon and text, and optionally
   * with inline actions, a timestamp, and action.
   *
   * @example Basic
   * ```tsx
   * <AxoChatEvent.Root>
   *   <AxoChatEvent.Body variant="secondary" symbol="arrow-clockwise">
   *     Secure session reset
   *   </AxoChatEvent.Body>
   * </AxoChatEvent.Root>
   * ```
   *
   * @example Kitchen Sink
   * ```tsx
   * const contact = (
   *   <AxoChatEvent.InlineAction onClick={action('onShowContact')}>
   *     John
   *   </AxoChatEvent.InlineAction>
   * );
   * <AxoChatEvent.Root>
   *   <AxoChatEvent.Body variant="secondary" symbol="camera">
   *     {contact} started a video call
   *     <AxoChatEvent.Timestamp timestamp={TimestampMs.now()}>
   *       8m
   *     </AxoChatEvent.Timestamp>
   *   </AxoChatEvent.Body>
   *   <AxoChatEvent.Action
   *     variant="subtle-affirmative"
   *     onClick={action('onGoToMessage')}
   *   >
   *     Join call
   *   </AxoChatEvent.Action>
   * </AxoChatEvent.Root>
   * ```
   *
   * @example With Timestamp
   */
  export const Root: FC<RootProps> = memo(props => {
    const id = useId();

    const context = useMemo((): RootContextType => {
      return { id };
    }, [id]);

    return (
      <RootContext value={context}>
        <article
          aria-labelledby={id}
          className={tw('flex flex-col items-center gap-2.5 px-8 py-2.5')}
        >
          {props.children}
        </article>
      </RootContext>
    );
  });

  Root.displayName = 'AxoChatEvent.Root';

  /**
   * <AxoChatEvent.Body>
   * --------------------------------------------------------------------------
   */

  /** Visual style of the body */
  export type BodyVariant = 'secondary' | 'destructive';

  const BodyVariants = variants<BodyVariant>('AxoChatEvent.BodyVariant', {
    secondary: tw('text-secondary'),
    destructive: tw('text-destructive'),
  });

  export type BodyProps = Readonly<{
    /** Visual style of the body */
    variant: BodyVariant;
    /** Leading icon */
    symbol: AxoSymbol.Name;
    /** Chat event label */
    children: ReactNode;
  }>;

  /**
   * The body of the chat event including the icon, text, inline actions, and
   * timestamp.
   */
  export const Body: FC<BodyProps> = memo(props => {
    const context = useStrictContext(RootContext);
    return (
      <div
        id={context.id}
        className={tw(
          '-my-1 py-1', // extra spacing for focus rings
          'max-w-100',
          'text-center text-pretty',
          'line-clamp-3',
          'type-body-medium',
          BodyVariants.get(props.variant)
        )}
      >
        <AxoSymbol.InlineGlyph symbol={props.symbol} label={null} />
        &nbsp;
        {props.children}
      </div>
    );
  });

  Body.displayName = 'AxoChatEvent.Body';

  /**
   * <AxoChatEvent.InlineAction>
   * --------------------------------------------------------------------------
   */

  export type InlineActionProps = Readonly<{
    /**
     * Called when the button is clicked.
     */
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
    /**
     * The button label.
     */
    children: ReactNode;
  }>;

  /**
   * An inline action in the chat event that looks like normal text until
   * hovered or focused.
   */
  export const InlineAction: FC<InlineActionProps> = memo(props => {
    const { onClick } = props;

    const handleClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onClick(event);
      },
      [onClick]
    );

    return (
      <button
        type="button"
        dir="auto"
        onClick={handleClick}
        className={tw(
          'inline',
          'hover:underline focus:underline active:text-primary',
          'rounded-xs outline-none keyboard-mode:focus:axo-focus-ring',
          'forced-colors:underline',
          'forced-colors:text-[LinkText]'
        )}
      >
        {props.children}
      </button>
    );
  });

  InlineAction.displayName = 'AxoChatEvent.InlineAction';

  /**
   * <AxoChatEvent.Timestamp>
   * --------------------------------------------------------------------------
   */

  export type TimestampProps = Readonly<{
    /** The timestamp value to make the <time> machine readable. */
    timestamp: TimestampMs;
    /** The relative formatted timestamp. */
    children: ReactNode;
  }>;

  /**
   * A relative formatted timestamp (ex: "8m" or "Now") to display after the
   * chat event.
   */
  export const Timestamp: FC<TimestampProps> = memo(props => {
    const { timestamp } = props;

    const isoFormat = useMemo(() => {
      return new Date(timestamp).toISOString();
    }, [timestamp]);

    return (
      <>
        {' · '}
        <time dateTime={isoFormat}>{props.children}</time>
      </>
    );
  });

  Timestamp.displayName = 'AxoChatEvent.Timestamp';

  /**
   * <AxoChatEvent.Description>
   * --------------------------------------------------------------------------
   */

  /**
   * Visual style of the button.
   */
  export type ActionVariant =
    | 'subtle-secondary'
    | 'subtle-primary'
    | 'subtle-affirmative'
    | 'subtle-destructive';

  export type ActionProps = Readonly<{
    /**
     * Ref to the underlying `<button>` element.
     */
    ref?: Ref<HTMLButtonElement>;
    /**
     * Visual style of the button.
     */
    variant: ActionVariant;
    /**
     * When `true`, prevents interaction.
     */
    disabled?: boolean;
    /**
     * When `true`, displays "disabled" styles, but doesn't actually disable
     * the button.
     */
    discouraged?: boolean;
    /**
     * Called when the button is clicked.
     * Not called when `disabled`.
     */
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
    /**
     * The button label.
     */
    children: ReactNode;
  }>;

  /**
   * A (single) optional action to display below the chat event.
   */
  export const Action: FC<ActionProps> = memo(props => {
    const { ref, variant, disabled, onClick, children, ...rest } = props;
    return (
      <AxoButton.Root
        ref={ref}
        variant={variant}
        size="sm"
        disabled={disabled}
        onClick={onClick}
        {...rest}
      >
        {children}
      </AxoButton.Root>
    );
  });

  Action.displayName = 'AxoChatEvent.Action';
}
