// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { ReadonlyDeep } from 'type-fest';

import { getAreWePrimaryDevice } from './user.std.ts';

import type { StateType } from '../reducer.preload.ts';
import type { LinkDeviceWorkflow } from '../../types/LinkedDevices.std.ts';
import type { LinkedDevice } from '../../sql/Interface.std.ts';

export const getWorkflow = (
  state: StateType
): ReadonlyDeep<LinkDeviceWorkflow> | undefined => state.linkedDevices.workflow;

export const getDevices = (
  state: StateType
): ReadonlyArray<LinkedDevice> | undefined => state.linkedDevices.devices;

export const getDoWeHaveOtherDevices = createSelector(
  getAreWePrimaryDevice,
  getDevices,
  (
    areWePrimaryDevice: boolean,
    devices: ReadonlyArray<LinkedDevice> | undefined
  ): boolean => !areWePrimaryDevice || Boolean(devices && devices.length > 0)
);
