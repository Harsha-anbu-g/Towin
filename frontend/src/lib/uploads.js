// One upload limit for the whole app.
//
// The server's multipart limit is 5MB (backend application.yml), and going over
// it produces a raw 500 the person cannot act on — so the file is stopped here,
// before it is sent, with a sentence that says what to do next.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const TOO_BIG_MESSAGE = 'That file is larger than 5 MB. Please choose a smaller one.';

export function isTooBig(file) {
  return !!file && file.size > MAX_UPLOAD_BYTES;
}
