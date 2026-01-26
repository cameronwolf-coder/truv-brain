# AI Knowledge Assistant Design

## Overview

An AI-powered chat assistant that answers questions about Truv's marketing knowledge base. Accessible via a chat bubble on the Truv Brain website, it uses OpenAI embeddings for semantic search and GPT-4o-mini for conversational responses.

**Use Cases:**
- "Write a LinkedIn ad for fintech CFOs" → Uses persona docs + voice guide
- "What are our key proof points?" → Searches proof-points.md
- "Draft an email for closed-lost prospects" → Combines multiple doc sources
- "What's our brand voice?" → Retrieves voice-guide.md

**Cost:** ~$0.02-0.05 per question

---

## Architecture

### Components

**1. Document Indexing Service** (Build-time)
- Scans `/docs/**/*.md` and plan files
- Splits documents into 500-token chunks
- Generates OpenAI embeddings (text-embedding-3-small)
- Outputs `public/knowledge-base.json`

**2. Chat Interface** (React)
- Fixed chat bubble (bottom-right corner)
- Expands to 350x500px chat panel
- Real-time message streaming
- Source attribution links
- Session-only history (clears on refresh)

**3. API Endpoint** (`/api/ask`)
- Vector similarity search (cosine distance)
- Context-aware GPT prompting
- Server-Sent Events (SSE) streaming
- Error handling with fallbacks

### Technology Stack

- **Embeddings:** OpenAI text-embedding-3-small (~$0.0001 per query)
- **Chat:** OpenAI gpt-4o-mini (~$0.01 per conversation)
- **Search:** In-memory vector similarity (no external DB)
- **Streaming:** Server-Sent Events (SSE)
- **Storage:** Static JSON file for embeddings

---

## Document Indexing

### Build Process

```bash
npm run index-knowledge
```

**Steps:**
1. Read all markdown files from `/docs`
2. Split each file into chunks:
   - Max 500 tokens per chunk
   - Split on markdown headings (##, ###)
   - Preserve context (include parent heading)
3. Generate embedding for each chunk
4. Save to `public/knowledge-base.json`

### Chunk Structure

```json
{
  "id": "personas-md-chunk-3",
  "text": "CFO Persona: Budget-conscious, risk-averse...",
  "source": "docs/personas.md",
  "section": "CFO",
  "tokens": 243,
  "embedding": [0.023, -0.891, 0.445, ...]
}
```

### Included Documents

- `/docs/*.md` - Core knowledge (products, personas, voice, proof points)
- `/docs/plans/*.md` - Project documentation
- `/docs/branding/*.md` - Brand guidelines
- `CLAUDE.md` - Project overview

**Excluded:**
- `README.md` files (meta documentation)
- Binary files (images, fonts)
- Code files (only markdown content)

---

## Retrieval Process

### Query Flow

1. **User asks question:** "Write a LinkedIn ad for fintech CFOs"

2. **Generate question embedding:**
   ```typescript
   const questionEmbedding = await openai.embeddings.create({
     model: "text-embedding-3-small",
     input: question
   });
   ```

3. **Calculate similarity scores:**
   ```typescript
   chunks.map(chunk => ({
     ...chunk,
     similarity: cosineSimilarity(questionEmbedding, chunk.embedding)
   }));
   ```

4. **Get top 5 matches:**
   - Sort by similarity score (descending)
   - Filter: similarity > 0.5 threshold
   - Return top 5 chunks

5. **Build context for GPT:**
   ```
   You are Truv's marketing assistant with deep knowledge of:
   - Products and features
   - Target personas (CFO, VP Finance, etc.)
   - Brand voice and messaging
   - Proof points and case studies

   Answer questions using this context:

   --- From personas.md ---
   [Chunk 1 content]

   --- From voice-guide.md ---
   [Chunk 2 content]

   ...

   User question: {question}
   ```

### Similarity Thresholds

- **High confidence (>0.7):** Use context directly
- **Medium (0.5-0.7):** Use context with caveat
- **Low (<0.5):** Respond "I couldn't find relevant information"

---

## Chat Interface

### Visual Design

**Chat Bubble (Collapsed):**
- Position: `fixed bottom-right (24px from edges)`
- Size: 60px diameter circle
- Icon: 💬 or sparkle icon
- Background: Blue gradient (brand colors)
- Badge: "Ask me anything" tooltip on hover
- Subtle pulse animation on first visit

**Chat Panel (Expanded):**
- Size: 350px wide × 500px tall
- Header: "Truv Marketing Assistant" + minimize button
- Message area: Scrollable, auto-scroll to bottom
- Input: "Ask a question..." placeholder
- Send button: Blue, disabled while processing

### Message Components

**User Message:**
```tsx
<div className="text-right">
  <div className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg">
    Write a LinkedIn ad for CFOs
  </div>
</div>
```

**Bot Message:**
```tsx
<div className="text-left">
  <div className="inline-block bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
    {streamedResponse}
  </div>
  <div className="text-xs text-gray-500 mt-1">
    📄 Sources: personas.md, voice-guide.md
  </div>
</div>
```

**Loading State:**
```tsx
<div className="flex items-center gap-2 text-gray-500">
  <Spinner />
  <span>Searching knowledge base...</span>
</div>
```

### Conversation Flow

1. User types question → Click send or press Enter
2. Show loading indicator: "Searching knowledge base..."
3. Stream response word-by-word as it arrives
4. Show source attribution below message
5. Re-enable input for follow-up question
6. Conversation persists in session, clears on refresh

---

## API Implementation

### Endpoint: `POST /api/ask`

**Request:**
```typescript
interface AskRequest {
  question: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}
```

**Response:** Server-Sent Events (SSE)

```typescript
// Event types
type SSEEvent =
  | { type: 'token', content: string }
  | { type: 'sources', files: string[] }
  | { type: 'done' }
  | { type: 'error', message: string };
```

### Processing Steps

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Load knowledge base
  const knowledgeBase = JSON.parse(
    fs.readFileSync('public/knowledge-base.json', 'utf-8')
  );

  // 2. Generate question embedding
  const questionEmbedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: req.body.question
  });

  // 3. Find similar chunks
  const similarChunks = knowledgeBase
    .map(chunk => ({
      ...chunk,
      similarity: cosineSimilarity(
        questionEmbedding.data[0].embedding,
        chunk.embedding
      )
    }))
    .filter(chunk => chunk.similarity > 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  // 4. Build context
  const context = similarChunks
    .map(chunk => `--- From ${chunk.source} ---\n${chunk.text}`)
    .join('\n\n');

  // 5. Stream GPT response
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are Truv's marketing assistant. Answer using this context:\n\n${context}`
      },
      ...req.body.conversationHistory,
      { role: "user", content: req.body.question }
    ],
    stream: true
  });

  // 6. Send SSE events
  res.setHeader('Content-Type', 'text/event-stream');

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({
    type: 'sources',
    files: similarChunks.map(c => c.source)
  })}\n\n`);

  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
}
```

---

## Error Handling

### Scenarios

**1. No Relevant Documents**
```typescript
if (similarChunks.length === 0) {
  return {
    type: 'error',
    message: "I couldn't find relevant information in the knowledge base. Could you rephrase your question?"
  };
}
```

**2. OpenAI API Failure**
```typescript
try {
  const response = await openai.chat.completions.create(...);
} catch (error) {
  console.error('OpenAI error:', error);
  return {
    type: 'error',
    message: "Sorry, I'm having trouble connecting. Please try again."
  };
}
```

**3. Question Too Vague**
- If question is < 5 words and similarity scores are all low
- Bot responds: "What would you like to know about? I can help with products, personas, brand voice, proof points, and more."

**4. Rate Limiting**
- OpenAI has rate limits (10,000 requests/min for embeddings)
- Implement exponential backoff retry
- Show user: "High demand right now, please wait a moment..."

### Edge Cases

- **Empty question:** Disable send button until text entered
- **Processing in progress:** Disable input while streaming response
- **Browser offline:** Show "You're offline" banner
- **Knowledge base missing:** Fallback to GPT without context, warn user
- **Very long response:** Show scroll indicator in chat panel

---

## Testing Strategy

### Unit Tests

```typescript
describe('Vector Search', () => {
  it('finds relevant chunks for persona questions', async () => {
    const result = await searchKnowledgeBase('Tell me about CFO persona');
    expect(result[0].source).toContain('personas.md');
    expect(result[0].similarity).toBeGreaterThan(0.7);
  });

  it('returns empty array for irrelevant questions', async () => {
    const result = await searchKnowledgeBase('What is quantum physics?');
    expect(result.filter(r => r.similarity > 0.5)).toHaveLength(0);
  });
});
```

### Integration Tests

- Test full question → answer flow with real OpenAI API
- Verify source attribution matches retrieved chunks
- Test conversation history (multi-turn dialogue)
- Test error scenarios (invalid API key, network failure)

### Manual Testing

**Sample Questions:**
- "Write a LinkedIn ad for fintech CFOs"
- "What are Truv's key products?"
- "How should I write in Truv's brand voice?"
- "Draft an email for closed-lost prospects"
- "What proof points can I use for payroll vertical?"

**Verify:**
- Responses are accurate and use knowledge base content
- Sources are correctly attributed
- Streaming works smoothly without lag
- Mobile chat bubble is responsive

---

## Deployment

### Build Process

```json
{
  "scripts": {
    "index-knowledge": "node scripts/index-knowledge.js",
    "build": "npm run index-knowledge && vite build"
  }
}
```

### Environment Variables

```bash
OPENAI_API_KEY=sk-...  # Already configured
```

### Vercel Configuration

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "outputDirectory": "dist"
}
```

**Important:** Knowledge base indexing runs at build time, so any doc updates require a redeploy.

---

## Future Enhancements

**Phase 2 (Optional):**
- Add "thumbs up/down" feedback on responses
- Track which docs are most frequently referenced
- Add conversational memory (persistent localStorage)
- Support file uploads ("analyze this campaign brief")
- Integration with HubSpot for live data queries

**Phase 3 (Optional):**
- Multi-modal support (upload images for brand consistency checks)
- Suggested questions based on current page context
- Export conversations as markdown
- Team sharing (multiple users, saved conversations in DB)
