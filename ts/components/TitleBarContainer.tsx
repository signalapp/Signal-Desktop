// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ReactNode } from 'react';
import TitleBar from '@indutny/frameless-titlebar';
import type { MenuItem } from '@indutny/frameless-titlebar';
import type { MenuItemConstructorOptions } from 'electron';

import { createTemplate } from '../../app/menu';
import { ThemeType } from '../types/Util';
import type { LocaleMessagesType } from '../types/I18N';
import type { MenuOptionsType, MenuActionType } from '../types/menu';

export type MenuPropsType = Readonly<{
  hasMenu: true;
  localeMessages: LocaleMessagesType;
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
  isWindows11: boolean;
  platform: string;
  executeMenuRole: ExecuteMenuRoleType;
  titleBarDoubleClick?: () => void;
  children: ReactNode;

  // Needs to be overriden in sticker-creator
  iconSrc?: string;
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
  executeMenuRole: (role: MenuItemConstructorOptions['role']) => void
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
      submenu = convertMenu(originalSubmenu, executeMenuRole);
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

    return {
      type,
      label,
      accelerator,
      click,
      submenu,
    };
  });
}

export const TitleBarContainer = (props: PropsType): JSX.Element => {
  const {
    theme,
    isMaximized,
    isFullScreen,
    isWindows11,
    executeMenuRole,
    titleBarDoubleClick,
    children,
    hasMenu,
    platform,
    iconSrc = 'images/icon_32.png',
  } = props;

  if (platform !== 'win32' || isFullScreen) {
    return <>{children}</>;
  }

  let maybeMenu: Array<MenuItem> | undefined;
  if (hasMenu) {
    const { localeMessages, menuOptions, executeMenuAction } = props;

    const menuTemplate = createTemplate(
      {
        ...menuOptions,

        // actions
        forceUpdate: () => executeMenuAction('forceUpdate'),
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
        showStickerCreator: () => executeMenuAction('showStickerCreator'),
        showWindow: () => executeMenuAction('showWindow'),
      },
      localeMessages
    );

    maybeMenu = convertMenu(menuTemplate, executeMenuRole);
  }

  const titleBarTheme = {
    bar: {
      // See stylesheets/_global.scss
      height: isWindows11 ? TITLEBAR_HEIGHT + 1 : TITLEBAR_HEIGHT,
      palette:
        theme === ThemeType.light ? ('light' as const) : ('dark' as const),
    },

    // Hide overlay
    menu: {
      overlay: {
        opacity: 0,
      },
    },
  };

  return (
    <div className="TitleBarContainer">
      <TitleBar
        className="TitleBarContainer__title"
        platform={platform}
        iconSrc={iconSrc}
        theme={titleBarTheme}
        maximized={isMaximized}
        menu={maybeMenu}
        onDoubleClick={titleBarDoubleClick}
        hideControls
      />

      <div className="TitleBarContainer__content">{children}</div>
    </div>
  );
};
