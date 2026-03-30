// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util.std.ts';
import { getStoryDistributionListName } from '../types/Stories.std.ts';
import type { StoryDistributionIdString } from '../types/StoryDistributionId.std.ts';
import { UserText } from './UserText.dom.tsx';

type PropsType = {
  i18n: LocalizerType;
  id: StoryDistributionIdString | string;
  name: string;
};

export function StoryDistributionListName({
  i18n,
  id,
  name,
}: PropsType): React.JSX.Element {
  return <UserText text={getStoryDistributionListName(i18n, id, name)} />;
}
