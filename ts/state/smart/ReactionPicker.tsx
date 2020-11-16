// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { useSelector } from 'react-redux';
import { get } from 'lodash';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';

import { LocalizerType } from '../../types/Util';
import {
  ReactionPicker,
  Props,
} from '../../components/conversation/ReactionPicker';

type ExternalProps = Omit<Props, 'skinTone' | 'i18n'>;

export const SmartReactionPicker = React.forwardRef<
  HTMLDivElement,
  ExternalProps
>((props, ref) => {
  const i18n = useSelector<StateType, LocalizerType>(getIntl);

  const skinTone = useSelector<StateType, number>(state =>
    get(state, ['items', 'skinTone'], 0)
  );

  return (
    <ReactionPicker ref={ref} skinTone={skinTone} i18n={i18n} {...props} />
  );
});
