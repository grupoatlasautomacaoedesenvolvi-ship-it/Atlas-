export async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (isJson) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || `Erro na operação (${res.status})`);
    }
    return data as T;
  } else {
    const text = await res.text();
    if (!res.ok) {
      // Remove HTML tags if response is HTML error page
      const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
      const snippet = cleanText.length > 120 ? cleanText.slice(0, 120) + '...' : cleanText;
      throw new Error(`Erro no servidor (${res.status}): ${snippet || 'Serviço indisponível'}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Resposta em formato inesperado do servidor (${res.status}).`);
    }
  }
}
