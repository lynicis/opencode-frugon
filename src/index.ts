import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

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

export function activate(ctx: any, userConfig?: Partial<FrugonConfig>) {
  config = { ...DEFAULT_CONFIG, ...userConfig };
  if (!config.enabled) return;

  const dir = path.dirname(config.outputPath!);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // OpenCode Plugin API hook (assumed shape based on instructions)
  ctx.on('completion:end', (event: any) => {
    try {
      logEvent(event);
    } catch (_e) {
      console.error('[opencode-frugon] Error logging event:', e);
    }
  });
}

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

export function cli(args: string[]) {
  if (args[0] === 'usage') {
    if (args[1] === '--frugon') {
      try {
        execSync(`frugon analyze "${config.outputPath}"`, { stdio: 'inherit' });
      } catch (_e) {
        console.error('Failed to run frugon. Is it installed? (uv tool install frugon)');
        process.exit(1);
      }
    } else {
      console.log(`Run 'opencode usage --frugon' to analyze logs at ${config.outputPath}`);
    }
  }
}
