// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { assertDev } from '../../util/assert';
import { getSafeDomain } from '../../types/LinkPreview';

import type { LinkPreviewSourceType } from '../../types/LinkPreview';
import type { StateType } from '../reducer';

export const getLinkPreview = createSelector(
  ({ linkPreviews }: StateType) => linkPreviews,
  ({ linkPreview, source }) => {
    return (fromSource: LinkPreviewSourceType) => {
      if (!linkPreview) {
        return;
      }

      if (source !== fromSource) {
        return;
      }

      const domain = getSafeDomain(linkPreview.url);
      assertDev(
        domain !== undefined,
        "Domain of linkPreview can't be undefined"
      );

      return {
        ...linkPreview,
        domain,
        isLoaded: true,
      };
    };
  }
);
