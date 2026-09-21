// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type { ConversationModel } from '../models/conversations.preload.ts';
import { DataReader, DataWriter } from '../sql/Client.preload.ts';
import { getActiveProfile } from '../state/selectors/notificationProfiles.dom.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import * as Errors from '../types/errors.std.ts';
import { shouldNotify as shouldNotifyDuringNotificationProfile } from '../types/NotificationProfile.std.ts';
import { NotificationType } from '../types/notifications.std.ts';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary.std.ts';
import { drop } from '../util/drop.std.ts';
import { getTitle } from '../util/getTitle.preload.ts';
import { isConversationMuted } from '../util/isConversationMuted.std.ts';
import { getNotifyWhileMutedForConversation } from '../util/notifyWhileMuted.preload.ts';
import * as Registration from '../util/registration.preload.ts';
import { safeSetTimeout } from '../util/timeout.std.ts';
import {
  filterForConversationsDueReminder,
  getShowUnreadRemindersForConversation,
  UNREAD_REMINDER_MIN_INTERVAL_BETWEEN_REMINDERS,
  UNREAD_REMINDER_POLL_INTERVAL,
  type UnreadReminderParticipant,
  type UnreadReminderSummary,
} from '../util/unreadReminders.std.ts';
import { isGroup, isMe } from '../util/whatTypeOfConversation.dom.ts';
import { notificationService } from './notifications.preload.ts';
import { MAX_SAFE_DATE } from '../util/timestamp.std.ts';

const log = createLogger('unreadReminders');

function includeStoryReplies(conversation: ConversationModel): boolean {
  return !isGroup(conversation.attributes);
}

class UnreadReminderService {
  #timeout: NodeJS.Timeout | null = null;
  #isInitialized = false;

  init(): void {
    if (this.#isInitialized) {
      log.warn('init: already initialized');
      return;
    }
    this.#isInitialized = true;

    if (itemStorage.get('unreadRemindersEnabledAt') == null) {
      const now = Date.now();
      log.info(`init: marking unread reminders enabled at ${now}`);
      drop(itemStorage.put('unreadRemindersEnabledAt', now));
    }

    notificationService.onShown(data => {
      if (data.type !== NotificationType.UnreadReminder) {
        return;
      }
      this.#markReminded(data.conversationId);
    });

    drop(this.#refresh());
  }

  #markReminded(conversationId: string): void {
    const conversation = window.ConversationController.get(conversationId);
    if (conversation == null) {
      return;
    }

    conversation.set({ lastUnreadReminderAt: Date.now() });
    drop(DataWriter.updateConversation(conversation.attributes));
  }

  async #refresh(): Promise<void> {
    clearTimeoutIfNecessary(this.#timeout);
    this.#timeout = null;

    try {
      await this.#doRefresh();
    } catch (error) {
      log.error('Refresh failed:', Errors.toLogFormat(error));
    } finally {
      this.#timeout = safeSetTimeout(
        () => drop(this.#refresh()),
        UNREAD_REMINDER_POLL_INTERVAL
      );
    }
  }

  async #doRefresh() {
    if (!Registration.isDone() || !notificationService.isEnabled) {
      return;
    }

    const eligible = window.ConversationController.getAll().filter(
      conversation => this.#isEligible(conversation)
    );

    if (eligible.length === 0) {
      return;
    }

    const candidates = await this.#getUnreadTimeRanges(eligible);
    const conversationIds = filterForConversationsDueReminder(
      candidates,
      Date.now()
    );
    // We only show one notification at a time, so we only queue a single chat.
    for (const conversationId of conversationIds) {
      // oxlint-disable-next-line no-await-in-loop
      if (await this.#maybeNotify(conversationId)) {
        return;
      }
    }
  }

  #isEligible(conversation: ConversationModel): boolean {
    const attributes = conversation.attributes;

    if (
      isMe(attributes) ||
      attributes.left ||
      attributes.removalStage != null ||
      conversation.isBlocked()
    ) {
      return false;
    }

    if (attributes.isArchived) {
      return false;
    }

    if (!isConversationMuted(attributes)) {
      return false;
    }

    if (!getShowUnreadRemindersForConversation(attributes, itemStorage)) {
      return false;
    }

    if (
      (conversation.attributes.lastUnreadReminderAt ?? 0) >
      Date.now() - UNREAD_REMINDER_MIN_INTERVAL_BETWEEN_REMINDERS
    ) {
      return false;
    }

    return (attributes.unreadCount ?? 0) > 0;
  }

  async #getUnreadTimeRanges(conversations: ReadonlyArray<ConversationModel>) {
    return DataReader.getUnremindedUnreadMessageTimeRanges(
      conversations.map(conversation => ({
        conversationId: conversation.id,
        lastRemindedAt:
          conversation.attributes.lastUnreadReminderAt ??
          // only show unread reminders for conversations with unread messages received
          // after feature launch
          itemStorage.get('unreadRemindersEnabledAt', MAX_SAFE_DATE),
        includeStoryReplies: includeStoryReplies(conversation),
      }))
    );
  }

  async #maybeNotify(conversationId: string): Promise<boolean> {
    const conversation = window.ConversationController.get(conversationId);
    if (conversation == null) {
      return false;
    }

    if (!this.#isEligible(conversation)) {
      return false;
    }

    const summary = await this.#getSummary(conversation);
    if (summary == null) {
      return false;
    }

    if (
      !shouldNotifyDuringNotificationProfile({
        activeProfile: getActiveProfile(window.reduxStore.getState()),
        conversationId,
        isCall: false,
        isMentionOrReply: false,
      })
    ) {
      log.info('maybeNotify: suppressed by the active notification profile');
      return false;
    }

    const { url, absolutePath } = await conversation.getAvatarOrIdenticon();

    notificationService.add({
      conversationId,
      type: NotificationType.UnreadReminder,
      summary,
      iconUrl: url ?? null,
      iconAbsolutePath: absolutePath ?? null,
    });

    return true;
  }

  async #getSummary(
    conversation: ConversationModel
  ): Promise<UnreadReminderSummary | undefined> {
    const ourAci = itemStorage.user.getAci();
    if (ourAci == null) {
      return undefined;
    }

    const data = await DataReader.getUnreadReminderSummaryData(
      conversation.id,
      {
        includeStoryReplies: includeStoryReplies(conversation),
        ourAci,
      }
    );

    if (data.unreadMessageCount <= 0) {
      return undefined;
    }

    const notifyWhileMuted = getNotifyWhileMutedForConversation(
      conversation.attributes
    );

    const toParticipants = (rows: ReadonlyArray<{ sourceServiceId: string }>) =>
      rows.map(row => this.#toParticipant(row.sourceServiceId));

    return {
      conversationId: conversation.id,
      conversationTitle: conversation.getTitle(),
      unreadMessageCount: data.unreadMessageCount,
      mentionCount: notifyWhileMuted.mentions ? data.mentionCount : 0,
      replyCount: notifyWhileMuted.replies ? data.replyCount : 0,
      senders: toParticipants(data.senders),
      mentioners: toParticipants(data.mentioners),
      repliers: toParticipants(data.repliers),
    };
  }

  #toParticipant(serviceId: string): UnreadReminderParticipant {
    const conversation = window.ConversationController.get(serviceId);

    if (!conversation) {
      log.warn('Cannot find conversation for chat participant');
    }

    return {
      title:
        conversation != null
          ? getTitle(conversation.attributes, { isShort: true })
          : window.SignalContext.i18n('icu:unknownContact'),
    };
  }
}

let instance: UnreadReminderService | undefined;

export function initialize(): void {
  if (instance) {
    return;
  }
  instance = new UnreadReminderService();
  instance.init();
}
