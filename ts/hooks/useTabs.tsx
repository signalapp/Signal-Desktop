// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { KeyboardEvent } from 'react';
import React, { useState } from 'react';
import classNames from 'classnames';
import { assert } from '../util/assert';
import { getClassNamesFor } from '../util/getClassNamesFor';

type Tab = {
  id: string;
  label: string;
};

export type TabsOptionsType = {
  initialSelectedTab?: string;
  moduleClassName?: string;
  onTabChange?: (selectedTab: string) => unknown;
  tabs: Array<Tab>;
};

export function useTabs({
  initialSelectedTab,
  moduleClassName,
  onTabChange,
  tabs,
}: TabsOptionsType): {
  selectedTab: string;
  tabsHeaderElement: JSX.Element;
} {
  assert(tabs.length, 'Tabs needs more than 1 tab present');

  const getClassName = getClassNamesFor('Tabs', moduleClassName);

  const [selectedTab, setSelectedTab] = useState<string>(
    initialSelectedTab || tabs[0].id
  );

  const tabsHeaderElement = (
    <div className={getClassName('')}>
      {tabs.map(({ id, label }) => (
        <div
          className={classNames(
            getClassName('__tab'),
            selectedTab === id && getClassName('__tab--selected')
          )}
          key={id}
          onClick={() => {
            setSelectedTab(id);
            onTabChange?.(id);
          }}
          onKeyUp={(e: KeyboardEvent) => {
            if (e.target === e.currentTarget && e.keyCode === 13) {
              setSelectedTab(id);
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          role="tab"
          tabIndex={0}
        >
          {label}
        </div>
      ))}
    </div>
  );

  return {
    selectedTab,
    tabsHeaderElement,
  };
}
