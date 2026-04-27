// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

/**
 * @type {typeof import("danger").danger}
 * @public
 */
// @ts-expect-error
export const danger = globalThis.danger;

/**
 * @type {typeof import("danger").warn}
 * @public
 */
// @ts-expect-error
export const warn = globalThis.warn;

/**
 * @type {typeof import("danger").fail}
 * @public
 */
// @ts-expect-error
export const fail = globalThis.fail;

/**
 * @type {typeof import("danger").message}
 * @public
 */
// @ts-expect-error
export const message = globalThis.message;

/**
 * @type {typeof import("danger").markdown}
 * @public
 */
// @ts-expect-error
export const markdown = globalThis.markdown;
