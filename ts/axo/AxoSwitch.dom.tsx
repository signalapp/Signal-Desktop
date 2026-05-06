// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC } from 'react';
import { memo } from 'react';
import { Switch } from 'radix-ui';
import { tw } from './tw.dom.tsx';
import { AxoSymbol } from './AxoSymbol.dom.tsx';

/**
 * A control that allows the user to toggle between checked and not checked.
 *
 * TODO(jamie): We need to figure out a better way to label these.
 *
 * @example Anatomy
 * ```tsx
 * <AxoSwitch.Root checked={checked} onCheckedChange={setChecked} />
 * ```
 *
 * @see {@link https://www.radix-ui.com/primitives/docs/components/switch | Switch - Radix Docs}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/switch/ | Switch Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#switch | `switch` role - WAI-ARIA 1.3}
 */
export namespace AxoSwitch {
  /**
   * <AxoSwitch.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /** The controlled state of the switch. Must be used in conjunction with `onCheckedChange`. */
    checked: boolean;
    /** Event handler called when the state of the switch changes. */
    onCheckedChange: (nextChecked: boolean) => void;
    /** When true, prevents the user from interacting with the switch. */
    disabled?: boolean;
    /** When true, indicates that the user must check the switch before the owning form can be submitted. */
    required?: boolean;
  }>;

  /**
   * Contains all the parts of a switch. An input will also render when used
   * within a form to ensure events propagate correctly.
   *
   * @example Inside a label element
   * ```tsx
   * <label className={tw('flex items-center gap-3')}>
   *   <span className={tw('grow')}>Allow multiple votes</span>
   *   <AxoSwitch.Root checked={allowMultiple} onCheckedChange={setAllowMultiple} />
   * </label>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    return (
      <Switch.Root
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
        disabled={props.disabled}
        required={props.required}
        className={tw(
          'group relative z-0 flex h-[18px] w-8 items-center rounded-full',
          'border border-border-secondary inset-shadow-on-color',
          'bg-fill-secondary',
          'data-disabled:bg-fill-primary',
          'enabled:active:bg-fill-secondary-pressed',
          'outline-none keyboard-mode:focus:outline-focus-ring',
          'overflow-hidden'
        )}
      >
        <span
          className={tw(
            'absolute inset-y-0',
            'w-5.5 rounded-s-full',
            'group-data-disabled:w-7.5 group-data-disabled:rounded-full',
            'opacity-0 group-data-[state=checked]:opacity-100',
            '-translate-x-3.5 group-data-[state=checked]:translate-x-0 rtl:translate-x-3.5',
            'bg-color-fill-primary group-enabled:group-active:bg-color-fill-primary-pressed',
            'transition-all duration-200 ease-out-cubic',
            'forced-colors:bg-[AccentColor]',
            'forced-colors:group-data-disabled:bg-[GrayText]'
          )}
        />
        <span
          className={tw(
            'invisible forced-colors:visible',
            'absolute inset-s-0.5 z-0 text-[12px]',
            'forced-color-adjust-none',
            'forced-colors:text-[AccentColorText]'
          )}
        >
          <AxoSymbol.InlineGlyph symbol="check" label={null} />
        </span>
        <Switch.Thumb
          className={tw(
            'z-10 block size-4 rounded-full',
            // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
            'shadow-[#000]/12',
            'shadow-[0.5px_0_0.5px_0.5px,-0.5px_0_0.5px_0.5px]',
            'bg-label-primary-on-color',
            'data-disabled:bg-label-disabled-on-color',
            'transition-all duration-200 ease-out-cubic',
            'data-[state=checked]:translate-x-3.5',
            'rtl:data-[state=checked]:-translate-x-3.5',
            'forced-colors:border',
            'forced-colors:data-disabled:bg-[ButtonFace]'
          )}
        />
      </Switch.Root>
    );
  });

  Root.displayName = 'AxoSwitch.Root';
}
