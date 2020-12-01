// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useEffect } from 'react';
import classNames from 'classnames';
import { GroupCallConnectionState } from '../types/Calling';
import { LocalizerType } from '../types/Util';

interface PropsType {
  connectionState: GroupCallConnectionState;
  i18n: LocalizerType;
}

// In the future, this component should show toasts when users join or leave. See
//   DESKTOP-902.
export const GroupCallToastManager: React.FC<PropsType> = ({
  connectionState,
  i18n,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(connectionState === GroupCallConnectionState.Reconnecting);
  }, [connectionState, setIsVisible]);

  const message = i18n('callReconnecting');

  return (
    <div
      className={classNames('module-ongoing-call__toast', {
        'module-ongoing-call__toast--hidden': !isVisible,
      })}
    >
      {message}
    </div>
  );
};
