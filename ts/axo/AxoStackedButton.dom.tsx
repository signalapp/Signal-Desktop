// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, MouseEvent, ReactNode, Ref } from 'react';
import { memo, useCallback } from 'react';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { tw } from './tw.dom.tsx';
import { FlexWrapDetector } from './_internal/FlexWrapDetector.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';
import { useAxoIntl } from './_internal/AxoIntl.dom.tsx';
import { forwardExtraPropsForRadix } from './_internal/props.dom.tsx';
import { AxoBaseSpinner } from './status/_AxoBaseSpinner.dom.tsx';

/**
 * An icon-button + text displayed as a stack, and can be placed in a row.
 *
 * @example Anatomy
 * ```tsx
 * <AxoStackedButton.Root />
 * <AxoStackedButton.Row>
 *   <AxoStackedButton.Root />
 *   <AxoStackedButton.Root />
 * </AxoStackedButton.Row>
 * ```
 *
 * * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/button/ | Button Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#button | `button` role - WAI-ARIA 1.3}
 */
export namespace AxoStackedButton {
  /**
   * <AxoStackedButton.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /**
     * Ref to the underlying `<button>` element.
     */
    ref?: Ref<HTMLButtonElement>;
    /**
     * Icon to display inside the button.
     */
    symbol: AxoSymbol.Name;
    /**
     * Label to display below the button
     */
    label: string;
    /**
     * When `true`, prevents interaction.
     */
    disabled?: boolean | null;
    /**
     * When `true`, shows a spinner and prevents interaction.
     */
    pending?: boolean | null;
    /**
     * When `true`, displays "disabled" styles, but doesn't actually disable
     * the button.
     */
    discouraged?: boolean | null;
    /**
     * Called when the button is clicked. Not called when `pending` or `disabled`.
     */
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const {
      ref,
      symbol,
      label,
      disabled,
      pending,
      discouraged,
      onClick,
      ...rest
    } = props;
    const intl = useAxoIntl();

    const handleClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (disabled || pending) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      },
      [disabled, pending, onClick]
    );

    return (
      // Extra wrapper element so that `<AxoStackedButton.Row>`
      // doesn't make the clickable area of the button `width: 100%`
      <span className={tw('inline-flex shrink-0')}>
        {/* Both the icon button and the label should be clickable */}
        <button
          ref={ref}
          type="button"
          className={tw(
            'group relative',
            'inline-flex max-w-full flex-col items-center-safe justify-center-safe gap-1.5',
            'outline-none'
          )}
          aria-disabled={(pending || disabled) ?? undefined}
          aria-label={pending ? intl.get('AxoButton.Pending') : undefined}
          onClick={handleClick}
          {...forwardExtraPropsForRadix(rest)}
        >
          <span
            className={tw(
              'relative mx-1 px-3.75 py-2.25',
              'leading-none font-regular',
              'rounded-full bg-primary',
              !(disabled || pending) && 'group-active:bg-primary-pressed',
              disabled || discouraged ? 'text-disabled' : 'text-primary',
              'keyboard-mode:group-focus:axo-focus-ring',
              'forced-colors:border forced-colors:border-[ButtonBorder] forced-colors:bg-[ButtonFace]',
              disabled || discouraged
                ? 'forced-colors:text-[GrayText]'
                : 'forced-colors:text-[ButtonText]'
            )}
          >
            <span className={tw(pending && 'invisible')}>
              <AxoSymbol.Icon symbol={symbol} size={18} label={null} />
            </span>
            {pending && <Spinner />}
          </span>
          <span
            className={tw(
              'line-clamp-2 w-full contain-inline-size',
              'text-center type-caption font-medium',
              'text-pretty wrap-break-word [word-break:auto-phrase] hyphens-auto',
              disabled
                ? 'text-disabled forced-colors:text-[GrayText]'
                : 'text-primary'
            )}
          >
            {label}
          </span>
        </button>
      </span>
    );
  });

  Root.displayName = 'AxoStackedButton.Root';

  /**
   * <AxoStackedButton.Row>
   * --------------------------------------------------------------------------
   */

  export type RowSpacing = 'md';

  const RowSpacings = variants('AxoStackedButton.RowSpacing', {
    md: tw('gap-x-1 gap-y-3'), // (12 with button margins)
  });

  export type RowProps = Readonly<{
    spacing: RowSpacing;
    children: ReactNode;
  }>;

  /**
   * Displays a set of stacked buttons in a full-width centered row with
   */
  export const Row: FC<RowProps> = memo(props => {
    return (
      <FlexWrapDetector>
        <div
          className={tw(
            // Position items
            'flex w-full items-start justify-center',
            RowSpacings.get(props.spacing),
            // Allow items to wrap
            'flex-wrap',
            // Leave space for focus ring
            'px-[2.5px] pt-[2.5px]',
            // When actions are being wrapped:
            // Make all of them full width
            'container-scrollable:*:w-full'
          )}
        >
          {props.children}
        </div>
      </FlexWrapDetector>
    );
  });

  Row.displayName = 'AxoStackedButton.Row';

  /**
   * <AxoIconButton.Spinner>
   * --------------------------------------------------------------------------
   */

  /** @internal */
  const Spinner: FC = memo(() => {
    return (
      <span className={tw('absolute inset-0 flex items-center justify-center')}>
        <AxoBaseSpinner.Root
          size={18}
          weight="regular"
          variant="default"
          value="indeterminate"
          track={false}
        />
      </span>
    );
  });

  Spinner.displayName = 'AxoStackedButton.Spinner';
}
