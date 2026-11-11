// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

import { setTimeout as sleep } from 'node:timers/promises';

/** @typedef {import('@octokit/openapi-types').components['schemas']} GitHubSchemas */
/** @typedef {GitHubSchemas['pull-request-simple']} GitHubPullRequest */
/** @typedef {GitHubSchemas['issue']} GitHubIssue */
/** @typedef {GitHubSchemas['issue-comment']} GitHubIssueComment */
/** @typedef {GitHubSchemas['global-advisory']} GitHubAdvisory */

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** Before each retry */
const RETRY_DELAYS = [1 * SECOND, 5 * SECOND, 10 * SECOND, 30 * SECOND];
/** Across all attempts and retries of one request */
const MAX_RETRY_TIME = MINUTE;

const RETRIABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

class FetchError extends Error {
  /** @readonly @type {Request} */
  #request;
  /** @readonly @type {Response | null} */
  #response;

  /**
   * @param {Request} request
   * @param {Response | null} response `null` when there was no response
   * @param {string} details the response body, or why there was no response
   */
  constructor(request, response, details) {
    const { method, url } = request;
    const status =
      response != null ? `${response.status} ${response.statusText}` : 'failed';
    super(`${method} ${url} -> ${status}: ${details}`);
    this.#request = request;
    this.#response = response;
  }

  isRetryable() {
    // POSTs might have gone through
    if (this.#request.method === 'POST') {
      return false;
    }
    return (
      this.#response == null || RETRIABLE_STATUS_CODES.has(this.#response.status)
    );
  }

  /** @returns {number | null} */
  getRetryAfter() {
    if (this.#response == null) {
      return null;
    }

    const retryAfter = this.#response.headers.get('Retry-After');
    if (retryAfter != null) {
      return Number(retryAfter) * SECOND;
    }

    const remaining = this.#response.headers.get('x-ratelimit-remaining');
    if (remaining == null || Number(remaining) > 0) {
      return null;
    }

    const reset = this.#response.headers.get('x-ratelimit-reset');
    if (reset != null) {
      const timestamp = Number(reset) * SECOND;
      return Math.max(0, timestamp - Date.now());
    }

    return null;
  }
}

/**
 * @template T
 * @param {() => Promise<T>} doFetch
 * @returns {Promise<T>}
 */
async function retryFetch(doFetch) {
  const deadline = Date.now() + MAX_RETRY_TIME;

  /**
   * @param {number} retryCount
   * @returns {Promise<T>}
   */
  async function next(retryCount) {
    try {
      return await doFetch();
    } catch (error) {
      if (!(error instanceof FetchError) || !error.isRetryable()) {
        throw error;
      }
      const defaultRetryDelay = RETRY_DELAYS[retryCount];
      if (defaultRetryDelay == null) {
        throw error;
      }
      const retryDelay = error.getRetryAfter() ?? defaultRetryDelay;
      const retryAt = Date.now() + retryDelay;
      if (retryAt > deadline) {
        throw error;
      }
      console.warn(
        `${error.message}, retrying in ${Math.ceil(retryDelay / SECOND)}s`
      );
      await sleep(retryDelay);
      return next(retryCount + 1);
    }
  }
  return next(0);
}

/**
 * @typedef {object} FetchParams
 * @prop {'GET' | 'POST' | 'PATCH' | 'DELETE'} method
 * @prop {string} path e.g. `/repos/signalapp/Signal-Desktop/pulls?state=open`
 * @prop {unknown} [json]
*/

/**
 * @param {FetchParams} params
 * @returns {Promise<unknown>}
 */
async function fetchGitHubApi(params) {
  const { method, path } = params;
  const url = new URL(path, 'https://api.github.com');

  const headers = new Headers({
    Accept: 'application/vnd.github+json',
    'User-Agent': 'signal-desktop-audit-deps',
  });
  const token = process.env.GITHUB_TOKEN ?? null;
  if (token != null) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  /** @type {BodyInit | null} */
  let body;
  if (params.json != null) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(params.json);
  } else {
    body = null;
  }

  return retryFetch(async () => {
    const signal = AbortSignal.timeout(10 * SECOND);
    /** @type {RequestInit} */
    const init = { method, headers, signal };
    init.body = body;
    const request = new Request(url, init);
    /** @type {Response} */
    let response;
    try {
      response = await fetch(request);
    } catch (error) {
      throw new FetchError(request, null, `${error}`);
    }
    if (!response.ok) {
      throw new FetchError(request, response, await response.text());
    }
    return response.json();
  });
}

/**
 * @param {string} ghsaId
 * @returns {Promise<GitHubAdvisory>}
 */
export async function getGitHubAdvisory(ghsaId) {
  const result = await fetchGitHubApi({
    method: 'GET',
    path: `/advisories/${encodeURIComponent(ghsaId)}`
  });
  return /** @type {GitHubAdvisory} */ (result);
}

/**
 * @param {string} repo `owner/repo`
 * @param {string} head `owner:branch`
 * @returns {Promise<ReadonlyArray<GitHubPullRequest>>}
 */
export async function getGitHubOpenPullRequests(repo, head) {
  const query = new URLSearchParams({ state: 'open', head });
  const result = await fetchGitHubApi({
    method: 'GET',
    path: `/repos/${repo}/pulls?${query}`
  });
  return /** @type {ReadonlyArray<GitHubPullRequest>} */ (result);
}

/**
 * @param {string} repo `owner/repo`
 * @param {Readonly<{ title: string; head: string; base: string; body: string }>} pullRequest
 * @returns {Promise<GitHubPullRequest>}
 */
export async function createGitHubPullRequest(repo, pullRequest) {
  const result = await fetchGitHubApi({
    method: 'POST',
    path: `/repos/${repo}/pulls`,
    json: pullRequest
  });
  return /** @type {GitHubPullRequest} */ (result);
}

/**
 * Pull requests are issues, so this labels them too.
 *
 * @param {string} repo `owner/repo`
 * @param {number} number
 * @param {ReadonlyArray<string>} labels
 * @returns {Promise<void>}
 */
export async function addGitHubIssueLabels(repo, number, labels) {
  await fetchGitHubApi({
    method: 'POST',
    path: `/repos/${repo}/issues/${number}/labels`,
    json: { labels }
  });
}

/**
 * @param {string} repo `owner/repo`
 * @param {number} number
 * @param {Readonly<{ title?: string; body?: string; state?: 'open' | 'closed' }>} changes
 * @returns {Promise<void>}
 */
export async function updateGitHubPullRequest(repo, number, changes) {
  await fetchGitHubApi({
    method: 'PATCH',
    path: `/repos/${repo}/pulls/${number}`,
    json: changes
  });
}

/**
 * @param {string} repo `owner/repo`
 * @param {number} number
 * @returns {Promise<GitHubIssue>}
 */
export async function getGitHubIssue(repo, number) {
  const result = await fetchGitHubApi({
    method: 'GET',
    path: `/repos/${repo}/issues/${number}`,
  });
  return /** @type {GitHubIssue} */ (result);
}

/**
 * @param {string} repo `owner/repo`
 * @param {number} number
 * @param {number} page 100 comments per page, oldest first
 * @returns {Promise<ReadonlyArray<GitHubIssueComment>>}
 */
export async function getGitHubIssueComments(repo, number, page) {
  const query = new URLSearchParams({ per_page: '100', page: `${page}` });
  const result = await fetchGitHubApi({
    method: 'GET',
    path: `/repos/${repo}/issues/${number}/comments?${query}`
  });
  return /** @type {ReadonlyArray<GitHubIssueComment>} */ (result);
}

/**
 * @param {string} repo `owner/repo`
 * @param {number} number
 * @param {string} body
 * @returns {Promise<void>}
 */
export async function createGitHubIssueComment(repo, number, body) {
  await fetchGitHubApi({
    method: 'POST',
    path: `/repos/${repo}/issues/${number}/comments`,
    json: { body },
  });
}

/**
 * @param {string} repo `owner/repo`
 * @param {GitHubIssueComment['id']} commentId
 * @param {string} body
 * @returns {Promise<void>}
 */
export async function updateGitHubIssueComment(repo, commentId, body) {
  await fetchGitHubApi({
    method: 'PATCH',
    path: `/repos/${repo}/issues/comments/${commentId}`,
    json: { body }
  });
}

/**
 * Includes pull requests with the label, they have `pull_request` set.
 *
 * @param {string} repo `owner/repo`
 * @param {string} label
 * @returns {Promise<ReadonlyArray<GitHubIssue>>}
 */
export async function getGitHubOpenIssues(repo, label) {
  const query = new URLSearchParams({ state: 'open', labels: label });
  const result = await fetchGitHubApi({
    method: 'GET',
    path: `/repos/${repo}/issues?${query}`,
  });
  return /** @type {ReadonlyArray<GitHubIssue>} */ (result);
}

/**
 * @param {string} repo `owner/repo`
 * @param {Readonly<{ title: string; body: string; labels: ReadonlyArray<string> }>} issue
 * @returns {Promise<void>}
 */
export async function createGitHubIssue(repo, issue) {
  await fetchGitHubApi({
    method: 'POST',
    path: `/repos/${repo}/issues`,
    json: issue,
  });
}

/**
 * @param {string} repo `owner/repo`
 * @param {number} number
 * @param {Readonly<{ title?: string; body?: string; state?: 'open' | 'closed' }>} changes
 * @returns {Promise<void>}
 */
export async function updateGitHubIssue(repo, number, changes) {
  await fetchGitHubApi({
    method: 'PATCH',
    path: `/repos/${repo}/issues/${number}`,
    json: changes,
  });
}
