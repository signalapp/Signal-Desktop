// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { CSSProperties, ReactNode, JSX, Ref } from 'react';
import classNames from 'classnames';
import { Popover } from 'radix-ui';
import { forwardExtraPropsForRadix } from '../../../axo/_internal/props.dom.tsx';
import { tw } from '../../../axo/tw.dom.tsx';
import { AxoBaseLayer } from '../../../axo/_internal/AxoBaseLayer.dom.tsx';
import { FunScrollerSection } from './FunScroller.dom.tsx';

/**
 * Grid Container
 */

export type FunGridContainerProps = Readonly<{
  totalSize: number;
  columnCount: number;
  cellWidth: number;
  cellHeight: number;
  children: ReactNode;
}>;

export function FunGridContainer(props: FunGridContainerProps): JSX.Element {
  return (
    <div
      className="FunGrid__Container"
      style={
        {
          '--fun-grid-container-total-size': `${props.totalSize}px`,
          '--fun-grid-container-column-count': props.columnCount,
          '--fun-grid-container-cell-width': `${props.cellWidth}px`,
          '--fun-grid-container-cell-height': `${props.cellHeight}px`,
        } as CSSProperties
      }
    >
      {props.children}
    </div>
  );
}

/**
 * Grid Section
 */

export type FunGridScrollerSectionProps = Readonly<{
  id: string;
  sectionOffset: number;
  sectionSize: number;
  children: ReactNode;
}>;

export function FunGridScrollerSection(
  props: FunGridScrollerSectionProps
): JSX.Element {
  return (
    <FunScrollerSection
      id={props.id}
      className="FunGrid__ScrollerSection"
      style={
        {
          '--fun-grid-scroller-section-offset': `${props.sectionOffset}px`,
          '--fun-grid-scroller-section-size': `${props.sectionSize}px`,
        } as CSSProperties
      }
    >
      {props.children}
    </FunScrollerSection>
  );
}

/**
 * Grid Header
 */

export type FunGridHeaderProps = Readonly<{
  id: string;
  headerOffset: number;
  headerSize: number;
  children: ReactNode;
}>;

export function FunGridHeader(props: FunGridHeaderProps): JSX.Element {
  return (
    <h3
      id={props.id}
      className="FunGrid__Header"
      style={
        {
          '--fun-grid-header-offset': `${props.headerOffset}px`,
          '--fun-grid-header-size': `${props.headerSize}px`,
        } as CSSProperties
      }
    >
      {props.children}
    </h3>
  );
}

/**
 * Grid Header Text
 */

export type FunGridHeaderTextProps = Readonly<{
  children: ReactNode;
}>;

export function FunGridHeaderText(props: FunGridHeaderTextProps): JSX.Element {
  return <span className="FunGrid__HeaderText">{props.children}</span>;
}

/**
 * Grid Header Button
 */

export type FunGridHeaderButtonProps = Readonly<{
  ref?: Ref<HTMLButtonElement>;
  label: string;
  children: ReactNode;
}>;

export function FunGridHeaderButton(
  props: FunGridHeaderButtonProps
): JSX.Element {
  const { ref, label, children, ...rest } = props;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className="FunGrid__HeaderButton"
      {...forwardExtraPropsForRadix(rest)}
    >
      {children}
    </button>
  );
}

/**
 * Grid Header Button
 */

export type FunGridHeaderIconProps = Readonly<{
  iconClassName: `FunGrid__HeaderIcon--${string}`;
}>;

export function FunGridHeaderIcon(props: FunGridHeaderIconProps): JSX.Element {
  return (
    <div className={classNames('FunGrid__HeaderIcon', props.iconClassName)} />
  );
}

/**
 * Grid Header Popover
 */

export type FunGridHeaderPopoverProps = Readonly<{
  children: ReactNode;
}>;

/** Must be rendered inside a `Popover.Root` */
export function FunGridHeaderPopover(
  props: FunGridHeaderPopoverProps
): JSX.Element {
  return (
    <Popover.Portal>
      <AxoBaseLayer>
        <Popover.Content
          className={tw('legacy-z-index-above-popup')}
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={12}
        >
          <div className="FunGrid__HeaderPopoverDialog">{props.children}</div>
        </Popover.Content>
      </AxoBaseLayer>
    </Popover.Portal>
  );
}

export type FunGridHeaderPopoverTextProps = Readonly<{
  children: ReactNode;
}>;

export function FunGridHeaderPopoverHeader(
  props: FunGridHeaderPopoverTextProps
): JSX.Element {
  return (
    <header className="FunGrid__HeaderPopoverHeader">{props.children}</header>
  );
}

/**
 * Grid Row Group
 */

export type FunGridRowGroupProps = Readonly<{
  'aria-labelledby': string;
  colCount: number;
  rowCount: number;
  rowGroupOffset: number;
  rowGroupSize: number;
  children: ReactNode;
}>;

export function FunGridRowGroup(props: FunGridRowGroupProps): JSX.Element {
  return (
    <div
      role="grid"
      aria-colcount={props.colCount}
      aria-rowcount={props.rowCount}
      aria-labelledby={props['aria-labelledby']}
      className="FunGrid__RowGroup"
      style={
        {
          '--fun-grid-row-group-offset': `${props.rowGroupOffset}px`,
          '--fun-grid-row-group-size': `${props.rowGroupSize}px`,
        } as CSSProperties
      }
    >
      {props.children}
    </div>
  );
}

/**
 * Grid Row
 */

export type FunGridRowProps = Readonly<{
  rowIndex: number;
  children: ReactNode;
}>;

export function FunGridRow(props: FunGridRowProps): JSX.Element {
  return (
    <div
      role="row"
      className="FunGrid__Row"
      aria-rowindex={props.rowIndex + 1}
      style={
        {
          '--fun-grid-row-index': props.rowIndex + 1,
        } as CSSProperties
      }
    >
      {props.children}
    </div>
  );
}

/**
 * Grid Cell
 */

export type FunGridCellProps = Readonly<{
  'data-key': string;
  rowIndex: number;
  colIndex: number;
  children: ReactNode;
}>;

export function FunGridCell(props: FunGridCellProps): JSX.Element {
  return (
    <div
      data-key={props['data-key']}
      role="gridcell"
      className="FunGrid__Cell"
      aria-rowindex={props.rowIndex + 1}
      aria-colindex={props.colIndex + 1}
    >
      {props.children}
    </div>
  );
}
