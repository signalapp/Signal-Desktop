// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import type { LocalizerType } from '../../types/Util';
import type { StateType } from '../reducer';
import { LinkPreviewSourceType } from '../../types/LinkPreview';
import { StoryCreator } from '../../components/StoryCreator';
import { getDistributionLists } from '../selectors/storyDistributionLists';
import { getIntl } from '../selectors/user';
import { getLinkPreview } from '../selectors/linkPreviews';
import { getAllSignalConnections, getMe } from '../selectors/conversations';
import { useLinkPreviewActions } from '../ducks/linkPreviews';
import { useStoriesActions } from '../ducks/stories';

export type PropsType = {
  onClose: () => unknown;
};

export function SmartStoryCreator({ onClose }: PropsType): JSX.Element | null {
  const { debouncedMaybeGrabLinkPreview } = useLinkPreviewActions();
  const { sendStoryMessage } = useStoriesActions();

  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const linkPreviewForSource = useSelector(getLinkPreview);
  const distributionLists = useSelector(getDistributionLists);
  const me = useSelector(getMe);
  const signalConnections = useSelector(getAllSignalConnections);

  return (
    <StoryCreator
      debouncedMaybeGrabLinkPreview={debouncedMaybeGrabLinkPreview}
      distributionLists={distributionLists}
      i18n={i18n}
      linkPreview={linkPreviewForSource(LinkPreviewSourceType.StoryCreator)}
      me={me}
      onClose={onClose}
      onSend={sendStoryMessage}
      signalConnections={signalConnections}
    />
  );
}
