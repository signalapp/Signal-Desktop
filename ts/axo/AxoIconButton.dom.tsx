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
import { forwardExtraPropsForRadix } from './_internal/props.dom.tsx';

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
    'relative rounded-full leading-none',
    'not-forced-colors:outline-none keyboard-mode:focus:axo-focus-ring',
    'forced-colors:border forced-colors:border-[ButtonBorder] forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]',
    'forced-colors:aria-disabled:text-[GrayText]',
    'forced-colors:aria-pressed:bg-[SelectedItem] forced-colors:aria-pressed:text-[SelectedItemText]'
  );

  const pressedInvertedStyles = tw(
    'aria-pressed:bg-inverted aria-pressed:not-aria-disabled:active:bg-inverted-pressed',
    'aria-pressed:not-aria-disabled:data-[axo-dropdownmenu-state=open]:bg-inverted-pressed',
    'aria-pressed:text-primary-inverted aria-pressed:aria-disabled:text-disabled-inverted'
  );

  const pressedPrimaryStyles = tw(
    'aria-pressed:bg-accent aria-pressed:not-aria-disabled:active:bg-accent-pressed',
    'aria-pressed:not-aria-disabled:data-[axo-dropdownmenu-state=open]:bg-accent-pressed',
    'aria-pressed:text-primary-oncolor aria-pressed:aria-disabled:text-disabled-oncolor'
  );

  const Variants = variants<Variant>('AxoIconButton.Variant', {
    'strong-secondary': tw(
      'bg-secondary text-primary',
      'not-aria-disabled:active:bg-secondary-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-secondary-pressed',
      'aria-disabled:text-disabled',
      pressedInvertedStyles
    ),
    'strong-primary': tw(
      'bg-accent text-primary-oncolor',
      'not-aria-disabled:active:bg-accent-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-accent-pressed',
      'aria-disabled:text-disabled-oncolor'
    ),
    'strong-affirmative': tw(
      'bg-affirmative text-primary-oncolor',
      'not-aria-disabled:active:bg-affirmative-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-affirmative-pressed',
      'aria-disabled:text-disabled-oncolor'
    ),
    'strong-warning': tw(
      'bg-warning-bright text-primary-onbright',
      'not-aria-disabled:active:bg-warning-bright-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-warning-bright-pressed',
      'aria-disabled:text-disabled-onbright'
    ),
    'strong-destructive': tw(
      'bg-destructive text-primary-oncolor',
      'not-aria-disabled:active:bg-destructive-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-destructive-pressed',
      'aria-disabled:text-disabled-oncolor'
    ),
    'subtle-secondary': tw(
      'bg-primary text-primary',
      'not-aria-disabled:active:bg-primary-pressed',
      'aria-disabled:text-disabled',
      pressedInvertedStyles
    ),
    'subtle-primary': tw(
      'bg-accent-tint text-accent',
      'not-aria-disabled:active:bg-accent-tint-pressed',
      'aria-disabled:text-accent-disabled'
    ),
    'subtle-affirmative': tw(
      'bg-affirmative-tint text-affirmative',
      'not-aria-disabled:active:bg-affirmative-tint-pressed',
      'aria-disabled:text-affirmative-disabled'
    ),
    'subtle-warning': tw(
      'bg-warning-tint text-warning',
      'not-aria-disabled:active:bg-warning-tint-pressed',
      'aria-disabled:text-warning-disabled'
    ),
    'subtle-destructive': tw(
      'bg-destructive-tint text-destructive',
      'not-aria-disabled:active:bg-destructive-tint-pressed',
      'aria-disabled:text-destructive-disabled'
    ),
    'implied-secondary': tw(
      'bg-transparent text-primary',
      'not-aria-disabled:hover:not-aria-pressed:bg-primary',
      'not-aria-disabled:active:bg-primary-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-primary-pressed',
      'focus:bg-primary',
      'aria-disabled:text-disabled',
      pressedPrimaryStyles
    ),
    'material-subtle': tw(
      'bg-material-secondary text-primary backdrop-blur-thin',
      'not-aria-disabled:active:bg-material-tertiary-pressed',
      'aria-disabled:text-disabled',
      pressedInvertedStyles
    ),
    'material-strong': tw(
      'bg-material-primary text-primary backdrop-blur-thin',
      'not-aria-disabled:active:bg-material-quaternary-pressed',
      'aria-disabled:text-disabled'
    ),
    'elevated-secondary': tw(
      'bg-material-tertiary text-primary backdrop-blur-thin',
      'not-aria-disabled:active:bg-material-tertiary-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-material-tertiary-pressed',
      'aria-disabled:text-disabled',
      'shadow-elevation-1'
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
    | 'strong-secondary'
    | 'strong-primary'
    | 'strong-affirmative'
    | 'strong-warning'
    | 'strong-destructive'
    | 'subtle-secondary'
    | 'subtle-primary'
    | 'subtle-affirmative'
    | 'subtle-warning'
    | 'subtle-destructive'
    | 'implied-secondary'
    | 'material-subtle'
    | 'material-strong'
    | 'elevated-secondary';

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
    symbol: AxoSymbol.Name;
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
   *   variant="implied-secondary"
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
   *   variant="implied-secondary"
   *   size="md"
   *   symbol={muted ? 'mic-slash' : 'mic'}
   *   pressed={muted}
   *   onClick={toggleMuted}
   * />
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const {
      ref,
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
        ref={ref}
        type="button"
        aria-label={pending ? intl.get('AxoButton.Pending') : label}
        aria-pressed={pressed ?? undefined}
        aria-disabled={(pending || disabled) ?? undefined}
        onClick={handleClick}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        className={tw(baseStyles, Variants.get(variant), Sizes.get(size))}
        {...forwardExtraPropsForRadix(rest)}
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
      'strong-primary': 'axo-button-spinner-oncolor',
      'strong-secondary': 'axo-button-spinner-secondary',
      'strong-affirmative': 'axo-button-spinner-oncolor',
      'strong-warning': 'axo-button-spinner-onbright',
      'strong-destructive': 'axo-button-spinner-oncolor',
      'subtle-primary': 'axo-button-spinner-primary',
      'subtle-secondary': 'axo-button-spinner-secondary',
      'subtle-affirmative': 'axo-button-spinner-affirmative',
      'subtle-warning': 'axo-button-spinner-warning',
      'subtle-destructive': 'axo-button-spinner-destructive',
      'elevated-secondary': 'axo-button-spinner-secondary',
      'material-subtle': 'axo-button-spinner-secondary',
      'material-strong': 'axo-button-spinner-secondary',
      'implied-secondary': 'axo-button-spinner-secondary',
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
