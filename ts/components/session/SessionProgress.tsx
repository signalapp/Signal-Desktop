import React from 'react';
import classNames from 'classnames'; 

interface Props {
  // Value ranges from 0 to 100
  value: number;
  // Optional. Load with initial value and have
  // it shoot to new value immediately
  prevValue?: number;
  sendStatus: -1 | 0 | 1 | 2;
  visible: boolean;
  fadeOnComplete: boolean;
}

interface State {
  visible: boolean;
  startFade: boolean;
}

export class SessionProgress extends React.PureComponent<Props, State> {
  public static defaultProps = {
    fadeOnComplete: true,
  };

  constructor(props: any) {
    super(props);

    const { visible } = this.props;

    this.state = {
      visible,
      startFade: false,
    };
  }

  public render() {
    const { startFade } = this.state;
    const { value, prevValue, sendStatus } = this.props;

    // Duration will be the decimal (in seconds) of
    // the percentage differnce, else 0.25s;
    // Minimum shift duration of 0.25s;

    // 1. Width depends on progress.
    // 2. Transition duration scales with the
    //    distance it needs to travel
    
    // FIXME VINCE - globalise all JS color references
    const sessionBrandColor = '#00f782';
    const sessionDangerAlt = '#ff4538';
    const successColor = sessionBrandColor;
    const failureColor = sessionDangerAlt;
    const backgroundColor = sendStatus === -1 ? failureColor : successColor;

    const shiftDurationMs = this.getShiftDuration(this.props.value, prevValue) * 1000;
    const fadeDurationMs = 500;
    const fadeOffsetMs = shiftDurationMs + 500;

    const style = {
      'background-color':         backgroundColor,
      'transform':                `translateX(-${100 - value}%)`,
      'transition-property':      'transform, opacity',
      'transition-duration':      `${shiftDurationMs}ms, ${fadeDurationMs}ms`,
      'transition-delay':         `0ms, ${fadeOffsetMs}ms`,
      'transition-timing-funtion':'cubic-bezier(0.25, 0.46, 0.45, 0.94), linear',
    }

    if (value >= 100) {
      this.onComplete();
    }

    return (
      <div className="session-progress">
        <div
          className={classNames('session-progress__progress', startFade && 'fade')}
          style={style}
        >
          &nbsp
        </div>
      </div>
    );
  }

  public onComplete() {
    const { fadeOnComplete } = this.props;

    // Fade
    if (fadeOnComplete) {
      this.setState({
        startFade: true,
      });
      
    }
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
