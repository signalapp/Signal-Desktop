import React from 'react';

export const LoadingIndicator = (): JSX.Element => {
  return (
    <div className="loading-widget">
      <div className="container">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
};
