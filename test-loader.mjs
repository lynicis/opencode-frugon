import { pathToFileURL } from 'url';

async function testLoad() {
  const pluginPath = '/Users/lynicis/Projects/opencode-frugon/dist/index.js';
  try {
    const mod = await import(pathToFileURL(pluginPath).href);
    console.log('Import successful:', Object.keys(mod));
    const init = mod.default || mod;
    const hooks = await init({}, { capturePrompts: true });
    console.log('Plugin initialized, hooks returned:', Object.keys(hooks));

    // Simulate event
    if (hooks.event) {
      hooks.event({
        name: 'completion:end',
        data: {
          model: 'test-model',
          usage: { promptTokens: 10, completionTokens: 5 }
        }
      });
      console.log('Event fired.');
    }
  } catch (err) {
    console.error('Failed to load plugin:', err);
  }
}

testLoad();
