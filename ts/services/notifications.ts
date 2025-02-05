// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import os from 'os';
import { debounce } from 'lodash';
import EventEmitter from 'events';
import { v4 as getGuid } from 'uuid';

import { Sound, SoundType } from '../util/Sound';
import { shouldHideExpiringMessageBody } from '../types/Settings';
import OS from '../util/os/osMain';
import * as log from '../logging/log';
import { makeEnumParser } from '../util/enum';
import { missingCaseError } from '../util/missingCaseError';
import type { StorageInterface } from '../types/Storage.d';
import type { LocalizerType } from '../types/Util';
import { drop } from '../util/drop';

type NotificationDataType = Readonly<{
  conversationId: string;
  isExpiringMessage: boolean;
  messageId: string;
  message: string;
  notificationIconUrl?: undefined | string;
  notificationIconAbsolutePath?: undefined | string;
  reaction?: {
    emoji: string;
    targetAuthorAci: string;
    targetTimestamp: number;
  };
  senderTitle: string;
  sentAt: number;
  storyId?: string;
  type: NotificationType;
  useTriToneSound?: boolean;
  wasShown?: boolean;
}>;

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
export enum NotificationType {
  IncomingCall = 'IncomingCall',
  IncomingGroupCall = 'IncomingGroupCall',
  IsPresenting = 'IsPresenting',
  Message = 'Message',
  Reaction = 'Reaction',
}

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

// Electron, at least on Windows and macOS, only shows one notification at a time (see
//   issues [#15364][0] and [#21646][1], among others). Because of that, we have a
//   single slot for notifications, and once a notification is dismissed, all of
//   Signal's notifications are dismissed.
// [0]: https://github.com/electron/electron/issues/15364
// [1]: https://github.com/electron/electron/issues/21646
class NotificationService extends EventEmitter {
  #i18n?: LocalizerType;
  #storage?: StorageInterface;

  public isEnabled = false;

  #lastNotification: null | Notification = null;
  #notificationData: null | NotificationDataType = null;
  #tokenData: { token: string; data: NotificationClickData } | undefined;

  // Testing indicated that trying to create/destroy notifications too quickly
  //   resulted in notifications that stuck around forever, requiring the user
  //   to manually close them. This introduces a minimum amount of time between calls,
  //   and batches up the quick successive update() calls we get from an incoming
  //   read sync, which might have a number of messages referenced inside of it.
  #update: () => unknown;

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
      'NotificationService not initialized. Falling back to window.storage, but you should fix this'
    );
    return window.storage;
  }

  #getI18n(): LocalizerType {
    if (this.#i18n) {
      return this.#i18n;
    }

    log.error(
      'NotificationService not initialized. Falling back to window.i18n, but you should fix this'
    );
    return window.i18n;
  }

  /**
   * A higher-level wrapper around `window.Notification`. You may prefer to use `notify`,
   * which doesn't check permissions, do any filtering, etc.
   */
  public add(notificationData: Omit<NotificationDataType, 'wasShown'>): void {
    log.info(
      'NotificationService: adding a notification and requesting an update'
    );
    this.#notificationData = notificationData;
    this.#update();
  }

  /**
   * A lower-level wrapper around `window.Notification`. You may prefer to use `add`,
   * which includes debouncing and user permission logic.
   */
  public notify({
    conversationId,
    iconUrl,
    iconPath,
    message,
    messageId,
    sentAt,
    silent,
    storyId,
    title,
    type,
    useTriToneSound,
  }: Readonly<{
    conversationId: string;
    iconUrl?: string;
    iconPath?: string;
    message: string;
    messageId?: string;
    sentAt: number;
    silent: boolean;
    storyId?: string;
    title: string;
    type: NotificationType;
    useTriToneSound?: boolean;
  }>): void {
    log.info('NotificationService: showing a notification', sentAt);

    if (OS.isWindows()) {
      const token = this._createToken({
        conversationId,
        messageId,
        storyId,
      });

      // Note: showing a windows notification clears all previous notifications first
      drop(
        window.IPC.showWindowsNotification({
          avatarPath: iconPath,
          body: message,
          heading: title,
          type,
          token,
        })
      );
    } else {
      this.#lastNotification?.close();

      const notification = new window.Notification(title, {
        body: OS.isLinux() ? filterNotificationText(message) : message,
        icon: iconUrl,
        silent: true,
        tag: messageId,
      });

      notification.onclick = () => {
        // Note: this maps to the xmlTemplate() function in app/WindowsNotifications.ts
        if (
          type === NotificationType.Message ||
          type === NotificationType.Reaction
        ) {
          window.IPC.showWindow();
          window.Events.showConversationViaNotification({
            conversationId,
            messageId,
            storyId,
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

      this.#lastNotification = notification;
    }

    if (!silent) {
      const soundType =
        messageId && !useTriToneSound ? SoundType.Pop : SoundType.TriTone;
      // We kick off the sound to be played. No need to await it.
      drop(new Sound({ soundType }).play());
    }
  }

  // Remove the last notification if both conditions hold:
  //
  // 1. Either `conversationId` or `messageId` matches (if present)
  // 2. `emoji`, `targetAuthorAci`, `targetTimestamp` matches (if present)
  public removeBy({
    conversationId,
    messageId,
    emoji,
    targetAuthorAci,
    targetTimestamp,
  }: Readonly<{
    conversationId?: string;
    messageId?: string;
    emoji?: string;
    targetAuthorAci?: string;
    targetTimestamp?: number;
  }>): void {
    if (!this.#notificationData) {
      log.info('NotificationService#removeBy: no notification data');
      return;
    }

    let shouldClear = false;
    if (
      conversationId &&
      this.#notificationData.conversationId === conversationId
    ) {
      log.info('NotificationService#removeBy: conversation ID matches');
      shouldClear = true;
    }
    if (messageId && this.#notificationData.messageId === messageId) {
      log.info('NotificationService#removeBy: message ID matches');
      shouldClear = true;
    }

    if (!shouldClear) {
      return;
    }

    const { reaction } = this.#notificationData;
    if (
      reaction &&
      emoji &&
      targetAuthorAci &&
      targetTimestamp &&
      (reaction.emoji !== emoji ||
        reaction.targetAuthorAci !== targetAuthorAci ||
        reaction.targetTimestamp !== targetTimestamp)
    ) {
      return;
    }

    this.clear();
    this.#update();
  }

  #fastUpdate(): void {
    const storage = this.#getStorage();
    const i18n = this.#getI18n();
    const notificationData = this.#notificationData;
    const isAppFocused = window.SignalContext.activeWindowService.isActive();
    const userSetting = this.getNotificationSetting();

    if (OS.isWindows()) {
      // Note: notificationData will be set if we're replacing the previous notification
      //   with a new one, so we won't clear here. That's because we always clear before
      //   adding anythhing new; just one notification at a time. Electron forces it, so
      //   we replicate it with our Windows notifications.
      if (!notificationData) {
        this.#tokenData = undefined;
        drop(window.IPC.clearAllWindowsNotifications());
      }
    } else if (this.#lastNotification) {
      this.#lastNotification.close();
      this.#lastNotification = null;
    }

    // This isn't a boolean because TypeScript isn't smart enough to know that, if
    //   `Boolean(notificationData)` is true, `notificationData` is truthy.
    const shouldShowNotification =
      this.isEnabled && !isAppFocused && notificationData;
    if (!shouldShowNotification) {
      log.info(
        `NotificationService not updating notifications. Notifications are ${
          this.isEnabled ? 'enabled' : 'disabled'
        }; app is ${isAppFocused ? '' : 'not '}focused; there is ${
          notificationData ? '' : 'no '
        }notification data`
      );
      if (isAppFocused) {
        this.#notificationData = null;
      }
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

    let notificationTitle: string;
    let notificationMessage: string;
    let notificationIconUrl: undefined | string;
    let notificationIconAbsolutePath: undefined | string;

    const {
      conversationId,
      isExpiringMessage,
      message,
      messageId,
      reaction,
      senderTitle,
      storyId,
      sentAt,
      useTriToneSound,
      wasShown,
      type,
    } = notificationData;

    if (wasShown) {
      log.info(
        'NotificationService: not showing a notification because it was already shown'
      );
      return;
    }

    switch (userSetting) {
      case NotificationSetting.Off:
        log.info(
          'NotificationService: not showing a notification because user has disabled it'
        );
        return;
      case NotificationSetting.NameOnly:
      case NotificationSetting.NameAndMessage: {
        notificationTitle = senderTitle;
        ({ notificationIconUrl, notificationIconAbsolutePath } =
          notificationData);

        if (
          isExpiringMessage &&
          shouldHideExpiringMessageBody(OS, os.release())
        ) {
          notificationMessage = i18n('icu:newMessage');
        } else if (userSetting === NotificationSetting.NameOnly) {
          if (reaction) {
            notificationMessage = i18n('icu:notificationReaction', {
              sender: senderTitle,
              emoji: reaction.emoji,
            });
          } else {
            notificationMessage = i18n('icu:newMessage');
          }
        } else if (storyId) {
          notificationMessage = message;
        } else if (reaction) {
          notificationMessage = i18n('icu:notificationReactionMessage', {
            sender: senderTitle,
            emoji: reaction.emoji,
            message,
          });
        } else {
          notificationMessage = message;
        }
        break;
      }
      case NotificationSetting.NoNameOrMessage:
        notificationTitle = FALLBACK_NOTIFICATION_TITLE;
        notificationMessage = i18n('icu:newMessage');
        break;
      default:
        log.error(missingCaseError(userSetting));
        notificationTitle = FALLBACK_NOTIFICATION_TITLE;
        notificationMessage = i18n('icu:newMessage');
        break;
    }

    log.info('NotificationService: requesting a notification to be shown');

    this.#notificationData = {
      ...notificationData,
      wasShown: true,
    };

    this.notify({
      conversationId,
      iconUrl: notificationIconUrl,
      iconPath: notificationIconAbsolutePath,
      messageId,
      message: notificationMessage,
      sentAt,
      silent: !shouldPlayNotificationSound,
      storyId,
      title: notificationTitle,
      type,
      useTriToneSound,
    });
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
    log.info(
      'NotificationService: clearing notification and requesting an update'
    );
    this.#notificationData = null;
    this.#update();
  }

  // We don't usually call this, but when the process is shutting down, we should at
  //   least try to remove the notification immediately instead of waiting for the
  //   normal debounce.
  public fastClear(): void {
    log.info('NotificationService: clearing notification and updating');
    this.#notificationData = null;
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

function filterNotificationText(text: string) {
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
