// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import { noop } from 'lodash';

import type { LocalizerType } from '../../types/Util';
import type { StateType } from '../reducer';
import { LinkPreviewSourceType } from '../../types/LinkPreview';
import { StoryCreator } from '../../components/StoryCreator';
import { getIntl } from '../selectors/user';
import { getLinkPreview } from '../selectors/linkPreviews';
import { useLinkPreviewActions } from '../ducks/linkPreviews';

export type PropsType = {
  onClose: () => unknown;
};

export function SmartStoryCreator({ onClose }: PropsType): JSX.Element | null {
  const { debouncedMaybeGrabLinkPreview } = useLinkPreviewActions();

  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const linkPreviewForSource = useSelector(getLinkPreview);

  return (
    <StoryCreator
      debouncedMaybeGrabLinkPreview={debouncedMaybeGrabLinkPreview}
      i18n={i18n}
      linkPreview={linkPreviewForSource(LinkPreviewSourceType.StoryCreator)}
      onClose={onClose}
      onNext={noop}
    />
  );
}
