// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { RequestHandler } from 'micro';
import { PRIMARY_DEVICE_ID } from '../../constants';
import { capabilitiesFromGrpc } from '../../data/capabilities';
import { DeviceId, ServiceIdKind } from '../../types';
import { Server } from '../base';
import { authenticatedGrpcRoute } from './utils/route';

/**
 * Routes for [device.proto](../../../protos/server/org/signal/chat/device.proto).
 * Keep routes in the same order as they are declared in the proto file.
 */
export function createDevicesRoutes(
  server: Server,
): ReadonlyArray<RequestHandler> {
  const onGetDevices = authenticatedGrpcRoute(
    server,
    'org.signal.chat.device.Devices/GetDevices',
    async (_body, device) => {
      const devices = await server.getAllDevicesByServiceId(device.aci);
      return {
        devices: devices.map((linkedDevice) => ({
          id: linkedDevice.deviceId,
          name: linkedDevice.encryptedName ?? null,
          lastSeen: BigInt(Date.now()),
          registrationId: linkedDevice.getCheckedRegistrationId(
            ServiceIdKind.ACI,
          ),
          // TODO: Encrypt the device's creation time
          createdAtCiphertext: null,
        })),
      };
    },
  );

  const onRemoveDevice = authenticatedGrpcRoute(
    server,
    'org.signal.chat.device.Devices/RemoveDevice',
    async ({ id }, device) => {
      if (id === PRIMARY_DEVICE_ID) {
        throw new Error('Cannot remove primary device');
      }

      if (device.deviceId !== PRIMARY_DEVICE_ID && id !== device.deviceId) {
        throw new Error(
          'Linked devices cannot remove devices other than themselves',
        );
      }

      const deviceId = id as DeviceId;

      // Removing a device that doesn't exist succeeds
      const target = await server.getDeviceByServiceId(device.aci, deviceId);
      if (target != null) {
        await server.removeDeviceByServiceId(device.aci, deviceId);
      }

      return {};
    },
  );

  const onSetCapabilities = authenticatedGrpcRoute(
    server,
    'org.signal.chat.device.Devices/SetCapabilities',
    async (request, device) => {
      device.capabilities = capabilitiesFromGrpc(request.capabilities);
      return {};
    },
  );

  return [onGetDevices, onRemoveDevice, onSetCapabilities];
}
