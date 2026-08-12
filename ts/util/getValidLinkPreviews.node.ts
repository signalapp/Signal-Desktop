// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LinkPreviewType } from '../types/message/LinkPreviews.std.ts';
import * as LinkPreview from '../types/LinkPreview.std.ts';
import { getRoomIdFromCallLink } from './callLinksRingrtc.node.ts';
import { isNotNil } from './isNotNil.std.ts';

export function getValidLinkPreviews(
  previews: ReadonlyArray<LinkPreviewType>,
  body: string | null | undefined,
  { isStory }: { isStory: boolean }
): Array<LinkPreviewType> {
  const urlsInBody = LinkPreview.findLinks(body || '');

  const validated = previews
    .map((item: LinkPreviewType) => {
      if (!LinkPreview.isValidLinkPreview(urlsInBody, item, { isStory })) {
        return null;
      }

      if (LinkPreview.isCallLink(item.url)) {
        return {
          ...item,
          isCallLink: true,
          callLinkRoomId: getRoomIdFromCallLink(item.url),
        };
      }

      return item;
    })
    .filter(isNotNil);

  return validated;
}
