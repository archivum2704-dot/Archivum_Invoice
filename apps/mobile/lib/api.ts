/**
 * Reads a response body that is supposed to be JSON.
 *
 * When the request never reaches the API — a redirect, a 404, a hosting-level
 * block — the body is an HTML page, and JSON.parse dies with
 * "Unexpected character: <", which tells the user nothing about what happened.
 * This reports the status and a readable excerpt instead.
 */
export function parseApiResponse(status: number, body: string): any {
  try {
    return JSON.parse(body);
  } catch {
    const looksLikeHtml = /^\s*</.test(body);
    const excerpt = body.replace(/\s+/g, " ").trim().slice(0, 120);
    return {
      error: looksLikeHtml ? "html_response" : "invalid_response",
      detail: looksLikeHtml
        ? `El servidor devolvió una página web en vez de datos (HTTP ${status}). Revisa la dirección de la API.`
        : `Respuesta inesperada del servidor (HTTP ${status}): ${excerpt}`,
    };
  }
}

/** Same, for a fetch Response. */
export async function readJson(res: Response): Promise<any> {
  return parseApiResponse(res.status, await res.text());
}
