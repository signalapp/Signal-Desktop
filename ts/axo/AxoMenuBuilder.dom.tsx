// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC } from 'react';
import React, { createContext, memo, useContext } from 'react';
import type { AxoBaseMenu } from './_internal/AxoBaseMenu.dom.js';
import { assert, unreachable } from './_internal/assert.dom.js';
import { AxoDropdownMenu } from './AxoDropdownMenu.dom.js';
import { AxoContextMenu } from './AxoContextMenu.dom.js';

const Namespace = 'AxoMenuBuilder';

export namespace AxoMenuBuilder {
  export type Renderer = 'AxoDropdownMenu' | 'AxoContextMenu';

  const MenuBuilderContext = createContext<Renderer | null>(null);

  // eslint-disable-next-line no-inner-declarations
  function useMenuBuilderContext(): Renderer {
    const context = useContext(MenuBuilderContext);
    return assert(context, `Must be wrapped with <${Namespace}.Root>`);
  }

  export type RootProps = AxoBaseMenu.MenuRootProps &
    Readonly<{
      renderer: Renderer;
    }>;

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
      <MenuBuilderContext.Provider value={props.renderer}>
        {child}
      </MenuBuilderContext.Provider>
    );
  });

  Root.displayName = `${Namespace}.Root`;

  export const Trigger: FC<AxoBaseMenu.MenuTriggerProps> = memo(props => {
    const renderer = useMenuBuilderContext();
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Trigger {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Trigger {...props} />;
    }
    unreachable(renderer);
  });

  Trigger.displayName = `${Namespace}.Trigger`;

  export const Content: FC<AxoBaseMenu.MenuContentProps> = memo(props => {
    const renderer = useMenuBuilderContext();
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Content {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Content {...props} />;
    }
    unreachable(renderer);
  });

  Content.displayName = `${Namespace}.Content`;

  export const Item: FC<AxoBaseMenu.MenuItemProps> = memo(props => {
    const renderer = useMenuBuilderContext();
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Item {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Item {...props} />;
    }
    unreachable(renderer);
  });

  Item.displayName = `${Namespace}.Item`;

  export const Group: FC<AxoBaseMenu.MenuGroupProps> = memo(props => {
    const renderer = useMenuBuilderContext();
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Group {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Group {...props} />;
    }
    unreachable(renderer);
  });

  Group.displayName = `${Namespace}.Group`;

  export const Label: FC<AxoBaseMenu.MenuLabelProps> = memo(props => {
    const renderer = useMenuBuilderContext();
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Label {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Label {...props} />;
    }
    unreachable(renderer);
  });

  Label.displayName = `${Namespace}.Label`;

  export const Separator: FC<AxoBaseMenu.MenuSeparatorProps> = memo(props => {
    const renderer = useMenuBuilderContext();
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Separator {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Separator {...props} />;
    }
    unreachable(renderer);
  });

  Separator.displayName = `${Namespace}.Separator`;

  export const CheckboxItem: FC<AxoBaseMenu.MenuCheckboxItemProps> = memo(
    props => {
      const renderer = useMenuBuilderContext();
      if (renderer === 'AxoDropdownMenu') {
        return <AxoDropdownMenu.CheckboxItem {...props} />;
      }
      if (renderer === 'AxoContextMenu') {
        return <AxoContextMenu.CheckboxItem {...props} />;
      }
      unreachable(renderer);
    }
  );

  CheckboxItem.displayName = `${Namespace}.CheckboxItem`;

  export const RadioGroup: FC<AxoBaseMenu.MenuRadioGroupProps> = memo(props => {
    const renderer = useMenuBuilderContext();
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.RadioGroup {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.RadioGroup {...props} />;
    }
    unreachable(renderer);
  });

  RadioGroup.displayName = `${Namespace}.RadioGroup`;

  export const RadioItem: FC<AxoBaseMenu.MenuRadioItemProps> = memo(props => {
    const renderer = useMenuBuilderContext();
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.RadioItem {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.RadioItem {...props} />;
    }
    unreachable(renderer);
  });

  RadioItem.displayName = `${Namespace}.RadioItem`;

  export const Sub: FC<AxoBaseMenu.MenuSubProps> = memo(props => {
    const renderer = useMenuBuilderContext();
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.Sub {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.Sub {...props} />;
    }
    unreachable(renderer);
  });

  Sub.displayName = `${Namespace}.Sub`;

  export const SubTrigger: FC<AxoBaseMenu.MenuSubTriggerProps> = memo(props => {
    const renderer = useMenuBuilderContext();
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.SubTrigger {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.SubTrigger {...props} />;
    }
    unreachable(renderer);
  });

  SubTrigger.displayName = `${Namespace}.SubTrigger`;

  export const SubContent: FC<AxoBaseMenu.MenuSubContentProps> = memo(props => {
    const renderer = useMenuBuilderContext();
    if (renderer === 'AxoDropdownMenu') {
      return <AxoDropdownMenu.SubContent {...props} />;
    }
    if (renderer === 'AxoContextMenu') {
      return <AxoContextMenu.SubContent {...props} />;
    }
    unreachable(renderer);
  });

  SubContent.displayName = `${Namespace}.SubContent`;
}
