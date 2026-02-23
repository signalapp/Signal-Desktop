// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as uuid } from 'uuid';
import sinon from 'sinon';

import {
  isMegaphoneCtaIdValid,
  isMegaphoneDeletable,
  isMegaphoneShowable,
} from '../../services/megaphone.preload.js';
import { DAY } from '../../util/durations/index.std.js';
import type {
  RemoteMegaphoneId,
  RemoteMegaphoneType,
} from '../../types/Megaphone.std.js';
import { generateAci } from '../../types/ServiceId.std.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';
import type { ConversationController } from '../../ConversationController.preload.js';
import type { ConversationModel } from '../../models/conversations.preload.js';

const FAKE_MEGAPHONE: RemoteMegaphoneType = {
  id: uuid() as RemoteMegaphoneId,
  priority: 100,
  desktopMinVersion: '1.37.0',
  dontShowBeforeEpochMs: Date.now() - 1 * DAY,
  dontShowAfterEpochMs: Date.now() + 14 * DAY,
  showForNumberOfDays: 30,
  conditionalId: 'test',
  primaryCtaId: 'donate',
  primaryCtaData: null,
  secondaryCtaId: 'snooze',
  secondaryCtaData: { snoozeDurationDays: [5, 7, 100] },
  localeFetched: 'en',
  title: 'megaphone',
  body: 'cats',
  imagePath: '../../../images/donate-heart.png',
  primaryCtaText: 'donate',
  secondaryCtaText: 'snooze',
  snoozeCount: 0,
  snoozedAt: null,
  shownAt: null,
  isFinished: false,
};

describe('megaphone service', () => {
  function getMegaphone(
    extraProps: Partial<RemoteMegaphoneType>
  ): RemoteMegaphoneType {
    return {
      ...FAKE_MEGAPHONE,
      ...extraProps,
    };
  }

  describe('isMegaphoneDeletable', () => {
    it('handles fresh megaphones', () => {
      assert.strictEqual(isMegaphoneDeletable(FAKE_MEGAPHONE), false);
    });

    it('handles expired megaphones', () => {
      const expiredMegaphone: RemoteMegaphoneType = {
        ...FAKE_MEGAPHONE,
        dontShowAfterEpochMs: Date.now() - 1 * DAY,
      };
      assert.strictEqual(isMegaphoneDeletable(expiredMegaphone), true);
    });
  });

  describe('isMegaphoneCtaIdValid', () => {
    it('handles valid ctaIds', () => {
      assert.strictEqual(isMegaphoneCtaIdValid('donate'), true);
      assert.strictEqual(isMegaphoneCtaIdValid('snooze'), true);
      assert.strictEqual(isMegaphoneCtaIdValid('finish'), true);
      assert.strictEqual(isMegaphoneCtaIdValid(null), true);
    });

    it('handles invalid ctaIds', () => {
      assert.strictEqual(isMegaphoneCtaIdValid('DONATE'), false);
      assert.strictEqual(isMegaphoneCtaIdValid('potato'), false);
      assert.strictEqual(isMegaphoneCtaIdValid(''), false);
    });
  });

  describe('isMegaphoneShowable', () => {
    it('handles fresh megaphone', () => {
      assert.strictEqual(isMegaphoneShowable(FAKE_MEGAPHONE), true);
    });

    it('handles finished megaphone', () => {
      const megaphone = getMegaphone({ isFinished: true });
      assert.strictEqual(isMegaphoneShowable(megaphone), false);
    });

    it('handles megaphones snoozed recently', () => {
      const megaphone = getMegaphone({
        snoozeCount: 1,
        snoozedAt: Date.now() - 1000,
      });
      assert.strictEqual(isMegaphoneShowable(megaphone), false);
    });

    it('handles megaphones snoozed and now ready to show again', () => {
      const megaphone = getMegaphone({
        snoozeCount: 1,
        snoozedAt: Date.now() - 7 * DAY,
      });
      assert.strictEqual(isMegaphoneShowable(megaphone), true);
    });

    it('handles megaphone with dontShowBeforeEpochMs in the future', () => {
      const megaphone = getMegaphone({
        dontShowBeforeEpochMs: Date.now() + 1 * DAY,
      });
      assert.strictEqual(isMegaphoneShowable(megaphone), false);
    });

    it('handles megaphone expired past dontShowAfterEpochMs', () => {
      const megaphone = getMegaphone({
        dontShowAfterEpochMs: Date.now() - 1 * DAY,
      });
      assert.strictEqual(isMegaphoneShowable(megaphone), false);
    });

    it('handles megaphone with invalid primaryCtaId', () => {
      const megaphone = getMegaphone({
        primaryCtaId: 'potato',
      });
      assert.strictEqual(isMegaphoneShowable(megaphone), false);
    });

    it('handles megaphone with invalid secondaryCtaId', () => {
      const megaphone = getMegaphone({
        secondaryCtaId: 'potato',
      });
      assert.strictEqual(isMegaphoneShowable(megaphone), false);
    });
  });

  describe('conditionals', () => {
    let sandbox: sinon.SinonSandbox;
    let deviceCreatedAt: number;
    let oldConversationController: ConversationController;
    let ourConversation: ConversationModel;

    const ourAci = generateAci();
    const createMeWithBadges = (
      badges: Array<{
        id: string;
      }>
    ): ConversationModel => {
      const attrs = {
        id: 'our-conversation-id',
        serviceId: ourAci,
        badges,
        type: 'private',
        sharedGroupNames: [],
        version: 0,
        expireTimerVersion: 1,
      };
      return {
        ...attrs,
        attributes: attrs,
      } as unknown as ConversationModel;
    };

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      sandbox.stub(itemStorage, 'get').callsFake(key => {
        if (key === 'deviceCreatedAt') {
          return deviceCreatedAt;
        }
        return undefined;
      });

      deviceCreatedAt = Date.now();
      ourConversation = createMeWithBadges([]);

      oldConversationController = window.ConversationController;
      window.ConversationController = {
        getOurConversation: () => ourConversation,
        conversationUpdated: () => undefined,
      } as unknown as ConversationController;
    });

    afterEach(() => {
      window.ConversationController = oldConversationController;
      sandbox.restore();
    });

    describe('standard_donate', async () => {
      const megaphone = getMegaphone({
        conditionalId: 'standard_donate',
      });

      it('true when desktop has been registered for a week and has no badges', () => {
        deviceCreatedAt = Date.now() - 7 * DAY;
        assert.strictEqual(isMegaphoneShowable(megaphone), true);
      });

      it('false with fresh linked desktop', () => {
        assert.strictEqual(isMegaphoneShowable(megaphone), false);
      });

      it('false with badges', () => {
        ourConversation = createMeWithBadges([{ id: 'cool' }]);
        assert.strictEqual(isMegaphoneShowable(megaphone), false);
      });
    });
  });
});
