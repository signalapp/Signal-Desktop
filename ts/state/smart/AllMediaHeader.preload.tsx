// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { PanelHeader } from '../../components/conversation/media-gallery/PanelHeader.dom.tsx';
import { getMediaGalleryState } from '../selectors/mediaGallery.std.ts';
import { getIntl } from '../selectors/user.std.ts';
import { useMediaGalleryActions } from '../ducks/mediaGallery.preload.ts';

export const SmartAllMediaHeader = memo(function SmartAllMediaHeader() {
  const { tab, sortOrder } = useSelector(getMediaGalleryState);
  const { setTab, setSortOrder } = useMediaGalleryActions();
  const i18n = useSelector(getIntl);

  return (
    <PanelHeader
      i18n={i18n}
      tab={tab}
      setTab={setTab}
      sortOrder={sortOrder}
      setSortOrder={setSortOrder}
    />
  );
});
