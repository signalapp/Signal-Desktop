// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This file is to prevent circular references with other selector files, since
//   selectors/conversations is used by so many things

import { createSelector } from 'reselect';

import type { ContactsByStory } from '../../components/SafetyNumberChangeDialog';
import type { ConversationVerificationData } from '../ducks/conversations';
import type { StoryDistributionListDataType } from '../ducks/storyDistributionLists';
import type { GetConversationByIdType } from './conversations';

import { isGroup } from '../../util/whatTypeOfConversation';
import {
  getConversationSelector,
  getConversationVerificationData,
} from './conversations';
import { ConversationVerificationState } from '../ducks/conversationsEnums';
import { getDistributionListSelector } from './storyDistributionLists';

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

        const conversationUuids = new Set(
          conversationData.uuidsNeedingVerification
        );

        if (conversationData.byDistributionId) {
          Object.entries(conversationData.byDistributionId).forEach(
            ([distributionId, distributionData]) => {
              if (distributionData.uuidsNeedingVerification.length === 0) {
                return;
              }
              const currentDistribution =
                distributionListSelector(distributionId);

              if (!currentDistribution) {
                distributionData.uuidsNeedingVerification.forEach(uuid => {
                  conversationUuids.add(uuid);
                });
                return;
              }

              conversations.push({
                story: {
                  conversationId,
                  distributionId,
                  name: currentDistribution.name,
                },
                contacts: distributionData.uuidsNeedingVerification.map(uuid =>
                  conversationSelector(uuid)
                ),
              });
            }
          );
        }

        if (conversationUuids.size) {
          const currentConversation = conversationSelector(conversationId);
          conversations.push({
            story: isGroup(currentConversation)
              ? {
                  conversationId,
                  name: currentConversation.title,
                }
              : undefined,
            contacts: Array.from(conversationUuids).map(uuid =>
              conversationSelector(uuid)
            ),
          });
        }
      }
    );

    return conversations;
  }
);
