import React from 'react';
import classNames from 'classnames';
import { Constants } from '../../session';

interface Props {
  // Value ranges from 0 to 100
  value: number;
  // Optional. Load with initial value and have
  // it shoot to new value immediately
  prevValue?: number;
  sendStatus: -1 | 0 | 1 | 2;
  visible: boolean;
  showOnComplete: boolean;

  resetProgress: any;
}

interface State {
  show: boolean;
  visible: boolean;
}

export class SessionProgress extends React.PureComponent<Props, State> {
  public static defaultProps = {
    showOnComplete: true,
  };

  constructor(props: any) {
    super(props);

    const { visible } = this.props;

    this.state = {
      show: true,
      visible,
    };

    this.onComplete = this.onComplete.bind(this);
  }

  public componentWillReceiveProps() {
    // Reset show for each reset
    this.setState({ show: true });
  }

  public render() {
    const { value, prevValue, sendStatus } = this.props;
    const { show } = this.state;

    // Duration will be the decimal (in seconds) of
    // the percentage differnce, else 0.25s;
    // Minimum shift duration of 0.25s;

    // 1. Width depends on progress.
    // 2. Transition duration scales with the
    //    distance it needs to travel

    const successColor = Constants.UI.COLORS.GREEN;
    const failureColor = Constants.UI.COLORS.DANGER_ALT;
    const backgroundColor = sendStatus === -1 ? failureColor : successColor;

    const shiftDurationMs =
      this.getShiftDuration(this.props.value, prevValue) * 1000;
    const showDurationMs = 500;
    const showOffsetMs = shiftDurationMs + 500;

    const willComplete = value >= 100;
    if (willComplete && !show) {
      setTimeout(this.onComplete, shiftDurationMs);
    }

    const style = {
      'background-color': backgroundColor,
      transform: `translateX(-${100 - value}%)`,
      'transition-property': 'transform',
      // 'transition-property':      'transform, opacity',
      'transition-duration': `${shiftDurationMs}ms`,
      // 'transition-duration':      `${shiftDurationMs}ms, ${showDurationMs}ms`,
      'transition-delay': '0ms',
      // 'transition-delay':         `0ms, ${showOffsetMs}ms`,
      'transition-timing-funtion': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      //'transition-timing-funtion':'cubic-bezier(0.25, 0.46, 0.45, 0.94), linear',
    };

    return (
      <div className="session-progress">
        {show && (
          <div className="session-progress__progress" style={style}>
            &nbsp
          </div>
        )}
      </div>
    );
  }

  public onComplete() {
    if (!this.state.show) {
      return;
    }

    console.log(`[sending] ONCOMPLETE`);
    this.setState({ show: false }, () => {
      setTimeout(this.props.resetProgress, 2000);
    });
  }

  private getShiftDuration(value: number, prevValue?: number) {
    // Generates a shift duration which is based upon the distance requred to travel.
    // Follows the curve of y = (1-c)*sqrt(x) + c
    // Input values are between 0 and 100.
    // Max time = 1.0s.

    const minTime = 0.25;
    if (!prevValue) {
      return minTime;
    }

    const distance = Math.abs(value - prevValue) / 100;
    return (1 - minTime) * Math.sqrt(distance) + minTime;
  }
}
