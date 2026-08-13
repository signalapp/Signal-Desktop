// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getById, createOrUpdate } from '../util.std.ts';
import { toLogFormat } from '../../types/errors.std.ts';

import type { ServiceIdString } from '../../types/ServiceId.std.ts';
import type { WritableDB } from '../Interface.std.ts';
import type { LoggerType } from '../../types/Logging.std.ts';

const ITEMS_TABLE = 'items';
const BLOCKED_NUMBER_KEY = 'blocked';
const BLOCKED_SERVICE_IDS_KEY = 'blocked-uuids';
const BLOCKED_GROUP_KEY = 'blocked-groups';

// Old types

type OldBlockedNumberList = ReadonlyArray<string>;
type OldBlockedServiceIdsList = ReadonlyArray<ServiceIdString>;
type OldBlockedGroupList = ReadonlyArray<string>;

type Item<T> = {
  id: string;
  value: T;
};

// New types:

type BlockedNumber = {
  blockedAt: number | undefined;
  e164: string;
};
type BlockedNumberList = ReadonlyArray<BlockedNumber>;

type BlockedServiceId = {
  blockedAt: number | undefined;
  serviceId: ServiceIdString;
};
type BlockedServiceIdList = ReadonlyArray<BlockedServiceId>;

type BlockedGroup = {
  blockedAt: number | undefined;
  groupId: string;
};
type BlockedGroupList = ReadonlyArray<BlockedGroup>;

export default function updateToSchemaVersion1770(
  db: WritableDB,
  logger: LoggerType
): void {
  const logId = 'updateToSchemaVersion1770';

  try {
    const blockedNumbers = getById(db, ITEMS_TABLE, BLOCKED_NUMBER_KEY) as Item<
      OldBlockedNumberList | undefined
    >;
    if (blockedNumbers?.value) {
      const updatedNumbers: BlockedNumberList = blockedNumbers.value.map(
        e164 => ({
          e164,
          blockedAt: undefined,
        })
      );

      const item: Item<BlockedNumberList> = {
        id: BLOCKED_NUMBER_KEY,
        value: updatedNumbers,
      };
      createOrUpdate(db, ITEMS_TABLE, item);
    }
  } catch (error) {
    logger.error(
      `${logId}: Failed to update '${BLOCKED_NUMBER_KEY}' item`,
      toLogFormat(error)
    );
  }

  try {
    const blockedServiceIds = getById(
      db,
      ITEMS_TABLE,
      BLOCKED_SERVICE_IDS_KEY
    ) as Item<OldBlockedServiceIdsList | undefined>;
    if (blockedServiceIds?.value) {
      const updatedServiceIds: BlockedServiceIdList =
        blockedServiceIds.value.map(serviceId => ({
          serviceId,
          blockedAt: undefined,
        }));

      const item: Item<BlockedServiceIdList> = {
        id: BLOCKED_SERVICE_IDS_KEY,
        value: updatedServiceIds,
      };
      createOrUpdate(db, ITEMS_TABLE, item);
    }
  } catch (error) {
    logger.error(
      `${logId}: Failed to update '${BLOCKED_SERVICE_IDS_KEY}' item`,
      toLogFormat(error)
    );
  }

  try {
    const blockedGroups = getById(db, ITEMS_TABLE, BLOCKED_GROUP_KEY) as Item<
      OldBlockedGroupList | undefined
    >;
    if (blockedGroups?.value) {
      const updatedGroups: BlockedGroupList = blockedGroups.value.map(
        groupId => ({
          groupId,
          blockedAt: undefined,
        })
      );

      const item: Item<BlockedGroupList> = {
        id: BLOCKED_GROUP_KEY,
        value: updatedGroups,
      };
      createOrUpdate(db, ITEMS_TABLE, item);
    }
  } catch (error) {
    logger.error(
      `${logId}: Failed to update '${BLOCKED_GROUP_KEY}' item`,
      toLogFormat(error)
    );
  }
}
