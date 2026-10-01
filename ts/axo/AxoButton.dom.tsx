// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useCallback } from 'react';
import type { FC, ReactNode, JSX, MouseEvent, Ref } from 'react';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { useAxoIntl } from './_internal/AxoIntl.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';
import { forwardExtraPropsForRadix } from './_internal/props.dom.tsx';
import { AxoBaseSpinner } from './status/_AxoBaseSpinner.dom.tsx';
import { FlexWrapDetector } from './_internal/FlexWrapDetector.dom.tsx';
import { css } from './_internal/css.dom.tsx';

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

  const VariantStyles = variants<Variant>('AxoButton.Variant', {
    // strong
    'strong-secondary': css('axo-button-strong-secondary'),
    'strong-primary': css('axo-button-strong-primary'),
    'strong-affirmative': css('axo-button-strong-affirmative'),
    'strong-warning': css('axo-button-strong-warning'),
    'strong-destructive': css('axo-button-strong-destructive'),

    // subtle
    'subtle-secondary': css('axo-button-subtle-secondary'),
    'subtle-primary': css('axo-button-subtle-primary'),
    'subtle-affirmative': css('axo-button-subtle-affirmative'),
    'subtle-warning': css('axo-button-subtle-warning'),
    'subtle-destructive': css('axo-button-subtle-destructive'),

    // elevated
    'elevated-secondary': css('axo-button-elevated-secondary'),

    // implied
    'implied-secondary': css('axo-button-implied-secondary'),
    'implied-primary': css('axo-button-implied-primary'),
    'implied-affirmative': css('axo-button-implied-affirmative'),
    'implied-destructive': css('axo-button-implied-destructive'),

    // message
    'message-incoming-primary': css('axo-button-message-incoming-primary'),
    'message-outgoing-primary': css('axo-button-message-outgoing-primary'),
  });

  const SizeStyles = variants<Size>('AxoButton.Size', {
    sm: css('axo-button-sm'),
    md: css('axo-button-md'),
    lg: css('axo-button-lg'),
  });

  const WidthStyles = variants<Width>('AxoButton.Width', {
    /* Always try to fit to the content of the button */
    fit: css('axo-button-fit'),
    /* Allow the button to grow within a flex container */
    grow: css('axo-button-grow'),
    /* Always try to fill the available space */
    full: css('axo-button-fill'),
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
   * <AxoButton.Group>
   * --------------------------------------------------------------------------
   */

  export type GroupProps = Readonly<{
    children: ReactNode;
  }>;

  export const Group: FC<GroupProps> = memo(props => {
    return (
      <FlexWrapDetector>
        <div className="axo-button-group">{props.children}</div>
      </FlexWrapDetector>
    );
  });

  Group.displayName = 'AxoButton.Group';

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
        className={css(
          'axo-button',
          VariantStyles.get(variant),
          SizeStyles.get(size),
          WidthStyles.get(width),
          pending && 'axo-button-pending'
        )}
        {...forwardExtraPropsForRadix(rest)}
      >
        <span aria-hidden={pending ?? undefined} className="axo-button-inner">
          {symbol != null && (
            <AxoSymbol.InlineGlyph symbol={symbol} label={null} />
          )}
          <span className="axo-button-text">{children}</span>
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
      <span className="axo-button-spinner">
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
