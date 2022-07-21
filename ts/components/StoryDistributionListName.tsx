// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { getStoryDistributionListName } from '../types/Stories';

type PropsType = {
  i18n: LocalizerType;
  id: string;
  name: string;
};

export const StoryDistributionListName = ({
  i18n,
  id,
  name,
}: PropsType): JSX.Element => {
  return <>{getStoryDistributionListName(i18n, id, name)}</>;
};
