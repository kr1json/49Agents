// ── Settings Modal + Preferences ──────────────────────────────────────────
import { escapeHtml } from './utils.js';
import { TERMINAL_FONTS, CANVAS_BACKGROUNDS } from './constants.js';
import { setSoundEnabled } from './sounds.js';

// External deps — set via initSettingsDeps()
let cloudFetch, applyTerminalTheme, getTerminalFontFamily;
let terminals;

// Live getters for primitive IIFE state
let _getters = {};

export function initSettingsDeps(ctx) {
  cloudFetch = ctx.cloudFetch;
  applyTerminalTheme = ctx.applyTerminalTheme;
  getTerminalFontFamily = ctx.getTerminalFontFamily;
  terminals = ctx.getTerminals();
  _getters = ctx;
}

// Proxy variables — read/write through getters/setters
function _get(key) { return _getters['get' + key.charAt(0).toUpperCase() + key.slice(1)]?.() ?? _getters[key]; }
function _set(key, val) { const setter = _getters['set' + key.charAt(0).toUpperCase() + key.slice(1)]; if (setter) setter(val); }

let prefsSaveTimer = null;

// TERMINAL_FONTS, CANVAS_BACKGROUNDS — imported from modules/constants.js

export function getAllPrefs(overrides) {
  return {
    nightMode: !!document.getElementById('night-mode-overlay'),
    terminalTheme: _getters.getCurrentTerminalTheme(),
    notificationSound: _getters.getNotificationSoundEnabled(),
    autoRemoveDone: _getters.getAutoRemoveDoneNotifs(),
    canvasBg: _getters.getCurrentCanvasBg(),
    snoozeDuration: _getters.getSnoozeDurationMs() / 1000,
    terminalFont: _getters.getCurrentTerminalFont(),
    focusMode: _getters.getFocusMode(),
    hudState: {
      fleet_expanded: _getters.getHudExpanded(),
      agents_expanded: _getters.getAgentsHudExpanded(),
      device_colors: _getters.getDeviceColorOverrides(),
      hud_hidden: _getters.getHudHidden(),
    },
    tutorialsCompleted: _getters.getTutorialsCompleted(),
    ...overrides,
  };
}

// getTerminalFontFamily — imported from modules/utils.js

function applyTerminalFont(fontName) {
  _getters.setCurrentTerminalFont(fontName);
  const family = getTerminalFontFamily(fontName);
  terminals.forEach(({ xterm }) => {
    xterm.options.fontFamily = family;
  });
}

export function savePrefsToCloud(overrides) {
  if (prefsSaveTimer) clearTimeout(prefsSaveTimer);
  prefsSaveTimer = setTimeout(() => {
    cloudFetch('PUT', '/api/preferences', getAllPrefs(overrides))
      .catch(e => console.error('[Prefs] Save failed:', e.message));
  }, 500);
}

export function setCanvasBackground(key) {
  const bg = CANVAS_BACKGROUNDS[key] || CANVAS_BACKGROUNDS.default;
  _getters.setCurrentCanvasBg(key);
  document.body.style.backgroundColor = bg.color;
  // Handle grid background
  if (bg.grid) {
    document.body.style.backgroundImage = 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)';
    document.body.style.backgroundSize = '40px 40px';
  } else {
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundSize = '';
  }
}

export function setNightMode(enabled) {
  let overlay = document.getElementById('night-mode-overlay');
  if (enabled && !overlay) {
    overlay = document.createElement('div');
    overlay.id = 'night-mode-overlay';
    document.body.appendChild(overlay);
  } else if (!enabled && overlay) {
    overlay.remove();
  }
}

export function showSettingsModal() {
  const existing = document.getElementById('settings-modal');
  if (existing) { existing.remove(); return; }

  const user = window.__tcUser || {};
  const nightModeOn = !!document.getElementById('night-mode-overlay');

  const overlay = document.createElement('div');
  overlay.id = 'settings-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100000;';

  const dialog = document.createElement('div');
  dialog.className = 'tc-scrollbar';
  dialog.style.cssText = 'background:#1a1a2e;border:1px solid rgba(var(--accent-rgb),0.3);border-radius:12px;padding:24px;max-width:400px;width:90%;color:#e0e0e0;font-family:Montserrat,sans-serif;max-height:80vh;overflow-y:auto;';

  // Helper: build a collapsible picker item
  function buildPickerItem(cls, dataAttr, dataVal, isSel, label, extra) {
    return `<div class="${cls}" data-${dataAttr}="${dataVal}" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;cursor:pointer;background:${isSel ? 'rgba(var(--accent-rgb),0.2)' : 'transparent'};border:1px solid ${isSel ? 'rgba(var(--accent-rgb),0.4)' : 'transparent'};transition:all 0.15s ease;">
      <span style="min-width:16px;text-align:center;font-size:12px;">${isSel ? '\u2713' : ''}</span>
      <span style="font-size:13px;flex:1;${extra || ''}">${label}</span>
    </div>`;
  }

  // Current theme/font info for collapsed preview
  const curTheme = TERMINAL_THEMES[currentTerminalTheme] || TERMINAL_THEMES.default;
  const curThemeDots = [curTheme.red, curTheme.green, curTheme.blue, curTheme.yellow, curTheme.magenta, curTheme.cyan].filter(Boolean)
    .map(c => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:2px;"></span>`).join('');

  dialog.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h3 style="margin:0;font-size:16px;font-weight:400;color:#8b8bb0;">Settings</h3>
      <button id="settings-close-btn" style="background:none;border:none;color:#6a6a8a;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:4px;line-height:1;">&times;</button>
    </div>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${user.avatar ? `<img src="${user.avatar}" style="width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);" alt="">` : '<div style="width:40px;height:40px;border-radius:50%;background:rgba(var(--accent-rgb),0.3);display:flex;align-items:center;justify-content:center;font-size:18px;">U</div>'}
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.name || 'User'}</div>
          <div style="font-size:12px;color:#6a6a8a;">@${user.login || 'unknown'} &middot; <span style="color:${user.tier === 'poweruser' ? '#e0a0ff' : user.tier === 'pro' ? '#4ec9b0' : user.tier === 'team' ? '#569cd6' : '#6a6a8a'};text-transform:uppercase;font-size:10px;letter-spacing:0.5px;">${user.tier || 'free'}</span></div>
        </div>
        <button id="settings-logout-btn" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;font-size:11px;padding:5px 12px;border-radius:6px;cursor:pointer;font-family:inherit;white-space:nowrap;">Logout</button>
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div>
        <div style="font-size:13px;">Night Mode</div>
        <div style="font-size:11px;color:#6a6a8a;">Red overlay for low-light use</div>
      </div>
      <label style="position:relative;display:inline-block;width:40px;height:22px;cursor:pointer;">
        <input type="checkbox" id="settings-night-toggle" ${nightModeOn ? 'checked' : ''} style="opacity:0;width:0;height:0;">
        <span style="position:absolute;inset:0;background:${nightModeOn ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'};border-radius:11px;transition:0.2s;"></span>
        <span style="position:absolute;top:2px;left:${nightModeOn ? '20px' : '2px'};width:18px;height:18px;background:#fff;border-radius:50%;transition:0.2s;"></span>
      </label>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div>
        <div style="font-size:13px;">Notification Sound</div>
        <div style="font-size:11px;color:#6a6a8a;">Play sound on state changes</div>
      </div>
      <label style="position:relative;display:inline-block;width:40px;height:22px;cursor:pointer;">
        <input type="checkbox" id="settings-sound-toggle" ${_getters.getNotificationSoundEnabled() ? 'checked' : ''} style="opacity:0;width:0;height:0;">
        <span style="position:absolute;inset:0;background:${_getters.getNotificationSoundEnabled() ? 'rgba(var(--accent-rgb),0.5)' : 'rgba(255,255,255,0.1)'};border-radius:11px;transition:0.2s;"></span>
        <span style="position:absolute;top:2px;left:${_getters.getNotificationSoundEnabled() ? '20px' : '2px'};width:18px;height:18px;background:#fff;border-radius:50%;transition:0.2s;"></span>
      </label>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div>
        <div style="font-size:13px;">Auto-Remove Done Notifications</div>
        <div style="font-size:11px;color:#6a6a8a;">Automatically dismiss "Task complete" after 15s</div>
      </div>
      <label style="position:relative;display:inline-block;width:40px;height:22px;cursor:pointer;">
        <input type="checkbox" id="settings-auto-remove-done-toggle" ${_getters.getAutoRemoveDoneNotifs() ? 'checked' : ''} style="opacity:0;width:0;height:0;">
        <span style="position:absolute;inset:0;background:${_getters.getAutoRemoveDoneNotifs() ? 'rgba(var(--accent-rgb),0.5)' : 'rgba(255,255,255,0.1)'};border-radius:11px;transition:0.2s;"></span>
        <span style="position:absolute;top:2px;left:${_getters.getAutoRemoveDoneNotifs() ? '20px' : '2px'};width:18px;height:18px;background:#fff;border-radius:50%;transition:0.2s;"></span>
      </label>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div>
        <div style="font-size:13px;">Focus on Hover</div>
        <div style="font-size:11px;color:#6a6a8a;">Hover to focus panes (off = click to focus)</div>
      </div>
      <label style="position:relative;display:inline-block;width:40px;height:22px;cursor:pointer;">
        <input type="checkbox" id="settings-focus-mode-toggle" ${focusMode === 'hover' ? 'checked' : ''} style="opacity:0;width:0;height:0;">
        <span style="position:absolute;inset:0;background:${focusMode === 'hover' ? 'rgba(var(--accent-rgb),0.5)' : 'rgba(255,255,255,0.1)'};border-radius:11px;transition:0.2s;"></span>
        <span style="position:absolute;top:2px;left:${focusMode === 'hover' ? '20px' : '2px'};width:18px;height:18px;background:#fff;border-radius:50%;transition:0.2s;"></span>
      </label>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div>
        <div style="font-size:13px;">Snooze Duration</div>
        <div style="font-size:11px;color:#6a6a8a;">How long to mute per terminal</div>
      </div>
      <span id="settings-snooze-slot"></span>
    </div>

    <div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div style="font-size:13px;margin-bottom:8px;">Canvas Background</div>
      <div id="settings-bg-list" style="display:flex;gap:6px;flex-wrap:wrap;">
        ${Object.entries(CANVAS_BACKGROUNDS).map(([key, bg]) => {
          const isSel = key === currentCanvasBg;
          return `<div class="settings-bg-item" data-bg="${key}" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;cursor:pointer;background:${isSel ? 'rgba(var(--accent-rgb),0.2)' : 'rgba(255,255,255,0.03)'};border:1px solid ${isSel ? 'rgba(var(--accent-rgb),0.4)' : 'rgba(255,255,255,0.06)'};transition:all 0.15s ease;">
            <span style="width:16px;height:16px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:${bg.color};${bg.grid ? 'background-image:linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px);background-size:4px 4px;' : ''}"></span>
            <span style="font-size:12px;">${bg.name}</span>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div id="settings-theme-header" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;">
        <div style="font-size:13px;">Terminal Theme</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="display:flex;gap:1px;">${curThemeDots}</span>
          <span style="font-size:12px;color:#6a6a8a;">${curTheme.name}</span>
          <span id="settings-theme-arrow" style="font-size:10px;color:#6a6a8a;transition:transform 0.2s;">\u25B6</span>
        </div>
      </div>
      <div id="settings-theme-body" style="display:none;margin-top:8px;">
        <input id="settings-theme-search" type="text" placeholder="Search themes..." style="width:100%;padding:5px 8px;margin-bottom:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#e0e0e0;font-size:12px;font-family:inherit;outline:none;box-sizing:border-box;" />
        <div id="settings-theme-list" style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;"></div>
      </div>
    </div>

    <div style="padding:12px 0;">
      <div id="settings-font-header" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;">
        <div style="font-size:13px;">Terminal Font</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:12px;color:#6a6a8a;font-family:'${_getters.getCurrentTerminalFont()}',monospace;">${_getters.getCurrentTerminalFont()}</span>
          <span id="settings-font-arrow" style="font-size:10px;color:#6a6a8a;transition:transform 0.2s;">\u25B6</span>
        </div>
      </div>
      <div id="settings-font-body" style="display:none;margin-top:8px;">
        <input id="settings-font-search" type="text" placeholder="Search fonts..." style="width:100%;padding:5px 8px;margin-bottom:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#e0e0e0;font-size:12px;font-family:inherit;outline:none;box-sizing:border-box;" />
        <div id="settings-font-list" style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;"></div>
      </div>
    </div>

    <div style="padding:12px 0;border-top:1px solid rgba(255,255,255,0.06);">
      <div id="settings-hotkeys-header" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;">
        <div style="font-size:13px;">Keyboard Shortcuts</div>
        <span id="settings-hotkeys-arrow" style="font-size:10px;color:#6a6a8a;transition:transform 0.2s;">\u25B6</span>
      </div>
      <div id="settings-hotkeys-body" style="display:none;margin-top:10px;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px;">
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Tab Q</kbd><span style="color:#9999b8;">Cycle terminals</span>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Tab A</kbd><span style="color:#9999b8;">Add menu</span>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Tab D</kbd><span style="color:#9999b8;">Toggle fleet pane</span>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Tab U</kbd><span style="color:#9999b8;">Toggle usage pane</span>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Tab S</kbd><span style="color:#9999b8;">Settings</span>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Tab W</kbd><span style="color:#9999b8;">Close pane (all if broadcast)</span>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Shift+Click</kbd><span style="color:#9999b8;">Broadcast select</span>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Esc</kbd><span style="color:#9999b8;">Clear broadcast / cancel</span>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Ctrl+Shift+2</kbd><span style="color:#9999b8;">Mention</span>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Tab Tab</kbd><span style="color:#9999b8;">Enter move mode</span>
        <div style="grid-column:1/3;padding:4px 0 2px 8px;color:#7a7a9a;font-size:11px;border-left:2px solid rgba(255,255,255,0.06);">
          <div style="margin-bottom:3px;"><kbd style="background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:3px;font-family:inherit;color:#aaa;font-size:11px;">WASD</kbd> / <kbd style="background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:3px;font-family:inherit;color:#aaa;font-size:11px;">Arrows</kbd> Navigate between panes</div>
          <div style="margin-bottom:3px;"><kbd style="background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:3px;font-family:inherit;color:#aaa;font-size:11px;">Enter</kbd> / <kbd style="background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:3px;font-family:inherit;color:#aaa;font-size:11px;">Tab</kbd> Select pane &amp; keep zoom</div>
          <div><kbd style="background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:3px;font-family:inherit;color:#aaa;font-size:11px;">Esc</kbd> Cancel &amp; restore original zoom</div>
        </div>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Ctrl+Scroll</kbd><span style="color:#9999b8;">Zoom canvas</span>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Scroll</kbd><span style="color:#9999b8;">Pan canvas / scroll terminal</span>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Ctrl +/-/0</kbd><span style="color:#9999b8;">Zoom pane (focused) or canvas</span>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Shift+Scroll</kbd><span style="color:#9999b8;">Pan canvas (over panes)</span>
        <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:inherit;color:#ccc;">Middle-drag</kbd><span style="color:#9999b8;">Pan canvas (anywhere)</span>
      </div>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Close handlers
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('settings-close-btn').addEventListener('click', close);

  // Escape key
  const escHandler = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);

  // Logout
  document.getElementById('settings-logout-btn').addEventListener('click', async () => {
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'include' }); } catch(e) {}
    window.location.href = '/login';
  });

  // Night mode toggle
  const nightToggle = document.getElementById('settings-night-toggle');
  nightToggle.addEventListener('change', () => {
    const on = nightToggle.checked;
    setNightMode(on);
    // Update toggle visual
    const track = nightToggle.nextElementSibling;
    const knob = track.nextElementSibling;
    track.style.background = on ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)';
    knob.style.left = on ? '20px' : '2px';
    savePrefsToCloud({ nightMode: on });
  });

  // Sound toggle
  const soundToggle = document.getElementById('settings-sound-toggle');
  soundToggle.addEventListener('change', () => {
    const on = soundToggle.checked;
    _getters.setNotificationSoundEnabled(on);
    _setSoundEnabled(on);
    const track = soundToggle.nextElementSibling;
    const knob = track.nextElementSibling;
    track.style.background = on ? 'rgba(var(--accent-rgb),0.5)' : 'rgba(255,255,255,0.1)';
    knob.style.left = on ? '20px' : '2px';
    savePrefsToCloud({ notificationSound: on });
  });

  // Auto-remove done notifications toggle
  const autoRemoveToggle = document.getElementById('settings-auto-remove-done-toggle');
  autoRemoveToggle.addEventListener('change', () => {
    const on = autoRemoveToggle.checked;
    _getters.setAutoRemoveDoneNotifs(on);
    const track = autoRemoveToggle.nextElementSibling;
    const knob = track.nextElementSibling;
    track.style.background = on ? 'rgba(var(--accent-rgb),0.5)' : 'rgba(255,255,255,0.1)';
    knob.style.left = on ? '20px' : '2px';
    savePrefsToCloud({ autoRemoveDone: on });
  });

  // Focus mode toggle (hover vs click)
  const focusModeToggle = document.getElementById('settings-focus-mode-toggle');
  focusModeToggle.addEventListener('change', () => {
    const hover = focusModeToggle.checked;
    _getters.setFocusMode(hover ? 'hover' : 'click');
    const track = focusModeToggle.nextElementSibling;
    const knob = track.nextElementSibling;
    track.style.background = hover ? 'rgba(var(--accent-rgb),0.5)' : 'rgba(255,255,255,0.1)';
    knob.style.left = hover ? '20px' : '2px';
    savePrefsToCloud({ focusMode: _getters.getFocusMode() });
  });

  // Snooze duration — custom dropdown
  const snoozeSlot = document.getElementById('settings-snooze-slot');
  const snoozeSelect = createCustomSelect(
    [
      { value: '30', label: '30s' },
      { value: '60', label: '60s' },
      { value: '90', label: '90s' },
      { value: '300', label: '5min' },
      { value: '600', label: '10min' }
    ],
    String(_getters.getSnoozeDurationMs() / 1000),
    (val) => {
      _getters.setSnoozeDurationMs(parseInt(val) * 1000);
      savePrefsToCloud({ snoozeDuration: parseInt(val) });
    }
  );
  snoozeSlot.appendChild(snoozeSelect.el);

  // Canvas background selection
  document.getElementById('settings-bg-list').addEventListener('click', (e) => {
    const item = e.target.closest('.settings-bg-item');
    if (!item) return;
    const bgKey = item.dataset.bg;
    setCanvasBackground(bgKey);
    document.querySelectorAll('.settings-bg-item').forEach(el => {
      const isSel = el.dataset.bg === bgKey;
      el.style.background = isSel ? 'rgba(var(--accent-rgb),0.2)' : 'rgba(255,255,255,0.03)';
      el.style.borderColor = isSel ? 'rgba(var(--accent-rgb),0.4)' : 'rgba(255,255,255,0.06)';
    });
    savePrefsToCloud({ canvasBg: bgKey });
  });

  // === Collapsible Theme Picker ===
  const themeBody = document.getElementById('settings-theme-body');
  const themeArrow = document.getElementById('settings-theme-arrow');
  const themeSearch = document.getElementById('settings-theme-search');
  const themeList = document.getElementById('settings-theme-list');

  function renderThemeList(filter) {
    const f = (filter || '').toLowerCase();
    let html = '';
    for (const [key, t] of Object.entries(TERMINAL_THEMES)) {
      if (f && !t.name.toLowerCase().includes(f) && !key.includes(f)) continue;
      const isSel = key === currentTerminalTheme;
      const dots = [t.red, t.green, t.blue, t.yellow, t.magenta, t.cyan].filter(Boolean)
        .map(c => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:2px;"></span>`).join('');
      html += `<div class="settings-theme-item" data-theme="${key}" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;cursor:pointer;background:${isSel ? 'rgba(var(--accent-rgb),0.2)' : 'transparent'};border:1px solid ${isSel ? 'rgba(var(--accent-rgb),0.4)' : 'transparent'};transition:all 0.15s ease;">
        <span style="min-width:16px;text-align:center;font-size:12px;">${isSel ? '\u2713' : ''}</span>
        <span style="font-size:13px;flex:1;">${t.name}</span>
        <span style="display:flex;gap:1px;">${dots}</span>
      </div>`;
    }
    themeList.innerHTML = html || '<div style="font-size:12px;color:#6a6a8a;padding:6px;">No matching themes</div>';
  }

  document.getElementById('settings-theme-header').addEventListener('click', () => {
    const open = themeBody.style.display === 'none';
    themeBody.style.display = open ? 'block' : 'none';
    themeArrow.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
    if (open) { renderThemeList(''); themeSearch.value = ''; themeSearch.focus(); }
  });

  themeSearch.addEventListener('input', (e) => renderThemeList(e.target.value));
  themeSearch.addEventListener('click', (e) => e.stopPropagation());

  themeList.addEventListener('click', (e) => {
    const item = e.target.closest('.settings-theme-item');
    if (!item) return;
    const themeKey = item.dataset.theme;
    applyTerminalTheme(themeKey);
    renderThemeList(themeSearch.value);
    // Update collapsed preview
    const t = TERMINAL_THEMES[themeKey];
    const headerPreview = document.getElementById('settings-theme-header').querySelector('div:last-child');
    const dots = [t.red, t.green, t.blue, t.yellow, t.magenta, t.cyan].filter(Boolean)
      .map(c => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:2px;"></span>`).join('');
    headerPreview.innerHTML = `<span style="display:flex;gap:1px;">${dots}</span><span style="font-size:12px;color:#6a6a8a;">${t.name}</span><span id="settings-theme-arrow" style="font-size:10px;color:#6a6a8a;transform:rotate(90deg);transition:transform 0.2s;">\u25B6</span>`;
    savePrefsToCloud({ terminalTheme: themeKey });
  });

  // === Collapsible Font Picker ===
  const fontBody = document.getElementById('settings-font-body');
  const fontArrow = document.getElementById('settings-font-arrow');
  const fontSearch = document.getElementById('settings-font-search');
  const fontList = document.getElementById('settings-font-list');

  function renderFontList(filter) {
    const f = (filter || '').toLowerCase();
    let html = '';
    for (const font of TERMINAL_FONTS) {
      if (f && !font.toLowerCase().includes(f)) continue;
      const isSel = font === currentTerminalFont;
      html += `<div class="settings-font-item" data-font="${font}" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;cursor:pointer;background:${isSel ? 'rgba(var(--accent-rgb),0.2)' : 'transparent'};border:1px solid ${isSel ? 'rgba(var(--accent-rgb),0.4)' : 'transparent'};transition:all 0.15s ease;">
        <span style="min-width:16px;text-align:center;font-size:12px;">${isSel ? '\u2713' : ''}</span>
        <span style="font-size:13px;font-family:'${font}',monospace;">${font}</span>
      </div>`;
    }
    fontList.innerHTML = html || '<div style="font-size:12px;color:#6a6a8a;padding:6px;">No matching fonts</div>';
  }

  document.getElementById('settings-font-header').addEventListener('click', () => {
    const open = fontBody.style.display === 'none';
    fontBody.style.display = open ? 'block' : 'none';
    fontArrow.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
    if (open) { renderFontList(''); fontSearch.value = ''; fontSearch.focus(); }
  });

  fontSearch.addEventListener('input', (e) => renderFontList(e.target.value));
  fontSearch.addEventListener('click', (e) => e.stopPropagation());

  fontList.addEventListener('click', (e) => {
    const item = e.target.closest('.settings-font-item');
    if (!item) return;
    const fontName = item.dataset.font;
    applyTerminalFont(fontName);
    renderFontList(fontSearch.value);
    // Update collapsed preview
    const headerPreview = document.getElementById('settings-font-header').querySelector('div:last-child');
    headerPreview.innerHTML = `<span style="font-size:12px;color:#6a6a8a;font-family:'${fontName}',monospace;">${fontName}</span><span id="settings-font-arrow" style="font-size:10px;color:#6a6a8a;transform:rotate(90deg);transition:transform 0.2s;">\u25B6</span>`;
    savePrefsToCloud({ terminalFont: fontName });
  });

  // === Collapsible Keyboard Shortcuts ===
  const hotkeysBody = document.getElementById('settings-hotkeys-body');
  const hotkeysArrow = document.getElementById('settings-hotkeys-arrow');
  document.getElementById('settings-hotkeys-header').addEventListener('click', () => {
    const open = hotkeysBody.style.display === 'none';
    hotkeysBody.style.display = open ? 'grid' : 'none';
    hotkeysArrow.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
  });
}

// Send WebSocket message (agentId defaults to activeAgentId for backward compat)
