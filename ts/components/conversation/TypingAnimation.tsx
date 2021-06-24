import React from 'react';
import classNames from 'classnames';

interface Props {
  color?: string;
}

export class TypingAnimation extends React.Component<Props> {
  public render() {
    const { color } = this.props;

    return (
      <div className="module-typing-animation" title={window.i18n('typingAlt')}>
        <div
          className={classNames(
            'module-typing-animation__dot',
            'module-typing-animation__dot--first',
            color ? `module-typing-animation__dot--${color}` : null
          )}
        />
        <div className="module-typing-animation__spacer" />
        <div
          className={classNames(
            'module-typing-animation__dot',
            'module-typing-animation__dot--second',
            color ? `module-typing-animation__dot--${color}` : null
          )}
        />
        <div className="module-typing-animation__spacer" />
        <div
          className={classNames(
            'module-typing-animation__dot',
            'module-typing-animation__dot--third',
            color ? `module-typing-animation__dot--${color}` : null
          )}
        />
      </div>
    );
  }
}
