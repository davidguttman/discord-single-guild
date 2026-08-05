// Optional bundled page-world injection.
//
// Keep executable customizations in this file so they are packaged with each
// release and reviewed alongside the app. This file is intentionally a no-op by
// default. It may run again after Discord performs an in-page navigation, so any
// future customization added here must be idempotent.
(() => {
  window.__discordSingleGuildInjected = true;
})();
