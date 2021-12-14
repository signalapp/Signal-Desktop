import React from 'react';

type Props = {
  loading: boolean;
};

export const SessionSpinner = (props: Props) => {
  const { loading } = props;

  return (
    <>
      {loading ? (
        <div className="session-loader">
          <div />
          <div />
          <div />
          <div />
        </div>
      ) : null}
    </>
  );
};
