// Ask AI as a named function (Rule 6): the chat panel calls this and nothing
// else, so an agent can ask the helper the same way a person types to it.
import api from './axios';

/**
 * Ask the Towinly helper one question, with the recent turns of this chat for context.
 * @param {{message: string, history?: {role: string, content: string}[]}} input the question
 *   and up to the last ten turns before it (the server refuses more than twelve)
 * @returns {Promise<{reply: string, action: {name: string, arguments?: object} | null}>} the
 *   answer, and the one action the helper proposed. The page must ask the person before
 *   acting on it (src/lib/assistantActions); the helper itself never writes anything.
 */
export async function askAssistant({ message, history = [] } = {}) {
  if (!message || !String(message).trim()) throw new Error('askAssistant needs a message');
  const res = await api.post('/assistant/chat', { message, history });
  return res?.data;
}
