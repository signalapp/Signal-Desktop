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
import { getScrollbarGutters } from './_internal/scrollbars.dom.js';
import { AxoButton } from './AxoButton.dom.js';
import { AxoIconButton } from './AxoIconButton.dom.js';

const Namespace = 'AxoDialog';

const { useContentEscapeBehavior } = AxoBaseDialog;

// We want to have 24px of padding on either side of header/body/footer, but
// it's import that we remain aligned with the vertical scrollbar gutters that
// we need to measure in the browser to know the value of.
//
// Chrome currently renders vertical scrollbars as 11px with
// `scrollbar-width: thin` but that could change someday or based on some OS
// settings. So we'll target 24px but we'll tolerate different values.
function getPadding(target: number, scrollbars: boolean): number {
  const scrollbarWidthExpected = 11;
  const paddingBeforeScrollbarWidth = target - scrollbarWidthExpected;

  if (scrollbars) {
    // If this element has scrollbars we should just rely on the rendered gutter
    return paddingBeforeScrollbarWidth;
  }

  const scrollbarWidthActual = getScrollbarGutters('thin', 'custom').vertical;

  // If this element doesn't have scrollbars, we need to add the exact value of
  // the actual scrollbar gutter
  return scrollbarWidthActual + paddingBeforeScrollbarWidth;
}

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

  type ContentSizeConfig = Readonly<{
    width: number;
    minWidth: number;
  }>;

  const ContentSizes: Record<ContentSize, ContentSizeConfig> = {
    sm: { width: 360, minWidth: 360 },
    md: { width: 420, minWidth: 360 },
    lg: { width: 720, minWidth: 360 },
  };

  export type ContentSize = 'sm' | 'md' | 'lg';
  export type ContentEscape = AxoBaseDialog.ContentEscape;
  export type ContentProps = Readonly<{
    size: ContentSize;
    escape: ContentEscape;
    children: ReactNode;
  }>;

  export const Content: FC<ContentProps> = memo(props => {
    const sizeConfig = ContentSizes[props.size];
    const handleContentEscapeEvent = useContentEscapeBehavior(props.escape);
    return (
      <Dialog.Portal>
        <Dialog.Overlay className={AxoBaseDialog.overlayStyles}>
          <Dialog.Content
            className={AxoBaseDialog.contentStyles}
            onEscapeKeyDown={handleContentEscapeEvent}
            onInteractOutside={handleContentEscapeEvent}
            style={{
              width: sizeConfig.width,
              minWidth: 320,
            }}
          >
            {props.children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
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
    const style = useMemo(() => {
      return {
        paddingInline: getPadding(10, false),
      };
    }, []);
    return (
      <div
        className={tw(
          'grid items-center py-2.5',
          'grid-cols-[[back-slot]_1fr_[title-slot]_auto_[close-slot]_1fr]'
        )}
        style={style}
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
            'rounded-full p-[5px] leading-none',
            'hovered:bg-fill-secondary pressed:bg-fill-secondary-pressed',
            'outline-0 outline-border-focused focused:outline-[2.5px]'
          )}
        >
          <AxoSymbol.Icon symbol={symbol} size={18} label={null} />
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
    screenReaderOnly?: boolean;
    children: ReactNode;
  }>;

  export const Title: FC<TitleProps> = memo(props => {
    const style = useMemo(() => {
      return {
        paddingInline: 24 - getPadding(10, false),
      };
    }, []);
    return (
      <Dialog.Title
        className={tw(
          'col-[title-slot] py-0.5',
          'truncate text-center',
          'type-body-medium font-semibold text-label-primary',
          props.screenReaderOnly && 'sr-only'
        )}
        style={style}
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
        <AxoIconButton.Root
          size="sm"
          variant="borderless-secondary"
          symbol="chevron-[start]"
          aria-label={props['aria-label']}
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
          <AxoIconButton.Root
            size="sm"
            variant="borderless-secondary"
            symbol="x"
            aria-label={props['aria-label']}
          />
        </Dialog.Close>
      </div>
    );
  });

  Close.displayName = `${Namespace}.Close`;

  export type ExperimentalSearchProps = Readonly<{
    children: ReactNode;
  }>;

  export const ExperimentalSearch: FC<ExperimentalSearchProps> = memo(props => {
    const style = useMemo(() => {
      return { paddingInline: getPadding(16, false) };
    }, []);
    return (
      <div style={style} className={tw('pb-2')}>
        {props.children}
      </div>
    );
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

    const style = useMemo((): CSSProperties => {
      return {
        paddingInline: padding === 'normal' ? getPadding(24, true) : undefined,
      };
    }, [padding]);

    return (
      <AxoScrollArea.Root
        maxHeight={440}
        scrollbarWidth="thin"
        scrollbarVisibility="as-needed"
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
    const style = useMemo((): CSSProperties => {
      return {
        paddingInline: getPadding(12, false),
      };
    }, []);

    return (
      <div
        className={tw('flex flex-wrap items-center gap-3 py-2.5')}
        style={style}
      >
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
    const style = useMemo(() => {
      return { paddingInlineStart: 24 - getPadding(12, false) };
    }, []);
    return (
      <div
        className={tw(
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
        style={style}
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
        size="md"
        width="grow"
      >
        {props.children}
      </AxoButton.Root>
    );
  });

  Action.displayName = `${Namespace}.Action`;

  /**
   * Component: <AxoDialog.Actions>
   * ------------------------------
   */

  export type IconActionVariant = 'primary' | 'destructive' | 'secondary';

  export type IconActionProps = Readonly<{
    'aria-label': string;
    variant: ActionVariant;
    symbol: AxoSymbol.IconName;
    onClick: () => void;
  }>;

  export const IconAction: FC<IconActionProps> = memo(props => {
    return (
      <AxoIconButton.Root
        aria-label={props['aria-label']}
        variant={props.variant}
        size="md"
        symbol={props.symbol}
      />
    );
  });

  IconAction.displayName = `${Namespace}.IconAction`;
}
