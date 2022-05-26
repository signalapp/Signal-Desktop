// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import type { CSSProperties, ReactElement } from 'react';
import React, { useEffect, useState } from 'react';
import { animated, useSpring } from '@react-spring/web';

import type { LocalizerType } from '../../types/Util';
import { TimelineDateHeader } from './TimelineDateHeader';
import { Spinner } from '../Spinner';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  isLoading: boolean;
  style?: CSSProperties;
  timestamp: number;
  visible: boolean;
}>;

export const TimelineFloatingHeader = ({
  i18n,
  isLoading,
  style,
  timestamp,
  visible,
}: PropsType): ReactElement => {
  const [hasRendered, setHasRendered] = useState(false);
  const [showSpinner, setShowSpinner] = useState(isLoading);

  useEffect(() => {
    setHasRendered(true);
  }, []);

  const [spinnerStyles, spinnerSpringRef] = useSpring(
    () => ({
      delay: 300,
      duration: 250,
      from: { opacity: 1 },
      to: { opacity: 0 },
      onRest: {
        opacity: ({ value }) => {
          if (value === 0) {
            setShowSpinner(false);
          }
        },
      },
    }),
    [isLoading]
  );

  useEffect(() => {
    if (isLoading) {
      spinnerSpringRef.stop();
      spinnerSpringRef.set({ opacity: 1 });
      setShowSpinner(true);
    }

    if (!isLoading && showSpinner) {
      spinnerSpringRef.start();
    }

    if (!isLoading && !showSpinner) {
      spinnerSpringRef.stop();
    }
  }, [isLoading, showSpinner, spinnerSpringRef]);

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
      {showSpinner && (
        <animated.div
          className="TimelineFloatingHeader__spinner-container"
          style={spinnerStyles}
        >
          <Spinner direction="on-background" size="20px" svgSize="small" />
        </animated.div>
      )}
    </div>
  );
};
