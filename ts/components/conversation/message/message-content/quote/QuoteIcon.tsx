import classNames from 'classnames';
import React from 'react';

export const QuoteIcon = (props: any) => {
  const { icon } = props;

  return (
    <div className="module-quote__icon-container">
      <div className="module-quote__icon-container__inner">
        <div className="module-quote__icon-container__circle-background">
          <div
            className={classNames(
              'module-quote__icon-container__icon',
              `module-quote__icon-container__icon--${icon}`
            )}
          />
        </div>
      </div>
    </div>
  );
};
