import React from 'react';


/**
 * A placeholder Message component, giving the structure of a plain message with none of
 * the dynamic functionality. We can build off of this going forward.
 */
export class Message extends React.Component<{}, {}> {
  public render() {
    return (
      <li className="entry outgoing sent delivered">
        <span className="avatar" />
        <div className="bubble">
          <div className="sender" dir="auto" />
          <div className="attachments" />
          <p className="content" dir="auto">
            <span className="body">
              Hi there. How are you doing? Feeling pretty good? Awesome.
            </span>
          </p>
          <div className="meta">
            <span
              className="timestamp"
              data-timestamp="1522800995425"
              title="Tue, Apr 3, 2018 5:16 PM"
            >
              1 minute ago
            </span>
            <span className="status hide" />
            <span className="timer" />
          </div>
        </div>
      </li>
    );
  }
}
