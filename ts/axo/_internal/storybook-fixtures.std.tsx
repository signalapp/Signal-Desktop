// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

type BadgeFixture = Readonly<{
  id: string;
  category: 'donor' | 'other';
  name: string;
  description: string;
  svg: { size: 160; src: string };
  svgs: {
    16: { size: 16; light: string; dark: string };
    24: { size: 24; light: string; dark: string };
    36: { size: 36; light: string; dark: string };
  };
}>;

// prettier-ignore
export const BADGES_FIXTURE = {
  planet: {
    id: 'R_MED',
    category: 'donor',
    name: 'Signal Planet',
    description: '{short_name} supports Signal with a monthly donation. Signal is a nonprofit with no advertisers or investors, supported only by people like you.',
    svg: { size: 160, src: 'fixtures/badges/planet/planet-160.svg' },
    svgs: {
      16: { size: 16, light: 'fixtures/badges/planet/planet-16-light.svg', dark: 'fixtures/badges/planet/planet-16-dark.svg' },
      24: { size: 24, light: 'fixtures/badges/planet/planet-24-light.svg', dark: 'fixtures/badges/planet/planet-24-dark.svg' },
      36: { size: 36, light: 'fixtures/badges/planet/planet-36-light.svg', dark: 'fixtures/badges/planet/planet-36-dark.svg' },
    },
  },
  rocket: {
    id: 'BOOST',
    category: 'donor',
    name: 'Signal Boost',
    description: '{short_name} supported Signal with a donation. Signal is a nonprofit with no advertisers or investors, supported only by people like you.',
    svg: { size: 160, src: 'fixtures/badges/rocket/rocket-160.svg' },
    svgs: {
      16: { size: 16, light: 'fixtures/badges/rocket/rocket-16-light.svg', dark: 'fixtures/badges/rocket/rocket-16-dark.svg' },
      24: { size: 24, light: 'fixtures/badges/rocket/rocket-24-light.svg', dark: 'fixtures/badges/rocket/rocket-24-dark.svg' },
      36: { size: 36, light: 'fixtures/badges/rocket/rocket-36-light.svg', dark: 'fixtures/badges/rocket/rocket-36-dark.svg' },
    },
  },
  star: {
    id: 'R_LOW',
    category: 'donor',
    name: 'Signal Star',
    description: '{short_name} supports Signal with a monthly donation. Signal is a nonprofit with no advertisers or investors, supported only by people like you.',
    svg: { size: 160, src: 'fixtures/badges/star/star-160.svg' },
    svgs: {
      16: { size: 16, light: 'fixtures/badges/star/star-16-light.svg', dark: 'fixtures/badges/star/star-16-dark.svg' },
      24: { size: 24, light: 'fixtures/badges/star/star-24-light.svg', dark: 'fixtures/badges/star/star-24-dark.svg' },
      36: { size: 36, light: 'fixtures/badges/star/star-36-light.svg', dark: 'fixtures/badges/star/star-36-dark.svg' },
    },
  },
  sun: {
    id: 'R_HIGH',
    category: 'donor',
    name: 'Signal Sun',
    description: '{short_name} supports Signal with a monthly donation. Signal is a nonprofit with no advertisers or investors, supported only by people like you.',
    svg: { size: 160, src: 'fixtures/badges/sun/sun-160.svg' },
    svgs: {
      16: { size: 16, light: 'fixtures/badges/sun/sun-16-light.svg', dark: 'fixtures/badges/sun/sun-16-dark.svg' },
      24: { size: 24, light: 'fixtures/badges/sun/sun-24-light.svg', dark: 'fixtures/badges/sun/sun-24-dark.svg' },
      36: { size: 36, light: 'fixtures/badges/sun/sun-36-light.svg', dark: 'fixtures/badges/sun/sun-36-dark.svg' },
    },
  },
  ufo: {
    id: 'GIFT',
    category: 'donor',
    name: 'Signal UFO',
    description: 'A friend made a donation to Signal on behalf of {short_name}. Signal is a nonprofit with no advertisers or investors, supported only by people like you.',
    svg: { size: 160, src: 'fixtures/badges/ufo/ufo-160.svg' },
    svgs: {
      16: { size: 16, light: 'fixtures/badges/ufo/ufo-16-light.svg', dark: 'fixtures/badges/ufo/ufo-16-dark.svg' },
      24: { size: 24, light: 'fixtures/badges/ufo/ufo-24-light.svg', dark: 'fixtures/badges/ufo/ufo-24-dark.svg' },
      36: { size: 36, light: 'fixtures/badges/ufo/ufo-36-light.svg', dark: 'fixtures/badges/ufo/ufo-36-dark.svg' },
    },
  },
} as const satisfies Record<string, BadgeFixture>;
