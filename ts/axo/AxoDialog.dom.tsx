// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Dialog } from 'radix-ui';
import type { CSSProperties, FC, MouseEvent, ReactNode } from 'react';
import { memo, useMemo, useState } from 'react';
import { AxoBaseDialog } from './_internal/AxoBaseDialog.dom.tsx';
import type { AxoSymbol } from './AxoSymbol.dom.tsx';
import { tw } from './tw.dom.tsx';
import { AxoScrollArea } from './AxoScrollArea.dom.tsx';
import { AxoButton } from './AxoButton.dom.tsx';
import { AxoIconButton } from './AxoIconButton.dom.tsx';
import { AxoTooltip } from './AxoTooltip.dom.tsx';
import { AxoTheme } from './AxoTheme.dom.tsx';
import { useAxoIntl } from './_internal/AxoIntl.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';
import { unreachable } from './_internal/assert.std.tsx';

const { useContentEscapeBehavior } = AxoBaseDialog;

/**
 * A window overlaid on either the primary window or another dialog window,
 * rendering the content underneath inert.
 *
 * @example Anatomy
 * ```tsx
 * <AxoDialog.Root>
 *   <AxoDialog.Trigger />
 *   <AxoDialog.Content>
 *     <AxoDialog.Header>
 *       <AxoDialog.Back />
 *       <AxoDialog.Title />
 *       <AxoDialog.Close />
 *     </AxoDialog.Header>
 *     <AxoDialog.Body>
 *       <AxoDialog.Description />
 *     </AxoDialog.Body>
 *     <AxoDialog.Footer>
 *       <AxoDialog.FooterContent />
 *       <AxoDialog.Actions>
 *         <AxoDialog.Action/>
 *         <AxoDialog.Action/>
 *       </AxoDialog.Actions>
 *     </AxoDialog.Footer>
 *   </AxoDialog.Content>
 * </AxoDialog.Root>
 * ```
 *
 * @see {@link https://www.radix-ui.com/primitives/docs/components/dialog | Dialog - Radix Docs}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | Dialog (Modal) Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#dialog | `dialog` role - WAI-ARIA 1.3}
 */
export namespace AxoDialog {
  /**
   * <AxoDialog.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /**
     * The controlled open state of the dialog.
     * Must be used in conjunction with `onOpenChange`.
     */
    open?: boolean;
    /**
     * Event handler called when the open state of the dialog changes.
     */
    onOpenChange?: (open: boolean) => void;
    /**
     * Should be a `Trigger` and `Content`.
     */
    children: ReactNode;
  }>;

  /**
   * Contains all the parts of a dialog.
   *
   * @example Controlled dialog (most common)
   * ```tsx
   * <AxoDialog.Root open={open} onOpenChange={onOpenChange}>
   *   <AxoDialog.Content size="sm" escape="cancel-is-noop">
   *     <AxoDialog.Header>
   *       <AxoDialog.Title>Delete attachment?</AxoDialog.Title>
   *       <AxoDialog.Close />
   *     </AxoDialog.Header>
   *     <AxoDialog.Body>
   *       <AxoDialog.Description>
   *         This attachment will be permanently deleted.
   *       </AxoDialog.Description>
   *     </AxoDialog.Body>
   *     <AxoDialog.Footer>
   *       <AxoDialog.Actions>
   *         <AxoDialog.Action variant="secondary" onClick={onCancel}>
   *           Cancel
   *         </AxoDialog.Action>
   *         <AxoDialog.Action variant="destructive" onClick={onDelete}>
   *           Delete
   *         </AxoDialog.Action>
   *       </AxoDialog.Actions>
   *     </AxoDialog.Footer>
   *   </AxoDialog.Content>
   * </AxoDialog.Root>
   * ```
   *
   * @example Trigger-based dialog
   * ```tsx
   * <AxoDialog.Root>
   *   <AxoDialog.Trigger>
   *     <AxoButton.Root variant="secondary" size="md" width="fit" onClick={noop}>
   *       Open settings
   *     </AxoButton.Root>
   *   </AxoDialog.Trigger>
   *   <AxoDialog.Content size="md" escape="cancel-is-destructive">
   *     <AxoDialog.Header>
   *       <AxoDialog.Title>Settings</AxoDialog.Title>
   *       <AxoDialog.Close />
   *     </AxoDialog.Header>
   *     <AxoDialog.Body>...</AxoDialog.Body>
   *   </AxoDialog.Content>
   * </AxoDialog.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    return (
      <Dialog.Root open={props.open} onOpenChange={props.onOpenChange} modal>
        {props.children}
      </Dialog.Root>
    );
  });

  Root.displayName = 'AxoDialog.Root';

  /**
   * <AxoDialog.Trigger>
   * --------------------------------------------------------------------------
   */

  export type TriggerProps = Readonly<{
    /**
     * The element that opens the dialog when clicked.
     */
    children: ReactNode;
  }>;

  /**
   * The button that opens the dialog.
   */
  export const Trigger: FC<TriggerProps> = memo(props => {
    return <Dialog.Trigger asChild>{props.children}</Dialog.Trigger>;
  });

  Trigger.displayName = 'AxoDialog.Trigger';

  /**
   * <AxoDialog.Content>
   * --------------------------------------------------------------------------
   */

  /**
   * Width of the dialog.
   * - `xs` – 300px
   * - `sm` – 360px
   * - `md` – 420px
   * - `lg` – 720px
   */
  export type ContentSize = 'xs' | 'sm' | 'md' | 'lg';

  /**
   * How dangerous the cancel action is considered.
   * - `cancel-is-noop`: Canceling is safe — pressing Escape or clicking outside closes the dialog.
   * - `cancel-is-destructive`: Canceling would lose user state — pressing Escape or clicking outside is disabled.
   */
  export type ContentEscape = AxoBaseDialog.ContentEscape;

  const ContentSizeStyles = variants<ContentSize>('AxoDialog.ContentSize', {
    xs: tw('w-[300px] min-w-[300px]'),
    sm: tw('w-[360px] min-w-[360px]'),
    md: tw('w-[420px] min-w-[360px]'),
    lg: tw('w-[720px] min-w-[360px]'),
  });

  export type ContentProps = Readonly<{
    /**
     * Width of the dialog.
     */
    size: ContentSize;
    /**
     * What happens when the user presses `Escape` or clicks outside.
     */
    escape: ContentEscape;
    /**
     * Suppresses the Radix UI warning about a missing `aria-describedby`.
     * Prefer adding a visually-hidden `Description` instead of using this.
     */
    disableMissingAriaDescriptionWarning?: boolean;
    /**
     * Should be `Header`, `Body`, `Footer`, and/or `Description` elements.
     */
    children: ReactNode;
  }>;

  /**
   * Contains content to be rendered in the open dialog.
   */
  export const Content: FC<ContentProps> = memo(props => {
    const handleContentEscapeEvent = useContentEscapeBehavior(props.escape);
    const [boundary, setBoundary] = useState<Element | null>(null);

    const descriptionProps = useMemo((): Dialog.DialogContentProps => {
      if (props.disableMissingAriaDescriptionWarning) {
        // Generally you should just add a description with `AxoDialog.Description`
        // and use `sr-only` to hide it if you don't want it to be visible
        // https://www.radix-ui.com/primitives/docs/components/dialog#description
        return { 'aria-describedby': undefined };
      }
      return {};
    }, [props.disableMissingAriaDescriptionWarning]);

    return (
      <Dialog.Portal>
        <AxoTheme.Inherit>
          <AxoTooltip.CollisionBoundary boundary={boundary} padding={4}>
            <AxoBaseDialog.Host>
              <Dialog.Overlay className={AxoBaseDialog.overlayStyles} />
              <Dialog.Content
                ref={setBoundary}
                className={tw(
                  AxoBaseDialog.contentStyles,
                  ContentSizeStyles.get(props.size)
                )}
                onEscapeKeyDown={handleContentEscapeEvent}
                onInteractOutside={handleContentEscapeEvent}
                {...descriptionProps}
              >
                <div className={tw('relative z-10')}>{props.children}</div>
              </Dialog.Content>
            </AxoBaseDialog.Host>
          </AxoTooltip.CollisionBoundary>
        </AxoTheme.Inherit>
      </Dialog.Portal>
    );
  });

  Content.displayName = 'AxoDialog.Content';

  /**
   * <AxoDialog.Header>
   * --------------------------------------------------------------------------
   */

  export type HeaderProps = Readonly<{
    /**
     * Should be `Back`, `Title`, and/or `Close` elements.
     */
    children: ReactNode;
  }>;

  /**
   * A three-column grid header: back button on the left, title in the center,
   * close button on the right. Omitting `Back` or `Close` leaves their column
   * empty so the title stays centered.
   */
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

  Header.displayName = 'AxoDialog.Header';

  /**
   * <AxoDialog.Title>
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
   * An accessible title to be announced when the dialog is opened.
   */
  export const Title: FC<TitleProps> = memo(props => {
    return (
      <Dialog.Title
        className={tw(
          'col-[title-slot] px-3.5 py-0.5',
          'truncate text-center',
          'type-body-medium font-semibold text-primary',
          props.screenReaderOnly && 'sr-only'
        )}
      >
        {props.children}
      </Dialog.Title>
    );
  });

  Title.displayName = 'AxoDialog.Title';

  /**
   * <AxoDialog.Back>
   * --------------------------------------------------------------------------
   */

  export type BackProps = Readonly<{
    /**
     * Called when the back button is clicked.
     */
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  /**
   * A back-navigation button rendered in the leading column of `Header`.
   */
  export const Back: FC<BackProps> = memo(props => {
    const intl = useAxoIntl();
    return (
      <div className={tw('col-[back-slot] text-start')}>
        <AxoIconButton.Root
          size="sm"
          variant="implied-secondary"
          symbol="chevron-[start]"
          label={intl.get('AxoDialog.Back')}
          tooltip={false}
          onClick={props.onClick}
        />
      </div>
    );
  });

  Back.displayName = 'AxoDialog.Back';

  /**
   * <AxoDialog.Close>
   * --------------------------------------------------------------------------
   */

  /**
   * The button that closes the dialog.
   */
  export const Close: FC = memo(() => {
    const intl = useAxoIntl();
    return (
      <div className={tw('col-[close-slot] text-end leading-none')}>
        <Dialog.Close asChild>
          <AxoIconButton.Root
            size="sm"
            variant="implied-secondary"
            symbol="x"
            label={intl.get('AxoDialog.Close')}
            tooltip={false}
          />
        </Dialog.Close>
      </div>
    );
  });

  Close.displayName = 'AxoDialog.Close';

  /**
   * <AxoDialog.Search>
   * --------------------------------------------------------------------------
   */

  export type SearchProps = Readonly<{
    /**
     * A search input element.
     */
    children: ReactNode;
  }>;

  /**
   * A padded slot for a search input, placed between `Header` and `Body`.
   */
  export const Search: FC<SearchProps> = memo(props => {
    return (
      <div className={tw('flex items-center gap-2 px-4 pb-2')}>
        {props.children}
      </div>
    );
  });

  Search.displayName = 'AxoDialog.Search';

  /**
   * <AxoDialog.Body>
   * --------------------------------------------------------------------------
   */

  /**
   * Horizontal padding applied to the body content.
   * - lg: 24px (default) - Generally used for more textual body content.
   * - md: 16px - Generally used for "card-style" content like AxoLists.
   * - sm: 12px - Generally used for AxoItems that are not wrapped with "card-style" lists.
   * - deprecated-only-scrollbar-gutter: No padding, fallback to browser's native scrollbar
   *   gutter handling which is unreliable depending on your OS scrollbar preference.
   */
  export type BodyPadding =
    | 'lg'
    | 'md'
    | 'sm'
    | 'deprecated-only-scrollbar-gutter';

  export type BodyProps = Readonly<{
    /**
     * Width of the native scrollbar track.
     */
    scrollbarWidth?: 'thin' | 'none';
    /**
     * Horizontal padding applied to the body content.
     * Defaults to `lg`.
     */
    padding?: BodyPadding;
    /**
     * Maximum height before the body becomes scrollable.
     * Defaults to `440`.
     */
    maxHeight?: number;
    /**
     * Set to true if the dialog has no footer after it, hides the bottom scroll hint.
     * TODO: Find a CSS solution to this so it's just automatic
     */
    noFooterHideBottomScrollHint?: boolean;

    /**
     * Force the dialog to always be at its maxHeight
     */
    forceMaxHeight?: boolean;
    /**
     * The scrollable body content.
     */
    children: ReactNode;
  }>;

  /**
   * Scrollable content area between `Header` and `Footer`.
   * Automatically shows scroll hints and a thin scrollbar.
   */
  export const Body: FC<BodyProps> = memo(props => {
    const {
      scrollbarWidth = 'thin',
      padding = 'lg',
      maxHeight = 440,
      forceMaxHeight,
    } = props;

    const style = useMemo((): CSSProperties | undefined => {
      const styles: CSSProperties = {};

      if (forceMaxHeight) {
        styles.minHeight = maxHeight;
      }

      let paddingInline: string | null;

      if (padding === 'lg') {
        paddingInline = '24px';
      } else if (padding === 'md') {
        paddingInline = '16px';
      } else if (padding === 'sm') {
        paddingInline = '12px';
      } else if (padding === 'deprecated-only-scrollbar-gutter') {
        paddingInline = null;
      } else {
        unreachable(padding);
      }

      if (paddingInline != null) {
        if (scrollbarWidth === 'thin') {
          paddingInline = `calc(${paddingInline} - var(--axo-scrollbar-gutter-thin-vertical))`;
        } else if (scrollbarWidth === 'none') {
          // ignore
        } else {
          unreachable(scrollbarWidth);
        }

        styles.paddingInline = paddingInline;
      }

      return styles;
    }, [forceMaxHeight, maxHeight, padding, scrollbarWidth]);

    return (
      <AxoScrollArea.Root
        maxHeight={maxHeight}
        scrollbarWidth={scrollbarWidth}
        scrollbarVisibility="as-needed"
      >
        <AxoScrollArea.Hint edge="top" />
        {!props.noFooterHideBottomScrollHint && (
          <AxoScrollArea.Hint edge="bottom" />
        )}
        <AxoScrollArea.Viewport>
          <AxoScrollArea.Content>
            <div style={style}>{props.children}</div>
          </AxoScrollArea.Content>
        </AxoScrollArea.Viewport>
      </AxoScrollArea.Root>
    );
  });

  Body.displayName = 'AxoDialog.Body';

  /**
   * <AxoDialog.Description>
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
      <Dialog.Description asChild>
        <div>{props.children}</div>
      </Dialog.Description>
    );
  });

  Description.displayName = 'AxoDialog.Description';

  /**
   * <AxoDialog.Body>
   * --------------------------------------------------------------------------
   */

  export type FooterProps = Readonly<{
    /**
     * Should be `FooterContent` and/or `Actions` elements.
     */
    children?: ReactNode;
  }>;

  /**
   * A row of action buttons at the bottom of the dialog.
   */
  export const Footer: FC<FooterProps> = memo(props => {
    return (
      <div className={tw('flex flex-wrap items-center gap-3 px-3 py-2.5')}>
        {props.children}
      </div>
    );
  });

  Footer.displayName = 'AxoDialog.Footer';

  /**
   * <AxoDialog.FooterContent>
   * --------------------------------------------------------------------------
   */

  export type FooterContentProps = Readonly<{
    /**
     * Supplementary text shown alongside the action buttons.
     */
    children: ReactNode;
  }>;

  /**
   * Optional text content placed in `Footer` alongside `Actions`.
   *
   * Flows into its own row when the available width is too narrow to share a
   * line.
   */
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
          'grow',
          'type-body-large text-primary'
        )}
      >
        {props.children}
      </div>
    );
  });

  FooterContent.displayName = 'AxoDialog.FooterContent';

  /**
   * <AxoDialog.Actions>
   * --------------------------------------------------------------------------
   */

  export type ActionsProps = Readonly<{
    /**
     * Should be `Action` and/or `IconAction` elements.
     */
    children: ReactNode;
  }>;

  /**
   * A right-aligned group of action buttons inside `Footer`.
   */
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

  Actions.displayName = 'AxoDialog.Actions';

  /**
   * <AxoDialog.Actions>
   * --------------------------------------------------------------------------
   */

  /**
   * Visual style of an action button.
   * - `primary`: High-emphasis confirm action.
   * - `secondary`: Low-emphasis cancel or alternative action.
   * - `destructive`: Irreversible or dangerous action.
   */
  export type ActionVariant =
    | 'strong-primary'
    | 'strong-destructive'
    | 'strong-secondary'
    | 'subtle-primary'
    | 'subtle-destructive'
    | 'subtle-secondary';

  export type Arrow = 'next' | 'external-link';

  export type ActionProps = Readonly<{
    /**
     * Visual style of the button.
     */
    variant: ActionVariant;
    /**
     * Optional leading icon.
     */
    symbol?: AxoSymbol.Name;
    /**
     * When `true`, shows a forward arrow on the trailing side.
     */
    arrow?: Arrow | null;
    /**
     * When `true`, shows a loading spinner and prevents interaction.
     */
    pending?: boolean | null;
    /**
     * When `true`, prevents interaction.
     */
    disabled?: boolean | null;
    /**
     * Event handler called when the button is clicked.
     */
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
    /**
     * The button label.
     */
    children: ReactNode;
  }>;

  /**
   * A button for use inside `Actions`.
   */
  export const Action: FC<ActionProps> = memo(props => {
    return (
      <AxoButton.Root
        variant={props.variant}
        symbol={props.symbol}
        arrow={props.arrow}
        pending={props.pending}
        disabled={props.disabled}
        size="md"
        width="grow"
        onClick={props.onClick}
      >
        {props.children}
      </AxoButton.Root>
    );
  });

  Action.displayName = 'AxoDialog.Action';

  /**
   * <AxoDialog.IconAction>
   * --------------------------------------------------------------------------
   */

  /**
   * Visual style of an icon action button.
   * - `primary`: High-emphasis confirm action.
   * - `secondary`: Low-emphasis cancel or alternative action.
   * - `destructive`: Irreversible or dangerous action.
   */
  export type IconActionVariant =
    | 'strong-primary'
    | 'strong-destructive'
    | 'strong-secondary';

  export type IconActionProps = Readonly<{
    /**
     * Accessible label for screen readers.
     * Should describe the action of the button, not the icon.
     */
    label: string;
    /**
     * Visual style of the button.
     */
    variant: IconActionVariant;
    /**
     * The icon to display.
     */
    symbol: AxoSymbol.Name;
    /**
     * Event handler called when the button is clicked.
     */
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  /**
   * An icon-only button for use inside `Actions`.
   */
  export const IconAction: FC<IconActionProps> = memo(props => {
    return (
      <AxoIconButton.Root
        label={props.label}
        variant={props.variant}
        size="md"
        symbol={props.symbol}
        onClick={props.onClick}
      />
    );
  });

  IconAction.displayName = 'AxoDialog.IconAction';
}
