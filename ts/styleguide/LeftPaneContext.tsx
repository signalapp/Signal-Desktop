import React from 'react';
import classNames from 'classnames';

interface Props {
  /**
   * Corresponds to the theme setting in the app, and the class added to the root element.
   */
  theme: 'light-theme' | 'dark-theme';
}

/**
 * Provides the parent elements necessary to allow the main Signal Desktop stylesheet to
 * apply (with no changes) to messages in the Style Guide.
 */
export class LeftPaneContext extends React.Component<Props> {
  public render() {
    const { theme } = this.props;

    return (
      <div className={classNames(theme || 'light-theme')}>
        <div className="gutter">{this.props.children}</div>
      </div>
    );
  }
}
