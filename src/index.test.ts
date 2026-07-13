import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import plugin from './index';

describe('opencode-frugon', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frugon-test-'));
  const tmpLog = path.join(tmpDir, 'opencode.jsonl');

  beforeEach(() => {
    if (fs.existsSync(tmpLog)) fs.unlinkSync(tmpLog);
  });

  afterEach(() => {
    if (fs.existsSync(tmpLog)) fs.unlinkSync(tmpLog);
  });

  test('activates and logs completion event', async () => {
    const hooks = await plugin({}, { outputPath: tmpLog });
    expect(fs.existsSync(path.dirname(tmpLog))).toBe(true);

    const handler = hooks.event;
    expect(handler).toBeDefined();

    if (handler) {
      handler({
        event: {
          name: 'completion:end',
          data: {
            model: 'gpt-4',
            timestamp: '2024-01-01T00:00:00Z',
            promptTokens: 10,
            completionTokens: 20,
            sessionId: 'sess-123',
            request: { messages: [{ role: 'user', content: 'hi' }] },
            response: { content: 'hello' }
          }
        }
      });
    }

    await new Promise((r) => setTimeout(r, 50));

    const content = fs.readFileSync(tmpLog, 'utf-8');
    const json = JSON.parse(content.trim());
    expect(json.model).toBe('gpt-4');
    expect(json.usage.prompt_tokens).toBe(10);
    expect(json.usage.completion_tokens).toBe(20);
    expect(json._opencode_metadata.sessionId).toBe('sess-123');
    expect(json.request).toBeUndefined();
    expect(json.response).toBeUndefined();
  });

  test('captures prompts and redacts secrets', async () => {
    const hooks = await plugin(
      {},
      { outputPath: tmpLog, capturePrompts: true, redactSecrets: true }
    );

    if (hooks.event) {
      hooks.event({
        event: {
          name: 'completion',
          data: {
            model: 'gpt-3.5',
            request: { messages: [{ role: 'user', content: 'my bearer token_123' }] }
          }
        }
      });
    }

    await new Promise((r) => setTimeout(r, 50));
    const json = JSON.parse(fs.readFileSync(tmpLog, 'utf-8').trim());
    expect(json.request.messages[0].content).toBe('[REDACTED]');
  });
});
