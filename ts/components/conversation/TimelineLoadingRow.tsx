// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { isNumber } from 'lodash';

import { Countdown } from '../Countdown';
import { Spinner } from '../Spinner';

export type STATE_ENUM = 'idle' | 'countdown' | 'loading';

export type Props = {
  state: STATE_ENUM;
  duration?: number;
  expiresAt?: number;
  onComplete?: () => unknown;
};

const FAKE_DURATION = 1000;

export class TimelineLoadingRow extends React.PureComponent<Props> {
  public renderContents(): JSX.Element {
    const { state, duration, expiresAt, onComplete } = this.props;

    if (state === 'idle') {
      const fakeExpiresAt = Date.now() - FAKE_DURATION;

      return <Countdown duration={FAKE_DURATION} expiresAt={fakeExpiresAt} />;
    }
    if (state === 'countdown' && isNumber(duration) && isNumber(expiresAt)) {
      return (
        <Countdown
          duration={duration}
          expiresAt={expiresAt}
          onComplete={onComplete}
        />
      );
    }

    return <Spinner size="24" svgSize="small" direction="on-background" />;
  }

  public override render(): JSX.Element {
    return (
      <div className="module-timeline-loading-row">{this.renderContents()}</div>
    );
  }
}
