// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServiceIdString } from '../types/ServiceId.std.js';
import type { SenderKeyInfoType } from '../model-types.d.ts';
import { DataWriter } from '../sql/Client.preload.js';
import type { StoryDistributionType } from '../sql/Interface.std.js';
import type { SenderKeyTargetType } from './sendToGroup.preload.js';
import { isNotNil } from './isNotNil.std.js';

export function distributionListToSendTarget(
  distributionList: StoryDistributionType,
  pendingSendRecipientIds: ReadonlyArray<ServiceIdString>
): SenderKeyTargetType {
  let inMemorySenderKeyInfo = distributionList?.senderKeyInfo;

  const recipientsSet = new Set(pendingSendRecipientIds);

  return {
    getGroupId: () => undefined,
    getMembers: () =>
      pendingSendRecipientIds
        .map(serviceId => window.ConversationController.get(serviceId))
        .filter(isNotNil),
    hasMember: (serviceId: ServiceIdString) => recipientsSet.has(serviceId),
    idForLogging: () => `dl(${distributionList.id})`,
    isGroupV2: () => true,
    isValid: () => true,
    getSenderKeyInfo: () => inMemorySenderKeyInfo,
    saveSenderKeyInfo: async (senderKeyInfo: SenderKeyInfoType) => {
      inMemorySenderKeyInfo = senderKeyInfo;
      await DataWriter.modifyStoryDistribution({
        ...distributionList,
        senderKeyInfo,
      });
    },
  };
}
