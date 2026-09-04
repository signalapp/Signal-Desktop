// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, FC } from 'react';
import { memo, useMemo } from 'react';
import { Tabs } from 'radix-ui';
import { ExperimentalAxoBaseSegmentedControl } from './_internal/AxoBaseSegmentedControl.dom.tsx';
import {
  createStrictContext,
  useStrictContext,
} from './_internal/StrictContext.dom.tsx';
import { tw } from './tw.dom.tsx';

export namespace AxoTabs {
  /**
   * <AxoTabs.Root>
   * --------------------------------------------------------------------------
   */

  type RootContextType = Readonly<{
    value: string;
  }>;

  const RootContext = createStrictContext<RootContextType>('AxoTabs.Root');

  export type RootProps = Readonly<{
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { value } = props;

    const context = useMemo((): RootContextType => {
      return { value };
    }, [value]);

    return (
      <RootContext value={context}>
        <Tabs.Root
          value={props.value}
          onValueChange={props.onValueChange}
          className={tw('flex flex-col')}
        >
          {props.children}
        </Tabs.Root>
      </RootContext>
    );
  });

  Root.displayName = 'AxoTabs.Root';

  /**
   * <AxoTabs.List>
   * --------------------------------------------------------------------------
   */

  export type ListProps = Readonly<{
    children: ReactNode;
  }>;

  export const List: FC<ListProps> = memo(props => {
    const { value } = useStrictContext(RootContext);
    return (
      <Tabs.List asChild>
        <ExperimentalAxoBaseSegmentedControl.Root
          value={value}
          variant="no-track"
          width="full"
          itemWidth="equal"
        >
          {props.children}
        </ExperimentalAxoBaseSegmentedControl.Root>
      </Tabs.List>
    );
  });

  List.displayName = 'AxoTabs.List';

  /**
   * <AxoTabs.Trigger>
   * --------------------------------------------------------------------------
   */

  export type TriggerProps = Readonly<{
    value: string;
    children: ReactNode;
  }>;

  export const Trigger: FC<TriggerProps> = memo(props => {
    return (
      <Tabs.Trigger asChild value={props.value}>
        <ExperimentalAxoBaseSegmentedControl.Item value={props.value}>
          <ExperimentalAxoBaseSegmentedControl.ItemText>
            {props.children}
          </ExperimentalAxoBaseSegmentedControl.ItemText>
        </ExperimentalAxoBaseSegmentedControl.Item>
      </Tabs.Trigger>
    );
  });

  Trigger.displayName = 'AxoTabs.Trigger';

  /**
   * <AxoTabs.Content>
   * --------------------------------------------------------------------------
   */

  export type ContentProps = Readonly<{
    value: string;
    children: ReactNode;
  }>;

  export const Content: FC<ContentProps> = memo(props => {
    return <Tabs.Content value={props.value}>{props.children}</Tabs.Content>;
  });

  Content.displayName = 'AxoTabs.Content';
}
