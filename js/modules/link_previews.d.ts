// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isLinkSafeToPreview(link: string): boolean;

export function findLinks(text: string, caretLocation?: number): Array<string>;

export function getDomain(href: string): string;

export function isLinkSneaky(link: string): boolean;

export function isStickerPack(href: string): boolean;
