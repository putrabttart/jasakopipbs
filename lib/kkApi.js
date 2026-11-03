const HTML_TITLE_RE = /<title[^>]*>([^<]*)<\/title>/i;

export class KkApiError extends Error {
  constructor(message, upstreamStatus = 0) {
    super(message);
    this.name = 'KkApiError';
    this.upstreamStatus = upstreamStatus;
  }
}

export async function parseKkResponse(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!response.ok || !contentType.toLowerCase().includes('application/json')) {
    const title = text.match(HTML_TITLE_RE)?.[1]?.trim();
    console.error('Kopi Kenangan API returned an invalid response', {
      status: response.status,
      contentType,
      title: title || null,
      url: response.url,
    });

    const detail = response.status ? ` (HTTP ${response.status})` : '';
    throw new KkApiError(
      `${fallbackMessage}${detail}. API Kopi Kenangan sedang tidak tersedia.`,
      response.status
    );
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    console.error('Kopi Kenangan API returned malformed JSON', {
      status: response.status,
      contentType,
      url: response.url,
    });
    throw new KkApiError(`${fallbackMessage}. Respons API Kopi Kenangan tidak valid.`);
  }
}
