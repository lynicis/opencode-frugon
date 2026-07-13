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
const loggedMessages = new Set<string>();

export default async (_input: any, userConfig?: Partial<FrugonConfig>) => {
  config = { ...DEFAULT_CONFIG, ...userConfig };

  if (config.outputPath) {
    config.outputPath = config.outputPath.replace(/^~(?=$|\/)/, os.homedir());
  }

  if (!config.enabled) return {};

  return {
    event: (...args: any[]) => {
      try {
        let eventName;
        let eventData: any;

        if (typeof args[0] === 'string') {
          eventName = args[0];
          eventData = args[1];
        } else {
          const e = args[0]?.event || args[0];
          eventName = e?.name || e?.type;
          eventData = e?.data || e?.properties || e;
        }

        // Support for legacy OpenCode completion events
        if (eventName === 'completion' || eventName === 'completion:end') {
          logEvent(eventData);
        }

        // Support for newer OpenCode message.updated events
        else if (eventName === 'message.updated') {
          const info = eventData?.info;
          if (info && info.role === 'assistant' && info.finish && !loggedMessages.has(info.id)) {
            loggedMessages.add(info.id);

            const legacyEventFormat = {
              model: info.modelID || 'unknown',
              timestamp: new Date(info.time?.completed || Date.now()).toISOString(),
              usage: {
                promptTokens: info.tokens?.input || 0,
                completionTokens: info.tokens?.output || 0
              },
              sessionId: info.sessionID,
              provider: info.providerID,
              cost: info.cost,
              finishReason: info.finish
            };

            logEvent(legacyEventFormat);
          }
        }
      } catch (err) {
        console.error('[opencode-frugon] Error logging event:', err);
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

  const line = JSON.stringify(logEntry) + '\n';
  try {
    fs.mkdirSync(path.dirname(config.outputPath!), { recursive: true });
    fs.appendFileSync(config.outputPath!, line, 'utf-8');
  } catch (err) {
    console.error('[opencode-frugon] Write failed:', err);
  }
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
