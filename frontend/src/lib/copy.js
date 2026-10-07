// Small copy helpers shared across pages.
import { tr } from '../i18n';

// "1 helper wants to help" / "3 helpers want to help"
export function applicantsLabel(count) {
  return count === 1 ? tr('1 helper wants to help') : tr('{count} helpers want to help', { count });
}

// The family who will see today's check-in, written the way a person would say
// it out loud. Long lists collapse so the line never wraps on a phone.
// "Sarah" / "Sarah and David" / "Sarah, David and one other" / "… and 2 others"
export function familyNamesLabel(names) {
  if (!names || names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return tr('{first} and {second}', { first: names[0], second: names[1] });
  const rest = names.length - 2;
  return rest === 1
    ? tr('{first}, {second} and one other', { first: names[0], second: names[1] })
    : tr('{first}, {second} and {rest} others', { first: names[0], second: names[1], rest });
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
