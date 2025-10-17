// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const HOURS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const NEXT_HOUR_DEG = 30;

export function getAnalogTime(): { hour: number; minute: number } {
  const date = new Date();
  const minutesBy60 = 60 / date.getMinutes();
  const minute = 360 / minutesBy60;
  const hourIndex = date.getHours() % 12;
  const currentHour = HOURS[hourIndex] ?? 0;
  const hour = currentHour + NEXT_HOUR_DEG / minutesBy60;

  return { hour, minute };
}
