# AI Knowledge Assistant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered chat assistant that answers questions about Truv's marketing knowledge base using OpenAI embeddings and GPT-4o-mini.

**Architecture:** Document indexing at build time creates embeddings for all markdown files. Chat interface sends questions to API endpoint that performs vector similarity search and streams GPT responses via SSE.

**Tech Stack:** React, TypeScript, OpenAI API (embeddings + chat), Server-Sent Events, Vercel Functions

---

## Task 1: Document Indexing Script

**Files:**
- Create: `scripts/index-knowledge.ts`
- Create: `scripts/utils/chunk-documents.ts`
- Create: `scripts/utils/cosine-similarity.ts`

**Step 1: Install dependencies**

Run:
```bash
npm install --save-dev @types/node glob
npm install tiktoken
```

Expected: Dependencies installed successfully

**Step 2: Create chunk utility**

Create: `scripts/utils/chunk-documents.ts`

```typescript
import { encoding_for_model } from 'tiktoken';

interface Chunk {
  id: string;
  text: string;
  source: string;
  section: string;
  tokens: number;
}

export function chunkDocument(
  content: string,
  sourcePath: string,
  maxTokens: number = 500
): Chunk[] {
  const enc = encoding_for_model('gpt-4o-mini');
  const chunks: Chunk[] = [];

  // Split on markdown headings
  const sections = content.split(/^(#{1,3}\s+.+)$/gm);

  let currentSection = '';
  let currentText = '';
  let chunkIndex = 0;

  for (let i = 0; i < sections.length; i++) {
    const part = sections[i].trim();
    if (!part) continue;

    // Check if this is a heading
    if (part.match(/^#{1,3}\s+/)) {
      // Save previous chunk if exists
      if (currentText) {
        const tokens = enc.encode(currentText);
        if (tokens.length > 0) {
          chunks.push({
            id: `${sourcePath.replace(/\//g, '-')}-chunk-${chunkIndex}`,
            text: currentText,
            source: sourcePath,
            section: currentSection,
            tokens: tokens.length,
          });
          chunkIndex++;
        }
      }

      currentSection = part.replace(/^#+\s+/, '');
      currentText = '';
    } else {
      currentText += part + '\n\n';

      // Check if we've exceeded max tokens
      const tokens = enc.encode(currentText);
      if (tokens.length > maxTokens) {
        chunks.push({
          id: `${sourcePath.replace(/\//g, '-')}-chunk-${chunkIndex}`,
          text: currentText,
          source: sourcePath,
          section: currentSection,
          tokens: tokens.length,
        });
        chunkIndex++;
        currentText = '';
      }
    }
  }

  // Save final chunk
  if (currentText) {
    const tokens = enc.encode(currentText);
    if (tokens.length > 0) {
      chunks.push({
        id: `${sourcePath.replace(/\//g, '-')}-chunk-${chunkIndex}`,
        text: currentText,
        source: sourcePath,
        section: currentSection,
        tokens: tokens.length,
      });
    }
  }

  enc.free();
  return chunks;
}
```

**Step 3: Create cosine similarity utility**

Create: `scripts/utils/cosine-similarity.ts`

```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

**Step 4: Create main indexing script**

Create: `scripts/index-knowledge.ts`

```typescript
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import OpenAI from 'openai';
import { chunkDocument } from './utils/chunk-documents';

interface KnowledgeChunk {
  id: string;
  text: string;
  source: string;
  section: string;
  tokens: number;
  embedding: number[];
}

async function main() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log('📚 Indexing knowledge base...');

  // Find all markdown files
  const files = await glob('docs/**/*.md', {
    ignore: ['**/node_modules/**', '**/README.md'],
  });

  // Add CLAUDE.md
  files.push('CLAUDE.md');

  console.log(`Found ${files.length} documents`);

  // Process all files into chunks
  const allChunks: Omit<KnowledgeChunk, 'embedding'>[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const chunks = chunkDocument(content, file);
    allChunks.push(...chunks);
  }

  console.log(`Created ${allChunks.length} chunks`);

  // Generate embeddings in batches
  const batchSize = 100;
  const knowledgeBase: KnowledgeChunk[] = [];

  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);

    console.log(`Generating embeddings ${i + 1}-${Math.min(i + batchSize, allChunks.length)}...`);

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch.map(chunk => chunk.text),
    });

    batch.forEach((chunk, idx) => {
      knowledgeBase.push({
        ...chunk,
        embedding: response.data[idx].embedding,
      });
    });
  }

  // Save to public directory
  const outputPath = 'public/knowledge-base.json';
  fs.mkdirSync('public', { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(knowledgeBase, null, 2));

  console.log(`✅ Knowledge base saved to ${outputPath}`);
  console.log(`   Total chunks: ${knowledgeBase.length}`);
  console.log(`   Total tokens: ${knowledgeBase.reduce((sum, c) => sum + c.tokens, 0)}`);
}

main().catch(console.error);
```

**Step 5: Add build script**

Modify: `package.json`

Add to `"scripts"`:
```json
"index-knowledge": "tsx scripts/index-knowledge.ts",
"prebuild": "npm run index-knowledge"
```

**Step 6: Test indexing**

Run:
```bash
npm run index-knowledge
```

Expected:
- Output shows "Found X documents"
- Output shows "Created Y chunks"
- Output shows "Knowledge base saved to public/knowledge-base.json"
- File `public/knowledge-base.json` exists

**Step 7: Verify output structure**

Run:
```bash
node -e "const kb = require('./public/knowledge-base.json'); console.log('Chunks:', kb.length); console.log('Sample:', JSON.stringify(kb[0], null, 2).substring(0, 500));"
```

Expected: Shows chunk count and sample chunk structure with embedding array

**Step 8: Commit**

```bash
git add scripts/ package.json .gitignore
echo "public/knowledge-base.json" >> .gitignore
git commit -m "feat: add document indexing script for knowledge base"
```

---

## Task 2: Ask API Endpoint

**Files:**
- Create: `api/ask.ts`
- Create: `src/types/chat.ts`

**Step 1: Create chat types**

Create: `src/types/chat.ts`

```typescript
export interface AskRequest {
  question: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export type SSEEvent =
  | { type: 'token'; content: string }
  | { type: 'sources'; files: string[] }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface KnowledgeChunk {
  id: string;
  text: string;
  source: string;
  section: string;
  tokens: number;
  embedding: number[];
}
```

**Step 2: Create API endpoint**

Create: `api/ask.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import type { AskRequest, KnowledgeChunk, SSEEvent } from '../src/types/chat';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { question, conversationHistory = [] } = req.body as AskRequest;

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question required' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // Load knowledge base
    const knowledgeBasePath = path.join(process.cwd(), 'public', 'knowledge-base.json');
    const knowledgeBase: KnowledgeChunk[] = JSON.parse(
      fs.readFileSync(knowledgeBasePath, 'utf-8')
    );

    // Generate question embedding
    const questionEmbedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
    });

    // Find similar chunks
    const similarChunks = knowledgeBase
      .map(chunk => ({
        ...chunk,
        similarity: cosineSimilarity(
          questionEmbedding.data[0].embedding,
          chunk.embedding
        ),
      }))
      .filter(chunk => chunk.similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    // Check if we found relevant context
    if (similarChunks.length === 0) {
      const errorEvent: SSEEvent = {
        type: 'error',
        message: "I couldn't find relevant information in the knowledge base. Could you rephrase your question?",
      };
      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
      res.end();
      return;
    }

    // Build context
    const context = similarChunks
      .map(chunk => `--- From ${chunk.source} ---\n${chunk.text}`)
      .join('\n\n');

    // Stream GPT response
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are Truv's marketing assistant with deep knowledge of:
- Products and features
- Target personas (CFO, VP Finance, etc.)
- Brand voice and messaging
- Proof points and case studies

Answer questions using this context:

${context}`,
        },
        ...conversationHistory,
        { role: 'user', content: question },
      ],
      stream: true,
      temperature: 0.7,
    });

    // Stream tokens
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        const tokenEvent: SSEEvent = { type: 'token', content };
        res.write(`data: ${JSON.stringify(tokenEvent)}\n\n`);
      }
    }

    // Send sources
    const sourcesEvent: SSEEvent = {
      type: 'sources',
      files: [...new Set(similarChunks.map(c => c.source))],
    };
    res.write(`data: ${JSON.stringify(sourcesEvent)}\n\n`);

    // Send done
    const doneEvent: SSEEvent = { type: 'done' };
    res.write(`data: ${JSON.stringify(doneEvent)}\n\n`);

    res.end();
  } catch (error) {
    console.error('Ask API error:', error);
    const errorEvent: SSEEvent = {
      type: 'error',
      message: "Sorry, I'm having trouble connecting. Please try again.",
    };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.end();
  }
}
```

**Step 3: Test API endpoint locally**

Run:
```bash
vercel dev
```

Then in another terminal:
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What are Truv'\''s products?"}'
```

Expected: Streaming response with tokens, sources, and done events

**Step 4: Commit**

```bash
git add api/ask.ts src/types/chat.ts
git commit -m "feat: add /api/ask endpoint with vector search and streaming"
```

---

## Task 3: Chat Bubble Component

**Files:**
- Create: `src/components/chat/ChatBubble.tsx`
- Create: `src/components/chat/ChatBubble.css`

**Step 1: Create chat bubble component**

Create: `src/components/chat/ChatBubble.tsx`

```typescript
import { useState } from 'react';
import './ChatBubble.css';

export function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Chat Bubble */}
      <button
        className="chat-bubble"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open chat assistant"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <h3>Truv Marketing Assistant</h3>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>
          <div className="chat-messages">
            <div className="bot-message">
              <p>Hi! Ask me anything about Truv's products, personas, brand voice, or marketing materials.</p>
            </div>
          </div>
          <div className="chat-input">
            <input
              type="text"
              placeholder="Ask a question..."
            />
            <button>Send</button>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Create chat bubble styles**

Create: `src/components/chat/ChatBubble.css`

```css
.chat-bubble {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  transition: transform 0.2s ease;
}

.chat-bubble:hover {
  transform: scale(1.1);
}

.chat-panel {
  position: fixed;
  bottom: 100px;
  right: 24px;
  width: 350px;
  height: 500px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  z-index: 999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.chat-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.chat-header button {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bot-message,
.user-message {
  max-width: 80%;
  padding: 12px;
  border-radius: 8px;
  line-height: 1.5;
}

.bot-message {
  align-self: flex-start;
  background: #f3f4f6;
  color: #1f2937;
}

.user-message {
  align-self: flex-end;
  background: #667eea;
  color: white;
}

.chat-input {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e5e7eb;
}

.chat-input input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.chat-input input:focus {
  outline: none;
  border-color: #667eea;
}

.chat-input button {
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.chat-input button:hover {
  background: #5568d3;
}

.chat-input button:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}
```

**Step 3: Add to Layout**

Modify: `src/components/Layout.tsx`

Add import:
```typescript
import { ChatBubble } from './chat/ChatBubble';
```

Add before closing `</div>`:
```tsx
<ChatBubble />
```

**Step 4: Test UI**

Run:
```bash
npm run dev
```

Open browser, verify:
- Chat bubble appears in bottom-right corner
- Clicking bubble opens chat panel
- Panel shows welcome message
- Input and send button are visible

**Step 5: Commit**

```bash
git add src/components/chat/ src/components/Layout.tsx
git commit -m "feat: add chat bubble UI component"
```

---

## Task 4: Chat Message State & Streaming

**Files:**
- Modify: `src/components/chat/ChatBubble.tsx`
- Create: `src/services/chatClient.ts`

**Step 1: Create chat client service**

Create: `src/services/chatClient.ts`

```typescript
import type { SSEEvent, AskRequest } from '../types/chat';

export class ChatClient {
  async ask(
    request: AskRequest,
    onEvent: (event: SSEEvent) => void
  ): Promise<void> {
    try {
      const response = await fetch('/api/ask', {
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
      const errorEvent: SSEEvent = {
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
      onEvent(errorEvent);
    }
  }
}
```

**Step 2: Add message state to ChatBubble**

Modify: `src/components/chat/ChatBubble.tsx`

Replace entire file:
```typescript
import { useState, useRef, useEffect } from 'react';
import { ChatClient } from '../../services/chatClient';
import type { SSEEvent } from '../../types/chat';
import './ChatBubble.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

export function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatClient = useRef(new ChatClient());

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    setStreamingContent('');

    const conversationHistory = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    await chatClient.current.ask(
      {
        question: userMessage.content,
        conversationHistory,
      },
      (event: SSEEvent) => {
        switch (event.type) {
          case 'token':
            setStreamingContent(prev => prev + event.content);
            break;

          case 'sources':
            setMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: streamingContent,
                sources: event.files,
              },
            ]);
            setStreamingContent('');
            break;

          case 'done':
            setIsProcessing(false);
            break;

          case 'error':
            setMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: event.message,
              },
            ]);
            setStreamingContent('');
            setIsProcessing(false);
            break;
        }
      }
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Bubble */}
      <button
        className="chat-bubble"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open chat assistant"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <h3>Truv Marketing Assistant</h3>
            <button onClick={() => setIsOpen(false)} aria-label="Close chat">
              ✕
            </button>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="bot-message">
                <p>
                  Hi! Ask me anything about Truv's products, personas, brand voice, or
                  marketing materials.
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`${msg.role}-message`}>
                <p>{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="message-sources">
                    📄 Sources: {msg.sources.join(', ')}
                  </div>
                )}
              </div>
            ))}

            {streamingContent && (
              <div className="bot-message">
                <p>{streamingContent}</p>
              </div>
            )}

            {isProcessing && !streamingContent && (
              <div className="bot-message">
                <p className="typing-indicator">Searching knowledge base...</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input">
            <input
              type="text"
              placeholder="Ask a question..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isProcessing}
            />
            <button onClick={handleSend} disabled={!input.trim() || isProcessing}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 3: Add message source styles**

Modify: `src/components/chat/ChatBubble.css`

Add at end:
```css
.message-sources {
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
  font-style: italic;
}

.typing-indicator {
  opacity: 0.7;
}
```

**Step 4: Test chat flow**

Run:
```bash
npm run dev
```

Test:
1. Open chat bubble
2. Type "What are Truv's products?"
3. Verify message appears as user message
4. Verify streaming response appears word-by-word
5. Verify sources appear at bottom of bot message
6. Ask follow-up question
7. Verify conversation history is maintained

**Step 5: Commit**

```bash
git add src/components/chat/ src/services/chatClient.ts
git commit -m "feat: add message state and streaming to chat"
```

---

## Task 5: Update CLAUDE.md and Deploy

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md**

Modify: `CLAUDE.md`

Add after Data Enrichment section:
```markdown
### 4. AI Knowledge Assistant
**Status:** Complete
**Location:** Chat bubble (bottom-right corner)

AI-powered chat assistant that answers questions about Truv's marketing knowledge base.

**Features:**
- Vector similarity search using OpenAI embeddings
- Real-time streaming responses via SSE
- Source attribution for all answers
- Session-based conversation history
- Searches all `/docs` markdown files + CLAUDE.md

**Tech:**
- OpenAI text-embedding-3-small for embeddings
- OpenAI gpt-4o-mini for chat responses
- Build-time document indexing
- Cosine similarity search

**Cost:** ~$0.02-0.05 per question

**Usage:** Click chat bubble in bottom-right corner, ask any question about Truv marketing.
```

**Step 2: Verify build script**

Run:
```bash
npm run build
```

Expected:
- Indexing script runs first
- Knowledge base JSON is created
- Vite build succeeds
- No TypeScript errors

**Step 3: Test production build locally**

Run:
```bash
npm run preview
```

Test chat functionality in preview mode

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add AI Knowledge Assistant to CLAUDE.md"
```

**Step 5: Push to GitHub**

```bash
git push
```

Expected: Vercel auto-deploys with knowledge base indexing

**Step 6: Verify deployment**

Wait for Vercel deployment, then test:
1. Visit production URL
2. Open chat bubble
3. Ask test question
4. Verify streaming works
5. Verify sources are shown

---

## Completion Checklist

- [ ] Document indexing script creates embeddings for all docs
- [ ] `/api/ask` endpoint performs vector search and streams responses
- [ ] Chat bubble appears in bottom-right corner
- [ ] Chat panel opens/closes correctly
- [ ] Messages stream in real-time
- [ ] Sources are attributed to responses
- [ ] Conversation history is maintained in session
- [ ] Build process runs indexing before Vite build
- [ ] Deployed to Vercel successfully
- [ ] CLAUDE.md updated with feature documentation

**Estimated time:** 2-3 hours
**Total files created:** 8
**Total files modified:** 3
