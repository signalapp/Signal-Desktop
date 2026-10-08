// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { KeyboardEvent, JSX } from 'react';
import { useState } from 'react';
import classNames from 'classnames';
import { assertDev } from '../util/assert.std.ts';

type Tab = {
  id: string;
  label: string;
};

export type BaseTabsOptionsType = {
  /** @deprecated */
  className?: string;
  tabs: Array<Tab>;
};

export type ControlledTabsOptionsType = BaseTabsOptionsType & {
  selectedTab: string;
  onTabChange: (selectedTab: string) => unknown;
};

export type UncontrolledTabsOptionsType = BaseTabsOptionsType & {
  initialSelectedTab?: string;
  onTabChange?: (selectedTab: string) => unknown;
};

export type TabsOptionsType =
  | ControlledTabsOptionsType
  | UncontrolledTabsOptionsType;

type TabsProps = {
  selectedTab: string;
  tabsHeaderElement: JSX.Element;
};

export function useTabs(options: TabsOptionsType): TabsProps {
  assertDev(options.tabs.length, 'Tabs needs more than 1 tab present');

  let selectedTab: string;
  let onChange: (selectedTab: string) => void;

  if ('selectedTab' in options) {
    selectedTab = options.selectedTab;
    onChange = options.onTabChange;
  } else {
    // useTabs should always be either controlled or uncontrolled.
    // This is enforced by the type system.
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    const [tabState, setTabState] = useState<string>(
      // oxlint-disable-next-line typescript/no-non-null-assertion
      options.initialSelectedTab || options.tabs[0]!.id
    );

    selectedTab = tabState;
    onChange = (newTab: string) => {
      setTabState(newTab);
      options.onTabChange?.(newTab);
    };
  }

  const tabsHeaderElement = (
    <div className={classNames('Tabs', options.className)} data-supertab>
      {options.tabs.map(({ id, label }) => (
        <div
          aria-selected={selectedTab === id}
          className={classNames(
            'Tabs__tab',
            selectedTab === id && 'Tabs__tab--selected'
          )}
          key={id}
          onClick={() => {
            onChange(id);
          }}
          onKeyUp={(e: KeyboardEvent) => {
            if (e.target === e.currentTarget && e.keyCode === 13) {
              onChange(id);
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
