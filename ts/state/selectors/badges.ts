// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import { mapValues } from 'lodash';
import * as log from '../../logging/log';
import type { StateType } from '../reducer';
import type { BadgesStateType } from '../ducks/badges';
import type { BadgeType } from '../../badges/types';
import { getOwn } from '../../util/getOwn';

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
  conversationBadges: ReadonlyArray<Pick<BadgeType, 'id'>>
) => undefined | BadgeType;

export const getPreferredBadgeSelector = createSelector(
  getBadgesById,
  (badgesById): PreferredBadgeSelectorType =>
    conversationBadges => {
      const firstId: undefined | string = conversationBadges[0]?.id;
      if (!firstId) {
        return undefined;
      }

      const badge = getOwn(badgesById, firstId);
      if (!badge) {
        log.error(
          'getPreferredBadgeSelector: conversation badge was not found'
        );
        return undefined;
      }

      return badge;
    }
);
