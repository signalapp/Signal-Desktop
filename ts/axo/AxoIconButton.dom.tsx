// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, Ref, MouseEvent, FocusEvent } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { tw } from './tw.dom.tsx';
import type { SpinnerVariant } from '../components/SpinnerV2.dom.tsx';
import { SpinnerV2 } from '../components/SpinnerV2.dom.tsx';
import { AxoTooltip } from './AxoTooltip.dom.tsx';
import { useAxoIntl } from './_internal/AxoIntl.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';

/**
 * A circular icon-only button with an accessible label and built-in tooltip.
 *
 * @example Anatomy
 * ```tsx
 * <AxoIconButton.Root />
 * ```
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/button/ | Button Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#button | `button` role - WAI-ARIA 1.3}
 */
export namespace AxoIconButton {
  /**
   * <AxoIconButton.Root>
   * --------------------------------------------------------------------------
   */

  const baseStyles = tw(
    'relative rounded-full leading-none select-none',
    'not-forced-colors:outline-none keyboard-mode:focus:outline-focus-ring',
    'forced-colors:border forced-colors:border-[ButtonBorder] forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]',
    'forced-colors:aria-disabled:text-[GrayText]',
    'forced-colors:aria-pressed:bg-[SelectedItem] forced-colors:aria-pressed:text-[SelectedItemText]'
  );

  const pressedInvertedStyles = tw(
    'aria-pressed:bg-fill-inverted aria-pressed:not-aria-disabled:active:bg-fill-inverted-pressed',
    'aria-pressed:text-label-primary-inverted aria-pressed:aria-disabled:text-label-disabled-inverted'
  );

  const pressedPrimaryStyles = tw(
    'aria-pressed:bg-color-fill-primary aria-pressed:not-aria-disabled:active:bg-color-fill-primary-pressed',
    'aria-pressed:text-label-primary-on-color aria-pressed:aria-disabled:text-label-disabled-on-color'
  );

  const Variants = variants<Variant>('AxoIconButton.Variant', {
    secondary: tw(
      'bg-fill-secondary not-aria-disabled:active:bg-fill-secondary-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-fill-secondary-pressed',
      'text-label-primary aria-disabled:text-label-disabled',
      pressedInvertedStyles
    ),
    primary: tw(
      'bg-color-fill-primary not-aria-disabled:active:bg-color-fill-primary-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-color-fill-primary-pressed',
      'text-label-primary-on-color aria-disabled:text-label-disabled-on-color',
      pressedInvertedStyles
    ),
    affirmative: tw(
      'bg-color-fill-affirmative not-aria-disabled:active:bg-color-fill-affirmative-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-color-fill-affirmative-pressed',
      'text-label-primary-on-color aria-disabled:text-label-disabled-on-color',
      pressedInvertedStyles
    ),
    destructive: tw(
      'bg-color-fill-destructive not-aria-disabled:active:bg-color-fill-destructive-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-color-fill-destructive-pressed',
      'text-label-primary-on-color aria-disabled:text-label-disabled-on-color',
      pressedInvertedStyles
    ),
    'borderless-secondary': tw(
      'not-aria-disabled:hover:not-aria-pressed:bg-fill-secondary not-aria-disabled:active:bg-fill-secondary-pressed',
      'focus:bg-fill-secondary',
      'data-[axo-dropdownmenu-state=open]:bg-fill-secondary-pressed',
      'text-label-primary aria-disabled:text-label-disabled',
      pressedPrimaryStyles
    ),
    'floating-secondary': tw(
      'bg-fill-floating not-aria-disabled:active:bg-fill-floating-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-fill-floating-pressed',
      'text-label-primary aria-disabled:text-label-disabled',
      'shadow-elevation-1',
      pressedInvertedStyles
    ),
  });

  /** @testexport */
  export function _getAllVariants(): ReadonlyArray<Variant> {
    return Variants.keys();
  }

  const Sizes = variants<Size>('AxoIconButton.Size', {
    sm: tw('p-[5px]'),
    md: tw('p-1.5'),
    lg: tw('p-2'),
  });

  const IconSizes = variants<Size, AxoSymbol.IconSize>('AxoIconButton.Size', {
    sm: 18,
    md: 20,
    lg: 20,
  });

  /** @testexport */
  export function _getAllSizes(): ReadonlyArray<Size> {
    return Sizes.keys();
  }

  /**
   * Visual style of the button.
   */
  export type Variant =
    | 'secondary'
    | 'primary'
    | 'affirmative'
    | 'destructive'
    | 'borderless-secondary'
    | 'floating-secondary';

  /**
   * Size of the button.
   */
  export type Size = 'sm' | 'md' | 'lg';

  export type RootProps = Readonly<{
    /**
     * Ref to the underlying `<button>` element.
     */
    ref?: Ref<HTMLButtonElement>;
    /**
     * Accessible label for the button. Should describe the action, not the icon.
     * Also used as the default tooltip text.
     */
    label: string;
    /**
     * Tooltip shown on hover.
     * - `true` (default): uses `label` as the tooltip text.
     * - `false`: no tooltip.
     * - `AxoTooltip.RootConfigProps`: custom tooltip configuration.
     */
    tooltip?: boolean | AxoTooltip.RootConfigProps;
    /**
     * Visual style of the button.
     */
    variant: Variant;
    /**
     * Size of the button.
     */
    size: Size;
    /**
     * Icon to display inside the button.
     */
    symbol: AxoSymbol.IconName;
    /**
     * Stroke weight override for the icon.
     */
    iconWeight?: AxoSymbol.Weight;
    /**
     * When `true`, shows a spinner and prevents interaction.
     */
    pending?: boolean | null;
    /**
     * When set, the button behaves as a toggle with `aria-pressed` semantics.
     */
    pressed?: boolean | null;
    /**
     * When `true`, prevents interaction.
     */
    disabled?: boolean | null;
    /**
     * Called when the button is clicked. Not called when `pending` or `disabled`.
     */
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    /**
     * Called when the mouse enters the button.
     */
    onMouseEnter?: (event: MouseEvent<HTMLButtonElement>) => void;
    /**
     * Called when the mouse focuses the button.
     */
    onFocus?: (event: FocusEvent<HTMLButtonElement>) => void;
  }>;

  /**
   * A circular icon-only button.
   * Wraps in a tooltip by default using `label`.
   *
   * @example Close button
   * ```tsx
   * <AxoIconButton.Root
   *   label="Close"
   *   variant="borderless-secondary"
   *   size="md"
   *   symbol="x"
   *   onClick={onClose}
   * />
   * ```
   *
   * @example Toggle mute button
   * ```tsx
   * <AxoIconButton.Root
   *   label={muted ? 'Unmute' : 'Mute'}
   *   variant="borderless-secondary"
   *   size="md"
   *   symbol={muted ? 'mic-slash' : 'mic'}
   *   pressed={muted}
   *   onClick={toggleMuted}
   * />
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const {
      label,
      tooltip = true,
      variant,
      size,
      symbol,
      iconWeight,
      pending,
      pressed,
      disabled,
      onClick,
      onMouseEnter,
      onFocus,
      ...rest
    } = props;
    const intl = useAxoIntl();

    const tooltipConfig = useMemo(() => {
      if (!tooltip) {
        return null;
      }
      if (typeof tooltip === 'object') {
        return tooltip;
      }
      return { label };
    }, [tooltip, label]);

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

    const button = (
      <button
        ref={props.ref}
        type="button"
        aria-label={pending ? intl.get('AxoButton.Pending') : label}
        aria-pressed={pressed ?? undefined}
        aria-disabled={(pending || disabled) ?? undefined}
        onClick={handleClick}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        className={tw(baseStyles, Variants.get(variant), Sizes.get(size))}
        {...rest}
      >
        <span
          aria-hidden={pending ?? undefined}
          className={tw(
            'align-top forced-color-adjust-none',
            pending ? 'opacity-0' : null
          )}
        >
          <AxoSymbol.Icon
            size={IconSizes.get(size)}
            symbol={symbol}
            label={null}
            weight={iconWeight}
          />
        </span>
        {pending && <Spinner buttonVariant={variant} buttonSize={size} />}
      </button>
    );

    if (tooltipConfig != null) {
      return (
        <AxoTooltip.Root
          {...tooltipConfig}
          tooltipRepeatsTriggerAccessibleName={label === tooltipConfig.label}
        >
          {button}
        </AxoTooltip.Root>
      );
    }

    return button;
  });

  Root.displayName = 'AxoIconButton.Root';

  /**
   * <AxoIconButton.Spinner>
   * --------------------------------------------------------------------------
   */

  const SpinnerVariants = variants<Variant, SpinnerVariant>(
    'AxoIconButton.Variant',
    {
      primary: 'axo-button-spinner-on-color',
      secondary: 'axo-button-spinner-secondary',
      affirmative: 'axo-button-spinner-on-color',
      destructive: 'axo-button-spinner-on-color',
      'floating-secondary': 'axo-button-spinner-secondary',
      'borderless-secondary': 'axo-button-spinner-secondary',
    }
  );

  type SpinnerSizeConfig = { size: number; strokeWidth: number };

  const SpinnerSizes = variants<Size, SpinnerSizeConfig>('AxoIconButton.Size', {
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
  const Spinner: FC<SpinnerProps> = memo(props => {
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
  });

  Spinner.displayName = 'AxoIconButton.Spinner';
}
