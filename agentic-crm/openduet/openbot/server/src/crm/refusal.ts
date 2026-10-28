/** A request the CRM turns down, with the HTTP status that says why. */
export class CrmRefusal extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 405,
  ) {
    super(message);
  }
}
