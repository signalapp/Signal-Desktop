import React from 'react';

import { LocalizerType } from '../../types/Util';

interface Props {
  i18n: LocalizerType;
  showSubtitle?: boolean;
}
export class AccentText extends React.PureComponent<Props> {
  constructor(props: any) {
    super(props);
  }

  public render() {
    const { showSubtitle } = this.props;

    // FIXME find a better way than dangerouslySetInnerHTML to set those two strings in a localized way
    return (
      <div className="session-content-accent-text">
        <div className="session-content-accent-text title">
          Begin
          <br />
          your
          <br />
          Session.
        </div>
        {showSubtitle ? (
          <div className="session-content-accent-text subtitle">
            Ensuring <span className="redacted">peace of</span> mind, one{' '}
            <span className="redacted">session</span> at a time.
          </div>
        ) : (
          ''
        )}
      </div>
    );
  }
}
