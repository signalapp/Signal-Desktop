// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  actions,
  getEmptyState,
  reducer,
} from '../../../state/ducks/network.dom.js';

describe('both/state/ducks/network', () => {
  describe('setChallengeStatus', () => {
    const { setChallengeStatus } = actions;

    it('updates whether we need to complete a server challenge', () => {
      const idleState = reducer(getEmptyState(), setChallengeStatus('idle'));
      assert.equal(idleState.challengeStatus, 'idle');

      const requiredState = reducer(idleState, setChallengeStatus('required'));
      assert.equal(requiredState.challengeStatus, 'required');

      const pendingState = reducer(
        requiredState,
        setChallengeStatus('pending')
      );
      assert.equal(pendingState.challengeStatus, 'pending');
    });
  });
});
