const POPUP_I18N = {
  en: {
    title: 'GitHub Release Downloads',
    tokenLabel: 'Personal Access Token (optional)',
    tokenHelp: 'Raises API limit from 60/hr to 5,000/hr and enables private repositories.',
    createToken: 'Create token',
    langLabel: 'Language',
    langAuto: 'Auto (Browser)',
    ttlLabel: 'Cache TTL',
    min5: '5 min',
    min15: '15 min',
    min30: '30 min',
    min60: '60 min',
    saveBtn: 'Save',
    clearCacheBtn: 'Clear cache',
    checking: 'Checking...',
    saved: 'Saved',
    invalidToken: 'Invalid token',
    cleared: 'Cleared ({count})'
  },
  tr: {
    title: 'GitHub Sürüm İndirmeleri',
    tokenLabel: 'Personal Access Token (opsiyonel)',
    tokenHelp: "API limitini saatte 60'tan 5.000'e çıkarır ve özel (private) repoları destekler.",
    createToken: 'Token oluştur',
    langLabel: 'Dil',
    langAuto: 'Otomatik (Tarayıcı)',
    ttlLabel: 'Önbellek Süresi',
    min5: '5 dk',
    min15: '15 dk',
    min30: '30 dk',
    min60: '60 dk',
    saveBtn: 'Kaydet',
    clearCacheBtn: 'Önbelleği temizle',
    checking: 'Doğrulanıyor...',
    saved: 'Kaydedildi',
    invalidToken: 'Geçersiz token',
    cleared: 'Temizlendi ({count})'
  }
};

function detectBrowserLang() {
  return (navigator.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

function resolveLang(setting) {
  if (setting === 'tr' || setting === 'en') return setting;
  return detectBrowserLang();
}

document.addEventListener('DOMContentLoaded', async () => {
  const rateText = document.getElementById('rate-text');
  const tokenInput = document.getElementById('token-input');
  const langSelect = document.getElementById('lang-select');
  const cacheTtlSelect = document.getElementById('cache-ttl-select');
  const clearCacheBtn = document.getElementById('clear-cache-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const statusMsg = document.getElementById('status-msg');

  let activeLang = detectBrowserLang();

  function t(key, vars = {}) {
    const dict = POPUP_I18N[activeLang] || POPUP_I18N.en;
    let str = dict[key] || POPUP_I18N.en[key] || key;
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
    return str;
  }

  function applyTranslations() {
    document.getElementById('ui-title').textContent = t('title');
    document.getElementById('ui-token-label').textContent = t('tokenLabel');
    document.getElementById('ui-token-help').textContent = t('tokenHelp');
    document.getElementById('ui-create-token').textContent = t('createToken');
    document.getElementById('ui-lang-label').textContent = t('langLabel');
    document.getElementById('ui-lang-auto').textContent = t('langAuto');
    document.getElementById('ui-ttl-label').textContent = t('ttlLabel');
    document.getElementById('ui-ttl-5').textContent = t('min5');
    document.getElementById('ui-ttl-15').textContent = t('min15');
    document.getElementById('ui-ttl-30').textContent = t('min30');
    document.getElementById('ui-ttl-60').textContent = t('min60');
    saveSettingsBtn.textContent = t('saveBtn');
    clearCacheBtn.textContent = t('clearCacheBtn');
  }

  function setStatus(text, isError = false) {
    statusMsg.textContent = text;
    statusMsg.className = isError ? 'status error' : 'status';
  }

  function updateRateDisplay(rl) {
    if (!rl || typeof rl.limit !== 'number') {
      rateText.textContent = 'API: --/--';
      return;
    }
    rateText.textContent = `API: ${rl.remaining}/${rl.limit}`;
  }

  const stored = await chrome.storage.local.get([
    'githubToken',
    'cacheTtlMinutes',
    'language',
    'rateLimit'
  ]);
  if (stored.githubToken) tokenInput.value = stored.githubToken;
  if (stored.cacheTtlMinutes) cacheTtlSelect.value = String(stored.cacheTtlMinutes);
  if (stored.language) langSelect.value = stored.language;

  activeLang = resolveLang(stored.language || 'auto');
  applyTranslations();
  updateRateDisplay(stored.rateLimit);

  chrome.runtime.sendMessage({ type: 'CHECK_RATE_LIMIT' }, (res) => {
    if (res && res.ok && res.data) updateRateDisplay(res.data);
  });

  // Apply language switch immediately when changed
  langSelect.addEventListener('change', async () => {
    const language = langSelect.value;
    activeLang = resolveLang(language);
    applyTranslations();
    await chrome.storage.local.set({ language });
  });

  saveSettingsBtn.addEventListener('click', async () => {
    const githubToken = tokenInput.value.trim();
    const cacheTtlMinutes = parseInt(cacheTtlSelect.value, 10) || 15;
    const language = langSelect.value;
    setStatus(t('checking'));

    chrome.runtime.sendMessage({ type: 'CHECK_RATE_LIMIT', token: githubToken }, async (res) => {
      if (res && res.ok && res.data) {
        await chrome.storage.local.set({ githubToken, cacheTtlMinutes, language });
        updateRateDisplay(res.data);
        setStatus(t('saved'));
      } else {
        setStatus(t('invalidToken'), true);
      }
    });
  });

  clearCacheBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, (res) => {
      if (res && res.ok) {
        setStatus(t('cleared', { count: res.clearedCount || 0 }));
      }
    });
  });
});
