// Small copy helpers shared across pages.

// "1 helper wants to help" / "3 helpers want to help"
export function applicantsLabel(count) {
  const one = count === 1;
  return `${count} helper${one ? '' : 's'} want${one ? 's' : ''} to help`;
}

// The family who will see today's check-in, written the way a person would say
// it out loud. Long lists collapse so the line never wraps on a phone.
// "Sarah" / "Sarah and David" / "Sarah, David and one other" / "… and 2 others"
export function familyNamesLabel(names) {
  if (!names || names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const rest = names.length - 2;
  return `${names[0]}, ${names[1]} and ${rest === 1 ? 'one other' : `${rest} others`}`;
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
