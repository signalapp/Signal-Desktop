// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { KeyboardEventHandler, MouseEventHandler, ReactNode } from 'react';
import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { useMove } from 'react-aria';
import { NavTabsToggle } from './NavTabs';
import type { LocalizerType } from '../types/I18N';
import {
  MAX_WIDTH,
  MIN_FULL_WIDTH,
  MIN_WIDTH,
  getWidthFromPreferredWidth,
} from '../util/leftPaneWidth';
import { WidthBreakpoint, getNavSidebarWidthBreakpoint } from './_util';
import type { UnreadStats } from '../util/countUnreadStats';

type NavSidebarActionButtonProps = {
  icon: ReactNode;
  label: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
};

export const NavSidebarActionButton = React.forwardRef<
  HTMLButtonElement,
  NavSidebarActionButtonProps
>(function NavSidebarActionButtonInner(
  { icon, label, onClick, onKeyDown },
  ref
): JSX.Element {
  return (
    <button
      ref={ref}
      type="button"
      className="NavSidebar__ActionButton"
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {icon}
      <span className="NavSidebar__ActionButtonLabel">{label}</span>
    </button>
  );
});

export type NavSidebarProps = Readonly<{
  actions?: ReactNode;
  children: ReactNode;
  i18n: LocalizerType;
  hasFailedStorySends: boolean;
  hasPendingUpdate: boolean;
  hideHeader?: boolean;
  navTabsCollapsed: boolean;
  onBack?: (() => void) | null;
  onToggleNavTabsCollapse(navTabsCollapsed: boolean): void;
  preferredLeftPaneWidth: number;
  requiresFullWidth: boolean;
  savePreferredLeftPaneWidth: (width: number) => void;
  title: string;
  otherTabsUnreadStats: UnreadStats;
  renderToastManager: (_: {
    containerWidthBreakpoint: WidthBreakpoint;
  }) => JSX.Element;
}>;

enum DragState {
  INITIAL,
  DRAGGING,
  DRAGEND,
}

export function NavSidebar({
  actions,
  children,
  hideHeader,
  i18n,
  hasFailedStorySends,
  hasPendingUpdate,
  navTabsCollapsed,
  onBack,
  onToggleNavTabsCollapse,
  preferredLeftPaneWidth,
  requiresFullWidth,
  savePreferredLeftPaneWidth,
  title,
  otherTabsUnreadStats,
  renderToastManager,
}: NavSidebarProps): JSX.Element {
  const isRTL = i18n.getLocaleDirection() === 'rtl';
  const [dragState, setDragState] = useState(DragState.INITIAL);

  const [preferredWidth, setPreferredWidth] = useState(() => {
    return getWidthFromPreferredWidth(preferredLeftPaneWidth, {
      requiresFullWidth,
    });
  });

  const width = getWidthFromPreferredWidth(preferredWidth, {
    requiresFullWidth,
  });

  const widthBreakpoint = getNavSidebarWidthBreakpoint(width);

  // `useMove` gives us keyboard and mouse dragging support.
  const { moveProps } = useMove({
    onMoveStart() {
      setDragState(DragState.DRAGGING);
    },
    onMoveEnd() {
      setDragState(DragState.DRAGEND);
    },
    onMove(event) {
      const { shiftKey, pointerType } = event;
      const deltaX = isRTL ? -event.deltaX : event.deltaX;
      const isKeyboard = pointerType === 'keyboard';
      const increment = isKeyboard && shiftKey ? 10 : 1;
      setPreferredWidth(prevWidth => {
        // Jump minimize for keyboard users
        if (isKeyboard && prevWidth === MIN_FULL_WIDTH && deltaX < 0) {
          return MIN_WIDTH;
        }
        // Jump maximize for keyboard users
        if (isKeyboard && prevWidth === MIN_WIDTH && deltaX > 0) {
          return MIN_FULL_WIDTH;
        }
        return prevWidth + deltaX * increment;
      });
    },
  });

  useEffect(() => {
    // Save the preferred width when the drag ends. We can't do this in onMoveEnd
    // because the width is not updated yet.
    if (dragState === DragState.DRAGEND) {
      setPreferredWidth(width);
      savePreferredLeftPaneWidth(width);
      setDragState(DragState.INITIAL);
    }
  }, [
    dragState,
    preferredLeftPaneWidth,
    preferredWidth,
    savePreferredLeftPaneWidth,
    width,
  ]);

  useEffect(() => {
    // This effect helps keep the pointer `col-resize` even when you drag past the handle.
    const className = 'NavSidebar__document--draggingHandle';
    if (dragState === DragState.DRAGGING) {
      document.body.classList.add(className);
      return () => {
        document.body.classList.remove(className);
      };
    }
    return undefined;
  }, [dragState]);

  return (
    <div
      role="navigation"
      className={classNames('NavSidebar', {
        'NavSidebar--narrow': widthBreakpoint === WidthBreakpoint.Narrow,
      })}
      style={{ width }}
    >
      {!hideHeader && (
        <div className="NavSidebar__Header">
          {onBack == null && navTabsCollapsed && (
            <NavTabsToggle
              i18n={i18n}
              navTabsCollapsed={navTabsCollapsed}
              onToggleNavTabsCollapse={onToggleNavTabsCollapse}
              hasFailedStorySends={hasFailedStorySends}
              hasPendingUpdate={hasPendingUpdate}
              otherTabsUnreadStats={otherTabsUnreadStats}
            />
          )}
          <div
            className={classNames('NavSidebar__HeaderContent', {
              'NavSidebar__HeaderContent--navTabsCollapsed': navTabsCollapsed,
              'NavSidebar__HeaderContent--withBackButton': onBack != null,
            })}
          >
            {onBack != null && (
              <button
                type="button"
                role="link"
                onClick={onBack}
                className="NavSidebar__BackButton"
              >
                <span className="NavSidebar__BackButtonLabel">
                  {i18n('icu:NavSidebar__BackButtonLabel')}
                </span>
              </button>
            )}
            <h1
              className={classNames('NavSidebar__HeaderTitle', {
                'NavSidebar__HeaderTitle--withBackButton': onBack != null,
              })}
              aria-live="assertive"
            >
              {title}
            </h1>
            {actions && (
              <div className="NavSidebar__HeaderActions">{actions}</div>
            )}
          </div>
        </div>
      )}

      <div className="NavSidebar__Content">{children}</div>

      <div
        className={classNames('NavSidebar__DragHandle', {
          'NavSidebar__DragHandle--dragging': dragState === DragState.DRAGGING,
        })}
        role="separator"
        aria-orientation="vertical"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={preferredLeftPaneWidth}
        aria-valuenow={MAX_WIDTH}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- See https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/separator_role#focusable_separator
        tabIndex={0}
        {...moveProps}
      />

      {renderToastManager({ containerWidthBreakpoint: widthBreakpoint })}
    </div>
  );
}

export function NavSidebarSearchHeader({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return <div className="NavSidebarSearchHeader">{children}</div>;
}

export function NavSidebarEmpty({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}): JSX.Element {
  return (
    <div className="NavSidebarEmpty">
      <div className="NavSidebarEmpty__inner">
        <h3 className="NavSidebarEmpty__title">{title}</h3>
        <p className="NavSidebarEmpty__subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
