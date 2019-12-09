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
    const { showSubtitle, i18n } = this.props;

    const title = i18n('beginYourSession');
    const subtitle = i18n('ensuringPeaceOfMind');

    return (
      <div className="session-content-accent-text">
        <div
          className="session-content-accent-text title"
          dangerouslySetInnerHTML={{ __html: title }}
        />

        {showSubtitle ? (
          <div
            className="session-content-accent-text subtitle"
            dangerouslySetInnerHTML={{ __html: subtitle }}
          />
        ) : (
          ''
        )}
      </div>
    );
  }
}
