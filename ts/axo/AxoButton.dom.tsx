// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useCallback } from 'react';
import type { FC, ReactNode, JSX, MouseEvent, Ref } from 'react';
import { tw } from './tw.dom.tsx';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { useAxoIntl } from './_internal/AxoIntl.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';
import { forwardExtraPropsForRadix } from './_internal/props.dom.tsx';
import { AxoBaseSpinner } from './status/_AxoBaseSpinner.dom.tsx';

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
    | 'strong-secondary'
    | 'strong-primary'
    | 'strong-affirmative'
    | 'strong-warning'
    | 'strong-destructive'
    | 'subtle-primary'
    | 'subtle-secondary'
    | 'subtle-affirmative'
    | 'subtle-warning'
    | 'subtle-destructive'
    | 'elevated-secondary'
    | 'implied-secondary'
    | 'implied-primary'
    | 'implied-affirmative'
    | 'implied-destructive'
    | 'message-incoming-primary'
    | 'message-outgoing-primary';

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
  export type Arrow = 'collapse' | 'expand' | 'next' | 'external-link';

  const baseStyles = tw(
    'relative inline-flex max-w-full items-center-safe justify-center-safe rounded-full',
    'not-forced-colors:outline-none keyboard-mode:focus:axo-focus-ring',
    'forced-colors:border',
    'forced-colors:aria-disabled:text-[GrayText]'
  );

  const VariantStyles = variants<Variant>('AxoButton.Variant', {
    // strong
    'strong-secondary': tw(
      baseStyles,
      'bg-secondary text-primary',
      'not-aria-disabled:active:bg-secondary-pressed',
      'data-[axo-discouraged=true]:text-disabled'
    ),
    'strong-primary': tw(
      baseStyles,
      'bg-accent text-primary-oncolor',
      'not-aria-disabled:active:bg-accent-pressed',
      'data-[axo-discouraged=true]:text-disabled-oncolor'
    ),
    'strong-affirmative': tw(
      baseStyles,
      'bg-affirmative text-primary-oncolor',
      'not-aria-disabled:active:bg-affirmative-pressed',
      'data-[axo-discouraged=true]:text-disabled-oncolor'
    ),
    'strong-warning': tw(
      baseStyles,
      'bg-warning-bright text-primary-onbright',
      'not-aria-disabled:active:bg-warning-bright-pressed',
      'data-[axo-discouraged=true]:text-disabled-onbright'
    ),
    'strong-destructive': tw(
      baseStyles,
      'bg-destructive text-primary-oncolor',
      'not-aria-disabled:active:bg-destructive-pressed',
      'data-[axo-discouraged=true]:text-disabled-oncolor'
    ),

    // subtle
    'subtle-secondary': tw(
      baseStyles,
      'bg-primary text-primary',
      'not-aria-disabled:active:bg-primary-pressed',
      'data-[axo-discouraged=true]:text-disabled'
    ),
    'subtle-primary': tw(
      baseStyles,
      'bg-accent-tint text-accent',
      'not-aria-disabled:active:bg-accent-tint-pressed',
      'data-[axo-discouraged=true]:text-accent-disabled'
    ),
    'subtle-affirmative': tw(
      baseStyles,
      'bg-affirmative-tint text-affirmative',
      'not-aria-disabled:active:bg-affirmative-tint-pressed',
      'data-[axo-discouraged=true]:text-affirmative-disabled'
    ),
    'subtle-warning': tw(
      baseStyles,
      'bg-warning-tint text-warning',
      'not-aria-disabled:active:bg-warning-tint-pressed',
      'data-[axo-discouraged=true]:text-warning-disabled'
    ),
    'subtle-destructive': tw(
      baseStyles,
      'bg-destructive-tint text-destructive',
      'not-aria-disabled:active:bg-destructive-tint-pressed',
      'data-[axo-discouraged=true]:text-destructive-disabled'
    ),

    // elevated
    'elevated-secondary': tw(
      baseStyles,
      'bg-material-tertiary text-primary shadow-elevation-1 backdrop-blur-thin',
      'not-aria-disabled:active:bg-material-tertiary-pressed',
      'data-[axo-discouraged=true]:text-disabled'
    ),

    // implied
    'implied-secondary': tw(
      baseStyles,
      'bg-transparent text-primary',
      'not-aria-disabled:hover:bg-primary',
      'not-aria-disabled:active:bg-primary-pressed',
      'data-[axo-discouraged=true]:text-disabled'
    ),
    'implied-primary': tw(
      baseStyles,
      'bg-transparent text-accent',
      'not-aria-disabled:hover:bg-accent-tint',
      'not-aria-disabled:active:bg-accent-tint-pressed',
      'data-[axo-discouraged=true]:text-accent-disabled'
    ),
    'implied-affirmative': tw(
      baseStyles,
      'bg-transparent text-affirmative',
      'not-aria-disabled:hover:bg-affirmative-tint',
      'not-aria-disabled:active:bg-affirmative-tint-pressed',
      'data-[axo-discouraged=true]:text-affirmative-disabled'
    ),
    'implied-destructive': tw(
      baseStyles,
      'bg-transparent text-destructive',
      'not-aria-disabled:hover:bg-destructive-tint',
      'not-aria-disabled:active:bg-destructive-tint-pressed',
      'data-[axo-discouraged=true]:text-destructive-disabled'
    ),

    // message
    'message-incoming-primary': tw(
      baseStyles,
      'bg-onmessage-incoming-primary text-primary',
      'not-aria-disabled:active:bg-onmessage-incoming-primary-pressed',
      'data-[axo-discouraged=true]:text-disabled'
    ),
    'message-outgoing-primary': tw(
      baseStyles,
      'bg-onmessage-outgoing-primary text-primary-oncolor',
      'not-aria-disabled:active:bg-onmessage-outgoing-primary-pressed',
      'data-[axo-discouraged=true]:text-disabled-oncolor'
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

  const Arrows = variants<Arrow, AxoSymbol.Name>('AxoButton.Arrow', {
    collapse: 'chevron-up',
    expand: 'chevron-down',
    next: 'chevron-[end]',
    'external-link': 'open',
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
    symbol?: AxoSymbol.Name | null;
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
     * When `true`, displays "disabled" styles, but doesn't actually disable
     * the button.
     */
    discouraged?: boolean | null;
    /**
     * When `true`, takes initial focus when rendered.
     */
    autoFocus?: boolean | null;
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
   * <AxoButton.Root variant="strong-secondary" size="md" width="grow" onClick={onCancel}>
   *   Cancel
   * </AxoButton.Root>
   * <AxoButton.Root variant="strong-primary" size="md" width="grow" pending={isSaving} onClick={onSave}>
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
      ref,
      variant,
      size,
      width = 'fit',
      symbol,
      arrow,
      pending,
      disabled,
      discouraged,
      pressed,
      expanded,
      controls,
      autoFocus,
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
        ref={ref}
        type="button"
        aria-label={pending ? intl.get('AxoButton.Pending') : undefined}
        aria-disabled={(pending || disabled) ?? undefined}
        aria-expanded={expanded ?? undefined}
        aria-pressed={pressed ?? undefined}
        aria-controls={controls ?? undefined}
        data-axo-discouraged={disabled || discouraged}
        autoFocus={autoFocus ?? undefined}
        onClick={handleClick}
        className={tw(
          VariantStyles.get(variant),
          SizeStyles.get(size),
          WidthStyles.get(width)
        )}
        {...forwardExtraPropsForRadix(rest)}
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

  const SpinnerVariants = variants<Variant, AxoBaseSpinner.Variant>(
    'AxoButton.Variant',
    {
      'strong-primary': 'oncolor',
      'strong-secondary': 'default',
      'strong-affirmative': 'oncolor',
      'strong-warning': 'oncolor',
      'strong-destructive': 'oncolor',
      'subtle-primary': 'default',
      'subtle-secondary': 'default',
      'subtle-affirmative': 'default',
      'subtle-warning': 'default',
      'subtle-destructive': 'default',
      'elevated-secondary': 'default',
      'implied-primary': 'default',
      'implied-secondary': 'default',
      'implied-affirmative': 'default',
      'implied-destructive': 'default',
      'message-incoming-primary': 'default',
      'message-outgoing-primary': 'default',
    }
  );

  const SpinnerSizes = variants<Size, number>('AxoButton.Size', {
    lg: 18,
    md: 18,
    sm: 16,
  });

  /** @internal */
  type SpinnerProps = Readonly<{
    buttonSize: Size;
    buttonVariant: Variant;
  }>;

  /** @internal */
  function Spinner(props: SpinnerProps): JSX.Element {
    const size = SpinnerSizes.get(props.buttonSize);
    const variant = SpinnerVariants.get(props.buttonVariant);
    return (
      <span className={tw('absolute inset-0 flex items-center justify-center')}>
        <AxoBaseSpinner.Root
          size={size}
          weight="regular"
          variant={variant}
          value="indeterminate"
          track={false}
        />
      </span>
    );
  }
}
