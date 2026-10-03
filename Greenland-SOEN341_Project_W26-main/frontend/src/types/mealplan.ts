export type MealTimeKey = "breakfast" | "lunch" | "dinner" | "snack";

export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type DayMeals = Record<MealTimeKey, string>;
export type MealPlanDays = Record<DayKey, DayMeals>;

export const WEEK_DAYS: string[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const MEAL_SLOTS: { label: string; key: MealTimeKey }[] = [
  { label: "Breakfast", key: "breakfast" },
  { label: "Lunch", key: "lunch" },
  { label: "Dinner", key: "dinner" },
  { label: "Snack", key: "snack" },
];

export const EMPTY_DAY: DayMeals = {
  breakfast: "",
  lunch: "",
  dinner: "",
  snack: "",
};

export const EMPTY_DAYS: MealPlanDays = {
  monday: { breakfast: "", lunch: "", dinner: "", snack: "" },
  tuesday: { breakfast: "", lunch: "", dinner: "", snack: "" },
  wednesday: { breakfast: "", lunch: "", dinner: "", snack: "" },
  thursday: { breakfast: "", lunch: "", dinner: "", snack: "" },
  friday: { breakfast: "", lunch: "", dinner: "", snack: "" },
  saturday: { breakfast: "", lunch: "", dinner: "", snack: "" },
  sunday: { breakfast: "", lunch: "", dinner: "", snack: "" },
};

export function getWeekIdForDate(date: Date): string {
  const oneJan = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor(
    (date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000)
  );
  const week = Math.ceil((dayOfYear + oneJan.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function getDayKeyFromDate(date: Date): DayKey {
  const days: DayKey[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[date.getDay()];
}

export function mondayOfWeekContaining(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}
