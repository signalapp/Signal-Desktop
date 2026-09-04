// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX } from 'react';
import { useMemo, useRef } from 'react';
import lodash from 'lodash';

import { Avatar, AvatarSize } from '../Avatar.dom.tsx';
import { ContactName } from './ContactName.dom.tsx';
import { Time } from '../Time.dom.tsx';
import type {
  Props as MessagePropsType,
  PropsData as MessagePropsDataType,
} from './Message.dom.tsx';
import { Message, MessageInteractivity } from './Message.dom.tsx';
import type { LocalizerType, ThemeType } from '../../types/Util.std.ts';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.ts';
import type { ContactNameColorType } from '../../types/Colors.std.ts';
import {
  SendStatus,
  type VisibleSendStatus,
} from '../../messages/MessageSendState.std.ts';
import { WidthBreakpoint } from '../_util.std.ts';
import { createLogger } from '../../logging/log.std.ts';
import { formatDateTimeLong } from '../../util/formatTimestamp.dom.ts';
import { DurationInSeconds } from '../../util/durations/index.std.ts';
import { format as formatRelativeTime } from '../../util/expirationTimer.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { AxoContainer } from '../../axo/AxoContainer.dom.tsx';
import { AxoList } from '../../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../../axo/items/AxoItem.dom.tsx';
import { AxoClickableItem } from '../../axo/items/AxoClickableItem.dom.tsx';
import { drop } from '../../util/drop.std.ts';
import { AxoTextItem } from '../../axo/items/AxoTextItem.dom.tsx';
import { AxoContactList } from '../../axo/items/AxoContactList.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';

const { noop } = lodash;

const log = createLogger('MessageDetail');

export type Contact = Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarUrl'
  | 'badges'
  | 'color'
  | 'id'
  | 'isMe'
  | 'phoneNumber'
  | 'profileName'
  | 'title'
> & {
  status?: SendStatus;
  statusTimestamp?: number;

  isOutgoingKeyError: boolean;
  isUnidentifiedDelivery: boolean;

  errors?: ReadonlyArray<Error>;
};

export type PropsData = {
  // An undefined status means they were the sender and it's an incoming message. If
  //   `undefined` is a status, there should be no other items in the array; if there are
  //   any defined statuses, `undefined` shouldn't be present.
  contacts: ReadonlyArray<Contact>;

  contactNameColor?: ContactNameColorType;
  errors: ReadonlyArray<Error>;
  message: Omit<
    MessagePropsDataType,
    'renderingContext' | 'menu' | 'contextMenu' | 'showMenu'
  >;
  receivedAt: number;
  sentAt: number;

  i18n: LocalizerType;
  platform: string;
  theme: ThemeType;
  getPreferredBadge: PreferredBadgeSelectorType;
} & Pick<MessagePropsType, 'getPreferredBadge' | 'interactionMode'>;

export type PropsSmartActions = Pick<MessagePropsType, 'renderAudioAttachment'>;

export type PropsReduxActions = Pick<
  MessagePropsType,
  | 'cancelAttachmentDownload'
  | 'checkForAccount'
  | 'clearTargetedMessage'
  | 'doubleCheckMissingQuoteReference'
  | 'endPoll'
  | 'kickOffAttachmentDownload'
  | 'markAttachmentAsCorrupted'
  | 'messageExpanded'
  | 'openGiftBadge'
  | 'pushPanelForConversation'
  | 'retryMessageSend'
  | 'sendPollVote'
  | 'saveAttachment'
  | 'saveAttachments'
  | 'showContactModal'
  | 'showConversation'
  | 'showEditHistoryModal'
  | 'showAttachmentDownloadStillInProgressToast'
  | 'showExpiredIncomingTapToViewToast'
  | 'showExpiredOutgoingTapToViewToast'
  | 'showLightbox'
  | 'showLightboxForViewOnceMedia'
  | 'showMediaNoLongerAvailableToast'
  | 'showSpoiler'
  | 'retryDeleteForEveryone'
  | 'showTapToViewNotAvailableModal'
  | 'startConversation'
  | 'viewStory'
> & {
  toggleSafetyNumberModal: (contactId: string) => void;
};

export type Props = PropsData & PropsSmartActions & PropsReduxActions;

const contactSortCollator = new Intl.Collator();

const _keyForError = (error: Error): string => {
  return `${error.name}-${error.message}`;
};

export function MessageDetail({
  contacts,
  errors,
  message,
  receivedAt,
  sentAt,
  cancelAttachmentDownload,
  checkForAccount,
  clearTargetedMessage,
  contactNameColor,
  doubleCheckMissingQuoteReference,
  endPoll,
  getPreferredBadge,
  i18n,
  interactionMode,
  kickOffAttachmentDownload,
  markAttachmentAsCorrupted,
  messageExpanded,
  openGiftBadge,
  platform,
  pushPanelForConversation,
  retryDeleteForEveryone,
  retryMessageSend,
  sendPollVote,
  renderAudioAttachment,
  saveAttachment,
  saveAttachments,
  showContactModal,
  showConversation,
  showEditHistoryModal,
  showAttachmentDownloadStillInProgressToast,
  showExpiredIncomingTapToViewToast,
  showExpiredOutgoingTapToViewToast,
  showLightbox,
  showLightboxForViewOnceMedia,
  showMediaNoLongerAvailableToast,
  showSpoiler,
  showTapToViewNotAvailableModal,
  startConversation,
  theme,
  toggleSafetyNumberModal,
  viewStory,
}: Props): JSX.Element {
  const messageContainerElementRef = useRef<HTMLDivElement>(null);

  const timeRemaining = message.expirationTimestamp
    ? // oxlint-disable-next-line react/purity
      DurationInSeconds.fromMillis(message.expirationTimestamp - Date.now())
    : undefined;

  return (
    <AxoContainer.Root>
      <AxoList.Group>
        <AxoList.Root>
          <AxoList.Body ref={messageContainerElementRef}>
            <Message
              {...message}
              renderingContext="conversation/MessageDetail"
              cancelAttachmentDownload={cancelAttachmentDownload}
              checkForAccount={checkForAccount}
              clearTargetedMessage={clearTargetedMessage}
              contactNameColor={contactNameColor}
              containerElementRef={messageContainerElementRef}
              containerWidthBreakpoint={WidthBreakpoint.Wide}
              renderMenu={undefined}
              disableScroll
              displayLimit={Number.MAX_SAFE_INTEGER}
              showLightboxForViewOnceMedia={showLightboxForViewOnceMedia}
              doubleCheckMissingQuoteReference={
                doubleCheckMissingQuoteReference
              }
              endPoll={endPoll}
              getPreferredBadge={getPreferredBadge}
              i18n={i18n}
              interactivity={MessageInteractivity.Static}
              interactionMode={interactionMode}
              kickOffAttachmentDownload={kickOffAttachmentDownload}
              markAttachmentAsCorrupted={markAttachmentAsCorrupted}
              messageExpanded={messageExpanded}
              openGiftBadge={openGiftBadge}
              platform={platform}
              pushPanelForConversation={pushPanelForConversation}
              retryDeleteForEveryone={retryDeleteForEveryone}
              retryMessageSend={retryMessageSend}
              sendPollVote={sendPollVote}
              renderAudioAttachment={renderAudioAttachment}
              saveAttachment={saveAttachment}
              saveAttachments={saveAttachments}
              shouldCollapseAbove={false}
              shouldCollapseBelow={false}
              shouldHideMetadata={false}
              showConversation={showConversation}
              showSpoiler={showSpoiler}
              scrollToQuotedMessage={() => {
                log.warn('scrollToQuotedMessage called!');
              }}
              showContactModal={showContactModal}
              showAttachmentDownloadStillInProgressToast={
                showAttachmentDownloadStillInProgressToast
              }
              showTapToViewNotAvailableModal={showTapToViewNotAvailableModal}
              showExpiredIncomingTapToViewToast={
                showExpiredIncomingTapToViewToast
              }
              showExpiredOutgoingTapToViewToast={
                showExpiredOutgoingTapToViewToast
              }
              showLightbox={showLightbox}
              showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
              startConversation={startConversation}
              theme={theme}
              viewStory={viewStory}
              onToggleSelect={noop}
              onReplyToMessage={noop}
            />
          </AxoList.Body>
        </AxoList.Root>

        <AxoList.Root>
          <AxoList.Body>
            <AxoItem.Group>
              {errors.map(error => {
                return (
                  <AxoTextItem.Root
                    key={_keyForError(error)}
                    variant="destructive"
                    label={i18n('icu:error')}
                    description={error.message}
                  />
                );
              })}

              <AxoTextItem.Root
                label={i18n('icu:sent')}
                description={
                  <Time timestamp={sentAt}>
                    {formatDateTimeLong(i18n, sentAt)}
                  </Time>
                }
                trailing={
                  <AxoItem.IconAction
                    variant="implied-secondary"
                    symbol="copy"
                    label={i18n('icu:StoryDetailsModal__copy-timestamp')}
                    onClick={() => {
                      drop(
                        window.navigator.clipboard.writeText(String(sentAt))
                      );
                    }}
                  />
                }
              />

              {receivedAt > 0 && message.direction === 'incoming' && (
                <AxoTextItem.Root
                  label={i18n('icu:received')}
                  description={
                    <Time timestamp={receivedAt}>
                      {formatDateTimeLong(i18n, receivedAt)}
                    </Time>
                  }
                />
              )}

              {timeRemaining && timeRemaining > 0 && (
                <AxoTextItem.Root
                  label={i18n('icu:MessageDetail--disappears-in')}
                  description={formatRelativeTime(i18n, timeRemaining, {
                    largest: 2,
                  })}
                />
              )}
            </AxoItem.Group>
          </AxoList.Body>
        </AxoList.Root>

        {message.isEditedMessage && (
          <AxoList.Root>
            <AxoList.Body>
              <AxoItem.Group>
                <AxoClickableItem.Root
                  symbol="pencil"
                  label={i18n('icu:MessageDetail__view-edits')}
                  onClick={() => {
                    showEditHistoryModal?.(message.id);
                  }}
                />
              </AxoItem.Group>
            </AxoList.Body>
          </AxoList.Root>
        )}

        <Contacts
          i18n={i18n}
          contacts={contacts}
          theme={theme}
          getPreferredBadge={getPreferredBadge}
          toggleSafetyNumberModal={toggleSafetyNumberModal}
        />
      </AxoList.Group>
    </AxoContainer.Root>
  );
}

function Contacts({
  i18n,
  contacts,
  theme,
  getPreferredBadge,
  toggleSafetyNumberModal,
}: {
  i18n: LocalizerType;
  contacts: ReadonlyArray<Contact>;
  theme: ThemeType;
  getPreferredBadge: PreferredBadgeSelectorType;
  toggleSafetyNumberModal: (contactId: string) => void;
}): ReactNode {
  // This assumes that the list either contains one sender (a status of `undefined`) or
  //   1+ contacts with `SendStatus`es, but it doesn't check that assumption.
  const contactsBySendStatus = Map.groupBy(contacts, contact => {
    return contact.status;
  });

  return (
    <>
      {(
        [
          undefined,
          SendStatus.Failed,
          SendStatus.Viewed,
          SendStatus.Read,
          SendStatus.Delivered,
          SendStatus.Sent,
          SendStatus.Pending,
        ] as Array<VisibleSendStatus | undefined>
      ).map(sendStatus => {
        const statusContacts = contactsBySendStatus.get(sendStatus);

        if (!statusContacts || !statusContacts.length) {
          return null;
        }

        return (
          <ContactGroup
            i18n={i18n}
            sendStatus={sendStatus}
            statusContacts={statusContacts}
            theme={theme}
            getPreferredBadge={getPreferredBadge}
            toggleSafetyNumberModal={toggleSafetyNumberModal}
          />
        );
      })}
    </>
  );
}

function ContactGroup({
  i18n,
  sendStatus,
  statusContacts,
  theme,
  getPreferredBadge,
  toggleSafetyNumberModal,
}: {
  i18n: LocalizerType;
  sendStatus: undefined | VisibleSendStatus;
  statusContacts: ReadonlyArray<Contact>;
  theme: ThemeType;
  getPreferredBadge: PreferredBadgeSelectorType;
  toggleSafetyNumberModal: (contactId: string) => void;
}): ReactNode {
  const sortedContacts = [...statusContacts].sort((a, b) =>
    contactSortCollator.compare(a.title, b.title)
  );

  const title = useMemo(() => {
    if (sendStatus == null) {
      return i18n('icu:from');
    }

    switch (sendStatus) {
      case SendStatus.Failed:
        return i18n('icu:MessageDetailsHeader--Failed');
      case SendStatus.Pending:
        return i18n('icu:MessageDetailsHeader--Pending');
      case SendStatus.Sent:
        return i18n('icu:MessageDetailsHeader--Sent');
      case SendStatus.Delivered:
        return i18n('icu:MessageDetailsHeader--Delivered');
      case SendStatus.Read:
        return i18n('icu:MessageDetailsHeader--Read');
      case SendStatus.Viewed:
        return i18n('icu:MessageDetailsHeader--Viewed');
      default:
        throw missingCaseError(sendStatus);
    }
  }, [i18n, sendStatus]);

  const symbol = useMemo((): AxoSymbol.Name | null => {
    if (sendStatus == null) {
      return null;
    }

    switch (sendStatus) {
      case SendStatus.Failed:
        return 'error-circle';
      case SendStatus.Pending:
        return 'circle-dashed';
      case SendStatus.Sent:
        return 'check-circle';
      case SendStatus.Delivered:
        return 'check-circle-on-check-circle';
      case SendStatus.Read:
        return 'check-circle-on-check-circle-fill';
      case SendStatus.Viewed:
        return 'check-circle-on-check-circle-fill';
      default:
        throw missingCaseError(sendStatus);
    }
  }, [sendStatus]);

  return (
    <AxoContactList.Root
      title={
        <>
          {title}
          {symbol != null && (
            <>
              &nbsp;
              <span
                className={tw(
                  'inline-block',
                  'font-regular',
                  sendStatus === SendStatus.Pending && 'animate-spin'
                )}
              >
                <AxoSymbol.InlineGlyph symbol={symbol} label={null} />
              </span>
            </>
          )}
        </>
      }
    >
      {sortedContacts.map(contact => {
        return (
          <ContactGroupItem
            key={contact.id}
            i18n={i18n}
            contact={contact}
            theme={theme}
            getPreferredBadge={getPreferredBadge}
            toggleSafetyNumberModal={toggleSafetyNumberModal}
          />
        );
      })}
    </AxoContactList.Root>
  );
}

function ContactGroupItem({
  i18n,
  contact,
  theme,
  getPreferredBadge,
  toggleSafetyNumberModal,
}: {
  i18n: LocalizerType;
  contact: Contact;
  theme: ThemeType;
  getPreferredBadge: PreferredBadgeSelectorType;
  toggleSafetyNumberModal: (contactId: string) => void;
}): JSX.Element {
  const contactErrors = contact.errors || [];

  return (
    <AxoContactList.Item
      avatar={
        <Avatar
          avatarUrl={contact.avatarUrl}
          badge={getPreferredBadge(contact.badges)}
          color={contact.color}
          conversationType="direct"
          i18n={i18n}
          phoneNumber={contact.phoneNumber}
          profileName={contact.profileName}
          theme={theme}
          title={contact.title}
          size={AvatarSize.THIRTY_TWO}
        />
      }
      title={<ContactName title={contact.title} />}
      description={
        <>
          {contactErrors.map(contactError => (
            <div
              key={_keyForError(contactError)}
              className={tw('text-destructive')}
            >
              {contactError.message}
            </div>
          ))}
        </>
      }
      value={
        <>
          {contact.isUnidentifiedDelivery && (
            <span className="module-message-detail__contact__unidentified-delivery-icon" />
          )}

          {contact.statusTimestamp && (
            <Time timestamp={contact.statusTimestamp}>
              {formatDateTimeLong(i18n, contact.statusTimestamp)}
            </Time>
          )}
        </>
      }
      accessory={
        contact.isOutgoingKeyError && (
          <AxoItem.Action
            variant="subtle-secondary"
            onClick={() => toggleSafetyNumberModal(contact.id)}
          >
            {i18n('icu:showSafetyNumber')}
          </AxoItem.Action>
        )
      }
    />
  );
}
