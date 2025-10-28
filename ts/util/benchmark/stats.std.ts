// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type StatsType = {
  mean: number;
  stddev: number;
  [key: string]: number;
};

export function stats(
  list: ReadonlyArray<number>,
  percentiles: ReadonlyArray<number> = []
): StatsType {
  if (list.length === 0) {
    throw new Error('Empty list given to stats');
  }

  let mean = 0;
  let stddev = 0;

  for (const value of list) {
    mean += value;
    stddev += value ** 2;
  }
  mean /= list.length;
  stddev /= list.length;

  stddev -= mean ** 2;
  stddev = Math.sqrt(stddev);

  const sorted = list.slice().sort((a, b) => a - b);

  const result: StatsType = { mean, stddev };

  for (const p of percentiles) {
    result[`p${p}`] = sorted[Math.floor((sorted.length * p) / 100)];
  }

  return result;
}

// t-distribution value for various sample count and p=0.001
// https://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm
const STUDENT_T = [
  318.309, 22.327, 10.215, 7.173, 5.893, 5.208, 4.785, 4.501, 4.297, 4.144,
  4.025, 3.93, 3.852, 3.787, 3.733, 3.686, 3.646, 3.61, 3.579, 3.552, 3.527,
  3.505, 3.485, 3.467, 3.45, 3.435, 3.421, 3.408, 3.396, 3.385, 3.375, 3.365,
  3.356, 3.348, 3.34, 3.333, 3.326, 3.319, 3.313, 3.307, 3.301, 3.296, 3.291,
  3.286, 3.281, 3.277, 3.273, 3.269, 3.265, 3.261, 3.258, 3.255, 3.251, 3.248,
  3.245, 3.242, 3.239, 3.237, 3.234, 3.232, 3.229, 3.227, 3.225, 3.223, 3.22,
  3.218, 3.216, 3.214, 3.213, 3.211, 3.209, 3.207, 3.206, 3.204, 3.202, 3.201,
  3.199, 3.198, 3.197, 3.195, 3.194, 3.193, 3.191, 3.19, 3.189, 3.188, 3.187,
  3.185, 3.184, 3.183, 3.182, 3.181, 3.18, 3.179, 3.178, 3.177, 3.176, 3.175,
  3.175, 3.174,

  // Infinity
  3.09,
];

export type Sample = Readonly<{
  y: number;
  x: number;
}>;

export type Regression = Readonly<{
  yIntercept: number;
  slope: number;
  confidence: number;
  outliers: number;
  severeOutliers: number;
}>;

export function regress(samples: ReadonlyArray<Sample>): Regression {
  // Bin the data by iteration count
  const bins = new Map<number, Array<number>>();
  for (const { x, y } of samples) {
    let bin = bins.get(x);
    if (bin === undefined) {
      bin = [];
      bins.set(x, bin);
    }
    bin.push(y);
  }

  let outliers = 0;
  let severeOutliers = 0;

  // Within each iteration bin identify the outliers for reporting purposes.
  for (const [, ys] of bins) {
    ys.sort();

    const p25 = ys[Math.floor(ys.length * 0.25)] ?? -Infinity;
    const p75 = ys[Math.ceil(ys.length * 0.75)] ?? +Infinity;
    const iqr = p75 - p25;

    const outlierLow = p25 - iqr * 1.5;
    const outlierHigh = p75 + iqr * 1.5;
    const badOutlierLow = p25 - iqr * 3;
    const badOutlierHigh = p75 + iqr * 3;

    // Tukey's method
    for (const d of ys) {
      if (d < badOutlierLow || d > badOutlierHigh) {
        severeOutliers += 1;
      } else if (d < outlierLow || d > outlierHigh) {
        outliers += 1;
      }
    }
  }

  if (samples.length < 2) {
    throw new Error('Low sample count');
  }

  let meanY = 0;
  let meanX = 0;
  for (const { y, x } of samples) {
    meanY += y;
    meanX += x;
  }
  meanY /= samples.length;
  meanX /= samples.length;

  let slopeNum = 0;
  let slopeDenom = 0;
  for (const { y, x } of samples) {
    slopeNum += (y - meanY) * (x - meanX);
    slopeDenom += (x - meanX) ** 2;
  }

  // Slope
  const slope = slopeNum / slopeDenom;

  // Y-Intercept
  const yIntercept = meanY - slope * meanX;

  let stdError = 0;
  for (const { y, x } of samples) {
    stdError += (y - yIntercept - slope * x) ** 2;
  }
  stdError /= samples.length - 2;
  stdError /= slopeDenom;
  stdError = Math.sqrt(stdError);

  return {
    yIntercept,
    slope,
    confidence:
      STUDENT_T[Math.min(samples.length, STUDENT_T.length - 1)] * stdError,
    outliers,
    severeOutliers,
  };
}
