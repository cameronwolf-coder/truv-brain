import type { StreamEventType, EnrichmentRequest } from '../types/enrichment';

export class EnrichmentClient {
  private abortController: AbortController | null = null;

  async startEnrichment(
    request: EnrichmentRequest,
    onEvent: (event: StreamEventType) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await fetch('/api/enrichment-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errBody = await response.json();
          errorMsg = errBody.error || errorMsg;
        } catch { /* ignore parse errors */ }
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onEvent(data);
            } catch (err) {
              console.error('Failed to parse SSE data:', err);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return; // Cancelled by user, not an error
      }
      onError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      this.abortController = null;
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
