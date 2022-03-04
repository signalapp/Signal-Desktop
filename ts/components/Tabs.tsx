// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';

import type { TabsOptionsType } from '../hooks/useTabs';
import { useTabs } from '../hooks/useTabs';

type PropsType = {
  children: (renderProps: { selectedTab: string }) => ReactNode;
} & TabsOptionsType;

export const Tabs = ({
  children,
  initialSelectedTab,
  moduleClassName,
  onTabChange,
  tabs,
}: PropsType): JSX.Element => {
  const { selectedTab, tabsHeaderElement } = useTabs({
    initialSelectedTab,
    moduleClassName,
    onTabChange,
    tabs,
  });

  return (
    <>
      {tabsHeaderElement}
      {children({ selectedTab })}
    </>
  );
};
