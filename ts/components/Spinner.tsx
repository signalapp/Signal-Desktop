import React from 'react';
import classNames from 'classnames';

interface Props {
  size?: string;
  svgSize: 'small' | 'normal';
  direction?: string;
}

export class Spinner extends React.Component<Props> {
  public render() {
    const { size, svgSize, direction } = this.props;

    return (
      <div
        className={classNames(
          'module-spinner__container',
          `module-spinner__container--${svgSize}`,
          direction ? `module-spinner__container--${direction}` : null,
          direction
            ? `module-spinner__container--${svgSize}-${direction}`
            : null
        )}
        style={{
          height: size,
          width: size,
        }}
      >
        <div
          className={classNames(
            'module-spinner__circle',
            `module-spinner__circle--${svgSize}`,
            direction ? `module-spinner__circle--${direction}` : null,
            direction ? `module-spinner__circle--${svgSize}-${direction}` : null
          )}
        />
        <div
          className={classNames(
            'module-spinner__arc',
            `module-spinner__arc--${svgSize}`,
            direction ? `module-spinner__arc--${direction}` : null,
            direction ? `module-spinner__arc--${svgSize}-${direction}` : null
          )}
        />
      </div>
    );
  }
}
