import React from 'react';
import { getInitials } from '../../util/getInitials';

interface Props {
  diameter: number;
  name: string;
  pubkey?: string;
  colors: Array<string>;
  borderColor: string;
}

interface State {
  sha512Seed?: string;
}

export class AvatarPlaceHolder extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props);

    this.state = {
      sha512Seed: undefined,
    };
  }

  public componentDidMount() {
    const { pubkey } = this.props;
    if (pubkey) {
      void this.sha512(pubkey).then((sha512Seed: string) => {
        this.setState({ sha512Seed });
      });
    }
  }

  public componentDidUpdate(prevProps: Props, prevState: State) {
    const { pubkey, name } = this.props;
    if (pubkey === prevProps.pubkey && name === prevProps.name) {
      return;
    }

    if (pubkey) {
      void this.sha512(pubkey).then((sha512Seed: string) => {
        this.setState({ sha512Seed });
      });
    }
  }

  public render() {
    const { borderColor, colors, diameter, name } = this.props;
    const diameterWithoutBorder = diameter - 2;
    const viewBox = `0 0 ${diameter} ${diameter}`;
    const r = diameter / 2;
    const rWithoutBorder = diameterWithoutBorder / 2;

    if (!this.state.sha512Seed) {
      // return grey circle
      return (
        <svg viewBox={viewBox}>
          <g id="UrTavla">
            <circle
              cx={r}
              cy={r}
              r={rWithoutBorder}
              fill="#d2d2d3"
              shapeRendering="geometricPrecision"
              stroke={borderColor}
              strokeWidth="1"
            />
          </g>
        </svg>
      );
    }

    const initial = getInitials(name)?.toLocaleUpperCase() || '0';
    const fontSize = diameter * 0.5;

    // Generate the seed simulate the .hashCode as Java
    const hash = parseInt(this.state.sha512Seed.substring(0, 12), 16) || 0;

    const bgColorIndex = hash % colors.length;

    const bgColor = colors[bgColorIndex];

    return (
      <svg viewBox={viewBox}>
        <g id="UrTavla">
          <circle
            cx={r}
            cy={r}
            r={rWithoutBorder}
            fill={bgColor}
            shapeRendering="geometricPrecision"
            stroke={borderColor}
            strokeWidth="1"
          />
          <text
            fontSize={fontSize}
            x="50%"
            y="50%"
            fill="white"
            textAnchor="middle"
            stroke="white"
            strokeWidth={1}
            alignmentBaseline="central"
          >
            {initial}
          </text>
        </g>
      </svg>
    );
  }

  private async sha512(str: string) {
    // tslint:disable-next-line: await-promise
    const buf = await crypto.subtle.digest(
      'SHA-512',
      new TextEncoder().encode(str)
    );

    // tslint:disable: prefer-template restrict-plus-operands
    return Array.prototype.map
      .call(new Uint8Array(buf), (x: any) => ('00' + x.toString(16)).slice(-2))
      .join('');
  }
}
