import React from 'react';
import classNames from 'classnames';

import { Localizer } from '../../types/Util';

interface Props {
  i18n: Localizer;
  color?: string;
}

export class TypingAnimation extends React.Component<Props> {
  public render() {
    const { i18n, color } = this.props;

    return (
      <div className="module-typing-animation" title={i18n('typingAlt')}>
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
