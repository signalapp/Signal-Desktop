// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React, { useMemo, useState } from 'react';

import { HEADER_CONTACT_NAME_CLASS_NAME } from './BaseConversationListItem.dom.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { BadgeType } from '../../badges/types.std.js';
import type { LocalizerType, ThemeType } from '../../types/Util.std.js';
import { ContactName } from '../conversation/ContactName.dom.js';
import { About } from '../conversation/About.dom.js';
import { ListTile } from '../ListTile.dom.js';
import { Avatar, AvatarSize } from '../Avatar.dom.js';
import { ContextMenu } from '../ContextMenu.dom.js';
import { I18n } from '../I18n.dom.js';
import { ConfirmationDialog } from '../ConfirmationDialog.dom.js';
import { isSignalConversation } from '../../util/isSignalConversation.dom.js';
import { isInSystemContacts } from '../../util/isInSystemContacts.std.js';
import { InContactsIcon } from '../InContactsIcon.dom.js';

export type ContactListItemConversationType = Pick<
  ConversationType,
  | 'about'
  | 'acceptedMessageRequest'
  | 'avatarUrl'
  | 'badges'
  | 'color'
  | 'groupId'
  | 'id'
  | 'name'
  | 'isMe'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'systemGivenName'
  | 'systemFamilyName'
  | 'title'
  | 'type'
  | 'username'
  | 'e164'
  | 'serviceId'
>;

type PropsDataType = ContactListItemConversationType & {
  badge: undefined | BadgeType;
};

type PropsHousekeepingType = {
  i18n: LocalizerType;
  onClick?: (id: string) => void;
  onAudioCall?: (id: string) => void;
  onVideoCall?: (id: string) => void;
  onRemove?: (id: string) => void;
  onBlock?: (id: string) => void;
  hasContextMenu: boolean;
  theme: ThemeType;
};

type PropsType = PropsDataType & PropsHousekeepingType;

export const ContactListItem: FunctionComponent<PropsType> = React.memo(
  function ContactListItem({
    about,
    avatarUrl,
    badge,
    color,
    hasContextMenu,
    i18n,
    id,
    isMe,
    name,
    onClick,
    onAudioCall,
    onVideoCall,
    onRemove,
    onBlock,
    phoneNumber,
    profileName,
    sharedGroupNames,
    systemGivenName,
    systemFamilyName,
    theme,
    title,
    type,
    serviceId,
  }) {
    const [isConfirmingBlocking, setConfirmingBlocking] = useState(false);
    const [isConfirmingRemoving, setConfirmingRemoving] = useState(false);

    const menuOptions = useMemo(
      () => [
        ...(onClick
          ? [
              {
                icon: 'ContactListItem__context-menu__chat-icon',
                label: i18n('icu:ContactListItem__menu__message'),
                onClick: () => onClick(id),
              },
            ]
          : []),
        ...(!isMe && onAudioCall
          ? [
              {
                icon: 'ContactListItem__context-menu__phone-icon',
                label: i18n('icu:ContactListItem__menu__audio-call'),
                onClick: () => onAudioCall(id),
              },
            ]
          : []),
        ...(!isMe && onVideoCall
          ? [
              {
                icon: 'ContactListItem__context-menu__video-icon',
                label: i18n('icu:ContactListItem__menu__video-call'),
                onClick: () => onVideoCall(id),
              },
            ]
          : []),
        ...(!isMe && onRemove
          ? [
              {
                icon: 'ContactListItem__context-menu__delete-icon',
                label: i18n('icu:ContactListItem__menu__remove'),
                onClick: () => setConfirmingRemoving(true),
              },
            ]
          : []),
        ...(!isMe && onBlock
          ? [
              {
                icon: 'ContactListItem__context-menu__block-icon',
                label: i18n('icu:ContactListItem__menu__block'),
                onClick: () => setConfirmingBlocking(true),
              },
            ]
          : []),
      ],
      [id, i18n, isMe, onClick, onAudioCall, onVideoCall, onRemove, onBlock]
    );

    const headerName = isMe ? (
      <ContactName
        isMe={isMe}
        module={HEADER_CONTACT_NAME_CLASS_NAME}
        title={i18n('icu:noteToSelf')}
      />
    ) : (
      <ContactName
        isSignalConversation={isSignalConversation({ id, serviceId })}
        module={HEADER_CONTACT_NAME_CLASS_NAME}
        title={title}
      />
    );

    const messageText =
      about && !isMe ? <About className="" text={about} /> : undefined;

    let trailing: JSX.Element | undefined;
    if (hasContextMenu) {
      trailing = (
        <ContextMenu
          i18n={i18n}
          menuOptions={menuOptions}
          popperOptions={{ placement: 'bottom-start', strategy: 'absolute' }}
          moduleClassName="ContactListItem__context-menu"
          ariaLabel={i18n('icu:ContactListItem__menu')}
          portalToRoot
        />
      );
    }

    let blockConfirmation: JSX.Element | undefined;
    let removeConfirmation: JSX.Element | undefined;

    if (isConfirmingBlocking) {
      blockConfirmation = (
        <ConfirmationDialog
          dialogName="ContactListItem.blocking"
          i18n={i18n}
          onClose={() => setConfirmingBlocking(false)}
          title={
            <I18n
              i18n={i18n}
              id="icu:MessageRequests--block-direct-confirm-title"
              components={{
                title: <ContactName key="name" title={title} />,
              }}
            />
          }
          actions={[
            {
              text: i18n('icu:MessageRequests--block'),
              action: () => onBlock?.(id),
              style: 'negative',
            },
          ]}
        >
          {i18n('icu:MessageRequests--block-direct-confirm-body')}
        </ConfirmationDialog>
      );
    }

    if (isConfirmingRemoving) {
      if (
        isInSystemContacts({ type, name, systemGivenName, systemFamilyName })
      ) {
        removeConfirmation = (
          <ConfirmationDialog
            key="ContactListItem.systemContact"
            dialogName="ContactListItem.systemContact"
            i18n={i18n}
            onClose={() => setConfirmingRemoving(false)}
            title={
              <I18n
                i18n={i18n}
                id="icu:ContactListItem__remove-system--title"
                components={{
                  title: <ContactName key="name" title={title} />,
                }}
              />
            }
            cancelText={i18n('icu:Confirmation--confirm')}
          >
            {i18n('icu:ContactListItem__remove-system--body')}
          </ConfirmationDialog>
        );
      } else {
        removeConfirmation = (
          <ConfirmationDialog
            key="ContactListItem.removing"
            dialogName="ContactListItem.removing"
            i18n={i18n}
            onClose={() => setConfirmingRemoving(false)}
            title={
              <I18n
                i18n={i18n}
                id="icu:ContactListItem__remove--title"
                components={{
                  title: <ContactName key="name" title={title} />,
                }}
              />
            }
            actions={[
              {
                text: i18n('icu:ContactListItem__remove--confirm'),
                action: () => onRemove?.(id),
                style: 'negative',
              },
            ]}
          >
            {i18n('icu:ContactListItem__remove--body')}
          </ConfirmationDialog>
        );
      }
    }

    return (
      <>
        <ListTile
          moduleClassName="ContactListItem"
          leading={
            <Avatar
              avatarUrl={avatarUrl}
              color={color}
              conversationType={type}
              noteToSelf={Boolean(isMe)}
              i18n={i18n}
              phoneNumber={phoneNumber}
              profileName={profileName}
              title={title}
              sharedGroupNames={sharedGroupNames}
              size={AvatarSize.THIRTY_TWO}
              // This is here to appease the type checker.
              {...(badge ? { badge, theme } : { badge: undefined })}
            />
          }
          trailing={trailing}
          title={
            <>
              {headerName}
              {isInSystemContacts({
                type,
                name,
                systemGivenName,
                systemFamilyName,
              }) && (
                <span>
                  {' '}
                  <InContactsIcon
                    className="ContactListItem__contact-icon"
                    i18n={i18n}
                  />
                </span>
              )}
            </>
          }
          subtitle={messageText}
          subtitleMaxLines={1}
          onClick={onClick ? () => onClick(id) : undefined}
        />

        {blockConfirmation}
        {removeConfirmation}
      </>
    );
  }
);
