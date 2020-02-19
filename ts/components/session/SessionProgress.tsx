import React from 'react';


interface Props {
  // Value ranges from 0 to 100
  value: number;
  // Optional. Load with initial value and have
  // it shoot to new value immediately
  prevValue?: number;
  visible: boolean;
  fadeOnComplete: boolean;
}

interface State {
  value: number;
  visible: boolean;
  startFade: boolean;
}

export class SessionProgress extends React.PureComponent<Props, State> {
  public static defaultProps = {
    fadeOnComplete: true,
  };

  constructor(props: any) {
    super(props);

    const { visible, value, prevValue } = this.props;

    this.state = {
      visible,
      startFade: false,
      value: prevValue || value,
    };
  }

  public componentWillMount() {
    setTimeout(() => {
      this.setState({
        value: this.props.value,
      });
    }, 20);
  }

  public render() {
    const { startFade, value } = this.state;
    const { prevValue } = this.props;

    // Duration will be the decimal (in seconds) of
    // the percentage differnce, else 0.25s;
    // Minimum shift duration of 0.25s;
    const shiftDuration = this.getShiftDuration(this.props.value, prevValue);

    // 1. Width depends on progress.
    // 2. Opacity is the inverse of fade.
    // 3. Transition duration scales with the 
    //    distance it needs to travel
    const style = {
      width: `${this.state.value}%`,
      opacity: `${Number(!startFade)}`,
      transition: `width ${shiftDuration.toFixed(2)}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
    };

    if (value >= 100) {
      this.onComplete();
    }

    return (
        <div className="session-progress">
            <div
                className="session-progress__progress"
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
    if ( fadeOnComplete ) {
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
