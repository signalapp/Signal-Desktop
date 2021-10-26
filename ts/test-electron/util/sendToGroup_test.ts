// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { _analyzeSenderKeyDevices, _waitForAll } from '../../util/sendToGroup';

import type { DeviceType } from '../../textsecure/Types.d';

describe('sendToGroup', () => {
  describe('#_analyzeSenderKeyDevices', () => {
    function getDefaultDeviceList(): Array<DeviceType> {
      return [
        {
          identifier: 'ident-guid-one',
          id: 1,
          registrationId: 11,
        },
        {
          identifier: 'ident-guid-one',
          id: 2,
          registrationId: 22,
        },
        {
          identifier: 'ident-guid-two',
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
          identifier: 'ident-guid-one',
          id: 2,
          registrationId: 22,
        },
        {
          identifier: 'ident-guid-two',
          id: 2,
          registrationId: 33,
        },
      ]);
      assert.deepEqual(newToMemberUuids, ['ident-guid-one', 'ident-guid-two']);
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
          identifier: 'ident-guid-one',
          id: 2,
          registrationId: 22,
        },
        {
          identifier: 'ident-guid-two',
          id: 2,
          registrationId: 33,
        },
      ]);
      assert.deepEqual(removedFromMemberUuids, [
        'ident-guid-one',
        'ident-guid-two',
      ]);
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
    it('returns nothing if new and previous lists are the same', async () => {
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
});
