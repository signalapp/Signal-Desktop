// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { LinkPreviewItem } from '../../components/conversation/media-gallery/LinkPreviewItem.dom.js';
import { getSafeDomain } from '../../types/LinkPreview.std.js';
import type { DataProps as PropsType } from '../../components/conversation/media-gallery/LinkPreviewItem.dom.js';
import { getIntl, getTheme } from '../selectors/user.std.js';
import { getConversationSelector } from '../selectors/conversations.dom.js';

export { PropsType };

export const SmartLinkPreviewItem = memo(function SmartLinkPreviewItem({
  mediaItem,
  onClick,
}: PropsType) {
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const getConversation = useSelector(getConversationSelector);

  const author = getConversation(
    mediaItem.message.sourceServiceId ?? mediaItem.message.source
  );

  const hydratedMediaItem = {
    ...mediaItem,
    preview: {
      ...mediaItem.preview,
      domain: getSafeDomain(mediaItem.preview.url),
    },
  };

  return (
    <LinkPreviewItem
      i18n={i18n}
      theme={theme}
      authorTitle={author.title}
      mediaItem={hydratedMediaItem}
      onClick={onClick}
    />
  );
});
