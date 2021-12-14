import React from 'react';

type Props = {
  text: string;
};

export const PillDivider = (props: Props) => {
  return (
    <div className="panel-text-divider">
      <div className="panel-text-divider-line" />
      <span>{props.text}</span>
      <div className="panel-text-divider-line" />
    </div>
  );
};
