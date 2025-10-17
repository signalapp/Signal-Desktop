// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

import type { RawBodyRange } from '../types/BodyRange.std.js';
import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import type { ICUStringMessageParamsByKeyType } from '../types/Util.std.js';
import * as Attachment from './Attachment.std.js';
import * as EmbeddedContact from '../types/EmbeddedContact.std.js';
import * as GroupChange from '../groupChange.std.js';
import * as MIME from '../types/MIME.std.js';
import * as Stickers from '../types/Stickers.preload.js';
import * as expirationTimer from './expirationTimer.std.js';
import { createLogger } from '../logging/log.std.js';
import { GiftBadgeStates } from '../types/GiftBadgeStates.std.js';
import { dropNull } from './dropNull.std.js';
import { getCallHistorySelector } from '../state/selectors/callHistory.std.js';
import {
  getCallSelector,
  getActiveCall,
} from '../state/selectors/calling.std.js';
import { getCallingNotificationText } from './callingNotification.std.js';
import {
  getConversationSelector,
  getSelectedMessageIds,
  getTargetedMessage,
} from '../state/selectors/conversations.dom.js';
import { getStringForConversationMerge } from './getStringForConversationMerge.std.js';
import { getStringForProfileChange } from './getStringForProfileChange.std.js';
import { getTitleNoDefault, getNumber } from './getTitle.preload.js';
import { findAndFormatContact } from './findAndFormatContact.preload.js';
import { isGroup, isMe } from './whatTypeOfConversation.dom.js';
import { strictAssert } from './assert.std.js';
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
} from '../state/selectors/message.preload.js';
import { getAuthor } from '../messages/sources.preload.js';
import {
  messageHasPaymentEvent,
  getPaymentEventNotificationText,
} from '../messages/payments.std.js';
import { MessageRequestResponseEvent } from '../types/MessageRequestResponseEvent.std.js';
import { missingCaseError } from './missingCaseError.std.js';
import { getUserConversationId } from '../state/selectors/user.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('getNotificationDataForMessage');
const { i18n } = window.SignalContext;

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
      text: i18n('icu:DeliveryIssue--preview'),
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
        i18n,
      }),
    };
  }

  if (isChatSessionRefreshed(attributes)) {
    return {
      emoji: '🔁',
      text: i18n('icu:ChatRefresh--notification'),
    };
  }

  if (isUnsupportedMessage(attributes)) {
    return {
      text: i18n('icu:message--getDescription--unsupported-message'),
    };
  }

  if (isGroupV1Migration(attributes)) {
    return {
      text: i18n('icu:GroupV1--Migration--was-upgraded'),
    };
  }

  if (isProfileChange(attributes)) {
    const { profileChange: change, changedId } = attributes;
    const changedContact = findAndFormatContact(changedId);
    if (!change) {
      throw new Error('getNotificationData: profileChange was missing!');
    }

    return {
      text: getStringForProfileChange(change, changedContact, i18n),
    };
  }

  if (isGroupV2Change(attributes)) {
    const { groupV2Change: change } = attributes;
    strictAssert(
      change,
      'getNotificationData: isGroupV2Change true, but no groupV2Change!'
    );

    const changes = GroupChange.renderChange<string>(change, {
      i18n,
      ourAci: itemStorage.user.getCheckedAci(),
      ourPni: itemStorage.user.getCheckedPni(),
      renderContact: (conversationId: string) => {
        const conversation = window.ConversationController.get(conversationId);
        return conversation
          ? conversation.getTitle()
          : i18n('icu:unknownContact');
      },
      renderIntl: <Key extends keyof ICUStringMessageParamsByKeyType>(
        key: Key,
        _i18n: unknown,
        components: ICUStringMessageParamsByKeyType[Key]
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return i18n(key, components as any);
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
        i18n
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
      text = i18n('icu:MessageRequestResponseNotification__Message--Accepted');
    } else if (event === MessageRequestResponseEvent.SPAM) {
      text = i18n('icu:MessageRequestResponseNotification__Message--Reported');
    } else if (event === MessageRequestResponseEvent.BLOCK) {
      if (isGroupConversation) {
        text = i18n(
          'icu:MessageRequestResponseNotification__Message--Blocked--Group'
        );
      } else {
        text = i18n('icu:MessageRequestResponseNotification__Message--Blocked');
      }
    } else if (event === MessageRequestResponseEvent.UNBLOCK) {
      if (isGroupConversation) {
        text = i18n(
          'icu:MessageRequestResponseNotification__Message--Unblocked--Group'
        );
      } else {
        text = i18n(
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
        text: i18n('icu:message--getDescription--disappearing-media'),
      };
    }

    if (Attachment.isImage(attachments)) {
      return {
        text: i18n('icu:message--getDescription--disappearing-photo'),
        emoji: '📷',
      };
    }
    if (Attachment.isVideo(attachments)) {
      return {
        text: i18n('icu:message--getDescription--disappearing-video'),
        emoji: '🎥',
      };
    }
    // There should be an image or video attachment, but we have a fallback just in
    //   case.
    return { text: i18n('icu:mediaMessage'), emoji: '📎' };
  }

  if (isGroupUpdate(attributes)) {
    const { group_update: groupUpdate } = attributes;
    const fromContact = getAuthor(attributes);
    const messages = [];
    if (!groupUpdate) {
      throw new Error('getNotificationData: Missing group_update');
    }

    if (groupUpdate.left === 'You') {
      return { text: i18n('icu:youLeftTheGroup') };
    }
    if (groupUpdate.left) {
      return {
        text: i18n('icu:leftTheGroup', {
          name: getNameForNumber(groupUpdate.left),
        }),
      };
    }

    if (!fromContact) {
      return { text: '' };
    }

    if (isMe(fromContact.attributes)) {
      messages.push(i18n('icu:youUpdatedTheGroup'));
    } else {
      messages.push(
        i18n('icu:updatedTheGroup', {
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
          i18n('icu:multipleJoinedTheGroup', {
            names: joinedWithoutMe
              .map(contact => contact.getTitle())
              .join(', '),
          })
        );

        if (joinedWithoutMe.length < joinedContacts.length) {
          messages.push(i18n('icu:youJoinedTheGroup'));
        }
      } else {
        const joinedContact = window.ConversationController.getOrCreate(
          groupUpdate.joined[0],
          'private'
        );
        if (isMe(joinedContact.attributes)) {
          messages.push(i18n('icu:youJoinedTheGroup'));
        } else {
          messages.push(
            i18n('icu:joinedTheGroup', {
              name: joinedContacts[0].getTitle(),
            })
          );
        }
      }
    }

    if (groupUpdate.name) {
      messages.push(
        i18n('icu:titleIsNow', {
          name: groupUpdate.name,
        })
      );
    }
    if (groupUpdate.avatarUpdated) {
      messages.push(i18n('icu:updatedGroupAvatar'));
    }

    return { text: messages.join(' ') };
  }
  if (isEndSession(attributes)) {
    return { text: i18n('icu:sessionEnded') };
  }
  if (isIncoming(attributes) && hasErrors(attributes)) {
    return { text: i18n('icu:incomingError') };
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
        text: i18n('icu:message--attachmentTooBig--one'),
      };
    }

    if (contentType === MIME.IMAGE_GIF || Attachment.isGIF(attachments)) {
      return {
        bodyRanges,
        emoji: '🎡',
        text: body || i18n('icu:message--getNotificationText--gif'),
      };
    }
    if (Attachment.isImage(attachments)) {
      return {
        bodyRanges,
        emoji: '📷',
        text: body || i18n('icu:message--getNotificationText--photo'),
      };
    }
    if (Attachment.isVideo(attachments)) {
      return {
        bodyRanges,
        emoji: '🎥',
        text: body || i18n('icu:message--getNotificationText--video'),
      };
    }
    if (Attachment.isVoiceMessage(attachment)) {
      return {
        bodyRanges,
        emoji: '🎤',
        text: body || i18n('icu:message--getNotificationText--voice-message'),
      };
    }
    if (Attachment.isAudio(attachments)) {
      return {
        bodyRanges,
        emoji: '🔈',
        text: body || i18n('icu:message--getNotificationText--audio-message'),
      };
    }

    return {
      bodyRanges,
      text: body || i18n('icu:message--getNotificationText--file'),
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
      text: i18n('icu:message--getNotificationText--stickers'),
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
      const text = getCallingNotificationText(callingNotification, i18n);
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
      return { text: i18n('icu:disappearingMessagesDisabled') };
    }

    return {
      text: i18n('icu:timerSetTo', {
        time: expirationTimer.format(i18n, expireTimer),
      }),
    };
  }

  if (isKeyChange(attributes)) {
    const { key_changed: identifier } = attributes;
    const conversation = window.ConversationController.get(identifier);
    return {
      text: i18n('icu:safetyNumberChangedGroup', {
        name: conversation ? conversation.getTitle() : '',
      }),
    };
  }
  const { contact: contacts } = attributes;
  if (contacts && contacts.length) {
    return {
      text: EmbeddedContact.getName(contacts[0]) || i18n('icu:unknownContact'),
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
      const recipient = toContact?.getTitle() ?? i18n('icu:unknownContact');
      return {
        emoji,
        text: i18n('icu:message--donation--preview--sent', {
          recipient,
        }),
      };
    }

    const fromContact = getAuthor(attributes);
    const sender = fromContact?.getTitle() ?? i18n('icu:unknownContact');
    return {
      emoji,
      text:
        giftBadge.state === GiftBadgeStates.Unopened
          ? i18n('icu:message--donation--preview--unopened', {
              sender,
            })
          : i18n('icu:message--donation--preview--redeemed'),
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
