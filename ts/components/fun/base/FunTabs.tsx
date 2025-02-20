// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Transition } from 'framer-motion';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import React, { useCallback } from 'react';
import type { Key } from 'react-aria';
import { useId } from 'react-aria';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import type { FunPickerTabKey } from '../FunConstants';

export type FunTabsProps = Readonly<{
  value: FunPickerTabKey;
  onChange: (newTab: FunPickerTabKey) => void;
  children: ReactNode;
}>;

export function FunTabs(props: FunTabsProps): JSX.Element {
  const { onChange } = props;

  const handleTabChange = useCallback(
    (key: Key) => {
      onChange(key as FunPickerTabKey);
    },
    [onChange]
  );

  return (
    <Tabs
      className="FunTabs__Tabs"
      selectedKey={props.value}
      onSelectionChange={handleTabChange}
    >
      {props.children}
    </Tabs>
  );
}

export type FunTabListProps = Readonly<{
  children: ReactNode;
}>;

export function FunTabList(props: FunTabListProps): JSX.Element {
  return <TabList className="FunTabs__TabList">{props.children}</TabList>;
}

const FunTabTransition: Transition = {
  type: 'spring',
  stiffness: 422,
  damping: 37.3,
  mass: 1,
};

export type FunTabProps = Readonly<{
  id: FunPickerTabKey;
  children: ReactNode;
}>;

export function FunPickerTab(props: FunTabProps): JSX.Element {
  return (
    <Tab className="FunTabs__Tab" id={props.id}>
      {({ isSelected }) => {
        return (
          <div className="FunTabs__TabButton">
            <div className="FunTabs__TabButtonText">{props.children}</div>
            {isSelected && (
              <motion.div
                className="FunTabs__TabButtonIndicator"
                layoutId="FunTabs__TabButtonIndicator"
                transition={FunTabTransition}
              />
            )}
          </div>
        );
      }}
    </Tab>
  );
}

export type FunTabPanelProps = Readonly<{
  id: FunPickerTabKey;
  children: ReactNode;
}>;

export function FunTabPanel(props: FunTabPanelProps): JSX.Element | null {
  const motionKey = useId();
  return (
    <TabPanel className="FunTabs__TabPanel" id={props.id} shouldForceMount>
      {({ isInert }) => {
        return (
          <AnimatePresence initial={false}>
            {isInert ? null : (
              <motion.div
                key={motionKey}
                className="FunTabs__TabPanelInner"
                initial={{ opacity: 0, zIndex: 1 }}
                animate={{ opacity: 1, zIndex: 1 }}
                exit={{ opacity: 1, zIndex: 0 }}
              >
                {props.children}
              </motion.div>
            )}
          </AnimatePresence>
        );
      }}
    </TabPanel>
  );
}
