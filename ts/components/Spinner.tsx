import React from 'react';
import classNames from 'classnames';

interface Props {
  small?: boolean;
  direction?: string;
}

export class Spinner extends React.Component<Props> {
  public render() {
    const { small, direction } = this.props;

    return (
      <div
        className={classNames(
          'module-spinner__container',
          direction ? `module-spinner__container--${direction}` : null,
          small ? 'module-spinner__container--small' : null,
          small && direction
            ? `module-spinner__container--small-${direction}`
            : null
        )}
      >
        <div
          className={classNames(
            'module-spinner__circle',
            direction ? `module-spinner__circle--${direction}` : null,
            small ? 'module-spinner__circle--small' : null,
            small && direction
              ? `module-spinner__circle--small-${direction}`
              : null
          )}
        />
        <div
          className={classNames(
            'module-spinner__arc',
            direction ? `module-spinner__arc--${direction}` : null,
            small ? 'module-spinner__arc--small' : null,
            small && direction
              ? `module-spinner__arc--small-${direction}`
              : null
          )}
        />
      </div>
    );
  }
}
