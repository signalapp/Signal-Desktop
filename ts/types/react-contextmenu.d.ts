// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'react-contextmenu' {
  import React from 'react';

  export interface ContextMenuProps {
    id: string;
    rtl?: boolean;
    children?: React.ReactNode;
  }

  export interface MenuItemProps {
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
    disabled?: boolean;
    divider?: boolean;
    children?: React.ReactNode;
  }

  export interface SubMenuProps {
    title: React.ReactNode;
    hoverDelay?: number;
    rtl?: boolean;
    children?: React.ReactNode;
  }

  export interface ContextMenuTriggerProps {
    id: string;
    children?: React.ReactNode;
  }

  export class ContextMenu extends React.Component<ContextMenuProps> {}
  export class MenuItem extends React.Component<MenuItemProps> {}
  export class SubMenu extends React.Component<SubMenuProps> {}
  export class ContextMenuTrigger extends React.Component<ContextMenuTriggerProps> {
    handleContextClick(event: React.MouseEvent<HTMLDivElement> | MouseEvent): void;
  }
}
