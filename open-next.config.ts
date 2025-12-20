import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({
  // For simple apps we don't need extra overrides. R2 cache can be enabled later
  // by importing and setting incrementalCache in this config.
});

