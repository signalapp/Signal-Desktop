// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import os from 'node:os';
import lodash from 'lodash';
import EventEmitter from 'node:events';
import { v4 as getGuid } from 'uuid';

import { Sound, SoundType } from '../util/Sound.std.ts';
import { shouldHideExpiringMessageBody } from '../types/Settings.std.ts';
import { itemStorage as fallbackStorage } from '../textsecure/Storage.preload.ts';
import OS from '../util/os/osMain.node.ts';
import { createLogger } from '../logging/log.std.ts';
import { makeEnumParser } from '../util/enum.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { toLogFormat } from '../types/errors.std.ts';
import type { StorageInterface } from '../types/Storage.d.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { NotificationType } from '../types/notifications.std.ts';
import { drop } from '../util/drop.std.ts';
import type { Emoji } from '../axo/emoji.std.ts';
import {
  getUnreadReminderNotificationContent,
  type UnreadReminderSummary,
} from '../util/unreadReminders.std.ts';

const { debounce } = lodash;

const log = createLogger('notifications');

type QueuedNotificationData = Readonly<
  | {
      type: NotificationType.Message | NotificationType.Reaction;
      conversationId: string;
      isExpiringMessage: boolean;
      messageId: string;
      message: string;
      iconUrl: string | null;
      iconAbsolutePath: string | null;
      reaction?: {
        emoji: Emoji.Variant;
        targetAuthorAci: string;
        targetTimestamp: number;
      };
      pollVote?: {
        voterConversationId: string;
        targetAuthorAci: string;
        targetTimestamp: number;
      };
      senderTitle: string;
      sentAt: number;
      storyId?: string;
    }
  | {
      type: NotificationType.UnreadReminder;
      conversationId: string;
      summary: UnreadReminderSummary;
      iconUrl: string | null;
      iconAbsolutePath: string | null;
    }
>;

export type ProcessedNotificationData = Readonly<
  {
    conversationId: string;
    title: string;
    body: string;
    iconUrl: string | null;
    iconAbsolutePath: string | null;
    silent: boolean;
  } & (
    | {
        type: NotificationType.Message | NotificationType.Reaction;
        messageId: string;
        sentAt: number;
        storyId: string | null;
        reaction?: {
          emoji: Emoji.Variant;
          targetAuthorAci: string;
          targetTimestamp: number;
        };
        pollVote?: {
          voterConversationId: string;
          targetAuthorAci: string;
          targetTimestamp: number;
        };
      }
    | {
        type: Exclude<
          NotificationType,
          NotificationType.Message | NotificationType.Reaction
        >;
      }
  )
>;

type RemoveByOptions = Readonly<
  {
    emoji?: Emoji.Variant;
    targetAuthorAci?: string;
    targetTimestamp?: number;
    onlyRemoveAssociatedPollVotes?: boolean;
  } & (
    | { conversationId: string; messageId?: string }
    | { messageId: string; conversationId?: string }
  )
>;

export type NotificationClickData = Readonly<{
  conversationId: string;
  messageId: string | undefined;
  storyId: string | undefined;
}>;
export type WindowsNotificationData = {
  avatarPath?: string;
  body: string;
  heading: string;
  token: string;
  type: NotificationType;
};

// The keys and values don't match here. This is because the values correspond to old
//   setting names. In the future, we may wish to migrate these to match.
export enum NotificationSetting {
  Off = 'off',
  NoNameOrMessage = 'count',
  NameOnly = 'name',
  NameAndMessage = 'message',
}

const parseNotificationSetting = makeEnumParser(
  NotificationSetting,
  NotificationSetting.NameAndMessage
);

export const FALLBACK_NOTIFICATION_TITLE = 'Signal';

const SHOWN_EVENT = 'shown';

function getSoundTypeFor(type: NotificationType): SoundType {
  switch (type) {
    case NotificationType.Message:
    case NotificationType.Reaction:
    case NotificationType.UnreadReminder:
      return SoundType.Pop;
    case NotificationType.IncomingCall:
    case NotificationType.IncomingGroupCall:
    case NotificationType.IsPresenting:
      return SoundType.TriTone;
    default:
      throw missingCaseError(type);
  }
}

// Electron, at least on Windows and macOS, only shows one notification at a time (see
//   issues [#15364][0] and [#21646][1], among others). Because of that, we have a
//   single slot for notifications, and once a notification is dismissed, all of
//   Signal's notifications are dismissed.
// [0]: https://github.com/electron/electron/issues/15364
// [1]: https://github.com/electron/electron/issues/21646
export class NotificationService extends EventEmitter {
  #i18n?: LocalizerType;
  #storage?: StorageInterface;

  public isEnabled = false;

  // queued via add()
  #queuedNotification: QueuedNotificationData | null = null;
  // Last shown notification. NB: On Windows we currently do not retain a Notification object
  #lastShown: {
    notification: Notification | null;
    data: ProcessedNotificationData;
  } | null = null;

  #shouldClearLastShown = false;

  #tokenData: { token: string; data: NotificationClickData } | undefined;

  // Testing indicated that trying to create/destroy notifications too quickly
  //   resulted in notifications that stuck around forever, requiring the user
  //   to manually close them. This introduces a minimum amount of time between calls,
  //   and batches up the quick successive update() calls we get from an incoming
  //   read sync, which might have a number of messages referenced inside of it.
  readonly #update: () => unknown;

  constructor() {
    super();

    this.#update = debounce(this.#fastUpdate.bind(this), 1000);
  }

  public initialize({
    i18n,
    storage,
  }: Readonly<{ i18n: LocalizerType; storage: StorageInterface }>): void {
    log.info('NotificationService initialized');
    this.#i18n = i18n;
    this.#storage = storage;
  }

  #getStorage(): StorageInterface {
    if (this.#storage) {
      return this.#storage;
    }

    log.error(
      'NotificationService not initialized. Falling back to storage, but you should fix this'
    );
    return fallbackStorage;
  }

  #getI18n(): LocalizerType {
    if (this.#i18n) {
      return this.#i18n;
    }

    log.error(
      'NotificationService not initialized. ' +
        'Falling back to window.SignalContext.i18n, but you should fix this'
    );
    return window.SignalContext.i18n;
  }

  /**
   * A higher-level wrapper around `window.Notification`. You may prefer to use `rawNotify`,
   * which doesn't check permissions, do any filtering, etc.
   */
  public add(notificationData: QueuedNotificationData): void {
    this.#queuedNotification = notificationData;
    this.#update();
  }

  /**
   * A lower-level wrapper around `window.Notification`. You may prefer to use `add`,
   * which includes debouncing and user permission logic.
   */
  public rawNotify(data: ProcessedNotificationData): void {
    const {
      conversationId,
      iconUrl,
      iconAbsolutePath,
      body,
      silent,
      title,
      type,
    } = data;

    const messageId = 'messageId' in data ? data.messageId : undefined;
    const storyId = 'storyId' in data ? (data.storyId ?? undefined) : undefined;

    log.info(
      'NotificationService: showing a notification',
      type,
      'sentAt' in data ? data.sentAt : undefined
    );

    this.#closeLastShown();

    if (OS.isWindows()) {
      const token = this._createToken({
        conversationId,
        messageId,
        storyId,
      });

      // Note: showing a windows notification clears all previous notifications first
      drop(
        window.IPC.showWindowsNotification({
          avatarPath: iconAbsolutePath ?? undefined,
          body,
          heading: title,
          type,
          token,
        })
      );

      this.#lastShown = { notification: null, data };
    } else {
      const notification = new window.Notification(title, {
        body: OS.isLinux() ? filterNotificationBody(body) : body,
        icon: iconUrl ?? undefined,
        silent: true,
        tag: messageId,
      });

      notification.onclick = () => {
        // Note: this maps to the xmlTemplate() function in app/WindowsNotifications.ts
        if (
          type === NotificationType.Message ||
          type === NotificationType.Reaction ||
          type === NotificationType.UnreadReminder
        ) {
          window.IPC.showWindow();
          window.Events.showConversationViaNotification({
            conversationId,
            messageId,
            storyId: storyId ?? undefined,
          });
        } else if (type === NotificationType.IncomingGroupCall) {
          window.IPC.showWindow();
          window.reduxActions?.calling?.startCallingLobby({
            conversationId,
            isVideoCall: true,
          });
        } else if (type === NotificationType.IsPresenting) {
          window.reduxActions?.calling?.cancelPresenting();
        } else if (type === NotificationType.IncomingCall) {
          window.IPC.showWindow();
        } else {
          throw missingCaseError(type);
        }
      };

      this.#lastShown = { notification, data };
    }

    if (!silent) {
      // We kick off the sound to be played. No need to await it.
      drop(new Sound({ soundType: getSoundTypeFor(type) }).play());
    }

    this.emit(SHOWN_EVENT, data);
  }

  public onShown(handler: (data: ProcessedNotificationData) => void): void {
    this.on(SHOWN_EVENT, handler);
  }

  public offShown(handler: (data: ProcessedNotificationData) => void): void {
    this.off(SHOWN_EVENT, handler);
  }

  #closeLastShown(): void {
    const lastShown = this.#lastShown;
    this.#lastShown = null;
    this.#shouldClearLastShown = false;

    if (lastShown?.notification != null) {
      lastShown.notification.close();
      return;
    }

    if (OS.isWindows()) {
      this.#tokenData = undefined;
      drop(window.IPC.clearAllWindowsNotifications());
    }
  }

  // Remove the last notification if both conditions hold:
  //
  // 1. Either `conversationId` or `messageId` matches (if present)
  // 2. Reaction: `emoji`, `targetAuthorAci`, `targetTimestamp` matches
  // 3. Poll vote: `onlyRemoveAssociatedPollVotes` flag is true
  public removeBy(identifier: RemoveByOptions): void {
    if (
      this.#queuedNotification &&
      this.#matchesNotification(identifier, this.#queuedNotification)
    ) {
      log.info('Removing queued notification');
      this.#queuedNotification = null;
    }

    if (
      this.#lastShown &&
      this.#matchesNotification(identifier, this.#lastShown.data)
    ) {
      log.info('Requesting dismissal of shown notification');
      this.#shouldClearLastShown = true;
      this.#update();
    }
  }

  #matchesNotification(
    identifier: RemoveByOptions,
    data: QueuedNotificationData | ProcessedNotificationData
  ): boolean {
    if (
      data.type !== NotificationType.Message &&
      data.type !== NotificationType.Reaction &&
      data.type !== NotificationType.UnreadReminder
    ) {
      return false;
    }

    const {
      conversationId,
      messageId,
      emoji,
      targetAuthorAci,
      targetTimestamp,
      onlyRemoveAssociatedPollVotes,
    } = identifier;

    const matchesConversationId =
      conversationId != null && data.conversationId === conversationId;
    const matchesMessageId =
      messageId != null && 'messageId' in data && data.messageId === messageId;

    if (!matchesConversationId && !matchesMessageId) {
      return false;
    }

    // If reaction filters are provided, only remove reaction notifications that match
    const hasReactionFilters = Boolean(
      emoji && targetAuthorAci && targetTimestamp
    );

    if (hasReactionFilters) {
      if (data.type !== NotificationType.Reaction) {
        return false;
      }

      const { reaction } = data;
      if (!reaction) {
        // Looking for reactions but this isn't one
        return false;
      }
      if (
        reaction.emoji !== emoji ||
        reaction.targetAuthorAci !== targetAuthorAci ||
        reaction.targetTimestamp !== targetTimestamp
      ) {
        // Reaction doesn't match the filter
        return false;
      }
    }

    // If onlyRemoveAssociatedPollVotes is true, only remove poll vote notifications
    // that match the targetAuthorAci and targetTimestamp
    if (onlyRemoveAssociatedPollVotes && targetAuthorAci && targetTimestamp) {
      if (data.type !== NotificationType.Message) {
        return false;
      }

      const { pollVote } = data;
      if (
        !pollVote ||
        pollVote.targetAuthorAci !== targetAuthorAci ||
        pollVote.targetTimestamp !== targetTimestamp
      ) {
        // Looking for poll votes but this isn't one
        return false;
      }
    }

    return true;
  }

  #fastUpdate(): void {
    const storage = this.#getStorage();
    const i18n = this.#getI18n();
    const queuedNotificationData = this.#queuedNotification;
    const isAppFocused = window.SignalContext.activeWindowService.isActive();
    const userSetting = this.getNotificationSetting();

    if (this.#shouldClearLastShown) {
      this.#closeLastShown();
    }

    if (isAppFocused) {
      this.#queuedNotification = null;
      return;
    }

    if (!this.isEnabled || queuedNotificationData == null) {
      return;
    }

    if (userSetting === NotificationSetting.Off) {
      return;
    }

    const shouldPlayNotificationSound = Boolean(
      storage.get('audio-notification')
    );

    const shouldDrawAttention = storage.get(
      'notification-draw-attention',
      false
    );
    if (shouldDrawAttention) {
      log.info('NotificationService: drawing attention');
      window.IPC.drawAttention();
    }

    const { conversationId, type } = queuedNotificationData;

    this.#queuedNotification = null;

    switch (type) {
      case NotificationType.Message:
      case NotificationType.Reaction: {
        const content = redactMessageNotificationContent({
          notificationData: queuedNotificationData,
          contentSetting: userSetting,
          i18n,
        });

        return this.rawNotify({
          conversationId,
          type,
          title: content.title,
          body: content.body,
          iconUrl: content.iconUrl,
          iconAbsolutePath: content.iconAbsolutePath,
          sentAt: queuedNotificationData.sentAt,
          messageId: queuedNotificationData.messageId,
          storyId: queuedNotificationData.storyId ?? null,
          reaction: queuedNotificationData.reaction,
          pollVote: queuedNotificationData.pollVote,
          silent: !shouldPlayNotificationSound,
        });
      }
      case NotificationType.UnreadReminder: {
        const contentSetting =
          userSetting === NotificationSetting.NameAndMessage ||
          userSetting === NotificationSetting.NameOnly
            ? 'full'
            : 'countsOnly';
        const content = getUnreadReminderNotificationContent({
          summary: queuedNotificationData.summary,
          contentSetting,
          fallbackTitle: FALLBACK_NOTIFICATION_TITLE,
          i18n,
        });

        return this.rawNotify({
          conversationId,
          type,
          title: content.title,
          body: content.body,
          silent: !shouldPlayNotificationSound,
          iconUrl:
            contentSetting === 'full' ? queuedNotificationData.iconUrl : null,
          iconAbsolutePath:
            contentSetting === 'full'
              ? queuedNotificationData.iconAbsolutePath
              : null,
        });
      }
      default:
        throw missingCaseError(type);
    }
  }

  public getNotificationSetting(): NotificationSetting {
    return parseNotificationSetting(
      this.#getStorage().get('notification-setting')
    );
  }

  /** @internal */
  public _createToken(data: NotificationClickData): string {
    const token = getGuid();

    this.#tokenData = {
      token,
      data,
    };

    return token;
  }

  public resolveToken(token: string): NotificationClickData | undefined {
    if (!this.#tokenData) {
      log.warn(`NotificationService: no data when looking up ${token}`);
      return undefined;
    }

    if (this.#tokenData.token !== token) {
      log.warn(`NotificationService: token mismatch ${token}`);
      return undefined;
    }

    return this.#tokenData.data;
  }

  public clear(): void {
    if (this.#lastShown) {
      log.info(
        'NotificationService: clearing notification and requesting an update'
      );
    }
    // We defer immediately clearing the notification so that we retain the token for
    // Windows locally for a debounce interval
    this.#shouldClearLastShown = true;
    this.#queuedNotification = null;
    this.#update();
  }

  // We don't usually call this, but when the process is shutting down, we should at
  //   least try to remove the notification immediately instead of waiting for the
  //   normal debounce.
  public fastClear(): void {
    log.info('NotificationService: clearing notification and updating');
    this.#closeLastShown();
    this.#queuedNotification = null;
    this.#fastUpdate();
  }

  public enable(): void {
    log.info('NotificationService: enabling');
    const needUpdate = !this.isEnabled;
    this.isEnabled = true;
    if (needUpdate) {
      this.#update();
    }
  }

  public disable(): void {
    log.info('NotificationService: disabling');
    this.isEnabled = false;
  }
}

export const notificationService = new NotificationService();

function filterNotificationBody(text: string) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function shouldSaveNotificationAvatarToDisk(): boolean {
  const notificationSetting = notificationService.getNotificationSetting();
  switch (notificationSetting) {
    case NotificationSetting.NameOnly:
    case NotificationSetting.NameAndMessage:
      // According to the MSDN, avatars can only be loaded from disk or an
      // http server:
      // https://learn.microsoft.com/en-us/uwp/schemas/tiles/toastschema/element-image?redirectedfrom=MSDN
      return OS.isWindows();
    case NotificationSetting.Off:
    case NotificationSetting.NoNameOrMessage:
      return false;
    default:
      throw missingCaseError(notificationSetting);
  }
}

function redactMessageNotificationContent({
  notificationData,
  i18n,
  contentSetting,
}: {
  notificationData: QueuedNotificationData & {
    type: NotificationType.Message | NotificationType.Reaction;
  };
  i18n: LocalizerType;
  contentSetting: Exclude<NotificationSetting, NotificationSetting.Off>;
}): {
  title: string;
  body: string;
  iconUrl: string | null;
  iconAbsolutePath: string | null;
} {
  let title: string;
  let body: string;
  let iconUrl: string | null = null;
  let iconAbsolutePath: string | null = null;

  switch (contentSetting) {
    case NotificationSetting.NameOnly:
    case NotificationSetting.NameAndMessage: {
      title = notificationData.senderTitle;
      ({ iconUrl, iconAbsolutePath } = notificationData);

      if (
        notificationData.isExpiringMessage &&
        shouldHideExpiringMessageBody(OS, os.release())
      ) {
        body = i18n('icu:newMessage');
      } else if (contentSetting === NotificationSetting.NameOnly) {
        body = i18n('icu:newMessage');
      } else if (notificationData.storyId) {
        body = notificationData.message;
      } else if (notificationData.reaction) {
        body = i18n('icu:notificationReactionMessage', {
          sender: notificationData.senderTitle,
          emoji: notificationData.reaction.emoji,
          message: notificationData.message,
        });
      } else if (notificationData.pollVote) {
        body = i18n('icu:notificationPollVoteMessage', {
          sender: notificationData.senderTitle,
          pollQuestion: notificationData.message,
        });
      } else {
        body = notificationData.message;
      }
      break;
    }
    case NotificationSetting.NoNameOrMessage:
      title = FALLBACK_NOTIFICATION_TITLE;
      body = i18n('icu:newMessage');
      break;
    default:
      log.error(toLogFormat(missingCaseError(contentSetting)));
      title = FALLBACK_NOTIFICATION_TITLE;
      body = i18n('icu:newMessage');
      break;
  }
  return {
    title,
    body,
    iconAbsolutePath,
    iconUrl,
  };
}
