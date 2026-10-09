export function birthDateError(day, month, year, today = new Date()) {
  if (![day, month, year].every(Number.isInteger)
      || year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return "Enter a valid date of birth.";
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    return "Enter a valid date of birth.";
  }
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();
  if (year > currentYear || (year === currentYear && (month > currentMonth || (month === currentMonth && day > currentDay)))) {
    return "Date of birth cannot be in the future.";
  }
  const birthdayPassed = currentMonth > month || (currentMonth === month && currentDay >= day);
  if (currentYear - year - Number(!birthdayPassed) < 18) {
    return "You must be 18 years or older.";
  }
  return "";
}
