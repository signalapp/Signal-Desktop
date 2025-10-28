// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import type { StateType } from '../../../state/reducer.preload.js';
import { reducer as rootReducer } from '../../../state/reducer.preload.js';
import { noopAction } from '../../../state/ducks/noop.std.js';
import { applyDonationBadge } from '../../../state/ducks/donations.preload.js';
import * as conversations from '../../../state/ducks/conversations.preload.js';
import type { BadgeType } from '../../../badges/types.std.js';
import { BadgeCategory } from '../../../badges/BadgeCategory.std.js';
import type { ConversationType } from '../../../state/ducks/conversations.preload.js';
import { generateAci } from '../../../types/ServiceId.std.js';

describe('donations duck', () => {
  const getEmptyRootState = (): StateType =>
    rootReducer(undefined, noopAction());

  const storageMap = new Map<string, unknown>();
  const storage = {
    get: (key: string): unknown => storageMap.get(key),
    put: async (key: string, value: unknown): Promise<void> => {
      storageMap.set(key, value);
    },
    remove: async (key: string): Promise<void> => {
      storageMap.delete(key);
    },
  };

  beforeEach(() => {
    storageMap.clear();
  });

  describe('applyDonationBadge thunk', () => {
    let sandbox: sinon.SinonSandbox;
    let myProfileChangedStub: sinon.SinonStub;
    let originalMyProfileChanged: typeof conversations.actions.myProfileChanged;

    const TEST_BADGE: BadgeType = {
      id: 'boost-badge',
      category: BadgeCategory.Donor,
      name: 'Boost',
      descriptionTemplate: 'Boost badge',
      images: [],
    };

    const ourConversationId = 'our-conversation-id';

    beforeEach(async () => {
      sandbox = sinon.createSandbox();

      // Mock myProfileChanged by replacing the function directly
      myProfileChangedStub = sandbox.stub().returns(() => Promise.resolve());
      originalMyProfileChanged = conversations.actions.myProfileChanged;
      conversations.actions.myProfileChanged = myProfileChangedStub;
    });

    afterEach(async () => {
      // Restore original myProfileChanged
      conversations.actions.myProfileChanged = originalMyProfileChanged;
      sandbox.restore();
    });

    const createMeWithBadges = (
      badges: Array<{
        id: string;
        isVisible?: boolean;
      }>
    ): ConversationType => ({
      id: ourConversationId,
      serviceId: generateAci(),
      badges,
      type: 'direct',
      title: 'Me',
      acceptedMessageRequest: true,
      isMe: true,
      sharedGroupNames: [],
    });

    const createRootState = (me: ConversationType): StateType => {
      const state = getEmptyRootState();

      return {
        ...state,
        user: {
          ...state.user,
          ourConversationId,
        },
        conversations: {
          ...state.conversations,
          conversationLookup: {
            [ourConversationId]: me,
          },
        },
      };
    };

    // Helper to create test setup for a scenario
    const setupTest = async (
      badges: Array<{ id: string; isVisible?: boolean }>
    ) => {
      const me = createMeWithBadges(badges);
      const rootState = createRootState(me);
      const getState = () => rootState;
      const dispatch = sandbox.stub().callsFake(async (action: unknown) => {
        if (typeof action === 'function') {
          return action(dispatch, getState);
        }
        return Promise.resolve();
      });
      const onComplete = sandbox.stub();

      // Helper to execute applyDonationBadge with common params
      const executeApplyDonationBadge = async (
        badge: BadgeType | undefined,
        applyBadge: boolean
      ) => {
        await applyDonationBadge({
          badge,
          applyBadge,
          onComplete,
          storage,
        })(dispatch, getState, null);
      };

      return { me, onComplete, executeApplyDonationBadge };
    };

    describe('Modal States', () => {
      describe('All badges invisible (previousDisplayBadgesOnProfile = false)', () => {
        it('Submit ON: Makes ALL badges visible, boost primary', async () => {
          // Setup: Boost invisible (along with other badges)
          const { onComplete, executeApplyDonationBadge } = await setupTest([
            { id: 'other-badge', isVisible: false },
            { id: 'boost-badge', isVisible: false },
          ]);

          // Action: Submit with toggle ON (checkbox checked)
          await executeApplyDonationBadge(TEST_BADGE, true);

          // Result: Boost becomes visible and primary,
          // ALL other badges become visible
          sinon.assert.calledOnce(myProfileChangedStub);
          const profileData = myProfileChangedStub.getCall(0).args[0];
          assert.deepEqual(profileData.badges, [
            { id: 'boost-badge', isVisible: true }, // Primary
            { id: 'other-badge', isVisible: true }, // Now visible too
          ]);

          // Verify storage was updated from false to true
          assert.equal(storage.get('displayBadgesOnProfile'), true);

          // Note: storageServiceUploadJob would be called here with
          // { reason: 'donation-badge-toggle' } but we can't spy on const exports

          sinon.assert.calledOnceWithExactly(onComplete);
        });

        it('Submit OFF: No change', async () => {
          // Setup: Boost invisible
          const { onComplete, executeApplyDonationBadge } = await setupTest([
            { id: 'boost-badge', isVisible: false },
            { id: 'other-badge', isVisible: false },
          ]);

          // Action: Submit with toggle OFF (checkbox unchecked)
          await executeApplyDonationBadge(TEST_BADGE, false);

          // Result: No change (badges remain invisible)
          // Since boost is not primary, nothing happens
          sinon.assert.notCalled(myProfileChangedStub);

          // Verify storage was written with false (even though unchanged)
          assert.equal(storage.get('displayBadgesOnProfile'), false);
          // Note: storageServiceUploadJob would not be called here

          sinon.assert.calledOnceWithExactly(onComplete);
        });
      });

      describe('All badges visible, boost primary (previousDisplayBadgesOnProfile = true)', () => {
        it('Submit ON: No change', async () => {
          // Setup: Boost primary
          const { onComplete, executeApplyDonationBadge } = await setupTest([
            { id: 'boost-badge', isVisible: true }, // Primary (index 0)
            { id: 'other-badge', isVisible: true },
          ]);

          // Action: Submit with toggle ON (checkbox checked)
          await executeApplyDonationBadge(TEST_BADGE, true);

          // Result: No change (boost remains primary)
          // myProfileChanged still called but with same order
          sinon.assert.calledOnce(myProfileChangedStub);
          const profileData = myProfileChangedStub.getCall(0).args[0];
          assert.deepEqual(profileData.badges, [
            { id: 'boost-badge', isVisible: true }, // Still primary
            { id: 'other-badge', isVisible: true },
          ]);

          // Verify storage remains at true (no update needed)
          assert.equal(storage.get('displayBadgesOnProfile'), true);
          // Note: storageServiceUploadJob would not be called here (no change)

          sinon.assert.calledOnceWithExactly(onComplete);
        });

        it('Submit OFF: Hides all badges', async () => {
          // Setup: Boost primary
          const { onComplete, executeApplyDonationBadge } = await setupTest([
            { id: 'boost-badge', isVisible: true }, // Primary (index 0)
            { id: 'other-badge', isVisible: true },
          ]);

          // Action: Submit with toggle OFF (checkbox unchecked)
          await executeApplyDonationBadge(TEST_BADGE, false);

          // Result: All badges become invisible
          sinon.assert.calledOnce(myProfileChangedStub);
          const profileData = myProfileChangedStub.getCall(0).args[0];
          assert.deepEqual(profileData.badges, []);

          // Verify storage was updated from true to false
          assert.equal(storage.get('displayBadgesOnProfile'), false);

          sinon.assert.calledOnceWithExactly(onComplete);
        });
      });

      describe('All badges visible, boost not primary (previousDisplayBadgesOnProfile = true)', () => {
        it('Submit ON: Makes boost primary', async () => {
          // Setup: Boost not primary (other badge is index 0)
          const { onComplete, executeApplyDonationBadge } = await setupTest([
            { id: 'other-badge', isVisible: true }, // Primary (index 0)
            { id: 'boost-badge', isVisible: true }, // Not primary
          ]);

          // Action: Submit with toggle ON (checkbox checked)
          await executeApplyDonationBadge(TEST_BADGE, true);

          // Result: Boost moves to primary position
          sinon.assert.calledOnce(myProfileChangedStub);
          const profileData = myProfileChangedStub.getCall(0).args[0];
          assert.deepEqual(profileData.badges, [
            { id: 'boost-badge', isVisible: true }, // Moved to primary
            { id: 'other-badge', isVisible: true }, // Previous primary shifts down
          ]);

          // Verify storage remains at true (no update needed)
          assert.equal(storage.get('displayBadgesOnProfile'), true);

          sinon.assert.calledOnceWithExactly(onComplete);
        });

        it('Submit OFF: No change', async () => {
          // Setup: Boost not primary (other badge is index 0)
          const { onComplete, executeApplyDonationBadge } = await setupTest([
            { id: 'other-badge', isVisible: true }, // Primary (index 0)
            { id: 'boost-badge', isVisible: true }, // Not primary
          ]);

          // Action: Submit with toggle OFF (checkbox unchecked)
          await executeApplyDonationBadge(TEST_BADGE, false);

          // Result: No change (other badge remains primary)
          sinon.assert.notCalled(myProfileChangedStub);

          // Verify storage remains at true (no update needed)
          assert.equal(storage.get('displayBadgesOnProfile'), true);

          sinon.assert.calledOnceWithExactly(onComplete);
        });
      });
    });

    describe('Error Scenarios', () => {
      it('No Badge Data: should show error', async () => {
        const { onComplete, executeApplyDonationBadge } = await setupTest([]);

        // Modal receives undefined badge
        await executeApplyDonationBadge(undefined, true);

        sinon.assert.calledOnce(onComplete);
        const error = onComplete.getCall(0).args[0];
        assert.instanceOf(error, Error);
        assert.equal(error.message, 'No badge was given to redeem');

        sinon.assert.notCalled(myProfileChangedStub);
      });

      it('Badge Visibility Data Corrupted: should show error', async () => {
        const { onComplete, executeApplyDonationBadge } = await setupTest([
          { id: 'boost-badge' }, // Missing isVisible property
        ]);

        await executeApplyDonationBadge(TEST_BADGE, true);

        // Should show error toast
        sinon.assert.calledOnce(onComplete);
        const error = onComplete.getCall(0).args[0];
        assert.instanceOf(error, Error);
        assert.equal(
          error.message,
          "Unable to determine user's existing visible badges"
        );

        sinon.assert.notCalled(myProfileChangedStub);
      });

      it("User Doesn't Have Badge: should show error", async () => {
        const { onComplete, executeApplyDonationBadge } = await setupTest([
          { id: 'other-badge', isVisible: true },
          // boost-badge not in list
        ]);

        await executeApplyDonationBadge(TEST_BADGE, true);

        // Should show error toast
        sinon.assert.calledOnce(onComplete);
        const error = onComplete.getCall(0).args[0];
        assert.instanceOf(error, Error);
        assert.equal(
          error.message,
          'User does not have the desired badge to apply'
        );

        sinon.assert.notCalled(myProfileChangedStub);
      });
    });
  });
});
