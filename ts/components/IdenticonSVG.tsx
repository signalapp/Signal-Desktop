// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

export type PropsTypeForContact = {
  backgroundColor: string;
  text: string;
  foregroundColor: string;
};

export function IdenticonSVGForContact({
  backgroundColor,
  text,
  foregroundColor,
}: PropsTypeForContact): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <circle cx="50" cy="50" r="40" fill={backgroundColor} />
      <text
        baselineShift="-8px"
        fill={foregroundColor}
        fontFamily="sans-serif"
        fontSize="24px"
        textAnchor="middle"
        x="50"
        y="50"
      >
        {text}
      </text>
    </svg>
  );
}

export type PropsTypeForGroup = {
  backgroundColor: string;
  foregroundColor: string;
};

export function IdenticonSVGForGroup({
  backgroundColor,
  foregroundColor,
}: PropsTypeForGroup): JSX.Element {
  // Note: the inner SVG below is taken from images/icons/v3/group/group.svg, viewBox
  //   added to match the original SVG, new dimensions to create match Avatar.tsx.
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <circle cx="50" cy="50" r="40" fill={backgroundColor} />
      <svg viewBox="0 0 20 20" height="45" width="60" y="27.5" x="20">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M10.833 5.957c0-1.778 1.195-3.353 2.917-3.353 1.722 0 2.917 1.575 2.917 3.353 0 .902-.294 1.759-.794 2.404-.499.645-1.242 1.118-2.123 1.118-.88 0-1.624-.473-2.123-1.118-.5-.645-.794-1.502-.794-2.404Zm2.917-1.895c-.694 0-1.458.681-1.458 1.895 0 .594.196 1.134.488 1.511.292.378.643.553.97.553.327 0 .678-.175.97-.553.292-.377.488-.917.488-1.511 0-1.214-.764-1.895-1.458-1.895Z"
          fill={foregroundColor}
        />
        <path
          d="M6.25 10.52c.93 0 1.821.202 2.613.564a6.44 6.44 0 0 0-1.03 1.152 4.905 4.905 0 0 0-1.583-.257c-2.23 0-3.934 1.421-4.226 3.125h4.769a6.113 6.113 0 0 0 .05 1.459H1.464a.94.94 0 0 1-.943-.938c0-2.907 2.66-5.104 5.729-5.104Z"
          fill={foregroundColor}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M13.75 10.52c-3.07 0-5.73 2.198-5.73 5.105 0 .545.45.938.944.938h9.572a.94.94 0 0 0 .943-.938c0-2.907-2.66-5.104-5.729-5.104Zm0 1.46c2.23 0 3.934 1.42 4.226 3.124H9.524c.292-1.704 1.997-3.125 4.226-3.125Zm-7.5-9.376c-1.722 0-2.917 1.575-2.917 3.353 0 .902.294 1.759.794 2.404.499.645 1.242 1.118 2.123 1.118.881 0 1.624-.473 2.123-1.118.5-.645.794-1.502.794-2.404 0-1.778-1.195-3.353-2.917-3.353ZM4.792 5.957c0-1.214.764-1.895 1.458-1.895.695 0 1.458.681 1.458 1.895 0 .594-.195 1.134-.488 1.511-.292.378-.643.553-.97.553-.327 0-.678-.175-.97-.553-.292-.377-.488-.917-.488-1.511Z"
          fill={foregroundColor}
        />
      </svg>
    </svg>
  );
}
