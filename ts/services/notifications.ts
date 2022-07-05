// Copyright 2015-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce } from 'lodash';
import EventEmitter from 'events';
import { Sound } from '../util/Sound';
import {
  AudioNotificationSupport,
  getAudioNotificationSupport,
  shouldHideExpiringMessageBody,
} from '../types/Settings';
import * as OS from '../OS';
import * as log from '../logging/log';
import { makeEnumParser } from '../util/enum';
import { missingCaseError } from '../util/missingCaseError';
import type { StorageInterface } from '../types/Storage.d';
import type { LocalizerType } from '../types/Util';

type NotificationDataType = Readonly<{
  conversationId: string;
  messageId: string;
  senderTitle: string;
  message: string;
  notificationIconUrl?: undefined | string;
  isExpiringMessage: boolean;
  reaction: {
    emoji: string;
    targetAuthorUuid: string;
    targetTimestamp: number;
  };
  wasShown?: boolean;
}>;

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
  private i18n?: LocalizerType;

  private storage?: StorageInterface;

  public isEnabled = false;

  private lastNotification: null | Notification = null;

  private notificationData: null | NotificationDataType = null;

  // Testing indicated that trying to create/destroy notifications too quickly
  //   resulted in notifications that stuck around forever, requiring the user
  //   to manually close them. This introduces a minimum amount of time between calls,
  //   and batches up the quick successive update() calls we get from an incoming
  //   read sync, which might have a number of messages referenced inside of it.
  private update: () => unknown;

  constructor() {
    super();

    this.update = debounce(this.fastUpdate.bind(this), 1000);
  }

  public initialize({
    i18n,
    storage,
  }: Readonly<{ i18n: LocalizerType; storage: StorageInterface }>): void {
    log.info('NotificationService initialized');
    this.i18n = i18n;
    this.storage = storage;
  }

  private getStorage(): StorageInterface {
    if (this.storage) {
      return this.storage;
    }

    log.error(
      'NotificationService not initialized. Falling back to window.storage, but you should fix this'
    );
    return window.storage;
  }

  private getI18n(): LocalizerType {
    if (this.i18n) {
      return this.i18n;
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
    this.notificationData = notificationData;
    this.update();
  }

  /**
   * A lower-level wrapper around `window.Notification`. You may prefer to use `add`,
   * which includes debouncing and user permission logic.
   */
  public notify({
    icon,
    message,
    onNotificationClick,
    silent,
    title,
  }: Readonly<{
    icon?: string;
    message: string;
    onNotificationClick: () => void;
    silent: boolean;
    title: string;
  }>): void {
    log.info('NotificationService: showing a notification');

    this.lastNotification?.close();

    const audioNotificationSupport = getAudioNotificationSupport();

    const notification = new window.Notification(title, {
      body: OS.isLinux() ? filterNotificationText(message) : message,
      icon,
      silent:
        silent || audioNotificationSupport !== AudioNotificationSupport.Native,
    });
    notification.onclick = onNotificationClick;

    if (
      !silent &&
      audioNotificationSupport === AudioNotificationSupport.Custom
    ) {
      // We kick off the sound to be played. No need to await it.
      new Sound({ src: 'sounds/notification.ogg' }).play();
    }

    this.lastNotification = notification;
  }

  // Remove the last notification if both conditions hold:
  //
  // 1. Either `conversationId` or `messageId` matches (if present)
  // 2. `emoji`, `targetAuthorUuid`, `targetTimestamp` matches (if present)
  public removeBy({
    conversationId,
    messageId,
    emoji,
    targetAuthorUuid,
    targetTimestamp,
  }: Readonly<{
    conversationId?: string;
    messageId?: string;
    emoji?: string;
    targetAuthorUuid?: string;
    targetTimestamp?: number;
  }>): void {
    if (!this.notificationData) {
      log.info('NotificationService#removeBy: no notification data');
      return;
    }

    let shouldClear = false;
    if (
      conversationId &&
      this.notificationData.conversationId === conversationId
    ) {
      log.info('NotificationService#removeBy: conversation ID matches');
      shouldClear = true;
    }
    if (messageId && this.notificationData.messageId === messageId) {
      log.info('NotificationService#removeBy: message ID matches');
      shouldClear = true;
    }

    if (!shouldClear) {
      return;
    }

    const { reaction } = this.notificationData;
    if (
      reaction &&
      emoji &&
      targetAuthorUuid &&
      targetTimestamp &&
      (reaction.emoji !== emoji ||
        reaction.targetAuthorUuid !== targetAuthorUuid ||
        reaction.targetTimestamp !== targetTimestamp)
    ) {
      return;
    }

    this.clear();
    this.update();
  }

  private fastUpdate(): void {
    const storage = this.getStorage();
    const i18n = this.getI18n();

    if (this.lastNotification) {
      this.lastNotification.close();
      this.lastNotification = null;
    }

    const { notificationData } = this;
    const isAppFocused = window.SignalContext.activeWindowService.isActive();
    const userSetting = this.getNotificationSetting();

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
        this.notificationData = null;
      }
      return;
    }

    const shouldPlayNotificationSound = Boolean(
      storage.get('audio-notification')
    );

    const shouldDrawAttention = storage.get(
      'notification-draw-attention',
      true
    );
    if (shouldDrawAttention) {
      log.info('NotificationService: drawing attention');
      window.drawAttention();
    }

    let notificationTitle: string;
    let notificationMessage: string;
    let notificationIconUrl: undefined | string;

    const {
      conversationId,
      messageId,
      senderTitle,
      message,
      isExpiringMessage,
      reaction,
      wasShown,
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
        ({ notificationIconUrl } = notificationData);

        if (isExpiringMessage && shouldHideExpiringMessageBody()) {
          notificationMessage = i18n('newMessage');
        } else if (userSetting === NotificationSetting.NameOnly) {
          if (reaction) {
            notificationMessage = i18n('notificationReaction', {
              sender: senderTitle,
              emoji: reaction.emoji,
            });
          } else {
            notificationMessage = i18n('newMessage');
          }
        } else if (reaction) {
          notificationMessage = i18n('notificationReactionMessage', {
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
        notificationMessage = i18n('newMessage');
        break;
      default:
        log.error(missingCaseError(userSetting));
        notificationTitle = FALLBACK_NOTIFICATION_TITLE;
        notificationMessage = i18n('newMessage');
        break;
    }

    log.info('NotificationService: requesting a notification to be shown');

    this.notificationData = {
      ...notificationData,
      wasShown: true,
    };

    this.notify({
      title: notificationTitle,
      icon: notificationIconUrl,
      message: notificationMessage,
      silent: !shouldPlayNotificationSound,
      onNotificationClick: () => {
        this.emit('click', conversationId, messageId);
      },
    });
  }

  public getNotificationSetting(): NotificationSetting {
    return parseNotificationSetting(
      this.getStorage().get('notification-setting')
    );
  }

  public clear(): void {
    log.info(
      'NotificationService: clearing notification and requesting an update'
    );
    this.notificationData = null;
    this.update();
  }

  // We don't usually call this, but when the process is shutting down, we should at
  //   least try to remove the notification immediately instead of waiting for the
  //   normal debounce.
  public fastClear(): void {
    log.info('NotificationService: clearing notification and updating');
    this.notificationData = null;
    this.fastUpdate();
  }

  public enable(): void {
    log.info('NotificationService: enabling');
    const needUpdate = !this.isEnabled;
    this.isEnabled = true;
    if (needUpdate) {
      this.update();
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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
