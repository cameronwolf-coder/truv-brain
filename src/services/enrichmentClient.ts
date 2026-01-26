import { StreamEventType, EnrichmentRequest } from '../types/enrichment';

export class EnrichmentClient {
  private eventSource: EventSource | null = null;

  async startEnrichment(
    request: EnrichmentRequest,
    onEvent: (event: StreamEventType) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const response = await fetch('/api/enrichment-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
      onError(err instanceof Error ? err : new Error('Unknown error'));
    }
  }

  cancel(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
