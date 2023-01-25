// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import React from 'react';
import { getClassNamesFor } from '../util/getClassNamesFor';

export type Props = {
  title: string | JSX.Element;
  subtitle?: string | JSX.Element;
  leading?: string | JSX.Element;
  trailing?: string | JSX.Element;
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
};

const getClassName = getClassNamesFor('ListTile');

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
export const ListTile = React.forwardRef<HTMLButtonElement, Props>(
  function ListTile(
    {
      title,
      subtitle,
      leading,
      trailing,
      onClick,
      onContextMenu,
      clickable,
      subtitleMaxLines = 2,
      disabled = false,
      variant = 'item',
      rootElement = 'div',
    }: Props,
    ref
  ) {
    const isClickable = clickable ?? Boolean(onClick);

    const rootProps = {
      className: classNames(
        getClassName(''),
        isClickable && getClassName('--clickable'),
        getClassName(`--variant-${variant}`)
      ),
      onClick,
      'aria-disabled': disabled ? true : undefined,
      onContextMenu,
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
