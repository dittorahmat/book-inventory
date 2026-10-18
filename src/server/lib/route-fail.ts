/** Kanonik respons gagal service {status, message} → JSON seragam. */
export const fail = (
  c: { json: (body: unknown, status?: 400 | 403 | 404 | 409) => Response },
  result: { status: 400 | 403 | 404 | 409; message: string }
): Response => c.json({ success: false, message: result.message }, result.status);
