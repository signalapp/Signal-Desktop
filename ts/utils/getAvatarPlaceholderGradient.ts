// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const GRADIENTS = [
  ['#252568', '#9C8F8F'],
  ['#2A4275', '#9D9EA1'],
  ['#2E4B5F', '#8AA9B1'],
  ['#2E426C', '#7A9377'],
  ['#1A341A', '#807F6E'],
  ['#464E42', '#D5C38F'],
  ['#595643', '#93A899'],
  ['#2C2F36', '#687466'],
  ['#2B1E18', '#968980'],
  ['#7B7067', '#A5A893'],
  ['#706359', '#BDA194'],
  ['#383331', '#A48788'],
  ['#924F4F', '#897A7A'],
  ['#663434', '#C58D77'],
  ['#8F4B02', '#AA9274'],
  ['#784747', '#8C8F6F'],
  ['#747474', '#ACACAC'],
  ['#49484C', '#A5A6B5'],
  ['#4A4E4D', '#ABAFAE'],
  ['#3A3A3A', '#929887'],
] as const;

export function getAvatarPlaceholderGradient(
  identifierHash: number
): Readonly<[string, string]> {
  const colorIndex = identifierHash % GRADIENTS.length;

  return GRADIENTS[colorIndex];
}
