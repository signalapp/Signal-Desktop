// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

/**
 * @typedef {{
 *   files: Array<string>;
 *   duration: number;
 * }} Bin
 */

/**
 * @param {ReadonlyArray<number>} values
 */
function getMedian(values) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * @param {Bin} a
 * @param {Bin} b
 * @returns {number}
 */
function compareBins(a, b) {
  if (a.duration !== b.duration) {
    return a.duration - b.duration;
  }
  return a.files.length - b.files.length; // fallback to fewest files
}

/**
 * @param {ReadonlyArray<Bin>} bins
 */
function getLightestBin(bins) {
  /** @type {Bin | null} */
  let lightest = null;
  for (const bin of bins) {
    // Keeps the earlier bin on ties
    if (lightest == null || compareBins(bin, lightest) < 0) {
      lightest = bin;
    }
  }
  if (lightest == null) {
    throw new Error('packFilesByDuration: Expected at least one bin');
  }
  return lightest;
}

/**
 * Puts the longest files first, each into the bin with the least total duration.
 * Files without a saved duration will default to the suite's median duration.
 *
 * @param {ReadonlyArray<string>} files
 * @param {Readonly<Record<string, number>>} durations
 * @param {number} binCount
 * @returns {ReadonlyArray<Bin>}
 */
export function packFilesByDuration(files, durations, binCount) {
  /** @type {Array<number>} */
  const knownDurations = [];
  for (const file of files) {
    const duration = durations[file];
    if (duration != null) {
      knownDurations.push(duration);
    }
  }
  const medianDuration = getMedian(knownDurations);

  /** @param {string} file */
  function getDuration(file) {
    return durations[file] ?? medianDuration;
  }

  // Ties by path, so every worker computes the same bins
  const sortedFiles = files.toSorted((a, b) => {
    const difference = getDuration(b) - getDuration(a);
    if (difference !== 0) {
      return difference;
    }
    return a < b ? -1 : 1;
  });

  /** @type {Array<Bin>} */
  const bins = Array.from({ length: binCount }, () => {
    return { files: [], duration: 0 };
  });

  for (const file of sortedFiles) {
    const lightest = getLightestBin(bins);
    lightest.files.push(file);
    lightest.duration += getDuration(file);
  }

  return bins;
}
