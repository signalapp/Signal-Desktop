import React from 'react';
// import classNames from 'classnames';

interface Props {
  duration: number;
  expiresAt: number;
  onComplete?: () => unknown;
}
interface State {
  ratio: number;
}

const CIRCUMFERENCE = 11.013 * 2 * Math.PI;

export class Countdown extends React.Component<Props, State> {
  public looping = false;

  constructor(props: Props) {
    super(props);

    const { duration, expiresAt } = this.props;
    const ratio = getRatio(expiresAt, duration);

    this.state = { ratio };
  }

  public componentDidMount() {
    this.startLoop();
  }

  public componentDidUpdate() {
    this.startLoop();
  }

  public componentWillUnmount() {
    this.stopLoop();
  }

  public startLoop() {
    if (this.looping) {
      return;
    }

    this.looping = true;
    requestAnimationFrame(this.loop);
  }

  public stopLoop() {
    this.looping = false;
  }

  public loop = () => {
    const { onComplete, duration, expiresAt } = this.props;
    if (!this.looping) {
      return;
    }

    const ratio = getRatio(expiresAt, duration);
    this.setState({ ratio });

    if (ratio === 1) {
      this.looping = false;
      if (onComplete) {
        onComplete();
      }
    } else {
      requestAnimationFrame(this.loop);
    }
  };

  public render() {
    const { ratio } = this.state;
    const strokeDashoffset = ratio * CIRCUMFERENCE;

    return (
      <svg className="module-countdown" viewBox="0 0 24 24">
        <path
          d="M12,1 A11,11,0,1,1,1,12,11.013,11.013,0,0,1,12,1Z"
          className="module-countdown__path"
          style={{
            strokeDasharray: `${CIRCUMFERENCE}, ${CIRCUMFERENCE}`,
            strokeDashoffset,
          }}
        />
      </svg>
    );
  }
}

function getRatio(expiresAt: number, duration: number) {
  const start = expiresAt - duration;
  const end = expiresAt;

  const now = Date.now();
  const totalTime = end - start;
  const elapsed = now - start;

  return Math.min(Math.max(0, elapsed / totalTime), 1);
}
