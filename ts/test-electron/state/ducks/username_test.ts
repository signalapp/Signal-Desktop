// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import { assert } from 'chai';

import type { UsernameStateType } from '../../../state/ducks/username';
import {
  getUsernameEditState,
  getUsernameReservationState,
  getUsernameReservationError,
  getUsernameReservationObject,
} from '../../../state/selectors/username';
import {
  UsernameEditState,
  UsernameReservationState,
  UsernameReservationError,
} from '../../../state/ducks/usernameEnums';
import { actions } from '../../../state/ducks/username';
import { ToastType } from '../../../types/Toast';
import { noopAction } from '../../../state/ducks/noop';
import { reducer } from '../../../state/reducer';
import {
  ReserveUsernameError,
  ConfirmUsernameResult,
} from '../../../types/Username';

const DEFAULT_RESERVATION = {
  username: 'abc.12',
  previousUsername: undefined,
  hash: new Uint8Array(),
};

describe('electron/state/ducks/username', () => {
  const emptyState = reducer(undefined, noopAction());
  const stateWithReservation = {
    ...emptyState,
    username: {
      ...emptyState.username,
      usernameReservation: {
        ...emptyState.username.usernameReservation,
        state: UsernameReservationState.Open,
        reservation: DEFAULT_RESERVATION,
      },
    } as UsernameStateType,
  };

  let sandbox: sinon.SinonSandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('setUsernameEditState', () => {
    it('should update username edit state', () => {
      const updatedState = reducer(
        emptyState,
        actions.setUsernameEditState(UsernameEditState.ConfirmingDelete)
      );

      assert.strictEqual(
        getUsernameEditState(updatedState),
        UsernameEditState.ConfirmingDelete
      );
    });
  });

  describe('openUsernameReservationModal/closeUsernameReservationModal', () => {
    it('should update reservation state', () => {
      const updatedState = reducer(
        emptyState,
        actions.openUsernameReservationModal()
      );

      assert.strictEqual(
        getUsernameReservationState(updatedState),
        UsernameReservationState.Open
      );

      const finalState = reducer(
        emptyState,
        actions.closeUsernameReservationModal()
      );

      assert.strictEqual(
        getUsernameReservationState(finalState),
        UsernameReservationState.Closed
      );
    });
  });

  describe('setUsernameReservationError', () => {
    it('should update error and reset reservation', () => {
      const updatedState = reducer(
        stateWithReservation,
        actions.setUsernameReservationError(UsernameReservationError.General)
      );

      assert.strictEqual(
        getUsernameReservationError(updatedState),
        UsernameReservationError.General
      );
      assert.strictEqual(getUsernameReservationObject(updatedState), undefined);
    });
  });

  describe('reserveUsername', () => {
    it('should dispatch correct actions after delay', async () => {
      const clock = sandbox.useFakeTimers({
        now: 0,
      });

      const doReserveUsername = sinon.stub().resolves(DEFAULT_RESERVATION);
      const dispatch = sinon.spy();

      actions.reserveUsername({
        nickname: 'test',
        doReserveUsername,
        delay: 1000,
      })(dispatch, () => emptyState, null);

      await clock.runToLastAsync();
      assert.strictEqual(clock.now, 1000);

      sinon.assert.calledOnce(dispatch);
      sinon.assert.calledWith(
        dispatch,
        sinon.match.has('type', 'username/RESERVE_USERNAME')
      );
    });

    it('should update reservation on success', () => {
      let state = emptyState;

      const abortController = new AbortController();

      state = reducer(state, {
        type: 'username/RESERVE_USERNAME_PENDING',
        meta: { abortController },
      });
      assert.strictEqual(
        getUsernameReservationState(state),
        UsernameReservationState.Reserving
      );

      state = reducer(state, {
        type: 'username/RESERVE_USERNAME_FULFILLED',
        payload: {
          ok: true,
          reservation: DEFAULT_RESERVATION,
        },
        meta: { abortController },
      });

      assert.strictEqual(
        getUsernameReservationState(state),
        UsernameReservationState.Open
      );
      assert.strictEqual(
        getUsernameReservationObject(state),
        DEFAULT_RESERVATION
      );
      assert.strictEqual(getUsernameReservationError(state), undefined);
    });

    const REMOTE_ERRORS: Array<
      [ReserveUsernameError, UsernameReservationError]
    > = [
      [
        ReserveUsernameError.Unprocessable,
        UsernameReservationError.CheckCharacters,
      ],
      [
        ReserveUsernameError.Conflict,
        UsernameReservationError.UsernameNotAvailable,
      ],
    ];
    for (const [error, mapping] of REMOTE_ERRORS) {
      it(`should update error on ${error}`, () => {
        let state = emptyState;

        const abortController = new AbortController();

        state = reducer(state, {
          type: 'username/RESERVE_USERNAME_PENDING',
          meta: { abortController },
        });
        state = reducer(state, {
          type: 'username/RESERVE_USERNAME_FULFILLED',
          payload: {
            ok: false,
            error,
          },
          meta: { abortController },
        });

        assert.strictEqual(getUsernameReservationObject(state), undefined);
        assert.strictEqual(getUsernameReservationError(state), mapping);
        assert.strictEqual(
          getUsernameReservationState(state),
          UsernameReservationState.Open
        );
      });
    }

    it('should update error on rejection', () => {
      let state = emptyState;

      const abortController = new AbortController();

      state = reducer(state, {
        type: 'username/RESERVE_USERNAME_PENDING',
        meta: { abortController },
      });
      state = reducer(state, {
        type: 'username/RESERVE_USERNAME_REJECTED',
        error: true,
        payload: new Error(),
        meta: { abortController },
      });

      assert.strictEqual(getUsernameReservationObject(state), undefined);
      assert.strictEqual(
        getUsernameReservationError(state),
        UsernameReservationError.General
      );
      assert.strictEqual(
        getUsernameReservationState(state),
        UsernameReservationState.Open
      );
    });

    it('should abort previous AbortController', () => {
      const firstController = new AbortController();
      const firstAbort = sinon.stub(firstController, 'abort');

      const updatedState = reducer(emptyState, {
        type: 'username/RESERVE_USERNAME_PENDING',
        meta: { abortController: firstController },
      });

      reducer(updatedState, {
        type: 'username/RESERVE_USERNAME_PENDING',
        meta: { abortController: new AbortController() },
      });

      sinon.assert.calledOnce(firstAbort);
    });

    it('should ignore resolve/reject with different AbortController', () => {
      const firstController = new AbortController();
      const secondController = new AbortController();

      let state = emptyState;
      state = reducer(state, {
        type: 'username/RESERVE_USERNAME_PENDING',
        meta: { abortController: firstController },
      });

      state = reducer(state, {
        type: 'username/RESERVE_USERNAME_FULFILLED',
        payload: {
          ok: true,
          reservation: DEFAULT_RESERVATION,
        },
        meta: { abortController: secondController },
      });
      assert.strictEqual(getUsernameReservationObject(state), undefined);

      state = reducer(state, {
        type: 'username/RESERVE_USERNAME_REJECTED',
        error: true,
        payload: new Error(),
        meta: { abortController: secondController },
      });
      assert.strictEqual(getUsernameReservationError(state), undefined);
      assert.strictEqual(
        getUsernameReservationState(state),
        UsernameReservationState.Reserving
      );
    });
  });

  describe('confirmUsername', () => {
    it('should dispatch promise when reservation is present', () => {
      const doConfirmUsername = sinon.stub().resolves(ConfirmUsernameResult.Ok);
      const dispatch = sinon.spy();

      actions.confirmUsername({
        doConfirmUsername,
      })(dispatch, () => stateWithReservation, null);

      sinon.assert.calledOnce(dispatch);
      sinon.assert.calledWith(
        dispatch,
        sinon.match.has('type', 'username/CONFIRM_USERNAME')
      );
    });

    it('should close modal on resolution', () => {
      let state = stateWithReservation;

      state = reducer(state, {
        type: 'username/CONFIRM_USERNAME_PENDING',
        meta: undefined,
      });
      assert.strictEqual(
        getUsernameReservationState(state),
        UsernameReservationState.Confirming
      );
      assert.strictEqual(
        getUsernameReservationObject(state),
        DEFAULT_RESERVATION
      );

      state = reducer(state, {
        type: 'username/CONFIRM_USERNAME_FULFILLED',
        payload: ConfirmUsernameResult.Ok,
        meta: undefined,
      });

      assert.strictEqual(
        getUsernameReservationState(state),
        UsernameReservationState.Closed
      );
      assert.strictEqual(getUsernameReservationObject(state), undefined);
      assert.strictEqual(getUsernameReservationError(state), undefined);
    });

    it('should not close modal on error', () => {
      let state = stateWithReservation;

      state = reducer(state, {
        type: 'username/CONFIRM_USERNAME_PENDING',
        meta: undefined,
      });
      assert.strictEqual(
        getUsernameReservationState(state),
        UsernameReservationState.Confirming
      );
      assert.strictEqual(
        getUsernameReservationObject(state),
        DEFAULT_RESERVATION
      );

      state = reducer(state, {
        type: 'username/CONFIRM_USERNAME_REJECTED',
        error: true,
        payload: new Error(),
        meta: undefined,
      });

      assert.strictEqual(
        getUsernameReservationState(state),
        UsernameReservationState.Open
      );
      assert.strictEqual(getUsernameReservationObject(state), undefined);
      assert.strictEqual(
        getUsernameReservationError(state),
        UsernameReservationError.General
      );
    });

    it('should not close modal on "conflict or gone"', () => {
      let state = stateWithReservation;

      state = reducer(state, {
        type: 'username/CONFIRM_USERNAME_PENDING',
        meta: undefined,
      });
      assert.strictEqual(
        getUsernameReservationState(state),
        UsernameReservationState.Confirming
      );
      assert.strictEqual(
        getUsernameReservationObject(state),
        DEFAULT_RESERVATION
      );

      state = reducer(state, {
        type: 'username/CONFIRM_USERNAME_FULFILLED',
        payload: ConfirmUsernameResult.ConflictOrGone,
        meta: undefined,
      });

      assert.strictEqual(
        getUsernameReservationState(state),
        UsernameReservationState.Open
      );
      assert.strictEqual(
        getUsernameReservationObject(state),
        DEFAULT_RESERVATION
      );
      assert.strictEqual(
        getUsernameReservationError(state),
        UsernameReservationError.ConflictOrGone
      );
    });
  });

  describe('deleteUsername', () => {
    it('should dispatch once on success', () => {
      const doDeleteUsername = sinon.stub().resolves();
      const dispatch = sinon.spy();

      actions.deleteUsername({
        doDeleteUsername,
        username: 'test',
      })(dispatch, () => emptyState, null);

      sinon.assert.calledOnce(dispatch);
      sinon.assert.calledWith(
        dispatch,
        sinon.match.has('type', 'username/DELETE_USERNAME')
      );
    });

    it('should dispatch twice on failure', async () => {
      const clock = sandbox.useFakeTimers({
        now: 0,
      });

      const doDeleteUsername = sinon.stub().rejects(new Error());
      const dispatch = sinon.spy();

      actions.deleteUsername({
        doDeleteUsername,
        username: 'test',
      })(dispatch, () => emptyState, null);

      await clock.runToLastAsync();

      sinon.assert.calledTwice(dispatch);
      sinon.assert.calledWith(
        dispatch,
        sinon.match.has('type', 'username/DELETE_USERNAME')
      );
      sinon.assert.calledWith(dispatch, {
        type: 'toast/SHOW_TOAST',
        payload: {
          toastType: ToastType.FailedToDeleteUsername,
        },
      });
    });

    it('should update editState', () => {
      let state = stateWithReservation;

      state = reducer(state, {
        type: 'username/DELETE_USERNAME_PENDING',
        meta: undefined,
      });
      assert.strictEqual(
        getUsernameEditState(state),
        UsernameEditState.Deleting
      );

      state = reducer(state, {
        type: 'username/DELETE_USERNAME_FULFILLED',
        payload: undefined,
        meta: undefined,
      });
      assert.strictEqual(
        getUsernameEditState(state),
        UsernameEditState.Editing
      );
    });
  });
});
