// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { UUIDStringType } from '../types/UUID';
import type { SenderKeyInfoType } from '../model-types.d';
import dataInterface from '../sql/Client';
import type { StoryDistributionType } from '../sql/Interface';
import type { SenderKeyTargetType } from './sendToGroup';
import { isNotNil } from './isNotNil';

export function distributionListToSendTarget(
  distributionList: StoryDistributionType,
  pendingSendRecipientIds: ReadonlyArray<string>
): SenderKeyTargetType {
  let inMemorySenderKeyInfo = distributionList?.senderKeyInfo;

  const recipientsSet = new Set(pendingSendRecipientIds);

  return {
    getGroupId: () => undefined,
    getMembers: () =>
      pendingSendRecipientIds
        .map(uuid => window.ConversationController.get(uuid))
        .filter(isNotNil),
    hasMember: (uuid: UUIDStringType) => recipientsSet.has(uuid),
    idForLogging: () => `dl(${distributionList.id})`,
    isGroupV2: () => true,
    isValid: () => true,
    getSenderKeyInfo: () => inMemorySenderKeyInfo,
    saveSenderKeyInfo: async (senderKeyInfo: SenderKeyInfoType) => {
      inMemorySenderKeyInfo = senderKeyInfo;
      await dataInterface.modifyStoryDistribution({
        ...distributionList,
        senderKeyInfo,
      });
    },
  };
}
