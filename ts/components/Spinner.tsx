import React from 'react';
import classNames from 'classnames';

interface Props {
  size: 'small' | 'mini' | 'normal';
  direction?: string;
}

export class Spinner extends React.Component<Props> {
  public render() {
    const { size, direction } = this.props;

    return (
      <div
        className={classNames(
          'module-spinner__container',
          `module-spinner__container--${size}`,
          direction ? `module-spinner__container--${direction}` : null,
          direction ? `module-spinner__container--${size}-${direction}` : null
        )}
      >
        <div
          className={classNames(
            'module-spinner__circle',
            `module-spinner__circle--${size}`,
            direction ? `module-spinner__circle--${direction}` : null,
            direction ? `module-spinner__circle--${size}-${direction}` : null
          )}
        />
        <div
          className={classNames(
            'module-spinner__arc',
            `module-spinner__arc--${size}`,
            direction ? `module-spinner__arc--${direction}` : null,
            direction ? `module-spinner__arc--${size}-${direction}` : null
          )}
        />
      </div>
    );
  }
}
