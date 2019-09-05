import React from 'react';
import { isNumber } from 'lodash';

import { Countdown } from '../Countdown';
import { Spinner } from '../Spinner';

export type STATE_ENUM = 'idle' | 'countdown' | 'loading';

type Props = {
  state: STATE_ENUM;
  duration?: number;
  expiresAt?: number;
  onComplete?: () => unknown;
};

const FAKE_DURATION = 1000;

export class TimelineLoadingRow extends React.PureComponent<Props> {
  public renderContents() {
    const { state, duration, expiresAt, onComplete } = this.props;

    if (state === 'idle') {
      const fakeExpiresAt = Date.now() - FAKE_DURATION;

      return <Countdown duration={FAKE_DURATION} expiresAt={fakeExpiresAt} />;
    } else if (
      state === 'countdown' &&
      isNumber(duration) &&
      isNumber(expiresAt)
    ) {
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

  public render() {
    return (
      <div className="module-timeline-loading-row">{this.renderContents()}</div>
    );
  }
}
