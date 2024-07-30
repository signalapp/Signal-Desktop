// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServiceIdString } from '../types/ServiceId';
import type { SenderKeyInfoType } from '../model-types.d';
import { DataWriter } from '../sql/Client';
import type { StoryDistributionType } from '../sql/Interface';
import type { SenderKeyTargetType } from './sendToGroup';
import { isNotNil } from './isNotNil';

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
