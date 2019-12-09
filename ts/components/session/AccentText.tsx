import React from 'react';
import classNames from 'classnames';

//import { LocalizerType } from '../../types/Util';

interface Props {
  //i18n: LocalizerType;
  // text: string;
  showSubtitle?: boolean;
}

export class AccentText extends React.PureComponent<Props> {
  constructor(props: any) {
    super(props);
  }

  public render() {
    const { showSubtitle } = this.props;

    return (
      <div className="session-accent-text">
        <div className="session-accent-text title">
          Begin<br />your<br />Session.
        </div>
        {showSubtitle ? (
          <div className="session-accent-text subtitle">
            Ensuring <span className={classNames('redacted')}>peace of</span>{' '}
            mind, one <span className={classNames('redacted')}>session</span> at
            a time.
          </div>
        ) : (
          ''
        )}
      </div>
    );
  }
}
