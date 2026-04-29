// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type JSX } from 'react';
import { tw } from '../../axo/tw.dom.tsx';

export function SignalConversationBackground(): JSX.Element {
  return (
    <div
      className={tw(
        // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
        'absolute inset-0 bg-[#F0F1F6] dark:bg-[#343A4A]'
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        fill="none"
        // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
        className={tw('size-full stroke-[#E3E4EA] dark:stroke-[#262C3D]')}
      >
        <defs>
          <g
            id="wave-crest"
            fill="transparent"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M0 61C51 61 51 41 100 41C150 41 150 61 200 61" />
            <path d="M75 47.0673C81.6262 48.2611 89.3895 49 99 49C109.098 49 117.157 48.1842 124 46.8821" />
            <path d="M0 53C51 53 51 33 100 33C150 33 150 53 200 53" />
            <path d="M63 52.141C72.0533 54.9394 82.9509 57 99 57C115.644 57 126.748 54.7837 136 51.8267" />
            <path d="M0 45C51 45 51 25 100 25C150 25 150 45 200 45" />
            <path d="M199 45C199.336 45 199.669 45.0009 200 45.0027M53 56.588C64.2979 61.0062 76.6567 65 99 65C122.336 65 134.78 60.6435 146.5 55.997" />
            <path d="M0 37C51 37 51 17 100 17C150 17 150 37 200 37" />
            <path d="M41 59.8929C56.7966 65.6766 68.7441 73 99 73C129.945 73 141.738 65.3391 158.086 59.5" />
            <path d="M0 29C51 29 51 9 100 9C150 9 150 29 200 29" />
            <path d="M199 61C199.336 61 199.669 61.0009 200 61.0027M28 63.9626C51.9454 69.5302 61.1355 81 99 81C137.947 81 146.557 68.8652 172.091 63.5" />
            <path d="M0 21C51 21 51 1 100 1C150 1 150 21 200 21" />
          </g>
        </defs>

        <pattern
          id="wave-tile"
          width="200"
          height="135"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <use href="#wave-crest" x="0" y="0" />
          <use href="#wave-crest" x="100" y="67.5" />
          <use href="#wave-crest" x="100" y="-67.5" />
          <use href="#wave-crest" x="-100" y="67.5" />
          <use href="#wave-crest" x="-100" y="-67.5" />
        </pattern>

        <rect width="100%" height="100%" x="0" y="0" fill="url(#wave-tile)" />
      </svg>
    </div>
  );
}
