// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, JSX } from 'react';
import { memo } from 'react';
import type { AxoBaseMenu } from './_internal/AxoBaseMenu.dom.tsx';
import { unreachable } from './_internal/assert.std.tsx';
import { AxoDropdownMenu } from './AxoDropdownMenu.dom.tsx';
import { AxoContextMenu } from './AxoContextMenu.dom.tsx';
import {
  createStrictContext,
  useStrictContext,
} from './_internal/StrictContext.dom.tsx';

/**
 * Create a menu that can either be a dropdown menu or context menu by passing
 * a `renderer` prop.
 *
 * Use this when the same menu structure needs to work as both an
 * `AxoDropdownMenu` and an `AxoContextMenu`.
 *
 * @example Anatomy
 * ```tsx
 * <AxoMenuBuilder.Root renderer={renderer}>
 *   <AxoMenuBuilder.Trigger />
 *   <AxoMenuBuilder.Content>
 *     <AxoMenuBuilder.Item />
 *     <AxoMenuBuilder.Separator />
 *     <AxoMenuBuilder.CheckboxItem />
 *     <AxoMenuBuilder.RadioGroup>
 *       <AxoMenuBuilder.RadioItem />
 *     </AxoMenuBuilder.RadioGroup>
 *     <AxoMenuBuilder.Sub>
 *       <AxoMenuBuilder.SubTrigger />
 *       <AxoMenuBuilder.SubContent />
 *     </AxoMenuBuilder.Sub>
 *   </AxoMenuBuilder.Content>
 * </AxoMenuBuilder.Root>
 * ```
 *
 * @see {AxoDropdownMenu}
 * @see {AxoContextMenu}
 * @see {@link https://www.radix-ui.com/primitives/docs/components/dropdown-menu | Dropdown Menu - Radix Docs}
 * @see {@link https://www.radix-ui.com/primitives/docs/components/context-menu | Context Menu - Radix Docs}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ | Menu Button Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#button | `button` role - WAI-ARIA 1.3}
 * @see {@link https://w3c.github.io/aria/#menu | `menu` role - WAI-ARIA 1.3}
 */
export namespace AxoMenuBuilder {
  /**
   * <AxoMenuBuilder.Root>
   * --------------------------------------------------------------------------
   */

  /**
   * Which menu primitive renders the component tree.
   * - `AxoDropdownMenu`: Opened by clicking the `Trigger` element.
   * - `AxoContextMenu`: Opened by right-clicking the `Trigger` element.
   */
  export type Renderer = 'AxoDropdownMenu' | 'AxoContextMenu';

  /**
   * The horizontal alignment of the menu content relative to the trigger.
   */
  export type Align = AxoBaseMenu.Align;

  /**
   * The preferred side of the trigger to render the menu content against.
   */
  export type Side = AxoBaseMenu.Side;

  /** @internal */
  const RendererContext = createStrictContext<Renderer>('AxoMenuBuilder.Root');

  /**
   * <AxoMenuBuilder.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = AxoBaseMenu.MenuRootProps &
    Readonly<{
      /**
       * Which menu primitive to use.
       * Passed down to all child components via context.
       */
      renderer: Renderer;
    }>;

  /**
   * Container for the menu. Sets the `renderer` in context so all child
   * components delegate to the correct underlying primitive.
   *
   * @example Same menu as dropdown or context menu
   * ```tsx
   * <AxoMenuBuilder.Root renderer={renderer} onOpenChange={setOpen}>
   *   <AxoMenuBuilder.Trigger>{children}</AxoMenuBuilder.Trigger>
   *   <AxoMenuBuilder.Content>
   *     <AxoMenuBuilder.Item symbol="reply" onSelect={onReply}>Reply</AxoMenuBuilder.Item>
   *     <AxoMenuBuilder.Item symbol="copy" onSelect={onCopy}>Copy</AxoMenuBuilder.Item>
   *   </AxoMenuBuilder.Content>
   * </AxoMenuBuilder.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const { renderer, ...rest } = props;

    let child: JSX.Element;
    if (renderer === 'AxoDropdownMenu') {
      child = <AxoDropdownMenu.Root {...rest} />;
    } else if (renderer === 'AxoContextMenu') {
      child = <AxoContextMenu.Root {...rest} />;
    } else {
      unreachable(renderer);
    }

    return (
      <RendererContext.Provider value={props.renderer}>
        {child}
      </RendererContext.Provider>
    );
  });

  Root.displayName = 'AxoMenuBuilder.Root';

  /**
   * <AxoMenuBuilder.Trigger>
   * --------------------------------------------------------------------------
   */

  /**
   * Delegates to `AxoDropdownMenu.Trigger` or `AxoContextMenu.Trigger` based
   * on the active renderer.
   */
  export const Trigger: FC<AxoBaseMenu.MenuTriggerProps> = memo(props => {
    const renderer = useStrictContext(RendererContext);
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Trigger {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Trigger {...props} />;
    }
    unreachable(renderer);
  });

  Trigger.displayName = 'AxoMenuBuilder.Trigger';

  /**
   * <AxoMenuBuilder.Content>
   * --------------------------------------------------------------------------
   */

  /**
   * Delegates to `AxoDropdownMenu.Content` or `AxoContextMenu.Content` based
   * on the active renderer.
   */
  export const Content: FC<AxoBaseMenu.MenuContentProps> = memo(props => {
    const renderer = useStrictContext(RendererContext);
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Content {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Content {...props} />;
    }
    unreachable(renderer);
  });

  Content.displayName = 'AxoMenuBuilder.Content';

  /**
   * <AxoMenuBuilder.Item>
   * --------------------------------------------------------------------------
   */

  /**
   * Delegates to `AxoDropdownMenu.Item` or `AxoContextMenu.Item` based on the
   * active renderer.
   */
  export const Item: FC<AxoBaseMenu.MenuItemProps> = memo(props => {
    const renderer = useStrictContext(RendererContext);
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Item {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Item {...props} />;
    }
    unreachable(renderer);
  });

  Item.displayName = 'AxoMenuBuilder.Item';

  /**
   * <AxoMenuBuilder.Group>
   * --------------------------------------------------------------------------
   */

  /**
   * Delegates to `AxoDropdownMenu.Group` or `AxoContextMenu.Group` based on
   * the active renderer.
   */
  export const Group: FC<AxoBaseMenu.MenuGroupProps> = memo(props => {
    const renderer = useStrictContext(RendererContext);
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Group {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Group {...props} />;
    }
    unreachable(renderer);
  });

  Group.displayName = 'AxoMenuBuilder.Group';

  /**
   * <AxoMenuBuilder.Label>
   * --------------------------------------------------------------------------
   */

  /**
   * Delegates to `AxoDropdownMenu.Label` or `AxoContextMenu.Label` based on
   * the active renderer.
   */
  export const Label: FC<AxoBaseMenu.MenuLabelProps> = memo(props => {
    const renderer = useStrictContext(RendererContext);
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Label {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Label {...props} />;
    }
    unreachable(renderer);
  });

  Label.displayName = 'AxoMenuBuilder.Label';

  /**
   * <AxoMenuBuilder.Separator>
   * --------------------------------------------------------------------------
   */

  /**
   * Delegates to `AxoDropdownMenu.Separator` or `AxoContextMenu.Separator`
   * based on the active renderer.
   */
  export const Separator: FC = memo(props => {
    const renderer = useStrictContext(RendererContext);
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Separator {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Separator {...props} />;
    }
    unreachable(renderer);
  });

  Separator.displayName = 'AxoMenuBuilder.Separator';

  /**
   * <AxoMenuBuilder.CheckboxItem>
   * --------------------------------------------------------------------------
   */

  /**
   * Delegates to `AxoDropdownMenu.CheckboxItem` or
   * `AxoContextMenu.CheckboxItem` based on the active renderer.
   */
  export const CheckboxItem: FC<AxoBaseMenu.MenuCheckboxItemProps> = memo(
    props => {
      const renderer = useStrictContext(RendererContext);
      if (renderer === 'AxoDropdownMenu') {
        return <AxoDropdownMenu.CheckboxItem {...props} />;
      }
      if (renderer === 'AxoContextMenu') {
        return <AxoContextMenu.CheckboxItem {...props} />;
      }
      unreachable(renderer);
    }
  );

  CheckboxItem.displayName = 'AxoMenuBuilder.CheckboxItem';

  /**
   * <AxoMenuBuilder.RadioGroup>
   * --------------------------------------------------------------------------
   */

  /**
   * Delegates to `AxoDropdownMenu.RadioGroup` or `AxoContextMenu.RadioGroup`
   * based on the active renderer.
   */
  export const RadioGroup: FC<AxoBaseMenu.MenuRadioGroupProps> = memo(props => {
    const renderer = useStrictContext(RendererContext);
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.RadioGroup {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.RadioGroup {...props} />;
    }
    unreachable(renderer);
  });

  RadioGroup.displayName = 'AxoMenuBuilder.RadioGroup';

  /**
   * <AxoMenuBuilder.RadioItem>
   * --------------------------------------------------------------------------
   */

  /**
   * Delegates to `AxoDropdownMenu.RadioItem` or `AxoContextMenu.RadioItem`
   * based on the active renderer.
   */
  export const RadioItem: FC<AxoBaseMenu.MenuRadioItemProps> = memo(props => {
    const renderer = useStrictContext(RendererContext);
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.RadioItem {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.RadioItem {...props} />;
    }
    unreachable(renderer);
  });

  RadioItem.displayName = 'AxoMenuBuilder.RadioItem';

  /**
   * <AxoMenuBuilder.Sub>
   * --------------------------------------------------------------------------
   */

  /**
   * Delegates to `AxoDropdownMenu.Sub` or `AxoContextMenu.Sub` based on the
   * active renderer.
   */
  export const Sub: FC<AxoBaseMenu.MenuSubProps> = memo(props => {
    const renderer = useStrictContext(RendererContext);
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Sub {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Sub {...props} />;
    }
    unreachable(renderer);
  });

  Sub.displayName = 'AxoMenuBuilder.Sub';

  /**
   * <AxoMenuBuilder.SubTrigger>
   * --------------------------------------------------------------------------
   */

  /**
   * Delegates to `AxoDropdownMenu.SubTrigger` or `AxoContextMenu.SubTrigger`
   * based on the active renderer.
   */
  export const SubTrigger: FC<AxoBaseMenu.MenuSubTriggerProps> = memo(props => {
    const renderer = useStrictContext(RendererContext);
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.SubTrigger {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.SubTrigger {...props} />;
    }
    unreachable(renderer);
  });

  SubTrigger.displayName = 'AxoMenuBuilder.SubTrigger';

  /**
   * <AxoMenuBuilder.SubContent>
   * --------------------------------------------------------------------------
   */

  /**
   * Delegates to `AxoDropdownMenu.SubContent` or `AxoContextMenu.SubContent`
   * based on the active renderer.
   */
  export const SubContent: FC<AxoBaseMenu.MenuSubContentProps> = memo(props => {
    const renderer = useStrictContext(RendererContext);
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.SubContent {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.SubContent {...props} />;
    }
    unreachable(renderer);
  });

  SubContent.displayName = 'AxoMenuBuilder.SubContent';
}
