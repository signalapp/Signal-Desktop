import React from 'react';

import { LocalizerType } from '../../types/Util';

export interface Props {
  i18n: LocalizerType;
}

export const ResetSessionNotification = ({ i18n }: Props): JSX.Element => (
  <div className="module-reset-session-notification">
    {i18n('sessionEnded')}
  </div>
);
