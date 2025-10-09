// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This file is to prevent circular references with other selector files, since
//   selectors/conversations is used by so many things

import { createSelector } from 'reselect';

import { normalizeStoryDistributionId } from '../../types/StoryDistributionId.js';
import type { ContactsByStory } from '../../components/SafetyNumberChangeDialog.js';
import type { ConversationVerificationData } from '../ducks/conversations.js';
import type { StoryDistributionListDataType } from '../ducks/storyDistributionLists.js';
import type { GetConversationByIdType } from './conversations.js';
import { isSignalConnection } from '../../util/getSignalConnections.js';

import { isGroup } from '../../util/whatTypeOfConversation.js';
import {
  getAllConversations,
  getConversationSelector,
  getConversationVerificationData,
} from './conversations.js';
import { ConversationVerificationState } from '../ducks/conversationsEnums.js';
import { getDistributionListSelector } from './storyDistributionLists.js';

export const getByDistributionListConversationsStoppingSend = createSelector(
  getConversationSelector,
  getDistributionListSelector,
  getConversationVerificationData,
  (
    conversationSelector: GetConversationByIdType,
    distributionListSelector: (
      id: string
    ) => StoryDistributionListDataType | undefined,
    verificationDataByConversation: Record<string, ConversationVerificationData>
  ): ContactsByStory => {
    const conversations: ContactsByStory = [];

    Object.entries(verificationDataByConversation).forEach(
      ([conversationId, conversationData]) => {
        if (
          conversationData.type !==
          ConversationVerificationState.PendingVerification
        ) {
          return;
        }

        const conversationServiceIds = new Set(
          conversationData.serviceIdsNeedingVerification
        );

        if (conversationData.byDistributionId) {
          Object.entries(conversationData.byDistributionId).forEach(
            ([distributionId, distributionData]) => {
              if (distributionData.serviceIdsNeedingVerification.length === 0) {
                return;
              }
              const currentDistribution =
                distributionListSelector(distributionId);

              if (!currentDistribution) {
                distributionData.serviceIdsNeedingVerification.forEach(
                  serviceId => {
                    conversationServiceIds.add(serviceId);
                  }
                );
                return;
              }

              conversations.push({
                story: {
                  conversationId,
                  distributionId: normalizeStoryDistributionId(
                    distributionId,
                    'conversations-extra'
                  ),
                  name: currentDistribution.name,
                },
                contacts: distributionData.serviceIdsNeedingVerification.map(
                  serviceId => conversationSelector(serviceId)
                ),
              });
            }
          );
        }

        if (conversationServiceIds.size) {
          const currentConversation = conversationSelector(conversationId);
          conversations.push({
            story: isGroup(currentConversation)
              ? {
                  conversationId,
                  name: currentConversation.title,
                }
              : undefined,
            contacts: Array.from(conversationServiceIds).map(serviceId =>
              conversationSelector(serviceId)
            ),
          });
        }
      }
    );

    return conversations;
  }
);

// `isSignalConnection` accesses itemStorage to determine which conversation
// is blocked so we can't export it in `conversations.ts` (which is imported
// directly for some components)
export const getAllSignalConnections = createSelector(
  getAllConversations,
  (conversations): ReturnType<typeof getAllConversations> =>
    conversations.filter(isSignalConnection)
);
