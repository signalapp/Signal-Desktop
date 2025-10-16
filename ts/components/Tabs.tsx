// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';

import type { TabsOptionsType } from '../hooks/useTabs.dom.js';
import { useTabs } from '../hooks/useTabs.dom.js';

type PropsType = {
  children: (renderProps: { selectedTab: string }) => ReactNode;
} & TabsOptionsType;

export function Tabs(props: PropsType): JSX.Element {
  const { children, ...options } = props;
  const { selectedTab, tabsHeaderElement } = useTabs(options);

  return (
    <>
      {tabsHeaderElement}
      {children({ selectedTab })}
    </>
  );
}
