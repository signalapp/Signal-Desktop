// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useCallback } from 'react';
import type { FC, ReactNode, JSX, MouseEvent, Ref } from 'react';
import { tw } from './tw.dom.tsx';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import type { SpinnerVariant } from '../components/SpinnerV2.dom.tsx';
import { SpinnerV2 } from '../components/SpinnerV2.dom.tsx';
import { useAxoIntl } from './_internal/AxoIntl.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';

/**
 * A text button with optional leading icon and trailing arrow.
 *
 * @example Anatomy
 * ```tsx
 * <AxoButton.Root />
 * ```
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/button/ | Button Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#button | `button` role - WAI-ARIA 1.3}
 */
export namespace AxoButton {
  /**
   * Visual style of the button.
   */
  export type Variant =
    | 'secondary'
    | 'primary'
    | 'affirmative'
    | 'destructive'
    | 'subtle-primary'
    | 'subtle-affirmative'
    | 'subtle-destructive'
    | 'floating-secondary'
    | 'floating-primary'
    | 'floating-affirmative'
    | 'floating-destructive'
    | 'borderless-secondary'
    | 'borderless-primary'
    | 'borderless-affirmative'
    | 'borderless-destructive';

  /**
   * Size of the button.
   */
  export type Size = 'sm' | 'md' | 'lg';

  /**
   * How the button sizes itself horizontally.
   * - `fit`: Shrinks to fit its content (default).
   * - `grow`: Expands to fill available space in a flex container.
   * - `full`: Always fills the full width of its container.
   */
  export type Width = 'fit' | 'grow' | 'full';

  /**
   * Trailing arrow shown on the button.
   * - `next`: Chevron pointing forward, for navigation.
   * - `expand`: Chevron pointing down, for revealing content.
   * - `collapse`: Chevron pointing up, for hiding content.
   *
   * Note: Omitted 'prev' because arrow appears on trailing side,
   * back buttons should probably all use AxoIconButton.
   */
  export type Arrow = 'collapse' | 'expand' | 'next';

  const baseStyles = tw(
    'relative inline-flex max-w-full items-center-safe justify-center-safe rounded-full select-none',
    'outline-none keyboard-mode:focus:outline-focus-ring',
    'forced-colors:border'
  );

  const baseSubtleVariant = tw(
    baseStyles,
    'bg-fill-secondary',
    'not-aria-disabled:active:bg-fill-secondary-pressed'
  );

  const baseFloatingVariant = tw(
    baseStyles,
    'bg-fill-floating',
    'shadow-elevation-1',
    'not-aria-disabled:active:bg-fill-floating-pressed'
  );

  const baseBorderlessVariant = tw(
    baseStyles,
    'bg-transparent',
    'not-aria-disabled:hover:bg-fill-secondary',
    'not-aria-disabled:active:bg-fill-secondary-pressed'
  );

  const VariantStyles = variants<Variant>('AxoButton.Variant', {
    // default
    secondary: tw(
      baseStyles,
      'bg-fill-secondary text-label-primary',
      'not-aria-disabled:active:bg-fill-secondary-pressed',
      'aria-disabled:text-label-disabled'
    ),
    primary: tw(
      baseStyles,
      'bg-color-fill-primary text-label-primary-on-color',
      'not-aria-disabled:active:bg-color-fill-primary-pressed',
      'aria-disabled:text-label-disabled-on-color'
    ),
    affirmative: tw(
      baseStyles,
      'bg-color-fill-affirmative text-label-primary-on-color',
      'not-aria-disabled:active:bg-color-fill-affirmative-pressed',
      'aria-disabled:text-label-disabled-on-color'
    ),
    destructive: tw(
      baseStyles,
      'bg-color-fill-destructive text-label-primary-on-color',
      'not-aria-disabled:active:bg-color-fill-destructive-pressed',
      'aria-disabled:text-label-disabled-on-color'
    ),

    // subtle
    'subtle-primary': tw(
      baseSubtleVariant,
      'text-color-label-primary',
      'aria-disabled:text-color-label-primary-disabled'
    ),
    'subtle-affirmative': tw(
      baseSubtleVariant,
      'text-color-label-affirmative',
      'aria-disabled:text-color-label-affirmative-disabled'
    ),
    'subtle-destructive': tw(
      baseSubtleVariant,
      'text-color-label-destructive',
      'aria-disabled:text-color-label-destructive-disabled'
    ),

    // floating
    'floating-secondary': tw(
      baseFloatingVariant,
      'text-label-primary',
      'aria-disabled:text-label-disabled'
    ),
    'floating-primary': tw(
      baseFloatingVariant,
      'text-color-label-primary',
      'aria-disabled:text-color-label-primary-disabled'
    ),
    'floating-affirmative': tw(
      baseFloatingVariant,
      'text-color-label-affirmative',
      'aria-disabled:text-color-label-affirmative-disabled'
    ),
    'floating-destructive': tw(
      baseFloatingVariant,
      'text-color-label-destructive',
      'aria-disabled:text-color-label-destructive-disabled'
    ),

    // borderless
    'borderless-secondary': tw(
      baseBorderlessVariant,
      'text-label-primary',
      'aria-disabled:text-label-disabled'
    ),
    'borderless-primary': tw(
      baseBorderlessVariant,
      'text-color-label-primary',
      'aria-disabled:text-color-label-primary-disabled'
    ),
    'borderless-affirmative': tw(
      baseBorderlessVariant,
      'text-color-label-affirmative',
      'aria-disabled:text-color-label-affirmative-disabled'
    ),
    'borderless-destructive': tw(
      baseBorderlessVariant,
      'text-color-label-destructive',
      'aria-disabled:text-color-label-destructive-disabled'
    ),
  });

  const SizeStyles = variants<Size>('AxoButton.Size', {
    sm: tw('min-w-12 px-2 py-1 type-body-small font-medium'),
    md: tw('min-w-14 px-3 py-1.5 type-body-medium font-medium'),
    lg: tw('min-w-16 px-4 py-2 type-body-medium font-medium'),
  });

  const WidthStyles = variants<Width>('AxoButton.Width', {
    /* Always try to fit to the content of the button */
    fit: tw(''),
    /* Allow the button to grow within a flex container */
    grow: tw('grow'),
    /* Always try to fill the available space */
    full: tw('w-full'),
  });

  type ArrowSymbol = AxoSymbol.InlineGlyphName;
  const Arrows = variants<Arrow, ArrowSymbol>('AxoButton.Arrow', {
    collapse: 'chevron-up',
    expand: 'chevron-down',
    next: 'chevron-[end]',
  });

  /** @testexport */
  export function _getAllVariants(): ReadonlyArray<Variant> {
    return VariantStyles.keys();
  }

  /** @testexport */
  export function _getAllSizes(): ReadonlyArray<Size> {
    return SizeStyles.keys();
  }

  /**
   * <AxoButton.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /**
     * Ref to the underlying `<button>` element.
     */
    ref?: Ref<HTMLButtonElement>;
    /**
     * Visual style of the button.
     */
    variant: Variant;
    /**
     * Size of the button.
     */
    size: Size;
    /**
     * How the button sizes itself horizontally. Defaults to `fit`.
     */
    width?: Width;
    /**
     * Optional leading icon.
     */
    symbol?: AxoSymbol.InlineGlyphName;
    /**
     * Optional trailing arrow icon.
     */
    arrow?: Arrow | null;
    /**
     * When `true`, shows a loading spinner and prevents interaction.
     */
    pending?: boolean | null;
    /**
     * When set, the button behaves as a toggle with `aria-pressed` semantics.
     */
    pressed?: boolean | null;
    /**
     * When set, adds `aria-expanded` for disclosure buttons that show/hide content.
     */
    expanded?: boolean | null;
    /**
     * `aria-controls` — the `id` of the element this button controls.
     */
    controls?: string | null;
    /**
     * When `true`, prevents interaction.
     */
    disabled?: boolean | null;
    /**
     * Called when the button is clicked.
     * Not called when `pending` or `disabled`.
     */
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    /**
     * The button label.
     */
    children: ReactNode;
  }>;

  /**
   * A text button with an optional leading icon and trailing arrow.
   *
   * @example Dialog actions
   * ```tsx
   * <AxoButton.Root variant="secondary" size="md" width="grow" onClick={onCancel}>
   *   Cancel
   * </AxoButton.Root>
   * <AxoButton.Root variant="primary" size="md" width="grow" pending={isSaving} onClick={onSave}>
   *   Save
   * </AxoButton.Root>
   * ```
   *
   * @example Inline destructive action with icon
   * ```tsx
   * <AxoButton.Root
   *   variant="subtle-destructive"
   *   size="md"
   *   symbol="trash"
   *   onClick={onDelete}
   * >
   *   Delete
   * </AxoButton.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const {
      variant,
      size,
      width,
      symbol,
      arrow,
      pending,
      disabled,
      pressed,
      expanded,
      controls,
      onClick,
      children,
      ...rest
    } = props;

    const intl = useAxoIntl();

    const handleClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (pending || disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      },
      [pending, disabled, onClick]
    );

    return (
      <button
        ref={props.ref}
        type="button"
        aria-label={pending ? intl.get('AxoButton.Pending') : undefined}
        aria-disabled={(pending || disabled) ?? undefined}
        aria-expanded={expanded ?? undefined}
        aria-pressed={pressed ?? undefined}
        aria-controls={controls ?? undefined}
        onClick={handleClick}
        className={tw(
          VariantStyles.get(variant),
          SizeStyles.get(size),
          WidthStyles.get(width ?? 'fit')
        )}
        {...rest}
      >
        <span
          aria-hidden={pending ?? undefined}
          className={tw(
            'flex shrink grow items-center-safe justify-center-safe gap-1 overflow-hidden',
            pending ? 'opacity-0' : null
          )}
        >
          {symbol != null && (
            <AxoSymbol.InlineGlyph symbol={symbol} label={null} />
          )}
          <span className={tw('min-w-0 shrink grow truncate')}>{children}</span>
          {arrow != null && (
            <AxoSymbol.InlineGlyph symbol={Arrows.get(arrow)} label={null} />
          )}
        </span>
        {pending && <Spinner buttonVariant={variant} buttonSize={size} />}
      </button>
    );
  });

  Root.displayName = 'AxoButton.Root';

  /**
   * <AxoButton.Spinner>
   * -------------------
   */

  const SpinnerVariants = variants<Variant, SpinnerVariant>(
    'AxoButton.Variant',
    {
      primary: 'axo-button-spinner-on-color',
      secondary: 'axo-button-spinner-secondary',
      affirmative: 'axo-button-spinner-on-color',
      destructive: 'axo-button-spinner-on-color',
      'subtle-primary': 'axo-button-spinner-primary',
      'subtle-affirmative': 'axo-button-spinner-affirmative',
      'subtle-destructive': 'axo-button-spinner-destructive',
      'floating-primary': 'axo-button-spinner-primary',
      'floating-secondary': 'axo-button-spinner-secondary',
      'floating-affirmative': 'axo-button-spinner-affirmative',
      'floating-destructive': 'axo-button-spinner-destructive',
      'borderless-primary': 'axo-button-spinner-primary',
      'borderless-secondary': 'axo-button-spinner-secondary',
      'borderless-affirmative': 'axo-button-spinner-affirmative',
      'borderless-destructive': 'axo-button-spinner-destructive',
    }
  );

  type SpinnerSizeConfig = Readonly<{
    size: number;
    strokeWidth: number;
  }>;

  const SpinnerSizes = variants<Size, SpinnerSizeConfig>('AxoButton.Size', {
    lg: { size: 20, strokeWidth: 2 },
    md: { size: 20, strokeWidth: 2 },
    sm: { size: 16, strokeWidth: 1.5 },
  });

  /** @internal */
  type SpinnerProps = Readonly<{
    buttonVariant: Variant;
    buttonSize: Size;
  }>;

  /** @internal */
  function Spinner(props: SpinnerProps): JSX.Element {
    const variant = SpinnerVariants.get(props.buttonVariant);
    const sizeConfig = SpinnerSizes.get(props.buttonSize);
    return (
      <span className={tw('absolute inset-0 flex items-center justify-center')}>
        <SpinnerV2
          size={sizeConfig.size}
          strokeWidth={sizeConfig.strokeWidth}
          variant={variant}
          value="indeterminate"
        />
      </span>
    );
  }
}
