// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import { forwardRef } from 'react';
import type { ForwardedRef, HTMLAttributes, ReactNode, JSX } from 'react';
import { tw } from '../../../axo/tw.dom.tsx';
import type { LocalizerType } from '../../../types/I18N.std.ts';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.tsx';
import type { ChatFolderPresetId } from './PreferencesChatFoldersPage.dom.tsx';

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

export type ItemContentProps = HTMLAttributes<HTMLSpanElement>;

export const ItemContent = forwardRef(function ItemContent(
  props: ItemContentProps,
  ref: ForwardedRef<HTMLSpanElement>
): JSX.Element {
  return (
    <span
      ref={ref}
      className="Preferences__ChatFolders__ChatSelection__ItemContent"
      {...props}
    />
  );
});

type ItemAvatarKind = 'Folder' | 'Add' | ChatFolderPresetId;

const ITEM_AVATAR_KINDS: Record<ItemAvatarKind, string> = {
  Folder: 'Preferences__ChatFolders__ChatSelection__ItemAvatar--Folder',
  Add: 'Preferences__ChatFolders__ChatSelection__ItemAvatar--Add',
  UnreadChats:
    'Preferences__ChatFolders__ChatSelection__ItemAvatar--UnreadChats',
  DirectChats:
    'Preferences__ChatFolders__ChatSelection__ItemAvatar--DirectChats',
  GroupChats: 'Preferences__ChatFolders__ChatSelection__ItemAvatar--GroupChats',
};

export function ItemAvatar(props: { kind: ItemAvatarKind }): JSX.Element {
  return (
    <span
      className={classNames(
        'Preferences__ChatFolders__ChatSelection__ItemAvatar',
        ITEM_AVATAR_KINDS[props.kind]
      )}
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
        'cursor-grab text-primary opacity-0 group-enabled:group-focus:opacity-100 group-enabled:group-active:opacity-100'
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
