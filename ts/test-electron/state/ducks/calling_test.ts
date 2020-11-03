// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  CallDetailsType,
  actions,
  getEmptyState,
  isCallActive,
  reducer,
} from '../../../state/ducks/calling';
import { CallState } from '../../../types/Calling';

describe('calling duck', () => {
  describe('actions', () => {
    describe('toggleSettings', () => {
      const { toggleSettings } = actions;

      it('toggles the settings dialog', () => {
        const afterOneToggle = reducer(getEmptyState(), toggleSettings());
        const afterTwoToggles = reducer(afterOneToggle, toggleSettings());
        const afterThreeToggles = reducer(afterTwoToggles, toggleSettings());

        assert.isTrue(afterOneToggle.settingsDialogOpen);
        assert.isFalse(afterTwoToggles.settingsDialogOpen);
        assert.isTrue(afterThreeToggles.settingsDialogOpen);
      });
    });

    describe('toggleParticipants', () => {
      const { toggleParticipants } = actions;

      it('toggles the participants list', () => {
        const afterOneToggle = reducer(getEmptyState(), toggleParticipants());
        const afterTwoToggles = reducer(afterOneToggle, toggleParticipants());
        const afterThreeToggles = reducer(
          afterTwoToggles,
          toggleParticipants()
        );

        assert.isTrue(afterOneToggle.participantsList);
        assert.isFalse(afterTwoToggles.participantsList);
        assert.isTrue(afterThreeToggles.participantsList);
      });
    });

    describe('togglePip', () => {
      const { togglePip } = actions;

      it('toggles the PiP', () => {
        const afterOneToggle = reducer(getEmptyState(), togglePip());
        const afterTwoToggles = reducer(afterOneToggle, togglePip());
        const afterThreeToggles = reducer(afterTwoToggles, togglePip());

        assert.isTrue(afterOneToggle.pip);
        assert.isFalse(afterTwoToggles.pip);
        assert.isTrue(afterThreeToggles.pip);
      });
    });
  });

  describe('helpers', () => {
    describe('isCallActive', () => {
      const fakeCallDetails: CallDetailsType = {
        id: 'fake-call',
        title: 'Fake Call',
        callId: 123,
        isIncoming: false,
        isVideoCall: false,
      };

      it('returns false if there are no call details', () => {
        assert.isFalse(isCallActive(getEmptyState()));
      });

      it('returns false if an incoming call is in a pre-reing state', () => {
        assert.isFalse(
          isCallActive({
            ...getEmptyState(),
            callDetails: {
              ...fakeCallDetails,
              isIncoming: true,
            },
            callState: CallState.Prering,
          })
        );
      });

      it('returns true if an outgoing call is in a pre-reing state', () => {
        assert.isTrue(
          isCallActive({
            ...getEmptyState(),
            callDetails: {
              ...fakeCallDetails,
              isIncoming: false,
            },
            callState: CallState.Prering,
          })
        );
      });

      it('returns false if an incoming call is ringing', () => {
        assert.isFalse(
          isCallActive({
            ...getEmptyState(),
            callDetails: {
              ...fakeCallDetails,
              isIncoming: true,
            },
            callState: CallState.Ringing,
          })
        );
      });

      it('returns true if an outgoing call is ringing', () => {
        assert.isTrue(
          isCallActive({
            ...getEmptyState(),
            callDetails: {
              ...fakeCallDetails,
              isIncoming: false,
            },
            callState: CallState.Ringing,
          })
        );
      });

      it('returns true if a call is in an accepted state', () => {
        assert.isTrue(
          isCallActive({
            ...getEmptyState(),
            callDetails: fakeCallDetails,
            callState: CallState.Accepted,
          })
        );
      });

      it('returns true if a call is in a reconnecting state', () => {
        assert.isTrue(
          isCallActive({
            ...getEmptyState(),
            callDetails: fakeCallDetails,
            callState: CallState.Reconnecting,
          })
        );
      });

      it('returns false if a call is in an ended state', () => {
        assert.isFalse(
          isCallActive({
            ...getEmptyState(),
            callDetails: fakeCallDetails,
            callState: CallState.Ended,
          })
        );
      });
    });
  });
});
