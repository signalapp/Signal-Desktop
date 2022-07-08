// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import {
  _analyzeSenderKeyDevices,
  _waitForAll,
  _shouldFailSend,
} from '../../util/sendToGroup';
import { UUID } from '../../types/UUID';

import type { DeviceType } from '../../textsecure/Types.d';
import {
  ConnectTimeoutError,
  HTTPError,
  MessageError,
  OutgoingIdentityKeyError,
  OutgoingMessageError,
  SendMessageChallengeError,
  SendMessageNetworkError,
  SendMessageProtoError,
  UnregisteredUserError,
} from '../../textsecure/Errors';

describe('sendToGroup', () => {
  const uuidOne = UUID.generate().toString();
  const uuidTwo = UUID.generate().toString();

  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    const stub = sandbox.stub(UUID, 'lookup');
    stub.withArgs(uuidOne).returns(new UUID(uuidOne));
    stub.withArgs(uuidTwo).returns(new UUID(uuidTwo));
    stub.returns(undefined);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#_analyzeSenderKeyDevices', () => {
    function getDefaultDeviceList(): Array<DeviceType> {
      return [
        {
          identifier: uuidOne,
          id: 1,
          registrationId: 11,
        },
        {
          identifier: uuidOne,
          id: 2,
          registrationId: 22,
        },
        {
          identifier: uuidTwo,
          id: 2,
          registrationId: 33,
        },
      ];
    }

    it('returns nothing if new and previous lists are the same', () => {
      const memberDevices = getDefaultDeviceList();
      const devicesForSend = getDefaultDeviceList();

      const {
        newToMemberDevices,
        newToMemberUuids,
        removedFromMemberDevices,
        removedFromMemberUuids,
      } = _analyzeSenderKeyDevices(memberDevices, devicesForSend);

      assert.isEmpty(newToMemberDevices);
      assert.isEmpty(newToMemberUuids);
      assert.isEmpty(removedFromMemberDevices);
      assert.isEmpty(removedFromMemberUuids);
    });
    it('returns set of new devices', () => {
      const memberDevices = getDefaultDeviceList();
      const devicesForSend = getDefaultDeviceList();

      memberDevices.pop();
      memberDevices.pop();

      const {
        newToMemberDevices,
        newToMemberUuids,
        removedFromMemberDevices,
        removedFromMemberUuids,
      } = _analyzeSenderKeyDevices(memberDevices, devicesForSend);

      assert.deepEqual(newToMemberDevices, [
        {
          identifier: uuidOne,
          id: 2,
          registrationId: 22,
        },
        {
          identifier: uuidTwo,
          id: 2,
          registrationId: 33,
        },
      ]);
      assert.deepEqual(newToMemberUuids, [uuidOne, uuidTwo]);
      assert.isEmpty(removedFromMemberDevices);
      assert.isEmpty(removedFromMemberUuids);
    });
    it('returns set of removed devices', () => {
      const memberDevices = getDefaultDeviceList();
      const devicesForSend = getDefaultDeviceList();

      devicesForSend.pop();
      devicesForSend.pop();

      const {
        newToMemberDevices,
        newToMemberUuids,
        removedFromMemberDevices,
        removedFromMemberUuids,
      } = _analyzeSenderKeyDevices(memberDevices, devicesForSend);

      assert.isEmpty(newToMemberDevices);
      assert.isEmpty(newToMemberUuids);
      assert.deepEqual(removedFromMemberDevices, [
        {
          identifier: uuidOne,
          id: 2,
          registrationId: 22,
        },
        {
          identifier: uuidTwo,
          id: 2,
          registrationId: 33,
        },
      ]);
      assert.deepEqual(removedFromMemberUuids, [uuidOne, uuidTwo]);
    });
    it('returns empty removals if partial send', () => {
      const memberDevices = getDefaultDeviceList();
      const devicesForSend = getDefaultDeviceList();

      devicesForSend.pop();
      devicesForSend.pop();

      const isPartialSend = true;
      const {
        newToMemberDevices,
        newToMemberUuids,
        removedFromMemberDevices,
        removedFromMemberUuids,
      } = _analyzeSenderKeyDevices(
        memberDevices,
        devicesForSend,
        isPartialSend
      );

      assert.isEmpty(newToMemberDevices);
      assert.isEmpty(newToMemberUuids);
      assert.isEmpty(removedFromMemberDevices);
      assert.isEmpty(removedFromMemberUuids);
    });
  });

  describe('#_waitForAll', () => {
    it('returns result of provided tasks', async () => {
      const task1 = () => Promise.resolve(1);
      const task2 = () => Promise.resolve(2);
      const task3 = () => Promise.resolve(3);

      const result = await _waitForAll({
        tasks: [task1, task2, task3],
        maxConcurrency: 1,
      });

      assert.deepEqual(result, [1, 2, 3]);
    });
  });

  describe('#_shouldFailSend', () => {
    it('returns false for a generic error', async () => {
      const error = new Error('generic');
      assert.isFalse(_shouldFailSend(error, 'testing generic'));
    });

    it("returns true for any error with 'untrusted' identity", async () => {
      const error = new Error('This was an untrusted identity.');
      assert.isTrue(_shouldFailSend(error, 'logId'));
    });

    it('returns true for certain types of error subclasses', async () => {
      assert.isTrue(
        _shouldFailSend(
          new OutgoingIdentityKeyError('something'),
          'testing OutgoingIdentityKeyError'
        )
      );
      assert.isTrue(
        _shouldFailSend(
          new UnregisteredUserError(
            'something',
            new HTTPError('something', {
              code: 400,
              headers: {},
            })
          ),
          'testing UnregisteredUserError'
        )
      );
      assert.isTrue(
        _shouldFailSend(
          new ConnectTimeoutError('something'),
          'testing ConnectTimeoutError'
        )
      );
    });

    it('returns false for unspecified error codes', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error: any = new Error('generic');

      error.code = 422;
      assert.isFalse(_shouldFailSend(error, 'testing generic 422'));

      error.code = 204;
      assert.isFalse(_shouldFailSend(error, 'testing generic 204'));
    });

    it('returns true for a specified error codes', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error: any = new Error('generic');
      error.code = 401;

      assert.isTrue(_shouldFailSend(error, 'testing generic'));
      assert.isTrue(
        _shouldFailSend(
          new HTTPError('something', {
            code: 404,
            headers: {},
          }),
          'testing HTTPError'
        )
      );
      assert.isTrue(
        _shouldFailSend(
          new OutgoingMessageError(
            'something',
            null,
            null,
            new HTTPError('something', {
              code: 413,
              headers: {},
            })
          ),
          'testing OutgoingMessageError'
        )
      );
      assert.isTrue(
        _shouldFailSend(
          new OutgoingMessageError(
            'something',
            null,
            null,
            new HTTPError('something', {
              code: 429,
              headers: {},
            })
          ),
          'testing OutgoingMessageError'
        )
      );
      assert.isTrue(
        _shouldFailSend(
          new SendMessageNetworkError(
            'something',
            null,
            new HTTPError('something', {
              code: 428,
              headers: {},
            })
          ),
          'testing SendMessageNetworkError'
        )
      );
      assert.isTrue(
        _shouldFailSend(
          new SendMessageChallengeError(
            'something',
            new HTTPError('something', {
              code: 500,
              headers: {},
            })
          ),
          'testing SendMessageChallengeError'
        )
      );
      assert.isTrue(
        _shouldFailSend(
          new MessageError(
            'something',
            new HTTPError('something', {
              code: 508,
              headers: {},
            })
          ),
          'testing MessageError'
        )
      );
    });
    it('returns true for errors inside of SendMessageProtoError', () => {
      assert.isTrue(
        _shouldFailSend(
          new SendMessageProtoError({}),
          'testing missing errors list'
        )
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error: any = new Error('generic');
      error.code = 401;

      assert.isTrue(
        _shouldFailSend(
          new SendMessageProtoError({ errors: [error] }),
          'testing one error with code'
        )
      );

      assert.isTrue(
        _shouldFailSend(
          new SendMessageProtoError({
            errors: [
              new Error('something'),
              new ConnectTimeoutError('something'),
            ],
          }),
          'testing ConnectTimeoutError'
        )
      );
    });
  });
});
