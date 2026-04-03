// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

/**
 * @typedef {Readonly<{
 *   userIdentifier: string;
 *   userSecret: string;
 * }>} AuthenticateOptionsType
 */

export const API_BASE = new URL('https://api.smartling.com/');
export const PROJECT_ID = 'ef62d1ebb';

/**
 * @param {AuthenticateOptionsType} options
 * @returns {Promise<Headers>}
 */
export async function authenticate({ userIdentifier, userSecret }) {
  const res = await fetch(new URL('./auth-api/v2/authenticate', API_BASE), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      userIdentifier,
      userSecret,
    }),
  });
  if (!res.ok) {
    throw new Error('Failed to authenticate with Smartling');
  }

  const {
    response: { data: auth },
  } = await res.json();

  return new Headers({
    authorization: `${auth.tokenType} ${auth.accessToken}`,
  });
}
