// Reunions as named functions (Rule 6, the first such catalog on the website):
// one exported function per action, plain inputs, plain outputs, no UI
// knowledge. Same names and bodies as the phone app's src/api/reunions.js, so
// the two clients can never disagree with the server about a body shape.
import api from './axios';

const needId = (value, name, fn) => {
  if (!value) throw new Error(`${fn} needs a ${name}`);
};

/** Every reunion the signed-in person is part of, as the elder or the organiser, newest first. */
export async function listMyReunions() {
  const res = await api.get('/reunions/mine');
  return res?.data;
}

/** One reunion with its guests and counts. Only the elder and the organiser may read it. */
export async function getReunion(reunionId) {
  needId(reunionId, 'reunionId', 'getReunion');
  const res = await api.get(`/reunions/${reunionId}`);
  return res?.data;
}

/** Step 1, the wish: who the elder wants to see again. Opens on "Who plans". */
export async function postReunionWish({ institution, years, city, note } = {}) {
  if (!institution || !String(institution).trim()) throw new Error('postReunionWish needs an institution');
  const res = await api.post('/reunions', { institution, years, city, note });
  return res?.data;
}

/** Step 2, the people allowed to plan: helpers at full trust and family with an active link. */
export async function listReunionOrganisers(reunionId) {
  needId(reunionId, 'reunionId', 'listReunionOrganisers');
  const res = await api.get(`/reunions/${reunionId}/organisers`);
  return res?.data;
}

/** Step 2, the elder chooses the organiser. Moves to "Finding"; the organiser is told. */
export async function chooseReunionOrganiser({ reunionId, organiserId } = {}) {
  needId(reunionId, 'reunionId', 'chooseReunionOrganiser');
  needId(organiserId, 'organiserId', 'chooseReunionOrganiser');
  const res = await api.post(`/reunions/${reunionId}/organiser`, { organiserId });
  return res?.data;
}

/** Step 3, add a guest: a name, maybe a phone and a note. Never money. Starts as Remembered. */
export async function addReunionGuest({ reunionId, name, phone, note } = {}) {
  needId(reunionId, 'reunionId', 'addReunionGuest');
  if (!name || !String(name).trim()) throw new Error('addReunionGuest needs a name');
  const res = await api.post(`/reunions/${reunionId}/guests`, { name, phone, note });
  return res?.data;
}

/** Step 3, where the organiser is with one guest: REMEMBERED, FOUND, REACHED, COMING, CANNOT_COME. */
export async function setReunionGuestState({ reunionId, guestId, state } = {}) {
  needId(reunionId, 'reunionId', 'setReunionGuestState');
  needId(guestId, 'guestId', 'setReunionGuestState');
  needId(state, 'state', 'setReunionGuestState');
  const res = await api.patch(`/reunions/${reunionId}/guests/${guestId}/state`, { state });
  return res?.data;
}

/** Step 3, take a guest off the list. */
export async function removeReunionGuest({ reunionId, guestId } = {}) {
  needId(reunionId, 'reunionId', 'removeReunionGuest');
  needId(guestId, 'guestId', 'removeReunionGuest');
  const res = await api.delete(`/reunions/${reunionId}/guests/${guestId}`);
  return res?.data;
}

/** Step 4, the plan in words the elder reads. Any field that asks for money is refused. */
export async function setReunionPlan({ reunionId, plannedOn, venue, rides, food, budget } = {}) {
  needId(reunionId, 'reunionId', 'setReunionPlan');
  const res = await api.put(`/reunions/${reunionId}/plan`, { plannedOn, venue, rides, food, budget });
  return res?.data;
}

/** One step forward. Finding and the plan are the elder's taps; the day ends by either side. */
export async function advanceReunion(reunionId) {
  needId(reunionId, 'reunionId', 'advanceReunion');
  const res = await api.post(`/reunions/${reunionId}/advance`);
  return res?.data;
}

/** Step 5, the day: check a guest in as they arrive. */
export async function checkInReunionGuest({ reunionId, guestId } = {}) {
  needId(reunionId, 'reunionId', 'checkInReunionGuest');
  needId(guestId, 'guestId', 'checkInReunionGuest');
  const res = await api.post(`/reunions/${reunionId}/guests/${guestId}/arrived`);
  return res?.data;
}

/** Step 6, the send-off: confirm a guest who came is home. */
export async function confirmReunionGuestHome({ reunionId, guestId } = {}) {
  needId(reunionId, 'reunionId', 'confirmReunionGuestHome');
  needId(guestId, 'guestId', 'confirmReunionGuestHome');
  const res = await api.post(`/reunions/${reunionId}/guests/${guestId}/home`);
  return res?.data;
}

/** Step 6, close once every guest who came is home, with the thank-you. */
export async function closeReunion({ reunionId, thankYou } = {}) {
  needId(reunionId, 'reunionId', 'closeReunion');
  const res = await api.post(`/reunions/${reunionId}/close`, { thankYou });
  return res?.data;
}

/** The elder stops the reunion at any step before it is done. */
export async function stopReunion(reunionId) {
  needId(reunionId, 'reunionId', 'stopReunion');
  const res = await api.post(`/reunions/${reunionId}/stop`);
  return res?.data;
}

/** The organiser steps down before the day; the reunion returns to "Who plans". */
export async function stepDownFromReunion(reunionId) {
  needId(reunionId, 'reunionId', 'stepDownFromReunion');
  const res = await api.post(`/reunions/${reunionId}/step-down`);
  return res?.data;
}

/** The sentence to show when a write is refused: the server's own 400 line, or the fallback. */
export function reunionErrorLine(error, fallback) {
  const message = error?.response?.data?.message;
  if (error?.response?.status === 400 && typeof message === 'string' && message.trim()) return message;
  return fallback;
}
