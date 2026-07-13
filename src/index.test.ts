import { expect, test, describe, beforeEach, afterEach, mock } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { activate, cli } from './index';

describe('opencode-frugon', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frugon-test-'));
  const tmpLog = path.join(tmpDir, 'opencode.jsonl');

  let mockCtx: {
    events: Record<string, Function>;
    on: ReturnType<typeof mock>;
  };

  beforeEach(() => {
    mockCtx = {
      events: {},
      on: mock((event: string, handler: Function) => {
        mockCtx.events[event] = handler;
      })
    };
    if (fs.existsSync(tmpLog)) fs.unlinkSync(tmpLog);
  });

  afterEach(() => {
    if (fs.existsSync(tmpLog)) fs.unlinkSync(tmpLog);
  });

  test('activates and logs completion event', async () => {
    activate(mockCtx, { outputPath: tmpLog });
    expect(mockCtx.on).toHaveBeenCalled();
    expect(fs.existsSync(path.dirname(tmpLog))).toBe(true);

    const handler = mockCtx.events['completion:end'];
    expect(handler).toBeDefined();

    // Trigger completion
    handler({
      model: 'gpt-4',
      timestamp: '2024-01-01T00:00:00Z',
      promptTokens: 10,
      completionTokens: 20,
      sessionId: 'sess-123',
      request: { messages: [{ role: 'user', content: 'hi' }] },
      response: { content: 'hello' }
    });

    // Wait for async appendFile
    await new Promise((r) => setTimeout(r, 50));

    const content = fs.readFileSync(tmpLog, 'utf-8');
    const json = JSON.parse(content.trim());
    expect(json.model).toBe('gpt-4');
    expect(json.usage.prompt_tokens).toBe(10);
    expect(json.usage.completion_tokens).toBe(20);
    expect(json._opencode_metadata.sessionId).toBe('sess-123');
    // Default config sets capturePrompts/Responses to false
    expect(json.request).toBeUndefined();
    expect(json.response).toBeUndefined();
  });

  test('captures prompts and redacts secrets', async () => {
    activate(mockCtx, { outputPath: tmpLog, capturePrompts: true, redactSecrets: true });

    mockCtx.events['completion:end']({
      model: 'gpt-3.5',
      request: { messages: [{ role: 'user', content: 'my bearer token_123' }] }
    });

    await new Promise((r) => setTimeout(r, 50));
    const json = JSON.parse(fs.readFileSync(tmpLog, 'utf-8').trim());
    expect(json.request.messages[0].content).toBe('[REDACTED]');
  });

  test('cli handles non-frugon command', () => {
    const logSpy = mock(console.log);
    const originalConsoleLog = console.log;
    console.log = logSpy;

    cli(['usage']);

    console.log = originalConsoleLog;
    expect(logSpy).toHaveBeenCalled();
  });
});
