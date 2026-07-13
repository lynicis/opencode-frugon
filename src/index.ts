import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface FrugonConfig {
  enabled?: boolean;
  outputPath?: string;
  capturePrompts?: boolean;
  captureResponses?: boolean;
  captureMetadata?: boolean;
  redactSecrets?: boolean;
}

const DEFAULT_CONFIG: FrugonConfig = {
  enabled: true,
  outputPath: path.join(os.homedir(), '.local', 'share', 'frugon', 'opencode.jsonl'),
  capturePrompts: false,
  captureResponses: false,
  captureMetadata: true,
  redactSecrets: true
};

let config = { ...DEFAULT_CONFIG };

function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return filepath.replace('~', os.homedir());
  }
  return filepath;
}

export default async (_input: any, userConfig?: Partial<FrugonConfig>) => {
  config = { ...DEFAULT_CONFIG, ...userConfig };

  if (config.outputPath) {
    config.outputPath = expandHome(config.outputPath);
  }

  if (!config.enabled) return {};

  const dir = path.dirname(config.outputPath!);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return {
    event: ({ event: e }: any) => {
      // Listen to the bus event for completion
      if (
        e?.name === 'completion' ||
        e?.type === 'completion' ||
        e?.name === 'completion:end' ||
        e?.type === 'completion:end'
      ) {
        try {
          logEvent(e.data || e);
        } catch (err) {
          console.error('[opencode-frugon] Error logging event:', err);
        }
      }
    }
  };
};

function logEvent(event: any) {
  // Map OpenCode event to Frugon native OpenAI schema
  const logEntry: any = {
    model: event.model || 'unknown',
    timestamp: event.timestamp || new Date().toISOString(),
    usage: {
      prompt_tokens: event.usage?.promptTokens || event.promptTokens || 0,
      completion_tokens: event.usage?.completionTokens || event.completionTokens || 0
    }
  };

  if (config.capturePrompts) {
    logEntry.request = {
      messages: event.request?.messages || []
    };
  }

  if (config.captureResponses) {
    logEntry.response = {
      choices: [{ message: { content: event.response?.content || '' } }]
    };
  }

  if (config.captureMetadata) {
    // Frugon degrades gracefully; extra metadata is fine at root or inside an extension object
    logEntry._opencode_metadata = {
      sessionId: event.sessionId,
      provider: event.provider,
      latency: event.latency,
      cost: event.cost,
      finishReason: event.finishReason
    };
  }

  if (config.redactSecrets) {
    redact(logEntry);
  }

  // O_APPEND ensures atomic writes on POSIX for small strings
  const line = JSON.stringify(logEntry) + '\n';
  fs.appendFile(config.outputPath!, line, (err) => {
    if (err) console.error('[opencode-frugon] Write failed:', err);
  });
}

function redact(obj: any) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string' && /(bearer\s|api_key|secret)/i.test(obj[key])) {
      obj[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object') {
      redact(obj[key]);
    }
  }
}
