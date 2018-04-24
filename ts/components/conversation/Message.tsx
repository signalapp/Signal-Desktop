import React from 'react';


/**
 * A placeholder Message component for now, giving the structure of a plain message with
 * none of the dynamic functionality. This page will be used to build up our corpus of
 * permutations before we start moving all message functionality to React.
 */
export class Message extends React.Component<{}, {}> {
  public render() {
    return (
      <li className="entry outgoing sent delivered">
        <span className="avatar" />
        <div className="bubble">
          <div className="sender" dir="auto" />
          <div className="tail-wrapper with-tail">
            <div className="inner-bubble">
              <p className="content" dir="auto">
                <span className="body">
                  Hi there. How are you doing? Feeling pretty good? Awesome.
                </span>
              </p>
            </div>
          </div>
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
