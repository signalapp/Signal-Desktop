import { assert } from 'chai';
import {
  CallDetailsType,
  getEmptyState,
  isCallActive,
} from '../../../state/ducks/calling';
import { CallState } from '../../../types/Calling';

describe('calling duck', () => {
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
