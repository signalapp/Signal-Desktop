// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import type { LocalizerType } from '../../types/Util';
import type { StateType } from '../reducer';
import { LinkPreviewSourceType } from '../../types/LinkPreview';
import { StoryCreator } from '../../components/StoryCreator';
import { getAllSignalConnections, getMe } from '../selectors/conversations';
import { getDistributionLists } from '../selectors/storyDistributionLists';
import { getIntl } from '../selectors/user';
import {
  getInstalledStickerPacks,
  getRecentStickers,
} from '../selectors/stickers';
import { getLinkPreview } from '../selectors/linkPreviews';
import { processAttachment } from '../../util/processAttachment';
import { useLinkPreviewActions } from '../ducks/linkPreviews';
import { useStoriesActions } from '../ducks/stories';

export type PropsType = {
  file?: File;
  onClose: () => unknown;
};

export function SmartStoryCreator({
  file,
  onClose,
}: PropsType): JSX.Element | null {
  const { debouncedMaybeGrabLinkPreview } = useLinkPreviewActions();
  const { sendStoryMessage } = useStoriesActions();

  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const distributionLists = useSelector(getDistributionLists);
  const installedPacks = useSelector(getInstalledStickerPacks);
  const linkPreviewForSource = useSelector(getLinkPreview);
  const me = useSelector(getMe);
  const recentStickers = useSelector(getRecentStickers);
  const signalConnections = useSelector(getAllSignalConnections);

  return (
    <StoryCreator
      debouncedMaybeGrabLinkPreview={debouncedMaybeGrabLinkPreview}
      distributionLists={distributionLists}
      i18n={i18n}
      installedPacks={installedPacks}
      file={file}
      linkPreview={linkPreviewForSource(LinkPreviewSourceType.StoryCreator)}
      me={me}
      onClose={onClose}
      onSend={sendStoryMessage}
      processAttachment={processAttachment}
      recentStickers={recentStickers}
      signalConnections={signalConnections}
    />
  );
}
