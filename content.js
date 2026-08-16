(() => {
  'use strict';

  const DEFAULTS = {
    seconds: 85,
    shortcut: { key: 'arrowright', code: 'ArrowRight', ctrl: false, alt: false, shift: true },
  };

  const BTN_CLASS = 'bff-ctrl-btn';
  const BTN_TEXT_CLASS = 'bff-btn-text';

  let config = { seconds: DEFAULTS.seconds, shortcut: { ...DEFAULTS.shortcut } };

  // 扩展环境使用 chrome.storage；直接在页面中引入本文件（本地测试）时退回默认值
  const storageArea =
    typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync
      ? chrome.storage.sync
      : null;

  function loadConfig() {
    if (!storageArea) return;
    const apply = () =>
      storageArea.get(DEFAULTS).then((cfg) => {
        config = cfg;
        updateButtonLabel();
      });
    apply();
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((_changes, area) => {
        if (area === 'sync') apply();
      });
    }
  }

  function getVideo() {
    return document.querySelector(
      '.bpx-player-video-wrap video, .bpx-player-container video, video'
    );
  }

  function fastForward() {
    const video = getVideo();
    // 直播等无限时长的媒体不做快进
    if (!video || !isFinite(video.duration) || video.duration <= 0) return false;
    video.currentTime = Math.max(
      0,
      Math.min(video.currentTime + config.seconds, video.duration - 0.1)
    );
    return true;
  }

  function updateButtonLabel(btn) {
    btn = btn || document.querySelector('.' + BTN_CLASS);
    if (!btn) return;
    const text = btn.querySelector('.' + BTN_TEXT_CLASS);
    if (text) text.textContent = `快进${config.seconds}s`;
    btn.title = `一键快进 ${config.seconds} 秒`;
  }

  function buildButton() {
    const btn = document.createElement('div');
    btn.className = `bpx-player-ctrl-btn ${BTN_CLASS}`;
    btn.title = `一键快进 ${config.seconds} 秒`;
    btn.innerHTML =
      '<svg class="bff-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">' +
      '<path d="M4.5 5.2l7.6 6.8-7.6 6.8V5.2z"></path>' +
      '<path d="M12.9 5.2l7.6 6.8-7.6 6.8V5.2z"></path>' +
      '</svg>' +
      `<span class="${BTN_TEXT_CLASS}"></span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      fastForward();
    });
    updateButtonLabel(btn);
    return btn;
  }

  // 插入到「清晰度」按钮左侧；旧版播放器或无清晰度按钮时依次回退
  function ensureButton() {
    if (document.querySelector('.' + BTN_CLASS)) return;
    const anchor =
      document.querySelector('.bpx-player-ctrl-quality') ||
      document.querySelector('.squirtle-quality') ||
      document.querySelector('.bpx-player-ctrl-setting');
    const container = anchor
      ? anchor.parentElement
      : document.querySelector('.bpx-player-control-bottom-right');
    if (!container) return;
    const btn = buildButton();
    if (anchor) container.insertBefore(btn, anchor);
    else container.appendChild(btn);
  }

  let ensureScheduled = false;
  function scheduleEnsure() {
    if (ensureScheduled) return;
    ensureScheduled = true;
    const run = () => {
      ensureScheduled = false;
      ensureButton();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 50);
  }

  function isTypingTarget(el) {
    if (!el || typeof el.closest !== 'function') return false;
    return !!el.closest(
      'input, textarea, select, [contenteditable="true"], [contenteditable=""]'
    );
  }

  function matchesShortcut(e) {
    const sc = config.shortcut;
    if (!sc || !sc.key) return false;
    let key = e.key || '';
    key = key === ' ' ? 'space' : key.toLowerCase();
    const keyHit = key === sc.key || (sc.code && e.code === sc.code);
    if (!keyHit) return false;
    return e.ctrlKey === !!sc.ctrl && e.altKey === !!sc.alt && e.shiftKey === !!sc.shift;
  }

  // window + 捕获阶段：先于B站播放器自身的快捷键处理
  window.addEventListener(
    'keydown',
    (e) => {
      if (isTypingTarget(e.target)) return;
      if (!matchesShortcut(e)) return;
      if (!fastForward()) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });
  // 兜底：B站是 SPA，切页/全屏后控件可能重建
  setInterval(ensureButton, 1000);
  ensureButton();
  loadConfig();
})();
