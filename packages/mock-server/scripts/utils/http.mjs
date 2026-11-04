// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/** @param {string} url */
async function baseFetch(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  }
  return response;
}

/** @param {string} url */
export async function fetchJson(url) {
  const response = await baseFetch(url);
  return response.json();
}

/** @param {string} url */
export async function fetchText(url) {
  const response = await baseFetch(url);
  return response.text();
}
