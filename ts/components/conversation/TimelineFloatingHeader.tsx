// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import type { CSSProperties, ReactElement } from 'react';
import React, { useEffect, useState } from 'react';
import type { LocalizerType } from '../../types/Util';
import { TimelineDateHeader } from './TimelineDateHeader';
import { Spinner } from '../Spinner';

export const TimelineFloatingHeader = ({
  i18n,
  isLoading,
  style,
  timestamp,
  visible,
}: Readonly<{
  i18n: LocalizerType;
  isLoading: boolean;
  style?: CSSProperties;
  timestamp: number;
  visible: boolean;
}>): ReactElement => {
  const [hasRendered, setHasRendered] = useState(false);

  useEffect(() => {
    setHasRendered(true);
  }, []);

  return (
    <div
      className={classNames(
        'TimelineFloatingHeader',
        `TimelineFloatingHeader--${
          visible && hasRendered ? 'visible' : 'hidden'
        }`
      )}
      style={style}
    >
      <TimelineDateHeader floating i18n={i18n} timestamp={timestamp} />
      <div
        className={classNames(
          'TimelineFloatingHeader__spinner-container',
          `TimelineFloatingHeader__spinner-container--${
            isLoading ? 'visible' : 'hidden'
          }`
        )}
      >
        <Spinner direction="on-background" size="20px" svgSize="small" />
      </div>
    </div>
  );
};
