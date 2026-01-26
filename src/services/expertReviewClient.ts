import type { ReviewStreamEvent, ReviewRequest } from '../types/expertReview';

export class ExpertReviewClient {
  private abortController: AbortController | null = null;

  async startReview(
    request: ReviewRequest,
    onEvent: (event: ReviewStreamEvent) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      this.abortController = new AbortController();

      const response = await fetch('/api/expert-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: this.abortController.signal,
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
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Cancelled by user
      }
      onError(err instanceof Error ? err : new Error('Unknown error'));
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
