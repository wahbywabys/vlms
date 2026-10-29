export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, 'not_found', `${what} not found`);
export const forbidden = (why = 'Not allowed') => new HttpError(403, 'forbidden', why);
export const conflict = (code: string, msg: string) => new HttpError(409, code, msg);
