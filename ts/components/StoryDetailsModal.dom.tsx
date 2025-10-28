// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util.std.js';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.js';
import type {
  StorySendStateType,
  StoryViewType,
} from '../types/Stories.std.js';
import { Avatar, AvatarSize } from './Avatar.dom.js';
import { ContactName } from './conversation/ContactName.dom.js';
import { ContextMenu } from './ContextMenu.dom.js';
import { I18n } from './I18n.dom.js';
import { Modal } from './Modal.dom.js';
import { SendStatus } from '../messages/MessageSendState.std.js';
import { Theme } from '../util/theme.std.js';
import { formatDateTimeLong } from '../util/formatTimestamp.dom.js';
import { DurationInSeconds } from '../util/durations/index.std.js';
import type { SaveAttachmentActionCreatorType } from '../state/ducks/conversations.preload.js';
import type { AttachmentType } from '../types/Attachment.std.js';
import { ThemeType } from '../types/Util.std.js';
import { Time } from './Time.dom.js';
import { groupBy } from '../util/mapUtil.std.js';
import { format as formatRelativeTime } from '../util/expirationTimer.std.js';
import { formatFileSize } from '../util/formatFileSize.std.js';

export type PropsType = {
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  isInternalUser?: boolean;
  onClose: () => unknown;
  saveAttachment: SaveAttachmentActionCreatorType;
  sender: StoryViewType['sender'];
  sendState?: Array<StorySendStateType>;
  attachment?: AttachmentType;
  expirationTimestamp: number | undefined;
  timestamp: number;
};

const contactSortCollator = new window.Intl.Collator();

function getSendStatusLabel(
  sendStatus: SendStatus | undefined,
  i18n: LocalizerType
): string {
  if (sendStatus === SendStatus.Failed) {
    return i18n('icu:MessageDetailsHeader--Failed');
  }

  if (sendStatus === SendStatus.Viewed) {
    return i18n('icu:MessageDetailsHeader--Viewed');
  }

  if (sendStatus === SendStatus.Read) {
    return i18n('icu:MessageDetailsHeader--Read');
  }

  if (sendStatus === SendStatus.Delivered) {
    return i18n('icu:MessageDetailsHeader--Delivered');
  }

  if (sendStatus === SendStatus.Sent) {
    return i18n('icu:MessageDetailsHeader--Sent');
  }

  if (sendStatus === SendStatus.Pending) {
    return i18n('icu:MessageDetailsHeader--Pending');
  }

  return i18n('icu:from');
}

export function StoryDetailsModal({
  attachment,
  getPreferredBadge,
  i18n,
  isInternalUser,
  onClose,
  saveAttachment,
  sender,
  sendState,
  timestamp,
  expirationTimestamp,
}: PropsType): JSX.Element {
  // the sender is included in the sendState data
  // but we don't want to show the sender in the "Sent To" list
  const actualRecipientsSendState = sendState?.filter(
    s => s.recipient.id !== sender.id
  );

  const contactsBySendStatus = actualRecipientsSendState
    ? groupBy(actualRecipientsSendState, contact => contact.status)
    : undefined;

  let content: JSX.Element;
  if (contactsBySendStatus) {
    content = (
      <div className="StoryDetailsModal__contact-container">
        {[
          SendStatus.Failed,
          SendStatus.Viewed,
          SendStatus.Read,
          SendStatus.Delivered,
          SendStatus.Sent,
          SendStatus.Pending,
        ].map(sendStatus => {
          const contacts = contactsBySendStatus.get(sendStatus);

          if (!contacts) {
            return null;
          }

          const sendStatusLabel = getSendStatusLabel(sendStatus, i18n);

          const sortedContacts = [...contacts].sort((a, b) =>
            contactSortCollator.compare(a.recipient.title, b.recipient.title)
          );

          return (
            <div
              key={sendStatusLabel}
              className="StoryDetailsModal__contact-group"
            >
              <div className="StoryDetailsModal__contact-group__header">
                {sendStatusLabel}
              </div>
              {sortedContacts.map(status => {
                const contact = status.recipient;

                return (
                  <div key={contact.id} className="StoryDetailsModal__contact">
                    <Avatar
                      avatarUrl={contact.avatarUrl}
                      badge={getPreferredBadge(contact.badges)}
                      color={contact.color}
                      conversationType="direct"
                      i18n={i18n}
                      phoneNumber={contact.phoneNumber}
                      profileName={contact.profileName}
                      sharedGroupNames={contact.sharedGroupNames}
                      size={AvatarSize.THIRTY_TWO}
                      theme={ThemeType.dark}
                      title={contact.title}
                    />
                    <div className="StoryDetailsModal__contact__text">
                      <ContactName title={contact.title} />
                    </div>
                    {status.updatedAt && (
                      <Time
                        className="StoryDetailsModal__status-timestamp"
                        timestamp={status.updatedAt}
                      >
                        {formatDateTimeLong(i18n, status.updatedAt)}
                      </Time>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  } else {
    content = (
      <div className="StoryDetailsModal__contact-container">
        <div className="StoryDetailsModal__contact-group">
          <div className="StoryDetailsModal__contact-group__header">
            {i18n('icu:sent')}
          </div>
          <div className="StoryDetailsModal__contact">
            <Avatar
              avatarPlaceholderGradient={sender.avatarPlaceholderGradient}
              avatarUrl={sender.avatarUrl}
              badge={getPreferredBadge(sender.badges)}
              color={sender.color}
              conversationType="direct"
              i18n={i18n}
              profileName={sender.profileName}
              sharedGroupNames={sender.sharedGroupNames}
              size={AvatarSize.THIRTY_TWO}
              theme={ThemeType.dark}
              title={sender.title}
            />
            <div className="StoryDetailsModal__contact__text">
              <div className="StoryDetailsModal__contact__name">
                <ContactName title={sender.title} />
              </div>
            </div>
            <Time
              className="StoryDetailsModal__status-timestamp"
              timestamp={timestamp}
            >
              {formatDateTimeLong(i18n, timestamp)}
            </Time>
          </div>
        </div>
      </div>
    );
  }

  const timeRemaining = expirationTimestamp
    ? DurationInSeconds.fromMillis(expirationTimestamp - Date.now())
    : undefined;

  const menuOptions = [
    {
      icon: 'StoryDetailsModal__copy-icon',
      label: i18n('icu:StoryDetailsModal__copy-timestamp'),
      onClick: () => {
        void window.navigator.clipboard.writeText(String(timestamp));
      },
    },
  ];

  if (isInternalUser && attachment) {
    menuOptions.push({
      icon: 'StoryDetailsModal__download-icon',
      label: i18n('icu:StoryDetailsModal__download-attachment'),
      onClick: () => {
        saveAttachment(attachment);
      },
    });
  }

  return (
    <Modal
      modalName="StoryDetailsModal"
      hasXButton
      i18n={i18n}
      moduleClassName="StoryDetailsModal"
      onClose={onClose}
      theme={Theme.Dark}
      title={
        <ContextMenu
          i18n={i18n}
          menuOptions={menuOptions}
          moduleClassName="StoryDetailsModal__debugger"
          popperOptions={{
            placement: 'bottom',
            strategy: 'absolute',
          }}
          theme={Theme.Dark}
        >
          <div>
            <I18n
              i18n={i18n}
              id="icu:StoryDetailsModal__sent-time"
              components={{
                time: (
                  <Time
                    className="StoryDetailsModal__debugger__button__text"
                    timestamp={timestamp}
                  >
                    {formatDateTimeLong(i18n, timestamp)}
                  </Time>
                ),
              }}
            />
          </div>
          {attachment && (
            <div>
              <I18n
                i18n={i18n}
                id="icu:StoryDetailsModal__file-size"
                components={{
                  size: (
                    <span className="StoryDetailsModal__debugger__button__text">
                      {formatFileSize(attachment.size)}
                    </span>
                  ),
                }}
              />
            </div>
          )}
          {timeRemaining && timeRemaining > 0 && (
            <div>
              <I18n
                i18n={i18n}
                id="icu:StoryDetailsModal__disappears-in"
                components={{
                  countdown: (
                    <span className="StoryDetailsModal__debugger__button__text">
                      {formatRelativeTime(i18n, timeRemaining, {
                        largest: 2,
                      })}
                    </span>
                  ),
                }}
              />
            </div>
          )}
        </ContextMenu>
      }
    >
      {content}
    </Modal>
  );
}
