// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import React, { useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import { getClassNamesFor } from '../util/getClassNamesFor';
import { CircleCheckbox } from './CircleCheckbox';

export type Props = {
  title: string | JSX.Element;
  subtitle?: string | JSX.Element;
  leading?: string | JSX.Element;
  trailing?: string | JSX.Element;
  moduleClassName?: string;
  onClick?: () => void;
  onContextMenu?: (ev: React.MouseEvent<Element, MouseEvent>) => void;
  // show hover highlight,
  // defaults to true if onClick is defined
  clickable?: boolean;
  // defaults to 2
  subtitleMaxLines?: 1 | 2 | 3;
  // defaults to false
  disabled?: boolean;
  // defaults to item
  variant?: 'item' | 'panelrow';
  // defaults to div
  rootElement?: 'div' | 'button';
  testId?: string;
  'aria-selected'?: boolean;
};

/**
 * A single row that typically contains some text and leading/trailing icons/widgets
 *
 * Mostly intended for items on a list: conversations, contacts, groups, options, etc
 * where all items have the same height.
 *
 * If wrapping with <label> and using a checkbox, don't use 'button' as the rootElement
 * as it conflicts with click-label-to-check behavior.
 *
 * Anatomy:
 * - leading (optional): widget on the left, typically an avatar
 * - title: single-line of main text
 * - subtitle (optional): 1-3 lines of subtitle text
 * - trailing (optional): widget on the right, typically a icon-button, checkbox, etc
 *
 * Behavior:
 * - highlights on hover if clickable
 * - clamps title to 1 line
 * - clamps subtitle to 1-3 lines
 * - no margins
 *
 * Variants:
 * - item: default, intended for selection lists (especially in modals)
 * - panelrow: more horizontal padding, intended for information rows (usually not in
 *   modals) that tend to occupy more horizontal space
 */
export function ListTile(
  params: Props & React.RefAttributes<HTMLButtonElement>
): JSX.Element {
  // forwardRef makes it impossible to add extra static fields to the function type so
  // we have to create this inner implementation that can be wrapped with a non-arrow
  // function. A bit weird, but looks fine at call-site.
  return <ListTileImpl {...params} />;
}

const ListTileImpl = React.forwardRef<HTMLButtonElement, Props>(
  function ListTileImpl(
    {
      title,
      subtitle,
      leading,
      trailing,
      moduleClassName,
      onClick,
      onContextMenu,
      clickable,
      subtitleMaxLines = 2,
      disabled = false,
      variant = 'item',
      rootElement = 'div',
      testId,
      ...ariaProps
    }: Props,
    ref
  ) {
    const isClickable = clickable ?? Boolean(onClick);

    const getClassName = getClassNamesFor('ListTile', moduleClassName);

    const rootProps = {
      className: classNames(
        getClassName(''),
        isClickable && getClassName('--clickable'),
        getClassName(`--variant-${variant}`)
      ),
      onClick,
      'aria-disabled': disabled ? true : undefined,
      onContextMenu,
      'data-testid': testId,
      ...ariaProps,
    };

    const contents = (
      <>
        {leading && <div className="ListTile__leading">{leading}</div>}
        <div className="ListTile__content">
          <div className="ListTile__title">{title}</div>
          {subtitle && (
            <div
              className={classNames(
                'ListTile__subtitle',
                `ListTile__subtitle--max-lines-${subtitleMaxLines}`
              )}
            >
              {subtitle}
            </div>
          )}
        </div>
        {trailing && <div className="ListTile__trailing">{trailing}</div>}
      </>
    );

    return rootElement === 'button' ? (
      <button type="button" {...rootProps} ref={ref}>
        {contents}
      </button>
    ) : (
      <div {...rootProps}>{contents}</div>
    );
  }
);

// although these heights are not required for ListTile (which sizes itself based on
// content), they are useful as constants for ListView.calculateRowHeight

/** Effective ListTile height for an avatar (leading) size 36 */
ListTile.heightFull = 64;

/** Effective ListTile height for an avatar (leading) size 48 */
ListTile.heightCompact = 52;

/**
 * ListTile with a trailing checkbox.
 *
 * It also wraps the ListTile with a <label> to get typical click-label-to-check behavior
 *
 * Same API except for:
 * - no "trailing" param since it is populated by the checkbox
 * - isChecked
 */
ListTile.checkbox = (
  props: Omit<Props, 'trailing'> & { isChecked: boolean }
) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const htmlId: string = useMemo(() => uuid(), []);

  const { onClick, disabled, isChecked, ...otherProps } = props;
  return (
    <label
      htmlFor={htmlId}
      // `onClick` is will double-fire if we're enabled. We want it to fire when we're
      //   disabled so we can show any "can't add contact" modals, etc. This won't
      //   work for keyboard users, though, because labels are not tabbable.
      {...(disabled ? { onClick } : {})}
    >
      <ListTile
        {...otherProps}
        disabled={disabled}
        trailing={
          <CircleCheckbox
            id={htmlId}
            checked={isChecked}
            onChange={onClick}
            disabled={disabled}
          />
        }
      />
    </label>
  );
};
