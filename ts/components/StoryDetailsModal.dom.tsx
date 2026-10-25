// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import type { LocalizerType } from '../types/Util.std.ts';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.ts';
import type {
  StorySendStateType,
  StoryViewType,
} from '../types/Stories.std.ts';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import { ContactName } from './conversation/ContactName.dom.tsx';
import { I18n } from './I18n.dom.tsx';
import { Modal } from './Modal.dom.tsx';
import { SendStatus } from '../messages/MessageSendState.std.ts';
import { Theme } from '../util/theme.std.ts';
import { formatDateTimeLong } from '../util/formatTimestamp.dom.ts';
import { DurationInSeconds } from '../util/durations/index.std.ts';
import type { SaveAttachmentActionCreatorType } from '../state/ducks/conversations.preload.ts';
import type { AttachmentType } from '../types/Attachment.std.ts';
import { ThemeType } from '../types/Util.std.ts';
import { Time } from './Time.dom.tsx';
import { groupBy } from '../util/mapUtil.std.ts';
import { format as formatRelativeTime } from '../util/expirationTimer.std.ts';
import { formatFileSize } from '../util/formatFileSize.std.ts';
import { AxoDropdownMenu } from '../axo/AxoDropdownMenu.dom.tsx';
import { AxoTheme } from '../axo/AxoTheme.dom.tsx';

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
            <div key={sendStatusLabel}>
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
        <div>
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
              size={AvatarSize.THIRTY_TWO}
              theme={ThemeType.dark}
              title={sender.title}
            />
            <div className="StoryDetailsModal__contact__text">
              <ContactName title={sender.title} />
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
    ? // oxlint-disable-next-line react/purity
      DurationInSeconds.fromMillis(expirationTimestamp - Date.now())
    : undefined;

  return (
    <Modal
      modalName="StoryDetailsModal"
      hasXButton
      i18n={i18n}
      className="StoryDetailsModal"
      onClose={onClose}
      theme={Theme.Dark}
      title={
        <AxoTheme.Override theme="force-dark">
          <AxoDropdownMenu.Root>
            <AxoDropdownMenu.Trigger>
              <button type="button" className="StoryDetailsModal__debugger">
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
              </button>
            </AxoDropdownMenu.Trigger>
            <AxoDropdownMenu.Content>
              <AxoDropdownMenu.Item
                symbol="copy"
                onSelect={() => {
                  void window.navigator.clipboard.writeText(String(timestamp));
                }}
              >
                {i18n('icu:StoryDetailsModal__copy-timestamp')}
              </AxoDropdownMenu.Item>
              {isInternalUser && attachment && (
                <AxoDropdownMenu.Item
                  symbol="download"
                  onSelect={() => saveAttachment(attachment)}
                >
                  {i18n('icu:StoryDetailsModal__download-attachment')}
                </AxoDropdownMenu.Item>
              )}
            </AxoDropdownMenu.Content>
          </AxoDropdownMenu.Root>
        </AxoTheme.Override>
      }
    >
      {content}
    </Modal>
  );
}
