// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Dialog } from 'radix-ui';
import type {
  CSSProperties,
  FC,
  ForwardedRef,
  HTMLAttributes,
  ReactNode,
} from 'react';
import React, { forwardRef, memo, useMemo } from 'react';
import { AxoBaseDialog } from './_internal/AxoBaseDialog.dom.js';
import { AxoSymbol } from './AxoSymbol.dom.js';
import { tw } from './tw.dom.js';
import { AxoScrollArea } from './AxoScrollArea.dom.js';
import { AxoButton } from './AxoButton.dom.js';

const Namespace = 'AxoDialog';

const { useContentEscapeBehavior, useContentSize } = AxoBaseDialog;

export namespace AxoDialog {
  /**
   * Component: <AxoDialog.Root>
   * ---------------------------
   */

  export type RootProps = Readonly<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <Dialog.Root open={props.open} onOpenChange={props.onOpenChange} modal>
        {props.children}
      </Dialog.Root>
    );
  });

  Root.displayName = `${Namespace}.Root`;

  /**
   * Component: <AxoDialog.Trigger>
   * ------------------------------
   */

  export type TriggerProps = Readonly<{
    children: ReactNode;
  }>;

  export const Trigger: FC<TriggerProps> = memo(props => {
    return <Dialog.Trigger asChild>{props.children}</Dialog.Trigger>;
  });

  Trigger.displayName = `${Namespace}.Trigger`;

  /**
   * Component: <AxoDialog.Content>
   * ------------------------------
   */

  export type ContentSize = AxoBaseDialog.ContentSize;
  export type ContentEscape = AxoBaseDialog.ContentEscape;
  export type ContentProps = AxoBaseDialog.ContentProps;

  export const Content: FC<ContentProps> = memo(props => {
    const sizeConfig = AxoBaseDialog.ContentSizes[props.size];
    const handleContentEscapeEvent = useContentEscapeBehavior(props.escape);
    return (
      <AxoBaseDialog.ContentSizeProvider value={props.size}>
        <Dialog.Portal>
          <Dialog.Overlay className={AxoBaseDialog.overlayStyles}>
            <Dialog.Content
              className={AxoBaseDialog.contentStyles}
              onEscapeKeyDown={handleContentEscapeEvent}
              onInteractOutside={handleContentEscapeEvent}
              style={{
                width: sizeConfig.width,
                minWidth: sizeConfig.minWidth,
              }}
            >
              {props.children}
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      </AxoBaseDialog.ContentSizeProvider>
    );
  });

  Content.displayName = `${Namespace}.Content`;

  /**
   * Component: <AxoDialog.Header>
   * -----------------------------
   */

  export type HeaderProps = Readonly<{
    children: ReactNode;
  }>;

  export const Header: FC<HeaderProps> = memo(props => {
    return (
      <div
        className={tw(
          'grid items-center p-2.5',
          'grid-cols-[[back-slot]_1fr_[title-slot]_auto_[close-slot]_1fr]'
        )}
      >
        {props.children}
      </div>
    );
  });

  Header.displayName = `${Namespace}.Header`;

  type HeaderIconButtonProps = HTMLAttributes<HTMLButtonElement> &
    Readonly<{
      label: string;
      symbol: AxoSymbol.IconName;
    }>;

  const HeaderIconButton = forwardRef(
    (
      props: HeaderIconButtonProps,
      ref: ForwardedRef<HTMLButtonElement>
    ): JSX.Element => {
      const { label, symbol, ...rest } = props;

      return (
        <button
          ref={ref}
          {...rest}
          type="button"
          aria-label={label}
          className={tw(
            'rounded-full p-1.5',
            'hovered:bg-fill-secondary pressed:bg-fill-secondary-pressed',
            'outline-0 outline-border-focused focused:outline-[2.5px]'
          )}
        >
          <AxoSymbol.Icon symbol={symbol} size={20} label={null} />
        </button>
      );
    }
  );

  HeaderIconButton.displayName = `${Namespace}._HeaderIconButton`;

  /**
   * Component: <AxoDialog.Title>
   * ----------------------------
   */

  export type TitleProps = Readonly<{
    children: ReactNode;
  }>;

  export const Title: FC<TitleProps> = memo(props => {
    return (
      <Dialog.Title
        className={tw(
          'col-[title-slot] px-3.5 py-0.5',
          'truncate text-center',
          'type-title-small text-label-primary'
        )}
      >
        {props.children}
      </Dialog.Title>
    );
  });

  Title.displayName = `${Namespace}.Title`;

  /**
   * Component: <AxoDialog.Back>
   * ---------------------------
   */

  export type BackProps = Readonly<{
    'aria-label': string;
  }>;

  export const Back: FC<BackProps> = memo(props => {
    return (
      <div className={tw('col-[back-slot] text-start')}>
        <HeaderIconButton
          label={props['aria-label']}
          symbol="chevron-[start]"
        />
      </div>
    );
  });

  Back.displayName = `${Namespace}.Back`;

  /**
   * Component: <AxoDialog.Close>
   * ----------------------------
   */

  export type CloseProps = Readonly<{
    'aria-label': string;
  }>;

  export const Close: FC<CloseProps> = memo(props => {
    return (
      <div className={tw('col-[close-slot] text-end')}>
        <Dialog.Close asChild>
          <HeaderIconButton label={props['aria-label']} symbol="x" />
        </Dialog.Close>
      </div>
    );
  });

  Close.displayName = `${Namespace}.Close`;

  export type ExperimentalSearchProps = Readonly<{
    children: ReactNode;
  }>;

  export const ExperimentalSearch: FC<ExperimentalSearchProps> = memo(props => {
    return <div className={tw('px-4 pb-2')}>{props.children}</div>;
  });

  ExperimentalSearch.displayName = `${Namespace}.ExperimentalSearch`;

  /**
   * Component: <AxoDialog.Body>
   * ---------------------------
   */

  export type BodyPadding = 'normal' | 'only-scrollbar-gutter';

  export type BodyProps = Readonly<{
    padding?: BodyPadding;
    children: ReactNode;
  }>;

  export const Body: FC<BodyProps> = memo(props => {
    const { padding = 'normal' } = props;
    const contentSize = useContentSize();
    const contentSizeConfig = AxoBaseDialog.ContentSizes[contentSize];

    const style = useMemo((): CSSProperties | undefined => {
      if (padding === 'only-scrollbar-gutter') {
        return;
      }

      return {
        paddingInline: 'calc(24px - var(--axo-scrollbar-gutter-thin-vertical))',
      };
    }, [padding]);

    return (
      <AxoScrollArea.Root
        maxHeight={contentSizeConfig.maxBodyHeight}
        scrollbarWidth="thin"
      >
        <AxoScrollArea.Hint edge="top" />
        <AxoScrollArea.Hint edge="bottom" />
        <AxoScrollArea.Viewport>
          <AxoScrollArea.Content>
            <div style={style}>{props.children}</div>
          </AxoScrollArea.Content>
        </AxoScrollArea.Viewport>
      </AxoScrollArea.Root>
    );
  });

  Body.displayName = `${Namespace}.Body`;

  /**
   * Component: <AxoDialog.Description>
   * ----------------------------------
   */

  export type DescriptionProps = Readonly<{
    children: ReactNode;
  }>;

  export const Description: FC<DescriptionProps> = memo(props => {
    return <Dialog.Description>{props.children}</Dialog.Description>;
  });

  Description.displayName = `${Namespace}.Description`;

  /**
   * Component: <AxoDialog.Body>
   * ---------------------------
   */

  export type FooterProps = Readonly<{
    children: ReactNode;
  }>;

  export const Footer: FC<FooterProps> = memo(props => {
    return (
      <div className={tw('flex flex-wrap items-center gap-3 px-3 py-2.5')}>
        {props.children}
      </div>
    );
  });

  Footer.displayName = `${Namespace}.Footer`;

  /**
   * Component: <AxoDialog.FooterContent>
   * ------------------------------------
   */

  export type FooterContentProps = Readonly<{
    children: ReactNode;
  }>;

  export const FooterContent: FC<FooterContentProps> = memo(props => {
    return (
      <div
        className={tw(
          'px-3',
          // Allow the flex layout to place it in the same row as the actions
          // if it can be wrapped to fit within the available space:
          'basis-[min-content]',
          // But if the text needs to wrap and the available space could only
          // fit 1-2 words per line, push it up into its own row:
          'min-w-[calc-size(fit-content,min(20ch,size))]',
          // Allow it to fill its own row
          'flex-grow',
          'type-body-large text-label-primary'
        )}
      >
        {props.children}
      </div>
    );
  });

  FooterContent.displayName = `${Namespace}.FooterContent`;

  /**
   * Component: <AxoDialog.Actions>
   * ------------------------------
   */

  export type ActionsProps = Readonly<{
    children: ReactNode;
  }>;

  export const Actions: FC<ActionsProps> = memo(props => {
    return (
      <div
        className={tw(
          // Align the buttons to the right even when there's no FooterContent:
          'ms-auto',
          // Allow buttons to wrap to their own lines
          'flex flex-wrap',
          // Prevents buttons that don't fit in the container from overflowing
          'max-w-full',
          'items-center gap-x-2 gap-y-3'
        )}
      >
        {props.children}
      </div>
    );
  });

  Actions.displayName = `${Namespace}.Actions`;

  /**
   * Component: <AxoDialog.Actions>
   * ------------------------------
   */

  export type ActionVariant = 'primary' | 'destructive' | 'secondary';

  export type ActionProps = Readonly<{
    variant: ActionVariant;
    symbol?: AxoSymbol.InlineGlyphName;
    arrow?: boolean;
    onClick: () => void;
    children: ReactNode;
  }>;

  export const Action: FC<ActionProps> = memo(props => {
    return (
      <AxoButton.Root
        variant={props.variant}
        symbol={props.symbol}
        arrow={props.arrow}
        size="medium"
        width="grow"
      >
        {props.children}
      </AxoButton.Root>
    );
  });

  Action.displayName = `${Namespace}.Action`;
}
