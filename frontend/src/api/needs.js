// Help requests as named functions (Rule 6). Same name and body as the phone
// app's src/api/needs.js, so the two clients agree with the server.
import api from './axios';

/**
 * Post a help request for the signed-in elder. It is open to helpers nearby at once.
 * @param {{title: string, description?: string|null, category: 'COMPANIONSHIP'|'TRANSPORTATION'|'ERRANDS'|'CLEANING'|'OTHER', urgency?: 'NORMAL'|'URGENT'}} request
 * @returns {Promise<object>} the request as the server stored it
 */
export async function postHelpRequest({ title, description = null, category, urgency = 'NORMAL' } = {}) {
  if (!title || !String(title).trim()) throw new Error('postHelpRequest needs a title');
  if (!category) throw new Error('postHelpRequest needs a category');
  const res = await api.post('/needs', { title, description, category, urgency });
  return res?.data;
}
