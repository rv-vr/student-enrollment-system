import type { SectionScheduleEntry } from "../db/schema";

export function parseClockTime(value: string) {
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3];

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  if (!meridiem) {
    if (hour < 0 || hour > 23) {
      return null;
    }

    return hour * 60 + minute;
  }

  if (hour < 1 || hour > 12) {
    return null;
  }

  let normalizedHour = hour % 12;

  if (meridiem === "PM") {
    normalizedHour += 12;
  }

  return normalizedHour * 60 + minute;
}

export function parseTimeRange(value: string) {
  const [startValue, endValue] = value.split(/\s*-\s*/);

  if (!startValue || !endValue) {
    return null;
  }

  const start = parseClockTime(startValue);
  const end = parseClockTime(endValue);

  if (start === null || end === null || start >= end) {
    return null;
  }

  return { start, end };
}

export function schedulesOverlap(
  leftSlot: SectionScheduleEntry,
  rightSlot: SectionScheduleEntry,
) {
  if (
    leftSlot.day.trim().toLowerCase() !== rightSlot.day.trim().toLowerCase()
  ) {
    return false;
  }

  const leftRange = parseTimeRange(leftSlot.time);
  const rightRange = parseTimeRange(rightSlot.time);

  if (!leftRange || !rightRange) {
    return false;
  }

  return leftRange.start < rightRange.end && rightRange.start < leftRange.end;
}
