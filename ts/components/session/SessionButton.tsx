import React from 'react';
import classNames from 'classnames';

//import { LocalizerType } from '../../types/Util';

export enum SessionButtonTypes {
  fullGreen = 'fullGreen',
  white = 'white',
  green = 'green',
}

interface Props {
  //i18n: LocalizerType;
  text: string;
  buttonType: SessionButtonTypes;
}

export class SessionButton extends React.PureComponent<Props> {
  public render() {
    const { buttonType, text } = this.props;

    return (
      <div
        className={classNames(
          'session-button',
          buttonType === SessionButtonTypes.green ? 'green' : '',
          buttonType === SessionButtonTypes.fullGreen ? 'full-green' : '',
          buttonType === SessionButtonTypes.white ? 'white' : ''
        )}
        role="button"
      >
        {text}
      </div>
    );
  }
}
