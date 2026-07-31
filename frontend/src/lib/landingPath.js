// Where each role lands after signing in.
//
// Elders — and BOTH, who are elders too — land on the daily check-in: it is the
// one thing Towinly asks of them each day, and it is what tells their family
// they are alright. Nobody else has a check-in, so nobody else goes there.
//
// Four call sites import this: the login form, the demo buttons, the Google
// callback, and the redirect off a public page while already signed in.
export function landingPathForRole(role) {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'FAMILY':
      return '/family-home';
    case 'ELDER':
    case 'BOTH':
      return '/streaks';
    default:
      return '/dashboard';
  }
}
