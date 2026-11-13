// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback } from 'react';
import type { ReactNode } from 'react';

import type { LocalizerType } from '../types/Util.std.ts';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.ts';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type {
  StorySendStateType,
  StoryViewType,
} from '../types/Stories.std.ts';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import { ContactName } from './conversation/ContactName.dom.tsx';
import { I18n } from './I18n.dom.tsx';
import {
  SendStatus,
  VISIBLE_SEND_STATUS_ORDER,
} from '../messages/MessageSendState.std.ts';
import { formatDateTimeLong } from '../util/formatTimestamp.dom.ts';
import { DurationInSeconds } from '../util/durations/index.std.ts';
import type { SaveAttachmentActionCreatorType } from '../state/ducks/conversations.preload.ts';
import type { AttachmentType } from '../types/Attachment.std.ts';
import { ThemeType } from '../types/Util.std.ts';
import { Time } from './Time.dom.tsx';
import { groupBy } from '../util/mapUtil.std.ts';
import { format as formatRelativeTime } from '../util/expirationTimer.std.ts';
import { formatFileSize } from '../util/formatFileSize.std.ts';
import { AxoDialog } from '../axo/dialogs/AxoDialog.dom.tsx';
import { AxoDropdownMenu } from '../axo/menus/AxoDropdownMenu.dom.tsx';
import { AxoContactList } from '../axo/items/AxoContactList.dom.tsx';
import { AxoItem } from '../axo/items/AxoItem.dom.tsx';
import { AxoList } from '../axo/items/AxoList.dom.tsx';
import { AxoTheme } from '../axo/AxoTheme.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

export type PropsType = Readonly<{
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
}>;

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

export function StoryDetailsModal(props: PropsType): ReactNode {
  const { i18n, onClose } = props;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose]
  );

  // The sender is included in the sendState, but isn't one of the recipients
  const recipientsSendState = props.sendState?.filter(
    s => s.recipient.id !== props.sender.id
  );

  const contactLists: Array<ReactNode> = [];
  if (recipientsSendState != null) {
    const contactsBySendStatus = groupBy(
      recipientsSendState,
      contact => contact.status
    );
    for (const sendStatus of VISIBLE_SEND_STATUS_ORDER) {
      const contacts = contactsBySendStatus.get(sendStatus);
      if (contacts == null) {
        continue;
      }

      const sortedContacts = contacts.toSorted((a, b) =>
        contactSortCollator.compare(a.recipient.title, b.recipient.title)
      );

      contactLists.push(
        <AxoContactList.Root
          key={sendStatus}
          title={getSendStatusLabel(sendStatus, i18n)}
        >
          {sortedContacts.map(status => {
            return (
              <ContactItem
                key={status.recipient.id}
                i18n={i18n}
                contact={status.recipient}
                getPreferredBadge={props.getPreferredBadge}
                timestamp={status.updatedAt ?? null}
              />
            );
          })}
        </AxoContactList.Root>
      );
    }
  } else {
    contactLists.push(
      <AxoContactList.Root key="sent" title={i18n('icu:sent')}>
        <ContactItem
          i18n={i18n}
          contact={props.sender}
          getPreferredBadge={props.getPreferredBadge}
          timestamp={props.timestamp}
        />
      </AxoContactList.Root>
    );
  }

  return (
    <AxoTheme.Override theme="force-dark">
      <AxoDialog.Root open onOpenChange={handleOpenChange}>
        <AxoDialog.Content
          size="md"
          position="bottom-end"
          escape="cancel-is-noop"
          disableMissingAriaDescriptionWarning
        >
          <AxoDialog.Header>
            <AxoDialog.Title>{i18n('icu:StoryListItem__info')}</AxoDialog.Title>
            <AxoDialog.Close />
          </AxoDialog.Header>
          <AxoDialog.Body padding="md">
            <AxoList.Group>
              <DetailsItem
                i18n={i18n}
                attachment={props.attachment ?? null}
                expirationTimestamp={props.expirationTimestamp ?? null}
                isInternalUser={props.isInternalUser ?? false}
                saveAttachment={props.saveAttachment}
                timestamp={props.timestamp}
              />
              {contactLists}
            </AxoList.Group>
          </AxoDialog.Body>
        </AxoDialog.Content>
      </AxoDialog.Root>
    </AxoTheme.Override>
  );
}

type DetailsItemProps = Readonly<{
  i18n: LocalizerType;
  attachment: AttachmentType | null;
  expirationTimestamp: number | null;
  isInternalUser: boolean;
  saveAttachment: SaveAttachmentActionCreatorType;
  timestamp: number;
}>;

/** Has a menu with debugging tools */
function DetailsItem(props: DetailsItemProps): ReactNode {
  const { i18n, saveAttachment } = props;

  const handleCopyTimestamp = useCallback(() => {
    void window.navigator.clipboard.writeText(String(props.timestamp));
  }, [props.timestamp]);

  const handleDownloadAttachment = useCallback(() => {
    if (props.attachment != null) {
      saveAttachment(props.attachment);
    }
  }, [props.attachment, saveAttachment]);

  const timeRemaining =
    props.expirationTimestamp != null
      ? // oxlint-disable-next-line react/purity
        DurationInSeconds.fromMillis(props.expirationTimestamp - Date.now())
      : null;

  const hasFileSize = props.attachment != null;
  const hasTimeRemaining = timeRemaining != null && timeRemaining > 0;

  return (
    <AxoList.Root>
      <AxoList.Body>
        <AxoItem.Group spacing="sm">
          <AxoItem.Root>
            <AxoItem.Content>
              <AxoItem.Label>
                <I18n
                  i18n={i18n}
                  id="icu:StoryDetailsModal__sent-time"
                  components={{
                    time: (
                      <Time timestamp={props.timestamp}>
                        {formatDateTimeLong(i18n, props.timestamp)}
                      </Time>
                    ),
                  }}
                />
              </AxoItem.Label>
              {(hasFileSize || hasTimeRemaining) && (
                <AxoItem.Description>
                  {props.attachment != null && (
                    <span className={tw('block')}>
                      <I18n
                        i18n={i18n}
                        id="icu:StoryDetailsModal__file-size"
                        components={{
                          size: formatFileSize(props.attachment.size),
                        }}
                      />
                    </span>
                  )}
                  {hasTimeRemaining && (
                    <span className={tw('block')}>
                      <I18n
                        i18n={i18n}
                        id="icu:StoryDetailsModal__disappears-in"
                        components={{
                          countdown: formatRelativeTime(i18n, timeRemaining, {
                            largest: 2,
                          }),
                        }}
                      />
                    </span>
                  )}
                </AxoItem.Description>
              )}
              <AxoItem.Accessory centerToFullHeight>
                <AxoDropdownMenu.Root>
                  <AxoDropdownMenu.Trigger>
                    <AxoItem.IconAction
                      variant="implied-secondary"
                      symbol="more"
                      label={i18n('icu:StoryDetailsModal__more-actions')}
                      tooltip={false}
                    />
                  </AxoDropdownMenu.Trigger>
                  <AxoDropdownMenu.Content>
                    <AxoDropdownMenu.Item
                      symbol="copy"
                      onSelect={handleCopyTimestamp}
                    >
                      {i18n('icu:StoryDetailsModal__copy-timestamp')}
                    </AxoDropdownMenu.Item>
                    {props.isInternalUser && props.attachment != null && (
                      <AxoDropdownMenu.Item
                        symbol="download"
                        onSelect={handleDownloadAttachment}
                      >
                        {i18n('icu:StoryDetailsModal__download-attachment')}
                      </AxoDropdownMenu.Item>
                    )}
                  </AxoDropdownMenu.Content>
                </AxoDropdownMenu.Root>
              </AxoItem.Accessory>
            </AxoItem.Content>
          </AxoItem.Root>
        </AxoItem.Group>
      </AxoList.Body>
    </AxoList.Root>
  );
}

type ContactItemProps = Readonly<{
  i18n: LocalizerType;
  contact: Pick<
    ConversationType,
    | 'avatarPlaceholderGradient'
    | 'avatarUrl'
    | 'badges'
    | 'color'
    | 'phoneNumber'
    | 'profileName'
    | 'title'
  >;
  getPreferredBadge: PreferredBadgeSelectorType;
  timestamp: number | null;
}>;

function ContactItem(props: ContactItemProps): ReactNode {
  const { i18n, contact } = props;

  let value: ReactNode = null;
  if (props.timestamp != null) {
    value = (
      <Time timestamp={props.timestamp}>
        {formatDateTimeLong(i18n, props.timestamp)}
      </Time>
    );
  }

  return (
    <AxoContactList.Item
      avatar={
        <Avatar
          avatarPlaceholderGradient={contact.avatarPlaceholderGradient}
          avatarUrl={contact.avatarUrl}
          badge={props.getPreferredBadge(contact.badges)}
          color={contact.color}
          conversationType="direct"
          i18n={i18n}
          phoneNumber={contact.phoneNumber}
          profileName={contact.profileName}
          size={AvatarSize.THIRTY_TWO}
          theme={ThemeType.dark}
          title={contact.title}
        />
      }
      title={<ContactName title={contact.title} />}
      value={value}
    />
  );
}
