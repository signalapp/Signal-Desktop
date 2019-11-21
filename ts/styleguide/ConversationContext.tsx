import React from 'react';
import classNames from 'classnames';

interface Props {
  /**
   * Corresponds to the theme setting in the app, and the class added to the root element.
   */
  ios: boolean;
  theme: 'light-theme' | 'dark-theme';
  mode: 'mouse-mode' | 'keyboard-mode';
}

/**
 * Provides the parent elements necessary to allow the main Signal Desktop stylesheet to
 * apply (with no changes) to messages in the Style Guide.
 */
export class ConversationContext extends React.Component<Props> {
  public render() {
    const { ios, theme, mode } = this.props;

    return (
      <div
        className={classNames(
          theme || 'light-theme',
          ios ? 'ios-theme' : null,
          mode
        )}
        style={{
          backgroundColor: theme === 'dark-theme' ? 'black' : undefined,
        }}
      >
        <div className="timeline-placeholder">
          <div className="timeline-wrapper">{this.props.children}</div>
        </div>
      </div>
    );
  }
}
