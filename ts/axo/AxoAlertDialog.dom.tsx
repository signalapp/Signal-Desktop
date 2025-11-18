// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AlertDialog } from 'radix-ui';
import type { FC, ReactNode } from 'react';
import React, { memo } from 'react';
import { AxoButton } from './AxoButton.dom.js';
import { tw } from './tw.dom.js';
import { AxoBaseDialog } from './_internal/AxoBaseDialog.dom.js';
import { AxoScrollArea } from './AxoScrollArea.dom.js';
import type { AxoSymbol } from './AxoSymbol.dom.js';

const Namespace = 'AxoAlertDialog';

const { useContentEscapeBehavior } = AxoBaseDialog;

/**
 * Displays a menu located at the pointer, triggered by a right click or a long press.
 *
 * Note: For menus that are triggered by a normal button press, you should use
 * `AxoDropdownMenu`.
 *
 * @example Anatomy
 * ```tsx
 * <AxoAlertDialog.Root>
 *   <AxoAlertDialog.Trigger>
 *   </AxoAlertDialog.Trigger>
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
 */
export namespace AxoAlertDialog {
  /**
   * Component: <AxoAlertDialog.Root>
   * --------------------------------
   */

  export type RootProps = AxoBaseDialog.RootProps;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <AlertDialog.Root open={props.open} onOpenChange={props.onOpenChange}>
        {props.children}
      </AlertDialog.Root>
    );
  });

  Root.displayName = `${Namespace}.Root`;

  /**
   * Component: <AxoAlertDialog.Trigger>
   * --------------------------------
   */

  export type TriggerProps = AxoBaseDialog.TriggerProps;

  export const Trigger: FC<TriggerProps> = memo(props => {
    return <AlertDialog.Trigger asChild>{props.children}</AlertDialog.Trigger>;
  });

  Trigger.displayName = `${Namespace}.Trigger`;

  /**
   * Component: <AxoAlertDialog.Content>
   * --------------------------------
   */

  export type ContentEscape = AxoBaseDialog.ContentEscape;
  export type ContentProps = Readonly<{
    escape: ContentEscape;
    children: ReactNode;
  }>;

  export const Content: FC<ContentProps> = memo(props => {
    const handleContentEscapeEvent = useContentEscapeBehavior(props.escape);
    return (
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={AxoBaseDialog.overlayStyles}>
          <AlertDialog.Content
            onEscapeKeyDown={handleContentEscapeEvent}
            className={AxoBaseDialog.contentStyles}
            style={{
              minWidth: 300,
              width: 300,
            }}
          >
            {props.children}
          </AlertDialog.Content>
        </AlertDialog.Overlay>
      </AlertDialog.Portal>
    );
  });

  Content.displayName = `${Namespace}.Content`;

  /**
   * Component: <AxoAlertDialog.Body>
   * ---------------------------------
   */

  export type BodyProps = Readonly<{
    children: ReactNode;
  }>;

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

  Body.displayName = `${Namespace}.Body`;

  /**
   * Component: <AxoAlertDialog.Footer>
   * ---------------------------------
   */

  export type FooterProps = Readonly<{
    children: ReactNode;
  }>;

  export const Footer: FC<FooterProps> = memo(props => {
    return <div className={tw('flex gap-2 px-6 py-4')}>{props.children}</div>;
  });

  Footer.displayName = `${Namespace}.Footer`;

  /**
   * Component: <AxoAlertDialog.Title>
   * ---------------------------------
   */

  export type TitleProps = Readonly<{
    screenReaderOnly?: boolean;
    children: ReactNode;
  }>;

  export const Title: FC<TitleProps> = memo(props => {
    return (
      <AlertDialog.Title
        className={tw(
          'text-center type-title-small text-label-primary',
          props.screenReaderOnly && 'sr-only'
        )}
      >
        {props.children}
      </AlertDialog.Title>
    );
  });

  Title.displayName = `${Namespace}.Title`;

  /**
   * Component: <AxoAlertDialog.Description>
   * ---------------------------------------
   */

  export type DescriptionProps = Readonly<{
    children: ReactNode;
  }>;

  export const Description: FC<DescriptionProps> = memo(props => {
    return (
      <AlertDialog.Description
        className={tw('text-center type-body-large text-label-secondary')}
      >
        {props.children}
      </AlertDialog.Description>
    );
  });

  Description.displayName = `${Namespace}.Description`;

  /**
   * Component: <AxoAlertDialog.Cancel>
   * ----------------------------------
   */

  export type CancelProps = Readonly<{
    children: ReactNode;
  }>;

  export const Cancel: FC<CancelProps> = memo(props => {
    return (
      <AlertDialog.Cancel asChild>
        <AxoButton.Root variant="secondary" size="md" width="full">
          {props.children}
        </AxoButton.Root>
      </AlertDialog.Cancel>
    );
  });

  Cancel.displayName = `${Namespace}.Cancel`;

  /**
   * Component: <AxoAlertDialog.Action>
   * ----------------------------------
   */

  export type ActionVariant = 'primary' | 'secondary' | 'destructive';

  export type ActionProps = Readonly<{
    variant: ActionVariant;
    symbol?: AxoSymbol.InlineGlyphName;
    arrow?: boolean;
    onClick: () => void;
    children: ReactNode;
  }>;

  export const Action: FC<ActionProps> = memo(props => {
    return (
      <AlertDialog.Action asChild onClick={props.onClick}>
        <AxoButton.Root
          variant={props.variant}
          symbol={props.symbol}
          arrow={props.arrow}
          size="md"
          width="full"
        >
          {props.children}
        </AxoButton.Root>
      </AlertDialog.Action>
    );
  });

  Action.displayName = `${Namespace}.Action`;
}
