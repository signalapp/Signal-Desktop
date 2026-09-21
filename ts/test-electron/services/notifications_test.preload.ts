// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import os from 'node:os';

import type { Emoji } from '../../axo/emoji.std.ts';
import {
  NotificationService,
  NotificationSetting,
} from '../../services/notifications.preload.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { NotificationType } from '../../types/notifications.std.ts';
import OS from '../../util/os/osMain.node.ts';
import { Sound } from '../../util/Sound.std.ts';
import type { UnreadReminderSummary } from '../../util/unreadReminders.std.ts';

const DEBOUNCE_INTERVAL = 1000;

describe('NotificationService', () => {
  for (const platform of ['windows', 'macos', 'linux']) {
    describe(platform, () => {
      let sandbox: sinon.SinonSandbox;
      let clock: sinon.SinonFakeTimers;
      let service: NotificationService;
      let closeNotification: sinon.SinonStub;
      let showNotification: sinon.SinonStub;
      let getNotificationSetting: sinon.SinonStub;

      beforeEach(() => {
        sandbox = sinon.createSandbox();
        clock = sandbox.useFakeTimers();
        sandbox.stub(OS, 'isWindows').returns(platform === 'windows');
        sandbox.stub(OS, 'isMacOS').returns(platform === 'macos');
        sandbox.stub(OS, 'isLinux').returns(platform === 'linux');
        if (platform === 'macos') {
          sandbox.stub(os, 'release').returns('27.0.0');
        }
        sandbox.stub(Sound.prototype, 'play').resolves();
        sandbox.stub(window.IPC, 'drawAttention');
        sandbox
          .stub(window.SignalContext.activeWindowService, 'isActive')
          .returns(false);

        const closeNativeNotification = sandbox.stub();
        const createNativeNotification = sandbox
          .stub(window, 'Notification')
          .returns({
            close: closeNativeNotification,
          });
        const clearWindowsNotifications = sandbox
          .stub(window.IPC, 'clearAllWindowsNotifications')
          .resolves();
        const showWindowsNotification = sandbox
          .stub(window.IPC, 'showWindowsNotification')
          .resolves();

        closeNotification =
          platform === 'windows'
            ? clearWindowsNotifications
            : closeNativeNotification;
        showNotification =
          platform === 'windows'
            ? showWindowsNotification
            : createNativeNotification;

        service = new NotificationService();
        service.initialize({
          storage: itemStorage,
          i18n: window.SignalContext.i18n,
        });
        getNotificationSetting = sandbox
          .stub(service, 'getNotificationSetting')
          .returns(NotificationSetting.NameAndMessage);
        service.enable();
        clock.tick(DEBOUNCE_INTERVAL);
      });

      afterEach(() => {
        sandbox.restore();
      });

      function queueMessage(
        messageId = 'message',
        overrides: Partial<
          Extract<
            Parameters<NotificationService['add']>[0],
            { type: NotificationType.Message | NotificationType.Reaction }
          >
        > = {}
      ): void {
        service.add({
          type: NotificationType.Message,
          conversationId: 'chat',
          messageId,
          isExpiringMessage: false,
          message: 'Body',
          senderTitle: 'Alice',
          sentAt: 1,
          iconUrl: null,
          iconAbsolutePath: null,
          ...overrides,
        });
      }

      function showMessage(): void {
        queueMessage();
        clock.tick(DEBOUNCE_INTERVAL);
        closeNotification.resetHistory();
      }

      describe('redacts message notification content based on user setting', () => {
        const iconUrl = 'file:///avatar.png';
        const iconAbsolutePath = '/avatar.png';

        function assertShowNotificationCalledWith(expected: {
          title: string;
          body: string;
          iconUrl: string | undefined;
          iconAbsolutePath: string | undefined;
        }): void {
          sinon.assert.calledOnce(showNotification);
          if (platform === 'windows') {
            assert.include(showNotification.firstCall.args[0], {
              heading: expected.title,
              body: expected.body,
              avatarPath: expected.iconAbsolutePath,
            });
          } else {
            assert.strictEqual(
              showNotification.firstCall.args[0],
              expected.title
            );
            assert.include(showNotification.firstCall.args[1], {
              body: expected.body,
              icon: expected.iconUrl,
            });
          }
        }

        it(`displays full message content for NameAndMessage`, () => {
          getNotificationSetting.returns(NotificationSetting.NameAndMessage);
          queueMessage('message', { iconUrl, iconAbsolutePath });
          clock.tick(DEBOUNCE_INTERVAL);
          assertShowNotificationCalledWith({
            title: 'Alice',
            body: 'Body',
            iconUrl,
            iconAbsolutePath,
          });
        });

        it(`redacts body for NameAndMessage and disappearing message on Windows`, () => {
          getNotificationSetting.returns(NotificationSetting.NameAndMessage);
          queueMessage('message', {
            isExpiringMessage: true,
            iconUrl,
            iconAbsolutePath,
          });
          clock.tick(DEBOUNCE_INTERVAL);
          if (platform === 'windows') {
            assertShowNotificationCalledWith({
              title: 'Alice',
              body: window.SignalContext.i18n('icu:newMessage'),
              iconUrl,
              iconAbsolutePath,
            });
          } else {
            assertShowNotificationCalledWith({
              title: 'Alice',
              body: 'Body',
              iconUrl,
              iconAbsolutePath,
            });
          }
        });

        it(`redacts body for NameOnly`, () => {
          getNotificationSetting.returns(NotificationSetting.NameOnly);
          queueMessage('message', { iconUrl, iconAbsolutePath });
          clock.tick(DEBOUNCE_INTERVAL);
          assertShowNotificationCalledWith({
            title: 'Alice',
            body: window.SignalContext.i18n('icu:newMessage'),
            iconUrl,
            iconAbsolutePath,
          });
        });

        it(`redacts body, title, and avatar for NoNameOrMessage`, () => {
          getNotificationSetting.returns(NotificationSetting.NoNameOrMessage);
          queueMessage('message', { iconUrl, iconAbsolutePath });
          clock.tick(DEBOUNCE_INTERVAL);
          assertShowNotificationCalledWith({
            title: 'Signal',
            body: window.SignalContext.i18n('icu:newMessage'),
            iconUrl: undefined,
            iconAbsolutePath: undefined,
          });
        });
      });

      it('cancels a queued message before it reaches the screen', () => {
        queueMessage();
        service.removeBy({ messageId: 'message' });
        clock.tick(DEBOUNCE_INTERVAL);
        sinon.assert.notCalled(showNotification);
      });

      it('keeps a newer queued message when dismissing the displayed message', () => {
        showMessage();
        queueMessage('newer');
        service.removeBy({ messageId: 'message' });
        clock.tick(DEBOUNCE_INTERVAL);
        sinon.assert.calledTwice(showNotification);
      });

      it('keeps the displayed message when a different queued message is read', () => {
        showMessage();
        queueMessage('newer');
        service.removeBy({ messageId: 'newer' });
        clock.tick(DEBOUNCE_INTERVAL);
        sinon.assert.notCalled(closeNotification);
        sinon.assert.calledOnce(showNotification);
      });

      it('removes both displayed and queued notifications for a conversation', () => {
        showMessage();
        queueMessage('second');
        service.removeBy({ conversationId: 'chat' });
        clock.tick(DEBOUNCE_INTERVAL);
        sinon.assert.calledOnce(closeNotification);
        sinon.assert.calledOnce(showNotification);
      });

      describe('removeBy matching', () => {
        const reaction = {
          emoji: '👍' as Emoji.Variant,
          targetAuthorAci: 'author',
          targetTimestamp: 123,
        };
        const pollVote = {
          voterConversationId: 'voter',
          targetAuthorAci: 'author',
          targetTimestamp: 123,
        };
        const reactionFilter = { conversationId: 'chat', ...reaction };
        const pollFilter = {
          conversationId: 'chat',
          targetAuthorAci: 'author',
          targetTimestamp: 123,
          onlyRemoveAssociatedPollVotes: true,
        };
        type RemovalCase = {
          name: string;
          kind?: 'reaction' | 'pollVote' | 'reminder';
          identifier: Parameters<NotificationService['removeBy']>[0];
          removed: boolean;
        };
        const cases: ReadonlyArray<RemovalCase> = [
          {
            name: 'matches conversation ID',
            identifier: { conversationId: 'chat' },
            removed: true,
          },
          {
            name: 'matches message ID',
            identifier: { messageId: 'message' },
            removed: true,
          },
          {
            name: 'ignores unrelated IDs',
            identifier: { conversationId: 'other', messageId: 'other' },
            removed: false,
          },
          {
            name: 'matches either ID when both are supplied',
            identifier: { conversationId: 'other', messageId: 'message' },
            removed: true,
          },
          {
            name: 'matches conversation even when message ID differs',
            identifier: { conversationId: 'chat', messageId: 'other' },
            removed: true,
          },
          {
            name: 'matches an exact reaction',
            kind: 'reaction',
            identifier: reactionFilter,
            removed: true,
          },
          {
            name: 'keeps a different reaction emoji',
            kind: 'reaction',
            identifier: { ...reactionFilter, emoji: '👎' as Emoji.Variant },
            removed: false,
          },
          {
            name: 'keeps a reaction to a different author',
            kind: 'reaction',
            identifier: { ...reactionFilter, targetAuthorAci: 'other' },
            removed: false,
          },
          {
            name: 'keeps a reaction to a different timestamp',
            kind: 'reaction',
            identifier: { ...reactionFilter, targetTimestamp: 456 },
            removed: false,
          },
          {
            name: 'matches an associated poll vote',
            kind: 'pollVote',
            identifier: pollFilter,
            removed: true,
          },
          {
            name: 'keeps a vote on a different author’s poll',
            kind: 'pollVote',
            identifier: { ...pollFilter, targetAuthorAci: 'other' },
            removed: false,
          },
          {
            name: 'keeps a vote on a different poll timestamp',
            kind: 'pollVote',
            identifier: { ...pollFilter, targetTimestamp: 456 },
            removed: false,
          },
        ];

        cases.forEach(({ name, kind, identifier, removed }) => {
          it(name, () => {
            queueMessage('message', {
              type:
                kind === 'reaction'
                  ? NotificationType.Reaction
                  : NotificationType.Message,
              reaction: kind === 'reaction' ? reaction : undefined,
              pollVote: kind === 'pollVote' ? pollVote : undefined,
            });
            clock.tick(DEBOUNCE_INTERVAL);
            closeNotification.resetHistory();

            service.removeBy(identifier);
            clock.tick(DEBOUNCE_INTERVAL);

            assert.strictEqual(closeNotification.callCount, removed ? 1 : 0);
            sinon.assert.calledOnce(showNotification);
          });
        });
      });

      describe('unread reminders', () => {
        function queueReminder(): void {
          const summary: UnreadReminderSummary = {
            conversationId: 'chat',
            conversationTitle: 'Friends',
            unreadMessageCount: 7,
            mentionCount: 0,
            replyCount: 0,
            senders: [{ title: 'Alice' }],
            mentioners: [],
            repliers: [],
          };
          service.add({
            type: NotificationType.UnreadReminder,
            conversationId: 'chat',
            summary,
            iconUrl: 'avatar-url',
            iconAbsolutePath: 'avatar-path',
          });
        }
        it(`includes names and avatar with the NameAndMessage setting`, () => {
          getNotificationSetting.returns(NotificationSetting.NameAndMessage);
          const shown = sandbox.stub();
          service.onShown(shown);
          queueReminder();
          clock.tick(DEBOUNCE_INTERVAL);

          sinon.assert.calledOnce(showNotification);
          sinon.assert.calledOnceWithMatch(shown, {
            type: NotificationType.UnreadReminder,
            conversationId: 'chat',
            title: 'Friends',
            body: window.SignalContext.i18n(
              'icu:UnreadReminders__notification--messages--1',
              { messageCount: 7, person1: 'Alice' }
            ),
            iconUrl: 'avatar-url',
            iconAbsolutePath: 'avatar-path',
          });
        });

        it(`includes names and avatar with the NameOnly setting`, () => {
          getNotificationSetting.returns(NotificationSetting.NameOnly);
          const shown = sandbox.stub();
          service.onShown(shown);
          queueReminder();
          clock.tick(DEBOUNCE_INTERVAL);
          sinon.assert.calledOnceWithMatch(shown, {
            type: NotificationType.UnreadReminder,
            conversationId: 'chat',
            title: 'Friends',
            body: window.SignalContext.i18n(
              'icu:UnreadReminders__notification--messages--1',
              { messageCount: 7, person1: 'Alice' }
            ),
            iconUrl: 'avatar-url',
            iconAbsolutePath: 'avatar-path',
          });
        });

        it('redacts names and avatars with the NoNameOrMessage setting', () => {
          getNotificationSetting.returns(NotificationSetting.NoNameOrMessage);
          const shown = sandbox.stub();
          service.onShown(shown);
          queueReminder();
          clock.tick(DEBOUNCE_INTERVAL);

          sinon.assert.calledOnceWithMatch(shown, {
            title: 'Signal',
            body: window.SignalContext.i18n(
              'icu:UnreadReminders__notification--counts--messages',
              { messageCount: 7 }
            ),
            iconUrl: null,
            iconAbsolutePath: null,
          });
        });

        it('does not report a reminder as shown when notifications are off', () => {
          getNotificationSetting.returns(NotificationSetting.Off);
          const shown = sandbox.stub();
          service.onShown(shown);
          queueReminder();
          clock.tick(DEBOUNCE_INTERVAL);
          sinon.assert.notCalled(showNotification);
          sinon.assert.notCalled(shown);
        });

        it('does not report a canceled reminder as shown', () => {
          const shown = sandbox.stub();
          service.onShown(shown);
          queueReminder();
          service.removeBy({ conversationId: 'chat' });
          clock.tick(DEBOUNCE_INTERVAL);
          sinon.assert.notCalled(showNotification);
          sinon.assert.notCalled(shown);
        });
      });

      if (platform === 'windows') {
        it('preserves the click target during focus-triggered clearing', () => {
          showMessage();
          const { token } = showNotification.firstCall.args[0];

          // Windows can focus the app (triggering clear()) before we resolve the link
          service.clear();
          assert.deepEqual(service.resolveToken(token), {
            conversationId: 'chat',
            messageId: 'message',
            storyId: undefined,
          });

          clock.tick(DEBOUNCE_INTERVAL);
          assert.isUndefined(service.resolveToken(token));
        });
      }
    });
  }
});
