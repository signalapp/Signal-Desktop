// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ReactNode } from 'react';
import type { ReadonlyDeep } from 'type-fest';

import type {
  GenericMediaItemType,
  ContactMediaItemType,
} from '../../../types/MediaItem.std.ts';
import type { LocalizerType } from '../../../types/Util.std.ts';
import { getName } from '../../../types/EmbeddedContact.std.ts';
import { AvatarColors } from '../../../types/Colors.std.ts';
import type { AttachmentStatusType } from '../../../hooks/useAttachmentStatus.std.ts';
import { Avatar, AvatarBlur, AvatarSize } from '../../Avatar.dom.tsx';
import { ListItem } from './ListItem.dom.tsx';

export type Props = {
  i18n: LocalizerType;
  mediaItem: ContactMediaItemType;
  authorTitle: string;
  onClick: (status: AttachmentStatusType['state']) => void;
  showMessage: () => void;
  renderContextMenu: (
    mediaItem: ReadonlyDeep<GenericMediaItemType>,
    children: ReactNode
  ) => React.JSX.Element;
};

export function ContactListItem({
  i18n,
  mediaItem,
  authorTitle,
  onClick,
  showMessage,
  renderContextMenu,
}: Props): React.JSX.Element {
  const { contact } = mediaItem;
  const { avatar } = contact;

  const name = getName(contact) ?? '';

  const thumbnail = (
    <Avatar
      avatarUrl={avatar?.avatar?.url}
      badge={undefined}
      blur={AvatarBlur.NoBlur}
      color={AvatarColors[0]}
      conversationType="direct"
      i18n={i18n}
      title={name}
      size={AvatarSize.THIRTY_SIX}
    />
  );

  const subtitle = i18n('icu:ContactListItem__subtitle');

  const title = [name];
  title.push(authorTitle);

  return (
    <ListItem
      i18n={i18n}
      mediaItem={mediaItem}
      thumbnail={thumbnail}
      title={title.join(' · ')}
      subtitle={subtitle}
      readyLabel={i18n('icu:startDownload')}
      onClick={onClick}
      showMessage={showMessage}
      renderContextMenu={renderContextMenu}
    />
  );
}
