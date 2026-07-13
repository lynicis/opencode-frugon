# opencode-frugon

[![CI](https://github.com/lynicis/opencode-frugon/actions/workflows/ci.yml/badge.svg)](https://github.com/lynicis/opencode-frugon/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A lightweight, zero-dependency OpenCode plugin that automatically captures LLM usage and logs it natively for [Frugon](https://github.com/Rodiun/frugon) — an open-source LLM cost analyzer.

See exactly where your LLM bill leaks right on your machine, with zero format conversion.

## Features

- **Native Frugon Support:** Writes directly to Frugon's expected OpenAI JSONL schema.
- **Zero Overhead:** Non-blocking async file streams ensure OpenCode performance is unaffected.
- **Privacy First:** All logs are written locally. Secrets, API keys, and bearer tokens are automatically redacted.
- **Configurable Capture:** Opt-in to capture full prompts/responses or only keep metadata and token usage.

## Requirements

- **OpenCode** (to generate the logs)
- **Frugon** (to analyze the logs: `uv tool install frugon`)

## Installation

Install directly through OpenCode using one of these methods:

**Method 1: Using the TUI**

1. Open the OpenCode TUI.
2. Select **Install Plugin**.
3. Enter `opencode-frugon`.

**Method 2: Via Configuration**
Add `opencode-frugon` to the `plugins` array in your `~/.config/opencode/opencode.json`:

```json
{
  "plugins": ["opencode-frugon"]
}
```

## Configuration

In your OpenCode settings (`~/.config/opencode/opencode.json` or similar), enable and configure the plugin:

```json
{
  "plugins": {
    "opencode-frugon": {
      "enabled": true,
      "outputPath": "~/.local/share/frugon/opencode.jsonl",
      "captureMetadata": true,
      "redactSecrets": true,
      "capturePrompts": false,
      "captureResponses": false
    }
  }
}
```

### Configuration Options

| Option             | Type      | Default                                | Description                                                       |
| ------------------ | --------- | -------------------------------------- | ----------------------------------------------------------------- |
| `enabled`          | `boolean` | `true`                                 | Enable or disable the plugin.                                     |
| `outputPath`       | `string`  | `~/.local/share/frugon/opencode.jsonl` | Absolute path where logs will be appended.                        |
| `captureMetadata`  | `boolean` | `true`                                 | Captures OpenCode-specific metadata (latency, cost, session IDs). |
| `redactSecrets`    | `boolean` | `true`                                 | Replaces API keys and bearer tokens with `[REDACTED]`.            |
| `capturePrompts`   | `boolean` | `false`                                | Whether to log full prompt messages.                              |
| `captureResponses` | `boolean` | `false`                                | Whether to log full LLM responses.                                |

## Usage

### Automatic Logging

Once activated, `opencode-frugon` listens to OpenCode's `completion:end` events. Every time an LLM request finishes, it seamlessly appends a Frugon-compatible JSON object to your configured `outputPath`.

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
