// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import React from 'react';
import type { ReactNode } from 'react';
import { tw } from '../../../axo/tw.js';
import type { LocalizerType } from '../../../types/I18N.js';
import { AxoSymbol } from '../../../axo/AxoSymbol.js';
import type { ChatFolderPresetId } from './PreferencesChatFoldersPage.js';

export const itemClassName = classNames(
  tw('group'),
  'Preferences__ChatFolders__ChatSelection__Item'
);
export const itemListItemClassName =
  'Preferences__ChatFolders__ChatSelection__Item--ListItem';
export const itemClickableClassName =
  'Preferences__ChatFolders__ChatSelection__Item--Clickable';
export const itemButtonClassName =
  'Preferences__ChatFolders__ChatSelection__Item--Button';

export function ItemContent(props: { children: ReactNode }): JSX.Element {
  return (
    <span className="Preferences__ChatFolders__ChatSelection__ItemContent">
      {props.children}
    </span>
  );
}

export function ItemAvatar(props: {
  kind: 'Folder' | 'Add' | ChatFolderPresetId;
}): JSX.Element {
  return (
    <span
      className={`Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--${props.kind}`}
    />
  );
}

export function ItemBody(props: { children: ReactNode }): JSX.Element {
  return (
    <span className="Preferences__ChatFolders__ChatSelection__ItemBody">
      {props.children}
    </span>
  );
}

export function ItemTitle(props: { children: ReactNode }): JSX.Element {
  return (
    <span className="Preferences__ChatFolders__ChatSelection__ItemTitle">
      {props.children}
    </span>
  );
}

export function ItemDescription(props: { children: ReactNode }): JSX.Element {
  return (
    <span className="Preferences__ChatFolders__ChatSelection__ItemDescription">
      {props.children}
    </span>
  );
}

export function ItemDragHandle(props: { i18n: LocalizerType }): JSX.Element {
  const { i18n } = props;
  return (
    <span
      className={tw(
        'cursor-grab text-label-primary opacity-0 group-hovered:opacity-100 group-focused:opacity-100'
      )}
    >
      <AxoSymbol.Icon
        symbol="draghandle-alt"
        size={24}
        label={i18n(
          'icu:Preferences__ChatFoldersPage__FoldersSection__DragHandle__Label'
        )}
      />
    </span>
  );
}
