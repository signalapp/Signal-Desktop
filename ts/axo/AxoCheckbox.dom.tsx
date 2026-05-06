// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC } from 'react';
import { memo } from 'react';
import { Checkbox } from 'radix-ui';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { tw } from './tw.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';

/**
 * A control that allows the user to toggle between checked and not checked.
 *
 * TODO(jamie): We need to figure out a better way to label these.
 *
 * @example Anatomy
 * ```tsx
 * <AxoCheckbox.Root />
 * ```
 * @see {@link https://www.radix-ui.com/primitives/docs/components/checkbox | Checkbox - Radix Docs}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/ | Checkbox Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#checkbox | `checkbox` role - WAI-ARIA 1.3}
 */
export namespace AxoCheckbox {
  /**
   * <AxoCheckbox.Root>
   * --------------------------------------------------------------------------
   */

  /**
   * Shape of the checkbox.
   * - `round`: Circular (20px). Used for selection in lists.
   * - `square`: Rounded-square (16px). Default for form checkboxes.
   */
  export type Variant = 'round' | 'square';

  const RootStyles = variants<Variant>('AxoCheckbox.Variant', {
    round: tw('size-5 rounded-full'),
    square: tw('size-4 rounded-sm'),
  });

  const IconSizes = variants<Variant, AxoSymbol.IconSize>(
    'AxoCheckbox.Variant',
    {
      round: 14,
      square: 12,
    }
  );

  /** @testexport */
  export function _getAllVariants(): ReadonlyArray<Variant> {
    return RootStyles.keys();
  }

  export type RootProps = Readonly<{
    /**
     * HTML `id` used to associate a `<label htmlFor={id}>` with this checkbox.
     */
    id?: string;
    /**
     * Shape of the checkbox.
     */
    variant: Variant;
    /**
     * The controlled checked state of the checkbox.
     * Must be used in conjunction with `onCheckedChange`.
     */
    checked: boolean;
    /**
     * Event handler called when the checked state of the checkbox changes.
     */
    onCheckedChange: (nextChecked: boolean) => void;
    /**
     * When `true`, prevents the user from interacting with the checkbox.
     */
    disabled?: boolean;
    /**
     * When `true`, indicates that the user must check the checkbox before the
     * owning form can be submitted.
     */
    required?: boolean;
  }>;

  /**
   * The checkbox control.
   *
   * @example Labeled checkbox
   * ```tsx
   * <AxoCheckbox.Root
   *   id={id}
   *   variant="square"
   *   checked={includeMedia}
   *   onCheckedChange={setIncludeMedia}
   * />
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    return (
      <Checkbox.Root
        id={props.id}
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
        disabled={props.disabled}
        required={props.required}
        className={tw(
          RootStyles.get(props.variant),
          'flex items-center justify-center',
          'border border-border-primary inset-shadow-on-color',
          'data-[state=unchecked]:bg-fill-primary',
          'data-[state=unchecked]:enabled:active:bg-fill-primary-pressed',
          'data-[state=checked]:bg-color-fill-primary',
          'data-[state=checked]:text-label-primary-on-color',
          'data-[state=checked]:enabled:active:bg-color-fill-primary-pressed',
          'data-disabled:border-border-secondary',
          'data-[state=checked]:data-disabled:text-label-disabled-on-color',
          'outline-none keyboard-mode:focus:outline-focus-ring',
          'overflow-hidden'
        )}
      >
        <Checkbox.Indicator asChild>
          <AxoSymbol.Icon
            symbol="check"
            size={IconSizes.get(props.variant)}
            label={null}
          />
        </Checkbox.Indicator>
      </Checkbox.Root>
    );
  });

  Root.displayName = 'AxoCheckbox.Root';
}
