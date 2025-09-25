// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import lodash from 'lodash';
import { createLogger } from '../../logging/log.js';
import type { StateType } from '../reducer.js';
import type { BadgesStateType } from '../ducks/badges.js';
import type { BadgeType } from '../../badges/types.js';
import { getOwn } from '../../util/getOwn.js';
import type { ConversationType } from '../ducks/conversations.js';

const { mapValues } = lodash;

const log = createLogger('badges');

const getBadgeState = (state: Readonly<StateType>): BadgesStateType =>
  state.badges;

export const getBadgesById = createSelector(getBadgeState, state =>
  mapValues(state.byId, badge => ({
    ...badge,
    images: badge.images.map(image =>
      mapValues(image, imageFile =>
        imageFile.localPath
          ? {
              ...imageFile,
              localPath: window.Signal.Migrations.getAbsoluteBadgeImageFilePath(
                imageFile.localPath
              ),
            }
          : imageFile
      )
    ),
  }))
);

export const getBadgesSelector = createSelector(
  getBadgesById,
  badgesById =>
    (
      conversationBadges: ReadonlyArray<Pick<BadgeType, 'id'>>
    ): Array<BadgeType> => {
      const result: Array<BadgeType> = [];

      for (const { id } of conversationBadges) {
        const badge = getOwn(badgesById, id);
        if (!badge) {
          log.error('getBadgesSelector: conversation badge was not found');
          continue;
        }
        result.push(badge);
      }

      return result;
    }
);

export type PreferredBadgeSelectorType = (
  conversationBadges: ConversationType['badges']
) => undefined | BadgeType;

export const getPreferredBadgeSelector = createSelector(
  getBadgesById,
  (badgesById): PreferredBadgeSelectorType =>
    conversationBadges => {
      // Find the first visible badge. For other people's badges, isVisible will be
      // unset and the badge is guaranteed to be visible.
      // For the local user's badges, isVisible will be set and we need to check it.
      const firstVisibleBadge = conversationBadges.find(conversationBadge =>
        'isVisible' in conversationBadge ? conversationBadge.isVisible : true
      );

      if (!firstVisibleBadge) {
        return undefined;
      }

      const badge = getOwn(badgesById, firstVisibleBadge.id);
      if (!badge) {
        log.error(
          'getPreferredBadgeSelector: conversation badge was not found'
        );
        return undefined;
      }

      return badge;
    }
);
