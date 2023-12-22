// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';
import type { ReactNode } from 'react';
import TitleBar from '@indutny/frameless-titlebar';
import type { MenuItem } from '@indutny/frameless-titlebar';
import type { MenuItemConstructorOptions } from 'electron';
import classNames from 'classnames';

import { createTemplate } from '../../app/menu';
import { ThemeType } from '../types/Util';
import type { LocalizerType } from '../types/I18N';
import type { MenuOptionsType, MenuActionType } from '../types/menu';
import { useIsWindowActive } from '../hooks/useIsWindowActive';

export type MenuPropsType = Readonly<{
  hasMenu: true;
  i18n: LocalizerType;
  menuOptions: MenuOptionsType;
  executeMenuAction: (action: MenuActionType) => void;
}>;

export type ExecuteMenuRoleType = (
  role: MenuItemConstructorOptions['role']
) => void;

export type PropsType = Readonly<{
  theme: ThemeType;
  isMaximized?: boolean;
  isFullScreen?: boolean;
  hasCustomTitleBar: boolean;
  hideMenuBar?: boolean;
  executeMenuRole: ExecuteMenuRoleType;
  titleBarDoubleClick?: () => void;
  children: ReactNode;
}> &
  (MenuPropsType | { hasMenu?: false });

const TITLEBAR_HEIGHT = 28;

// Windows only
const ROLE_TO_ACCELERATOR = new Map<
  MenuItemConstructorOptions['role'],
  string
>();
ROLE_TO_ACCELERATOR.set('undo', 'CmdOrCtrl+Z');
ROLE_TO_ACCELERATOR.set('redo', 'CmdOrCtrl+Y');
ROLE_TO_ACCELERATOR.set('cut', 'CmdOrCtrl+X');
ROLE_TO_ACCELERATOR.set('copy', 'CmdOrCtrl+C');
ROLE_TO_ACCELERATOR.set('paste', 'CmdOrCtrl+V');
ROLE_TO_ACCELERATOR.set('pasteAndMatchStyle', 'CmdOrCtrl+Shift+V');
ROLE_TO_ACCELERATOR.set('selectAll', 'CmdOrCtrl+A');
ROLE_TO_ACCELERATOR.set('resetZoom', 'CmdOrCtrl+0');
ROLE_TO_ACCELERATOR.set('zoomIn', 'CmdOrCtrl+=');
ROLE_TO_ACCELERATOR.set('zoomOut', 'CmdOrCtrl+-');
ROLE_TO_ACCELERATOR.set('togglefullscreen', 'F11');
ROLE_TO_ACCELERATOR.set('toggleDevTools', 'CmdOrCtrl+Shift+I');
ROLE_TO_ACCELERATOR.set('minimize', 'CmdOrCtrl+M');

function convertMenu(
  menuList: ReadonlyArray<MenuItemConstructorOptions>,
  executeMenuRole: (role: MenuItemConstructorOptions['role']) => void,
  i18n: LocalizerType
): Array<MenuItem> {
  return menuList.map(item => {
    const {
      type,
      label,
      accelerator: originalAccelerator,
      click: originalClick,
      submenu: originalSubmenu,
      role,
    } = item;
    let submenu: Array<MenuItem> | undefined;

    if (Array.isArray(originalSubmenu)) {
      submenu = convertMenu(originalSubmenu, executeMenuRole, i18n);
    } else if (originalSubmenu) {
      throw new Error('Non-array submenu is not supported');
    }

    let click: (() => unknown) | undefined;
    if (originalClick) {
      if (role) {
        throw new Error(`Menu item: ${label} has both click and role`);
      }

      // We don't use arguments in app/menu.ts
      click = originalClick as () => unknown;
    } else if (role) {
      click = () => executeMenuRole(role);
    }

    let accelerator: string | undefined;
    if (originalAccelerator) {
      accelerator = originalAccelerator.toString();
    } else if (role) {
      accelerator = ROLE_TO_ACCELERATOR.get(role);
    }

    // Custom titlebar is visible only on Windows and this string is used only
    // in UI. Actual accelerator interception is handled by Electron through
    // `app/main.ts`.
    accelerator = accelerator?.replace(
      /CommandOrControl|CmdOrCtrl/g,
      i18n('icu:Keyboard--Key--ctrl')
    );
    accelerator = accelerator?.replace(
      /Shift/g,
      i18n('icu:Keyboard--Key--shift')
    );

    return {
      type,
      label,
      accelerator,
      click,
      submenu,
    };
  });
}

export function TitleBarContainer(props: PropsType): JSX.Element {
  const {
    theme,
    isMaximized,
    isFullScreen,
    hasCustomTitleBar,
    hideMenuBar,
    executeMenuRole,
    titleBarDoubleClick,
    children,
    hasMenu,
  } = props;

  const isWindowActive = useIsWindowActive();

  const titleBarTheme = useMemo(
    () => ({
      bar: {
        // See stylesheets/_global.scss
        height: TITLEBAR_HEIGHT,
        palette:
          theme === ThemeType.light ? ('light' as const) : ('dark' as const),
        ...(theme === ThemeType.dark
          ? {
              // $color-gray-05
              color: '#e9e9e9',
              // $color-gray-80
              background: '#2e2e2e',
              // $color-gray-95
              borderBottom: '1px solid #121212',
              //
              button: {
                active: {
                  // $color-gray-05
                  color: '#e9e9e9',
                  // $color-gray-75
                  background: '#3b3b3b',
                },
                hover: {
                  // $color-gray-05
                  color: '#e9e9e9',
                  // $color-gray-75
                  background: '#3b3b3b',
                },
              },
            }
          : {}),
      },

      // Hide overlay
      menu: {
        overlay: {
          opacity: 0,
        },
        autoHide: hideMenuBar,

        ...(theme === ThemeType.dark
          ? {
              separator: {
                // $color-gray-95
                color: '#5e5e5e',
              },
              accelerator: {
                // $color-gray-25
                color: '#b9b9b9',
              },
              list: {
                // $color-gray-75
                background: '#3b3b3b',
                boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.12)',
                borderRadius: '0px 0px 6px 6px',
              },
            }
          : {
              list: {
                boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.12)',
                borderRadius: '0px 0px 6px 6px',
              },
            }),
      },

      // Zoom support
      enableOverflow: false,
      scalingFunction(value: string) {
        return `calc(${value} * var(--zoom-factor))`;
      },
    }),
    [theme, hideMenuBar]
  );

  if (!hasCustomTitleBar) {
    return <>{children}</>;
  }

  let maybeMenu: Array<MenuItem> | undefined;
  if (hasMenu) {
    const { i18n, menuOptions, executeMenuAction } = props;

    const menuTemplate = createTemplate(
      {
        ...menuOptions,

        // actions
        forceUpdate: () => executeMenuAction('forceUpdate'),
        openArtCreator: () => executeMenuAction('openArtCreator'),
        openContactUs: () => executeMenuAction('openContactUs'),
        openForums: () => executeMenuAction('openForums'),
        openJoinTheBeta: () => executeMenuAction('openJoinTheBeta'),
        openReleaseNotes: () => executeMenuAction('openReleaseNotes'),
        openSupportPage: () => executeMenuAction('openSupportPage'),
        setupAsNewDevice: () => executeMenuAction('setupAsNewDevice'),
        setupAsStandalone: () => executeMenuAction('setupAsStandalone'),
        showAbout: () => executeMenuAction('showAbout'),
        showDebugLog: () => executeMenuAction('showDebugLog'),
        showKeyboardShortcuts: () => executeMenuAction('showKeyboardShortcuts'),
        showSettings: () => executeMenuAction('showSettings'),
        showWindow: () => executeMenuAction('showWindow'),
        zoomIn: () => executeMenuAction('zoomIn'),
        zoomOut: () => executeMenuAction('zoomOut'),
        zoomReset: () => executeMenuAction('zoomReset'),
      },
      i18n
    );

    maybeMenu = convertMenu(menuTemplate, executeMenuRole, i18n);
  }

  return (
    <div
      className={classNames(
        'TitleBarContainer',
        isWindowActive ? 'TitleBarContainer--active' : null,
        isFullScreen ? 'TitleBarContainer--fullscreen' : null
      )}
    >
      <div className="TitleBarContainer__padding" />
      <div className="TitleBarContainer__content">{children}</div>

      <TitleBar
        className="TitleBarContainer__title"
        platform="win32"
        iconSrc="images/titlebar_icon.svg"
        theme={titleBarTheme}
        maximized={isMaximized}
        menu={maybeMenu}
        onDoubleClick={titleBarDoubleClick}
        hideControls
      />
    </div>
  );
}
