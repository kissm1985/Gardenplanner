// Spreadsheet formula injection guard: a text cell starting with = + - @ (or a tab / CR) would run
// as a formula when the CSV is opened in Excel. Such cells get a leading apostrophe, which Excel
// shows as plain text; our own CSV import strips it again, so plant lists still round-trip.
const RISKY = /^[=+\-@\t\r]/;
const NUMBER = /^-?\d+([.,]\d+)?$/;

export const safeCell = (s: string) => (RISKY.test(s) && !NUMBER.test(s) ? `'${s}` : s);

export const unsafeCell = (s: string) => (s.startsWith("'") && RISKY.test(s.slice(1)) ? s.slice(1) : s);
