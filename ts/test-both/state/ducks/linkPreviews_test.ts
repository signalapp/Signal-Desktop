// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  actions,
  getEmptyState,
  reducer,
} from '../../../state/ducks/linkPreviews';
import type { LinkPreviewType } from '../../../types/message/LinkPreviews';

describe('both/state/ducks/linkPreviews', () => {
  function getMockLinkPreview(): LinkPreviewType {
    return {
      title: 'Hello World',
      domain: 'signal.org',
      url: 'https://www.signal.org',
      isStickerPack: false,
      isCallLink: false,
    };
  }

  describe('addLinkPreview', () => {
    const { addLinkPreview } = actions;

    it('updates linkPreview', () => {
      const state = getEmptyState();
      const linkPreview = getMockLinkPreview();
      const nextState = reducer(state, addLinkPreview(linkPreview, 1));

      assert.strictEqual(nextState.linkPreview, linkPreview);
    });
  });

  describe('removeLinkPreview', () => {
    const { removeLinkPreview } = actions;

    it('removes linkPreview', () => {
      const state = {
        ...getEmptyState(),
        linkPreview: getMockLinkPreview(),
      };
      const nextState = reducer(state, removeLinkPreview());

      assert.isUndefined(nextState.linkPreview);
    });
  });
});
