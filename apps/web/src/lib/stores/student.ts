import { browser } from "$app/environment";
import { writable } from "svelte/store";
import type { Student } from "$lib/api/types";

export const students: Student[] = [
  { id: 1, name: "Ava Patel" },
  { id: 2, name: "Noah Kim" },
  { id: 3, name: "Mia Garcia" },
];

const storageKey = "course-enrollment.active-student-id";
const defaultStudentId = students[0].id;

function getInitialStudentId() {
  if (!browser) {
    return defaultStudentId;
  }

  const storedValue = Number(localStorage.getItem(storageKey));

  if (
    Number.isInteger(storedValue) &&
    students.some((student) => student.id === storedValue)
  ) {
    return storedValue;
  }

  return defaultStudentId;
}

export const activeStudentId = writable(getInitialStudentId());

if (browser) {
  activeStudentId.subscribe((value) => {
    localStorage.setItem(storageKey, String(value));
  });
}

export function getStudentById(studentId: number) {
  return students.find((student) => student.id === studentId) ?? students[0];
}

export function getStudentName(studentId: number) {
  return getStudentById(studentId).name;
}
