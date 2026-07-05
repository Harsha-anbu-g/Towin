// Small copy helpers shared across pages.

// "1 helper wants to help" / "3 helpers want to help"
export function applicantsLabel(count) {
  const one = count === 1;
  return `${count} helper${one ? '' : 's'} want${one ? 's' : ''} to help`;
}

// Full years between a YYYY-MM-DD birthdate and now (birthday counts).
// The date string is split by hand so no timezone shift can move the day.
export function yearsOld(dob, now = new Date()) {
  const [birthYear, birthMonth, birthDay] = dob.split('-').map(Number);
  let years = now.getFullYear() - birthYear;
  const beforeBirthday =
    now.getMonth() + 1 < birthMonth ||
    (now.getMonth() + 1 === birthMonth && now.getDate() < birthDay);
  if (beforeBirthday) years -= 1;
  return years;
}
