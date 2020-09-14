import React from 'react';

interface Props {
  label: string;
}

export const EmptyState = ({ label }: Props): JSX.Element => (
  <div className="module-empty-state">{label}</div>
);
