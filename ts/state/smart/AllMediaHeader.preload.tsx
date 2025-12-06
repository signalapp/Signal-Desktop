// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { PanelHeader } from '../../components/conversation/media-gallery/PanelHeader.dom.js';
import { getMediaGalleryState } from '../selectors/mediaGallery.std.js';
import { getIntl } from '../selectors/user.std.js';
import { useMediaGalleryActions } from '../ducks/mediaGallery.preload.js';

export const SmartAllMediaHeader = memo(function SmartAllMediaHeader() {
  const { tab } = useSelector(getMediaGalleryState);
  const { setTab } = useMediaGalleryActions();
  const i18n = useSelector(getIntl);

  return <PanelHeader i18n={i18n} tab={tab} setTab={setTab} />;
});
