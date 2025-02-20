// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import classNames from 'classnames';
import type { Transition } from 'framer-motion';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useId } from 'react-aria';
import type { Selection } from 'react-aria-components';
import { ListBox, ListBoxItem } from 'react-aria-components';
import {
  getScrollLeftDistance,
  getScrollRightDistance,
  useScrollObserver,
} from '../../../hooks/useSizeObserver';
import * as log from '../../../logging/log';
import * as Errors from '../../../types/errors';
import { strictAssert } from '../../../util/assert';
import { FunImage } from './FunImage';

/**
 * Sub Nav
 */

export type FunSubNavProps = Readonly<{
  children: ReactNode;
}>;

export function FunSubNav(props: FunSubNavProps): JSX.Element {
  return <div className="FunSubNav__Container">{props.children}</div>;
}

/**
 * Sub Nav Scroller
 */

export type FunSubNavScrollerProps = Readonly<{
  children: ReactNode;
}>;

export function FunSubNavScroller(props: FunSubNavScrollerProps): JSX.Element {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const scrollOpacityThreshold = 32;

  const [scrollLeftDistance, setScrollLeftDistance] = useState(0);
  const [scrollRightDistance, setScrollRightDistance] = useState(0);

  useScrollObserver(outerRef, innerRef, scroll => {
    setScrollLeftDistance(
      getScrollLeftDistance(scroll, scrollOpacityThreshold)
    );
    setScrollRightDistance(
      getScrollRightDistance(scroll, scrollOpacityThreshold)
    );
  });

  return (
    <div className="FunSubNav__Scroller">
      <div
        className="FunSubNav__ScrollerMask FunSubNav__ScrollerMask--Left"
        style={{ opacity: scrollLeftDistance / scrollOpacityThreshold }}
      />
      <div
        className="FunSubNav__ScrollerMask FunSubNav__ScrollerMask--Right"
        style={{ opacity: scrollRightDistance / scrollOpacityThreshold }}
      />
      <div
        // This is probably okay not to be focusable because the only thing it
        // contains has navigation controls.
        ref={outerRef}
        className="FunSubNav__ScrollerViewport"
      >
        <div ref={innerRef} className="FunSubNav__ScrollerViewportInner">
          {props.children}
        </div>
      </div>
    </div>
  );
}

/**
 * Sub Nav Buttons
 */

export type FunSubNavButtonsProps = Readonly<{
  children: ReactNode;
}>;

export function FunSubNavButtons(props: FunSubNavButtonsProps): JSX.Element {
  return <div className="FunSubNav__Buttons">{props.children}</div>;
}

/**
 * Sub Nav Button
 */

export type FunSubNavButtonProps = Readonly<{
  onClick: () => void;
  children: ReactNode;
}>;

export function FunSubNavButton(props: FunSubNavButtonProps): JSX.Element {
  return (
    <button type="button" className="FunSubNav__Button" onClick={props.onClick}>
      {props.children}
    </button>
  );
}

/**
 * Sub Nav ListBox
 */

export type FunSubNavListBoxProps<Key extends string> = Readonly<{
  'aria-label': string;
  selected: Key;
  onSelect: (key: Key) => void;
  children: ReactNode;
}>;

type FunSubNavListBoxContextValue = { id: string; selected: string };
const FunSubNavListBoxContext =
  createContext<FunSubNavListBoxContextValue | null>(null);

export function FunSubNavListBox<Key extends string>(
  props: FunSubNavListBoxProps<Key>
): JSX.Element {
  const { onSelect } = props;
  const id = useId();

  const contextValue = useMemo(() => {
    return { id, selected: props.selected };
  }, [id, props.selected]);

  const handleSelectionChange = useCallback(
    (keys: Selection) => {
      try {
        strictAssert(keys !== 'all', 'Expected single selection');
        strictAssert(keys.size === 1, 'Expected single selection');
        const [first] = keys.values();
        onSelect(first as Key);
      } catch (error) {
        // Note: react-aria gets into bad state if you don't catch this error.
        log.error(
          'Failed to handle selection change',
          Errors.toLogFormat(error)
        );
      }
    },
    [onSelect]
  );

  return (
    <FunSubNavListBoxContext.Provider value={contextValue}>
      <ListBox
        aria-label={props['aria-label']}
        className="FunSubNav__ListBox"
        selectionMode="single"
        selectionBehavior="replace"
        disallowEmptySelection
        selectedKeys={[props.selected]}
        orientation="horizontal"
        onSelectionChange={handleSelectionChange}
      >
        {props.children}
      </ListBox>
    </FunSubNavListBoxContext.Provider>
  );
}

/**
 * Sub Nav ListBoxItem
 */

export type FunSubNavListBoxItemProps = Readonly<{
  id: string;
  label: string;
  children: ReactNode;
}>;

const FunSubNavListBoxItemTransition: Transition = {
  type: 'spring',
  stiffness: 632,
  damping: 43.8,
  mass: 1,
};

function FunSubNavListBoxItemButton(props: {
  isSelected: boolean;
  children: ReactNode;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    strictAssert(ref.current, 'Expected ref to be defined');
    if (props.isSelected) {
      ref.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'nearest',
      });
    }
  }, [props.isSelected]);

  return (
    <div ref={ref} className="FunSubNav__ListBoxItem__Button">
      {props.children}
    </div>
  );
}

export function FunSubNavListBoxItem(
  props: FunSubNavListBoxItemProps
): JSX.Element {
  const context = useContext(FunSubNavListBoxContext);
  strictAssert(context, 'Must be wrapped with <FunSubNavListBox>');
  return (
    <ListBoxItem
      id={props.id}
      className="FunSubNav__ListBoxItem"
      aria-label={props.label}
      textValue={props.label}
    >
      {({ isSelected }) => {
        return (
          <FunSubNavListBoxItemButton isSelected={isSelected}>
            <span className="FunSubNav__ListBoxItem__ButtonIcon">
              {props.children}
            </span>
            {isSelected && (
              <motion.div
                className="FunSubNav__ListBoxItem__ButtonIndicator"
                layoutId={`FunSubNav__ListBoxItem__ButtonIndicator--${context.id}`}
                layoutDependency={context.selected}
                transition={FunSubNavListBoxItemTransition}
              />
            )}
          </FunSubNavListBoxItemButton>
        );
      }}
    </ListBoxItem>
  );
}

/**
 * Sub Nav Icon
 */

export type FunSubNavIconProps = Readonly<{
  iconClassName: `FunSubNav__Icon--${string}`;
}>;

export function FunSubNavIcon(props: FunSubNavIconProps): JSX.Element {
  return <div className={classNames('FunSubNav__Icon', props.iconClassName)} />;
}

/**
 * Sub Nav Image
 */

export type FunSubNavImageProps = Readonly<{
  src: string;
}>;

export function FunSubNavImage(props: FunSubNavImageProps): JSX.Element {
  return (
    <FunImage
      role="presentation"
      className="FunSubNav__Image"
      src={props.src}
      width={26}
      height={26}
      // presentational
      alt=""
    />
  );
}
