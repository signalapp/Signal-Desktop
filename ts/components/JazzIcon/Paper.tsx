import React from 'react';

const styles = {
  borderRadius: '50%',
  display: 'inline-block',
  margin: 0,
  overflow: 'hidden',
  padding: 0,
};

// @ts-ignore
export const Paper = ({ children, color, diameter, style: styleOverrides }) => (
  <div
    className="paper"
    style={{
      ...styles,
      backgroundColor: color,
      height: diameter,
      width: diameter,
      ...(styleOverrides || {}),
    }}
  >
    {children}
  </div>
);
