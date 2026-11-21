/* Toddle Tweaks — service worker: tracker blocking toggles, toolbar badge, "what's new" after updates. */

const DEFAULTS = { blockTrackers: true, blockIntercom: true };

async function syncRulesets() {
  const { settings = {} } = await chrome.storage.sync.get('settings');
  const s = { ...DEFAULTS, ...settings };
  const enable = [];
  const disable = [];
  (s.blockTrackers ? enable : disable).push('trackers');
  (s.blockIntercom ? enable : disable).push('intercom');
  (s.redirectHome !== false ? enable : disable).push('redirect');
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: enable, disableRulesetIds: disable });
  } catch (e) {
    console.warn('[Toddle Tweaks] ruleset update failed', e);
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  syncRulesets();
  // Remember the update so the next Toddle page can show "Toddle Tweaks updated! See what's new".
  const version = chrome.runtime.getManifest().version;
  if (details.reason === 'update' && details.previousVersion && details.previousVersion !== version) {
    chrome.storage.local.set({ whatsNew: { version, from: details.previousVersion, t: Date.now() } });
  }
});
chrome.runtime.onStartup.addListener(syncRulesets);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.settings) syncRulesets();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'openOptions') { chrome.runtime.openOptionsPage(); return; }
  // @dev-start
  if (msg && msg.type === 'devReload' && !('update_url' in chrome.runtime.getManifest())) {
    chrome.runtime.reload();
    return;
  }
  // @dev-end
  if (msg && msg.type === 'badge') {
    const n = msg.count || 0;
    chrome.action.setBadgeText({ text: n ? String(n) : '' });
    chrome.action.setBadgeBackgroundColor({ color: msg.missing ? '#c5221f' : '#1a73e8' });
  }
});
