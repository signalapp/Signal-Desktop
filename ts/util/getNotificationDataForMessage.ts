// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

import type { RawBodyRange } from '../types/BodyRange';
import type { ReadonlyMessageAttributesType } from '../model-types.d';
import type { ICUStringMessageParamsByKeyType } from '../types/Util';
import * as Attachment from '../types/Attachment';
import * as EmbeddedContact from '../types/EmbeddedContact';
import * as GroupChange from '../groupChange';
import * as MIME from '../types/MIME';
import * as Stickers from '../types/Stickers';
import * as expirationTimer from './expirationTimer';
import * as log from '../logging/log';
import { GiftBadgeStates } from '../components/conversation/Message';
import { dropNull } from './dropNull';
import { getCallHistorySelector } from '../state/selectors/callHistory';
import { getCallSelector, getActiveCall } from '../state/selectors/calling';
import { getCallingNotificationText } from './callingNotification';
import {
  getConversationSelector,
  getSelectedMessageIds,
  getTargetedMessage,
} from '../state/selectors/conversations';
import { getStringForConversationMerge } from './getStringForConversationMerge';
import { getStringForProfileChange } from './getStringForProfileChange';
import { getTitleNoDefault, getNumber } from './getTitle';
import { findAndFormatContact } from './findAndFormatContact';
import { isGroup, isMe } from './whatTypeOfConversation';
import { strictAssert } from './assert';
import {
  getPropsForCallHistory,
  hasErrors,
  isCallHistory,
  isChatSessionRefreshed,
  isDeliveryIssue,
  isEndSession,
  isExpirationTimerUpdate,
  isGroupUpdate,
  isGroupV1Migration,
  isGroupV2Change,
  isIncoming,
  isKeyChange,
  isOutgoing,
  isProfileChange,
  isTapToView,
  isUnsupportedMessage,
  isConversationMerge,
  isMessageRequestResponse,
} from '../state/selectors/message';
import {
  getAuthor,
  messageHasPaymentEvent,
  getPaymentEventNotificationText,
} from '../messages/helpers';
import { MessageRequestResponseEvent } from '../types/MessageRequestResponseEvent';
import { missingCaseError } from './missingCaseError';
import { getUserConversationId } from '../state/selectors/user';

function getNameForNumber(e164: string): string {
  const conversation = window.ConversationController.get(e164);
  if (!conversation) {
    return e164;
  }
  return conversation.getTitle();
}

export function getNotificationDataForMessage(
  attributes: ReadonlyMessageAttributesType
): {
  bodyRanges?: ReadonlyArray<ReadonlyDeep<RawBodyRange>>;
  emoji?: string;
  text: string;
} {
  if (isDeliveryIssue(attributes)) {
    return {
      emoji: '⚠️',
      text: window.i18n('icu:DeliveryIssue--preview'),
    };
  }

  if (isConversationMerge(attributes)) {
    const conversation = window.ConversationController.get(
      attributes.conversationId
    );
    strictAssert(
      conversation,
      'getNotificationData/isConversationMerge/conversation'
    );
    strictAssert(
      attributes.conversationMerge,
      'getNotificationData/isConversationMerge/conversationMerge'
    );

    return {
      text: getStringForConversationMerge({
        obsoleteConversationTitle: getTitleNoDefault(
          attributes.conversationMerge.renderInfo
        ),
        obsoleteConversationNumber: getNumber(
          attributes.conversationMerge.renderInfo
        ),
        conversationTitle: conversation.getTitle(),
        i18n: window.i18n,
      }),
    };
  }

  if (isChatSessionRefreshed(attributes)) {
    return {
      emoji: '🔁',
      text: window.i18n('icu:ChatRefresh--notification'),
    };
  }

  if (isUnsupportedMessage(attributes)) {
    return {
      text: window.i18n('icu:message--getDescription--unsupported-message'),
    };
  }

  if (isGroupV1Migration(attributes)) {
    return {
      text: window.i18n('icu:GroupV1--Migration--was-upgraded'),
    };
  }

  if (isProfileChange(attributes)) {
    const { profileChange: change, changedId } = attributes;
    const changedContact = findAndFormatContact(changedId);
    if (!change) {
      throw new Error('getNotificationData: profileChange was missing!');
    }

    return {
      text: getStringForProfileChange(change, changedContact, window.i18n),
    };
  }

  if (isGroupV2Change(attributes)) {
    const { groupV2Change: change } = attributes;
    strictAssert(
      change,
      'getNotificationData: isGroupV2Change true, but no groupV2Change!'
    );

    const changes = GroupChange.renderChange<string>(change, {
      i18n: window.i18n,
      ourAci: window.textsecure.storage.user.getCheckedAci(),
      ourPni: window.textsecure.storage.user.getCheckedPni(),
      renderContact: (conversationId: string) => {
        const conversation = window.ConversationController.get(conversationId);
        return conversation
          ? conversation.getTitle()
          : window.i18n('icu:unknownContact');
      },
      renderIntl: <Key extends keyof ICUStringMessageParamsByKeyType>(
        key: Key,
        _i18n: unknown,
        components: ICUStringMessageParamsByKeyType[Key]
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return window.i18n(key, components as any);
      },
    });

    return { text: changes.map(({ text }) => text).join(' ') };
  }

  if (messageHasPaymentEvent(attributes)) {
    const sender = findAndFormatContact(attributes.sourceServiceId);
    const conversation = findAndFormatContact(attributes.conversationId);
    return {
      text: getPaymentEventNotificationText(
        attributes.payment,
        sender.title,
        conversation.title,
        sender.isMe,
        window.i18n
      ),
      emoji: '💳',
    };
  }

  if (isMessageRequestResponse(attributes)) {
    const { messageRequestResponseEvent: event } = attributes;
    strictAssert(
      event,
      'getNotificationData: isMessageRequestResponse true, but no messageRequestResponseEvent!'
    );
    const conversation = window.ConversationController.get(
      attributes.conversationId
    );
    strictAssert(
      conversation,
      'getNotificationData/isConversationMerge/conversation'
    );
    const isGroupConversation = isGroup(conversation.attributes);
    let text: string;
    if (event === MessageRequestResponseEvent.ACCEPT) {
      text = window.i18n(
        'icu:MessageRequestResponseNotification__Message--Accepted'
      );
    } else if (event === MessageRequestResponseEvent.SPAM) {
      text = window.i18n(
        'icu:MessageRequestResponseNotification__Message--Reported'
      );
    } else if (event === MessageRequestResponseEvent.BLOCK) {
      if (isGroupConversation) {
        text = window.i18n(
          'icu:MessageRequestResponseNotification__Message--Blocked--Group'
        );
      } else {
        text = window.i18n(
          'icu:MessageRequestResponseNotification__Message--Blocked'
        );
      }
    } else if (event === MessageRequestResponseEvent.UNBLOCK) {
      if (isGroupConversation) {
        text = window.i18n(
          'icu:MessageRequestResponseNotification__Message--Unblocked--Group'
        );
      } else {
        text = window.i18n(
          'icu:MessageRequestResponseNotification__Message--Unblocked'
        );
      }
    } else {
      throw missingCaseError(event);
    }

    return {
      text,
    };
  }

  const { attachments = [] } = attributes;

  if (isTapToView(attributes)) {
    if (attributes.isErased) {
      return {
        text: window.i18n('icu:message--getDescription--disappearing-media'),
      };
    }

    if (Attachment.isImage(attachments)) {
      return {
        text: window.i18n('icu:message--getDescription--disappearing-photo'),
        emoji: '📷',
      };
    }
    if (Attachment.isVideo(attachments)) {
      return {
        text: window.i18n('icu:message--getDescription--disappearing-video'),
        emoji: '🎥',
      };
    }
    // There should be an image or video attachment, but we have a fallback just in
    //   case.
    return { text: window.i18n('icu:mediaMessage'), emoji: '📎' };
  }

  if (isGroupUpdate(attributes)) {
    const { group_update: groupUpdate } = attributes;
    const fromContact = getAuthor(attributes);
    const messages = [];
    if (!groupUpdate) {
      throw new Error('getNotificationData: Missing group_update');
    }

    if (groupUpdate.left === 'You') {
      return { text: window.i18n('icu:youLeftTheGroup') };
    }
    if (groupUpdate.left) {
      return {
        text: window.i18n('icu:leftTheGroup', {
          name: getNameForNumber(groupUpdate.left),
        }),
      };
    }

    if (!fromContact) {
      return { text: '' };
    }

    if (isMe(fromContact.attributes)) {
      messages.push(window.i18n('icu:youUpdatedTheGroup'));
    } else {
      messages.push(
        window.i18n('icu:updatedTheGroup', {
          name: fromContact.getTitle(),
        })
      );
    }

    if (groupUpdate.joined && groupUpdate.joined.length) {
      const joinedContacts = groupUpdate.joined.map(item =>
        window.ConversationController.getOrCreate(item, 'private')
      );
      const joinedWithoutMe = joinedContacts.filter(
        contact => !isMe(contact.attributes)
      );

      if (joinedContacts.length > 1) {
        messages.push(
          window.i18n('icu:multipleJoinedTheGroup', {
            names: joinedWithoutMe
              .map(contact => contact.getTitle())
              .join(', '),
          })
        );

        if (joinedWithoutMe.length < joinedContacts.length) {
          messages.push(window.i18n('icu:youJoinedTheGroup'));
        }
      } else {
        const joinedContact = window.ConversationController.getOrCreate(
          groupUpdate.joined[0],
          'private'
        );
        if (isMe(joinedContact.attributes)) {
          messages.push(window.i18n('icu:youJoinedTheGroup'));
        } else {
          messages.push(
            window.i18n('icu:joinedTheGroup', {
              name: joinedContacts[0].getTitle(),
            })
          );
        }
      }
    }

    if (groupUpdate.name) {
      messages.push(
        window.i18n('icu:titleIsNow', {
          name: groupUpdate.name,
        })
      );
    }
    if (groupUpdate.avatarUpdated) {
      messages.push(window.i18n('icu:updatedGroupAvatar'));
    }

    return { text: messages.join(' ') };
  }
  if (isEndSession(attributes)) {
    return { text: window.i18n('icu:sessionEnded') };
  }
  if (isIncoming(attributes) && hasErrors(attributes)) {
    return { text: window.i18n('icu:incomingError') };
  }

  const { body: untrimmedBody = '', bodyRanges = [] } = attributes;
  const body = untrimmedBody.trim();

  if (attachments.length) {
    // This should never happen but we want to be extra-careful.
    const attachment = attachments[0] || {};
    const { contentType } = attachment;

    const tooBigAttachmentCount = attachments.filter(
      item => item.wasTooBig
    ).length;
    if (tooBigAttachmentCount === attachments.length) {
      return {
        emoji: '📎',
        text: window.i18n('icu:message--attachmentTooBig--one'),
      };
    }

    if (contentType === MIME.IMAGE_GIF || Attachment.isGIF(attachments)) {
      return {
        bodyRanges,
        emoji: '🎡',
        text: body || window.i18n('icu:message--getNotificationText--gif'),
      };
    }
    if (Attachment.isImage(attachments)) {
      return {
        bodyRanges,
        emoji: '📷',
        text: body || window.i18n('icu:message--getNotificationText--photo'),
      };
    }
    if (Attachment.isVideo(attachments)) {
      return {
        bodyRanges,
        emoji: '🎥',
        text: body || window.i18n('icu:message--getNotificationText--video'),
      };
    }
    if (Attachment.isVoiceMessage(attachment)) {
      return {
        bodyRanges,
        emoji: '🎤',
        text:
          body ||
          window.i18n('icu:message--getNotificationText--voice-message'),
      };
    }
    if (Attachment.isAudio(attachments)) {
      return {
        bodyRanges,
        emoji: '🔈',
        text:
          body ||
          window.i18n('icu:message--getNotificationText--audio-message'),
      };
    }

    return {
      bodyRanges,
      text: body || window.i18n('icu:message--getNotificationText--file'),
      emoji: '📎',
    };
  }

  const { sticker: stickerData } = attributes;
  if (stickerData) {
    const emoji =
      Stickers.getSticker(stickerData.packId, stickerData.stickerId)?.emoji ||
      stickerData?.emoji;

    if (!emoji) {
      log.warn('Unable to get emoji for sticker');
    }
    return {
      text: window.i18n('icu:message--getNotificationText--stickers'),
      emoji: dropNull(emoji),
    };
  }

  if (isCallHistory(attributes)) {
    const state = window.reduxStore.getState();
    const callingNotification = getPropsForCallHistory(attributes, {
      ourConversationId: getUserConversationId(state),
      callSelector: getCallSelector(state),
      activeCall: getActiveCall(state),
      callHistorySelector: getCallHistorySelector(state),
      conversationSelector: getConversationSelector(state),
      selectedMessageIds: getSelectedMessageIds(state),
      targetedMessageId: getTargetedMessage(state)?.id,
    });
    if (callingNotification) {
      const text = getCallingNotificationText(callingNotification, window.i18n);
      if (text != null) {
        return {
          text,
        };
      }
    }

    log.error("This call history message doesn't have valid call history");
  }
  if (isExpirationTimerUpdate(attributes)) {
    const { expireTimer } = attributes.expirationTimerUpdate ?? {};
    if (!expireTimer) {
      return { text: window.i18n('icu:disappearingMessagesDisabled') };
    }

    return {
      text: window.i18n('icu:timerSetTo', {
        time: expirationTimer.format(window.i18n, expireTimer),
      }),
    };
  }

  if (isKeyChange(attributes)) {
    const { key_changed: identifier } = attributes;
    const conversation = window.ConversationController.get(identifier);
    return {
      text: window.i18n('icu:safetyNumberChangedGroup', {
        name: conversation ? conversation.getTitle() : '',
      }),
    };
  }
  const { contact: contacts } = attributes;
  if (contacts && contacts.length) {
    return {
      text:
        EmbeddedContact.getName(contacts[0]) ||
        window.i18n('icu:unknownContact'),
      emoji: '👤',
    };
  }

  const { giftBadge } = attributes;
  if (giftBadge) {
    const emoji = '✨';

    if (isOutgoing(attributes)) {
      const toContact = window.ConversationController.get(
        attributes.conversationId
      );
      const recipient =
        toContact?.getTitle() ?? window.i18n('icu:unknownContact');
      return {
        emoji,
        text: window.i18n('icu:message--donation--preview--sent', {
          recipient,
        }),
      };
    }

    const fromContact = getAuthor(attributes);
    const sender = fromContact?.getTitle() ?? window.i18n('icu:unknownContact');
    return {
      emoji,
      text:
        giftBadge.state === GiftBadgeStates.Unopened
          ? window.i18n('icu:message--donation--preview--unopened', {
              sender,
            })
          : window.i18n('icu:message--donation--preview--redeemed'),
    };
  }

  if (body) {
    return {
      text: body,
      bodyRanges,
    };
  }

  return { text: '' };
}
