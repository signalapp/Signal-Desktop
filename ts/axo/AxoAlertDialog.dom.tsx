// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AlertDialog } from 'radix-ui';
import type { FC, MouseEvent, ReactElement, ReactNode } from 'react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { AxoButton } from './AxoButton.dom.tsx';
import { tw } from './tw.dom.tsx';
import { AxoBaseDialog } from './_internal/AxoBaseDialog.dom.tsx';
import { AxoScrollArea } from './AxoScrollArea.dom.tsx';
import type { AxoSymbol } from './AxoSymbol.dom.tsx';
import { FlexWrapDetector } from './_internal/FlexWrapDetector.dom.tsx';
import { AxoTheme } from './AxoTheme.dom.tsx';
import { useAxoIntl } from './_internal/AxoIntl.dom.tsx';
import {
  createStrictContext,
  useStrictContext,
} from './_internal/StrictContext.dom.tsx';

const {
  useContentEscapeBehavior,
  useContentRestoreFocusBehavior,
  useTriggerPresenceRef,
} = AxoBaseDialog;

/**
 * A modal dialog that interrupts the user with important content and expects a
 * response. Unlike `AxoDialog`, it has no header or close button — the user
 * must explicitly choose an action.
 *
 * @example Anatomy
 * ```tsx
 * <AxoAlertDialog.Root>
 *   <AxoAlertDialog.Trigger />
 *   <AxoAlertDialog.Content>
 *     <AxoAlertDialog.Body>
 *       <AxoAlertDialog.Title />
 *       <AxoAlertDialog.Description />
 *     </AxoAlertDialog.Body>
 *     <AxoAlertDialog.Footer>
 *       <AxoAlertDialog.Cancel />
 *       <AxoAlertDialog.Action />
 *     </AxoAlertDialog.Footer>
 *   </AxoAlertDialog.Content>
 * </AxoAlertDialog.Root>
 * ```
 *
 * @see {@link https://www.radix-ui.com/primitives/docs/components/alert-dialig | Alert Dialog - Radix Docs}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/ | Alert and Message Dialogs Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#alertdialog | `alertdialog` role - WAI-ARIA 1.3}
 */
export namespace AxoAlertDialog {
  /**
   * <AxoAlertDialog.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = AxoBaseDialog.RootProps &
    Readonly<{
      /**
       * Called along with `onOpenChange(false)` when the dialog is dismissed
       * without taking an action: via `Cancel`, `Ok`, pressing `Escape`, or
       * clicking outside.
       *
       * Unlike `onOpenChange`, this is not called when an `Action` closes the
       * dialog. Use this for side effects that should only happen when the
       * user backs out of the dialog.
       */
      onCancel?: () => void;
    }>;

  type RootContextType = Readonly<{
    setActionTriggered: () => void;
    hasTrigger: boolean;
    setHasTrigger: (hasTrigger: boolean) => void;
  }>;

  const RootContext = createStrictContext<RootContextType>(
    'AxoAlertDialog.Root'
  );

  /**
   * Contains all the parts of an alert dialog.
   *
   * @example Discard confirmation
   * ```tsx
   * <AxoAlertDialog.Root open={open} onOpenChange={onOpenChange}>
   *   <AxoAlertDialog.Content escape="cancel-is-noop">
   *     <AxoAlertDialog.Body>
   *       <AxoAlertDialog.Title>Discard draft?</AxoAlertDialog.Title>
   *       <AxoAlertDialog.Description>
   *         Your message will be deleted and cannot be recovered.
   *       </AxoAlertDialog.Description>
   *     </AxoAlertDialog.Body>
   *     <AxoAlertDialog.Footer>
   *       <AxoAlertDialog.Cancel/>
   *       <AxoAlertDialog.Action variant="strong-destructive" onClick={onDiscard}>
   *         Discard
   *       </AxoAlertDialog.Action>
   *     </AxoAlertDialog.Footer>
   *   </AxoAlertDialog.Content>
   * </AxoAlertDialog.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const { onOpenChange, onCancel } = props;
    const actionTriggeredRef = useRef(false);
    const [hasTrigger, setHasTrigger] = useState(false);

    const handleOpenChange = useCallback(
      (open: boolean) => {
        if (!open) {
          const actionTriggered = actionTriggeredRef.current;
          actionTriggeredRef.current = false;
          if (!actionTriggered) {
            onCancel?.();
          }
        }
        onOpenChange?.(open);
      },
      [onOpenChange, onCancel]
    );

    const setActionTriggered = useCallback(() => {
      actionTriggeredRef.current = true;
    }, []);

    const context = useMemo((): RootContextType => {
      return { setActionTriggered, hasTrigger, setHasTrigger };
    }, [setActionTriggered, hasTrigger, setHasTrigger]);

    return (
      <RootContext.Provider value={context}>
        <AlertDialog.Root open={props.open} onOpenChange={handleOpenChange}>
          {props.children}
        </AlertDialog.Root>
      </RootContext.Provider>
    );
  });

  Root.displayName = 'AxoAlertDialog.Root';

  /**
   * <AxoAlertDialog.Trigger>
   * --------------------------------------------------------------------------
   */

  export type TriggerProps = AxoBaseDialog.TriggerProps;

  /**
   * A button that opens the dialog.
   */
  export const Trigger: FC<TriggerProps> = memo(props => {
    const { setHasTrigger } = useStrictContext(RootContext);
    const ref = useTriggerPresenceRef(setHasTrigger);

    return (
      <AlertDialog.Trigger ref={ref} asChild>
        {props.children}
      </AlertDialog.Trigger>
    );
  });

  Trigger.displayName = 'AxoAlertDialog.Trigger';

  /**
   * <AxoAlertDialog.Content>
   * --------------------------------------------------------------------------
   */

  /**
   * How dangerous the cancel action is considered.
   * - `cancel-is-noop`: Canceling is safe — pressing Escape or clicking outside closes the dialog.
   * - `cancel-is-destructive`: Canceling would lose user state — pressing Escape or clicking outside is disabled.
   */
  export type ContentEscape = AxoBaseDialog.ContentEscape;

  export type ContentProps = Readonly<{
    /**
     * What happens when the user presses `Escape` or clicks outside.
     */
    escape: ContentEscape;
    /**
     * Should be `Body` and `Footer` elements.
     */
    children: ReactNode;
  }>;

  /**
   * Contains content to be rendered when the dialog is open.
   */
  export const Content: FC<ContentProps> = memo(props => {
    const handleContentEscapeEvent = useContentEscapeBehavior(props.escape);
    const { hasTrigger } = useStrictContext(RootContext);
    const restoreFocusHandlers = useContentRestoreFocusBehavior(hasTrigger);

    return (
      <AlertDialog.Portal>
        <AxoTheme.Inherit>
          <AxoBaseDialog.Host>
            <AlertDialog.Overlay className={AxoBaseDialog.overlayClassName} />
            <AlertDialog.Content
              onEscapeKeyDown={handleContentEscapeEvent}
              onOpenAutoFocus={restoreFocusHandlers.onOpenAutoFocus}
              onCloseAutoFocus={restoreFocusHandlers.onCloseAutoFocus}
              className={tw(AxoBaseDialog.contentClassName, 'w-72 min-w-72')}
            >
              {props.children}
            </AlertDialog.Content>
          </AxoBaseDialog.Host>
        </AxoTheme.Inherit>
      </AlertDialog.Portal>
    );
  });

  Content.displayName = 'AxoAlertDialog.Content';

  /**
   * <AxoAlertDialog.Body>
   * --------------------------------------------------------------------------
   */

  export type BodyProps = Readonly<{
    /**
     * The scrollable body content.
     */
    children: ReactNode;
  }>;

  /**
   * Scrollable content area before `Footer`.
   * Automatically shows scroll hint and a thin scrollbar.
   */
  export const Body: FC<BodyProps> = memo(props => {
    return (
      <AxoScrollArea.Root maxHeight={440} scrollbarWidth="none">
        <AxoScrollArea.Hint edge="bottom" />
        <AxoScrollArea.Viewport>
          <AxoScrollArea.Content>
            <div className={tw('flex flex-col gap-1 px-6 pt-5')}>
              {props.children}
            </div>
          </AxoScrollArea.Content>
        </AxoScrollArea.Viewport>
      </AxoScrollArea.Root>
    );
  });

  Body.displayName = 'AxoAlertDialog.Body';

  /**
   * <AxoAlertDialog.Footer>
   * --------------------------------------------------------------------------
   */

  const footerWrapDetectorStyles = tw(
    // When actions are not being wrapped:
    // Try to keep all actions equal size, but don't truncate them.
    'container-not-scrollable:*:basis-0',
    'container-not-scrollable:*:min-w-fit',
    // When actions are being wrapped:
    // Make all of them full width
    'container-scrollable:*:w-full'
  );

  // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
  const footerWrapForcedBreakStyles = tw('*:w-full');

  export type FooterProps = Readonly<{
    /**
     * Force actions to always break onto separate lines, even if they fit onto
     * one line.
     */
    forceAlwaysBreakToSeparateLines?: boolean | null;
    /**
     * Should be a `Cancel` and one or more `Action` elements.
     */
    children: ReactNode;
  }>;

  /**
   * A row of buttons at the bottom of the dialog.
   */
  export const Footer: FC<FooterProps> = memo(props => {
    const children = (
      <div
        className={tw(
          'flex flex-wrap-reverse gap-2 p-4',
          props.forceAlwaysBreakToSeparateLines
            ? footerWrapForcedBreakStyles
            : footerWrapDetectorStyles
        )}
      >
        {props.children}
      </div>
    );

    if (props.forceAlwaysBreakToSeparateLines) {
      return children;
    }

    return <FlexWrapDetector.Root>{children}</FlexWrapDetector.Root>;
  });

  Footer.displayName = 'AxoAlertDialog.Footer';

  /**
   * <AxoAlertDialog.Title>
   * --------------------------------------------------------------------------
   */

  export type TitleProps = Readonly<{
    /**
     * There must always be a title for the dialog, but if you don't want it to
     * be visually displayed you can pass `screenReaderOnly: true`
     */
    screenReaderOnly?: boolean;
    /**
     * The title text.
     */
    children: ReactNode;
  }>;

  /**
   * An accessible name to be announced when the dialog is opened.
   */
  export const Title: FC<TitleProps> = memo(props => {
    return (
      <AlertDialog.Title
        className={tw(
          'text-pretty',
          'type-title-small text-primary',
          props.screenReaderOnly && 'sr-only'
        )}
      >
        {props.children}
      </AlertDialog.Title>
    );
  });

  Title.displayName = 'AxoAlertDialog.Title';

  /**
   * <AxoAlertDialog.Description>
   * --------------------------------------------------------------------------
   */

  export type DescriptionProps = Readonly<{
    /**
     * The description text.
     */
    children: ReactNode;
  }>;

  /**
   * An optional accessible description to be announced when the dialog is opened.
   */
  export const Description: FC<DescriptionProps> = memo(props => {
    return (
      <AlertDialog.Description asChild>
        <div>{props.children}</div>
      </AlertDialog.Description>
    );
  });

  Description.displayName = 'AxoAlertDialog.Description';

  /**
   * <AxoAlertDialog.Cancel>
   * --------------------------------------------------------------------------
   */

  export type CancelProps = Readonly<{
    /**
     * The button label.
     */
    children?: string | ReactElement | null;
    /**
     * When `true`, prevents the user from dismissing via this button.
     */
    disabled?: boolean;
  }>;

  /**
   * A secondary button that dismisses the dialog without taking any action.
   * Auto-focused if it's the last cancel/ok action.
   */
  export const Cancel: FC<CancelProps> = memo(props => {
    const intl = useAxoIntl();
    return (
      <AlertDialog.Cancel asChild>
        <AxoButton.Root
          variant="subtle-secondary"
          size="md"
          width="grow"
          disabled={props.disabled}
        >
          {props.children ?? intl.get('AxoAlertDialog.Cancel')}
        </AxoButton.Root>
      </AlertDialog.Cancel>
    );
  });

  Cancel.displayName = 'AxoAlertDialog.Cancel';

  /**
   * <AxoAlertDialog.Ok>
   * --------------------------------------------------------------------------
   */

  export type OkProps = Readonly<{
    /**
     * The button label.
     */
    children?: string | ReactElement | null;
    /**
     * When `true`, prevents the user from dismissing via this button.
     */
    disabled?: boolean;
  }>;

  /**
   * A primary button that dismisses the dialog without taking any action.
   * Auto-focused if it's the last cancel/ok action.
   */
  export const Ok: FC<OkProps> = memo(props => {
    const intl = useAxoIntl();
    return (
      <AlertDialog.Cancel asChild>
        <AxoButton.Root
          variant="strong-primary"
          size="md"
          width="grow"
          disabled={props.disabled}
        >
          {props.children ?? intl.get('AxoAlertDialog.Ok')}
        </AxoButton.Root>
      </AlertDialog.Cancel>
    );
  });

  Ok.displayName = 'AxoAlertDialog.Ok';

  /**
   * <AxoAlertDialog.Action>
   * --------------------------------------------------------------------------
   */

  /**
   * Visual style of an action button.
   */
  export type ActionVariant =
    | 'strong-primary'
    | 'subtle-secondary'
    | 'strong-destructive'
    | 'subtle-destructive';

  export type Arrow = 'next' | 'external-link';

  export type ActionProps = Readonly<{
    /**
     * Visual style of the button.
     */
    variant: ActionVariant;
    /**
     * Optional leading icon.
     */
    symbol?: AxoSymbol.Name | null;
    /**
     * When `true`, shows a forward arrow on the trailing side.
     */
    arrow?: Arrow | null;
    /**
     * Called when the button is clicked.
     */
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    /**
     * When `true`, prevents interaction.
     */
    disabled?: boolean;
    /**
     * When `true`, shows a loading spinner and prevents interaction.
     */
    pending?: boolean;
    /**
     * When `true`, takes initial focus when rendered.
     */
    autoFocus?: boolean;
    /**
     * The button label.
     */
    children: ReactNode;
  }>;

  /**
   * A button that dismisses the dialog and optionally takes an action.
   * Not auto-focused by default.
   */
  export const Action: FC<ActionProps> = memo(props => {
    const { onClick } = props;
    const { setActionTriggered } = useStrictContext(RootContext);

    const handleClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          setActionTriggered();
        }
      },
      [onClick, setActionTriggered]
    );

    return (
      <AlertDialog.Action asChild>
        <AxoButton.Root
          variant={props.variant}
          symbol={props.symbol}
          arrow={props.arrow}
          size="md"
          width="grow"
          onClick={handleClick}
          disabled={props.disabled}
          pending={props.pending}
          autoFocus={props.autoFocus}
        >
          {props.children}
        </AxoButton.Root>
      </AlertDialog.Action>
    );
  });

  Action.displayName = 'AxoAlertDialog.Action';
}
