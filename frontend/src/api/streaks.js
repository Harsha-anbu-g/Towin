// The daily check-in as a named function (Rule 6). Same as the phone app's
// src/api/streaks.js.
import api from './axios';

/**
 * Mark the signed-in elder as here today. A second call on the same day is not an
 * error: the server answers with alreadyCheckedIn=true.
 * @returns {Promise<{currentStreak: number, alreadyCheckedIn: boolean}>} today's streak
 */
export async function checkInToday() {
  const res = await api.post('/streaks/checkin');
  return res?.data;
}
