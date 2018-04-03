import React from 'react';


interface IProps {
  /**
   * Corresponds to the theme setting in the app, and the class added to the root element.
   */
  theme: "ios" | "android" | "android-dark";
}

/**
 * Provides the parent elements necessary to allow the main Signal Desktop stylesheet to
 * apply (with no changes) to messages in this context.
 */
export class MessageParents extends React.Component<IProps, {}> {
  public render() {
    const { theme } = this.props;

    return (
      <div className={theme}>
        <div className="conversation">
          <div className="discussion-container" style={{padding: '0.5em'}}>
            <ul className="message-list">
              {this.props.children}
            </ul>
          </div>
        </div>
      </div>
    );
  }
}
