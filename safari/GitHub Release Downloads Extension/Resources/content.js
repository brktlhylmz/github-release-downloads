// Content Script - GitHub Release Downloads (Native Primer UI + i18n + Platform & Delta Insights)

(() => {
  const RESERVED_PATHS = new Set([
    'settings',
    'notifications',
    'explore',
    'trending',
    'marketplace',
    'sponsors',
    'topics',
    'collections',
    'events',
    'codespaces',
    'features',
    'enterprise',
    'pricing',
    'about',
    'contact',
    'security',
    'login',
    'join',
    'signup',
    'session',
    'orgs',
    'organizations',
    'users',
    'search',
    'pulls',
    'issues',
    'gist',
    'new',
    'import',
    'dashboard',
    'account',
    'billing',
    'watching',
    'stars',
    'copilot',
    'customer-stories',
    'readme',
    'team'
  ]);

  const I18N = {
    en: {
      downloadsBtn: 'Downloads',
      downloadsLower: 'downloads',
      totalDownloadsLower: 'total downloads',
      loadingTooltip: 'Loading release downloads...',
      totalTooltip: '{total} total downloads across {releases} releases',
      deltaTooltip: ' (+{delta} since last check)',
      releaseMetaTooltip: '{total} total downloads across {assets} assets',
      overlayTitle: 'Downloads',
      overlaySubtitle: '{total} total{delta} · {releases} releases',
      osLabel: 'OS:',
      archLabel: 'Arch:',
      filterByPlatformTitle: 'Click to filter by {name} ({count} downloads)',
      filterPlaceholder: 'Filter releases or assets...',
      sortLatest: 'Sort: Latest',
      sortTop: 'Sort: Most downloaded',
      sortAssetsBtn: 'Sort by downloads',
      sortedAssetsBtn: 'Sorted by downloads ↓',
      prerelease: 'Pre-release',
      sourceOnly: 'Source code only (0 binary assets)',
      noReleases: 'No releases published in this repository.',
      noAssets: 'Releases exist, but no downloadable build assets are attached.',
      viewAllReleases: 'View all releases',
      loading: 'Loading...',
      retry: 'Retry',
      refresh: 'Refresh',
      close: 'Close',
      errPrivateToken:
        'This is a private repository. Add a Personal Access Token in the extension popup to view download counts.',
      errRateLimit:
        'GitHub API rate limit exceeded{reset}. Add a Personal Access Token in the extension popup for 5,000 requests/hr.',
      errUnauthorized: 'Invalid or expired GitHub token. Check extension settings.',
      errGeneric: 'Failed to load release downloads.'
    },
    tr: {
      downloadsBtn: 'İndirmeler',
      downloadsLower: 'indirme',
      totalDownloadsLower: 'toplam indirme',
      loadingTooltip: 'Sürüm indirme sayıları yükleniyor...',
      totalTooltip: '{releases} sürümde toplam {total} indirme',
      deltaTooltip: ' (son ziyaretten beri +{delta})',
      releaseMetaTooltip: '{assets} dosyada toplam {total} indirme',
      overlayTitle: 'İndirmeler',
      overlaySubtitle: '{total} toplam{delta} · {releases} sürüm',
      osLabel: 'İS:',
      archLabel: 'Mimari:',
      filterByPlatformTitle: '{name} için filtrele ({count} indirme)',
      filterPlaceholder: 'Sürüm veya dosya ara...',
      sortLatest: 'Sırala: En yeni',
      sortTop: 'Sırala: En çok indirilen',
      sortAssetsBtn: 'İndirmeye göre sırala',
      sortedAssetsBtn: 'İndirmeye göre sıralandı ↓',
      prerelease: 'Ön sürüm',
      sourceOnly: 'Yalnızca kaynak kodu (ekli dosya yok)',
      noReleases: 'Bu repoda henüz yayınlanmış bir sürüm (release) yok.',
      noAssets: 'Sürüm mevcut ancak indirilebilir build/dosya eklenmemiş.',
      viewAllReleases: 'Tüm sürümleri görüntüle',
      loading: 'Yükleniyor...',
      retry: 'Tekrar dene',
      refresh: 'Yenile',
      close: 'Kapat',
      errPrivateToken:
        'Bu özel (private) bir repo. İndirme sayılarını görmek için eklenti menüsünden GitHub Token (PAT) ekleyin.',
      errRateLimit:
        'GitHub API saatlik istek limiti doldu{reset}. Limiti 5.000/saat yapmak için eklenti menüsünden Token ekleyin.',
      errUnauthorized: 'GitHub Token geçersiz veya süresi dolmuş. Eklenti ayarlarını kontrol edin.',
      errGeneric: 'İndirme verileri alınamadı.'
    }
  };

  let currentLang = detectBrowserLang();
  let currentRepoKey = null;
  let currentRepoData = null;
  let currentError = null;
  let isLoading = false;
  let isPopoverOpen = false;
  let overlaySortBy = 'latest'; // 'latest' | 'downloads'
  let activePlatformFilter = null; // e.g. 'os:macOS' or 'arch:arm64'
  let extraReleasesByTag = new Map();
  let renderScheduled = false;

  const OCTICONS = {
    download: `<svg aria-hidden="true" focusable="false" class="octicon octicon-download" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="display:inline-block;vertical-align:text-bottom"><path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"></path><path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z"></path></svg>`,
    chevronRight: `<svg aria-hidden="true" focusable="false" class="octicon octicon-chevron-right" viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"></path></svg>`,
    x: `<svg aria-hidden="true" focusable="false" class="octicon octicon-x" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path></svg>`,
    sync: `<svg aria-hidden="true" focusable="false" class="octicon octicon-sync" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"></path></svg>`
  };

  function detectBrowserLang() {
    const nav = (navigator.language || 'en').toLowerCase();
    return nav.startsWith('tr') ? 'tr' : 'en';
  }

  function resolveLang(setting) {
    if (setting === 'tr' || setting === 'en') return setting;
    return detectBrowserLang();
  }

  function t(key, vars = {}) {
    const dict = I18N[currentLang] || I18N.en;
    let str = dict[key] || I18N.en[key] || key;
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
    return str;
  }

  function formatCompact(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    if (num < 1000) return String(num);
    if (num < 1000000) {
      return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    }
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
  }

  function formatExact(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString(currentLang === 'tr' ? 'tr-TR' : 'en-US');
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeUrl(url) {
    if (!url) return '#';
    const str = String(url).trim();
    if (str.startsWith('https://') || str.startsWith('/')) {
      return escapeHtml(str);
    }
    return '#';
  }

  // Classify an asset filename into OS and CPU Architecture
  function classifyAssetPlatform(filename) {
    const lower = String(filename || '').toLowerCase();

    // Ignore checksums, signatures, metadata, and source files
    if (
      /\.(sha256|sha512|sha1|md5|sig|asc|gpg|pem|pub|txt|json|sbom|spdx|blockmap|yml|yaml|msi\.wixpdb)$/i.test(
        lower
      ) ||
      lower.includes('checksum') ||
      lower.includes('shasum')
    ) {
      return { os: null, arch: null };
    }

    let os = null;
    if (
      /\.(dmg|pkg)$/i.test(lower) ||
      /(macos|darwin|osx|apple-darwin|mac[_.-]|[-_.]mac[_.-]|[-_.]mac\.)/i.test(lower)
    ) {
      os = 'macOS';
    } else if (
      /\.(exe|msi|msix|appx|nupkg)$/i.test(lower) ||
      /(windows|win64|win32|[-_.]win[_.-]|[-_.]win\.|pc-windows|msvc|mingw)/i.test(lower)
    ) {
      os = 'Windows';
    } else if (/\.(aab)$/i.test(lower) || /android/i.test(lower) || (/\.apk$/i.test(lower) && !/(linux|alpine)/i.test(lower))) {
      os = 'Android';
    } else if (/\.(ipa)$/i.test(lower) || /(iphoneos|[-_.]ios[_.-])/i.test(lower)) {
      os = 'iOS';
    } else if (
      /\.(deb|rpm|appimage|snap|flatpak|pacman)$/i.test(lower) ||
      /(linux|ubuntu|debian|fedora|centos|rhel|archlinux|alpine|unknown-linux)/i.test(lower)
    ) {
      os = 'Linux';
    } else if (/(freebsd|openbsd|netbsd)/i.test(lower)) {
      os = 'BSD';
    }

    let arch = null;
    if (/(universal|all-arch)/i.test(lower)) {
      arch = 'universal';
    } else if (/(arm64|aarch64|armv8|apple-silicon)/i.test(lower)) {
      arch = 'arm64';
    } else if (/(x86_64|x86-64|amd64|x64|win64)/i.test(lower)) {
      arch = 'x64';
    } else if (/(armv7|armv6|armhf|armel)/i.test(lower)) {
      arch = 'armv7';
    } else if (/(i386|i686|ia32|win32|[-_.]386[_.-]|[-_.]x86[_.-])/i.test(lower)) {
      arch = 'x86';
    }

    return { os, arch };
  }

  function computePlatformBreakdown(releases) {
    const osTotals = new Map();
    const archTotals = new Map();
    let totalOsDownloads = 0;
    let totalArchDownloads = 0;

    for (const rel of releases || []) {
      for (const asset of rel.assets || []) {
        const count = Number(asset.download_count) || 0;
        if (count <= 0) continue;
        const { os, arch } = classifyAssetPlatform(asset.name);
        if (os) {
          osTotals.set(os, (osTotals.get(os) || 0) + count);
          totalOsDownloads += count;
        }
        if (arch) {
          archTotals.set(arch, (archTotals.get(arch) || 0) + count);
          totalArchDownloads += count;
        }
      }
    }

    const osList = Array.from(osTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        pct: totalOsDownloads > 0 ? Math.round((count / totalOsDownloads) * 100) : 0
      }))
      .filter((item) => item.pct > 0);

    const archList = Array.from(archTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        pct: totalArchDownloads > 0 ? Math.round((count / totalArchDownloads) * 100) : 0
      }))
      .filter((item) => item.pct > 0);

    return { osList, archList };
  }

  function parseRepoFromLocation() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    const [owner, repo] = parts;
    if (RESERVED_PATHS.has(owner.toLowerCase())) return null;
    if (owner.startsWith('.') || repo.startsWith('.')) return null;

    return {
      owner,
      repo: repo.replace(/\.git$/, ''),
      subpath: parts.slice(2).join('/')
    };
  }

  function inspectRepoDomState(parsed) {
    const visLabel = document.querySelector('[data-testid="repo-visibility-label"], .Label--secondary');
    const visText = visLabel ? (visLabel.textContent || '').trim().toLowerCase() : '';
    const isPrivate = visText === 'private' || visText === 'internal';

    const tagPrefix = `/${parsed.owner}/${parsed.repo}/releases/tag/`.toLowerCase();
    const hasReleaseLinks = Array.from(document.querySelectorAll('a[href*="/releases/tag/"]')).some((a) => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      return href.includes(tagPrefix);
    });

    let explicitlyNoReleases = false;
    const headings = Array.from(document.querySelectorAll('h2'));
    for (const h2 of headings) {
      if ((h2.textContent || '').trim().startsWith('Releases')) {
        const section = h2.closest('div[class*="sidebarSection"], .BorderGrid-cell') || h2.parentElement;
        if (section && !section.querySelector('[data-component="SkeletonText"]')) {
          const secText = (section.textContent || '').toLowerCase();
          if (
            secText.includes('no releases published') ||
            secText.includes('create a new release') ||
            (!section.querySelector('a[href*="/releases/tag/"]') && !secText.includes('releases '))
          ) {
            explicitlyNoReleases = true;
          }
        }
      }
    }

    if (parsed.subpath === 'releases') {
      const blankslate = document.querySelector('#repo-content-pjax-container .blankslate, main .blankslate');
      if (blankslate && !hasReleaseLinks) {
        explicitlyNoReleases = true;
      }
    }

    return { isPrivate, hasReleaseLinks, explicitlyNoReleases };
  }

  function formatApiError(response, parsed) {
    const code = response && response.errorCode;
    if (code === 'RATE_LIMIT') {
      const resetStr = response.rateLimitReset
        ? ` (${new Date(response.rateLimitReset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
        : '';
      return t('errRateLimit', { reset: resetStr });
    }
    if (code === 'UNAUTHORIZED') {
      return t('errUnauthorized');
    }
    if (code === 'NOT_FOUND_OR_PRIVATE') {
      const domState = inspectRepoDomState(parsed);
      if (domState.isPrivate && domState.hasReleaseLinks) {
        return t('errPrivateToken');
      }
      return null;
    }
    return (response && response.error) || t('errGeneric');
  }

  async function init() {
    try {
      const stored = await chrome.storage.local.get(['language']);
      currentLang = resolveLang(stored.language);
    } catch (_) {}

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.language) {
        currentLang = resolveLang(changes.language.newValue);
        clearRenderedSignatures();
        renderAll();
      }
      if (changes.githubToken && currentRepoKey) {
        checkPageAndLoad(true);
      }
    });

    checkPageAndLoad();

    document.addEventListener('turbo:load', () => checkPageAndLoad());
    document.addEventListener('pjax:end', () => checkPageAndLoad());
    window.addEventListener('popstate', () => setTimeout(checkPageAndLoad, 80));

    document.addEventListener('click', (e) => {
      if (!isPopoverOpen) return;
      const item = document.getElementById('gh-dl-header-item');
      if (item && !item.contains(e.target)) {
        closePopover();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isPopoverOpen) {
        closePopover();
      }
    });

    const observer = new MutationObserver(() => {
      if (!currentRepoKey) return;
      scheduleRender();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function clearRenderedSignatures() {
    const headerItem = document.getElementById('gh-dl-header-item');
    if (headerItem) delete headerItem.dataset.sig;
    document.querySelectorAll('.gh-dl-about-stat-row, .gh-dl-sidebar-release-stat').forEach((el) => {
      delete el.dataset.sig;
    });
    document
      .querySelectorAll(
        '.gh-dl-subnav-total, .gh-dl-release-meta-item, .gh-dl-assets-summary-count, .gh-dl-sort-assets-btn, .gh-dl-asset-col'
      )
      .forEach((el) => el.remove());
  }

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      renderAll();
    });
  }

  async function checkPageAndLoad(forceRefresh = false) {
    const parsed = parseRepoFromLocation();
    if (!parsed) {
      currentRepoKey = null;
      currentRepoData = null;
      currentError = null;
      return;
    }

    const repoKey = `${parsed.owner}/${parsed.repo}`;
    const repoChanged = repoKey !== currentRepoKey;

    if (repoChanged) {
      currentRepoKey = repoKey;
      currentRepoData = null;
      currentError = null;
      activePlatformFilter = null;
      extraReleasesByTag.clear();
      isPopoverOpen = false;
    }

    if (repoChanged || forceRefresh || (!currentRepoData && !isLoading)) {
      if (!forceRefresh) {
        const domState = inspectRepoDomState(parsed);
        if (domState.explicitlyNoReleases && !domState.hasReleaseLinks) {
          currentRepoData = {
            owner: parsed.owner,
            repo: parsed.repo,
            totalDownloads: 0,
            deltaTotal: 0,
            totalReleases: 0,
            totalAssets: 0,
            hasMorePages: false,
            releases: [],
            inferredNoReleases: true,
            fetchedAt: Date.now()
          };
          currentError = null;
          isLoading = false;
          renderAll();
          return;
        }
      }

      isLoading = true;
      currentError = null;
      renderAll();

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_REPO_DOWNLOADS',
          owner: parsed.owner,
          repo: parsed.repo,
          forceRefresh
        });

        if (currentRepoKey !== repoKey) return;

        isLoading = false;
        if (response && response.ok && response.data) {
          currentRepoData = response.data;
          currentError = null;
          await ensureCurrentTagReleaseLoaded(parsed);
        } else {
          const errMsg = formatApiError(response, parsed);
          if (errMsg === null) {
            currentRepoData = {
              owner: parsed.owner,
              repo: parsed.repo,
              totalDownloads: 0,
              deltaTotal: 0,
              totalReleases: 0,
              totalAssets: 0,
              hasMorePages: false,
              releases: [],
              inferredNoReleases: true,
              fetchedAt: Date.now()
            };
            currentError = null;
          } else {
            currentError = errMsg;
          }
        }
      } catch (err) {
        if (currentRepoKey !== repoKey) return;
        isLoading = false;
        currentError = err.message || t('errGeneric');
      }
    } else if (currentRepoData) {
      await ensureCurrentTagReleaseLoaded(parsed);
    }

    renderAll();
  }

  async function ensureCurrentTagReleaseLoaded(parsed) {
    if (!parsed || !parsed.subpath.startsWith('releases/tag/')) return;
    const rawTag = parsed.subpath.slice('releases/tag/'.length).split('/')[0];
    if (!rawTag) return;
    const tag = decodeURIComponent(rawTag);

    if (findReleaseByTag(tag)) return;

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'GET_RELEASE_BY_TAG',
        owner: parsed.owner,
        repo: parsed.repo,
        tag
      });
      if (res && res.ok && res.data) {
        extraReleasesByTag.set(tag, res.data);
      }
    } catch (_) {}
  }

  function findReleaseByTag(tag) {
    if (!tag) return null;
    if (currentRepoData && Array.isArray(currentRepoData.releases)) {
      const found = currentRepoData.releases.find(
        (r) => r.tag_name === tag || decodeURIComponent(r.tag_name) === tag
      );
      if (found) return found;
    }
    if (extraReleasesByTag.has(tag)) {
      return extraReleasesByTag.get(tag);
    }
    return null;
  }

  function renderAll() {
    if (!currentRepoKey) return;

    if (currentRepoData && currentRepoData.inferredNoReleases && !isLoading) {
      const parsed = parseRepoFromLocation();
      if (parsed) {
        const domState = inspectRepoDomState(parsed);
        if (domState.hasReleaseLinks) {
          currentRepoData = null;
          checkPageAndLoad(true);
          return;
        }
      }
    }

    renderHeaderAction();
    renderAboutSidebarStat();
    renderSidebarReleasesStat();
    renderReleasesPage();
  }

  // 1. HEADER ACTION BUTTON
  function renderHeaderAction() {
    const actionsList = document.querySelector(
      'ul[data-testid="repo-header-actions"], #repository-container-header ul.pagehead-actions, ul.pagehead-actions'
    );
    if (!actionsList) return;

    let item = document.getElementById('gh-dl-header-item');
    if (!item || item.parentElement !== actionsList) {
      if (item) item.remove();
      item = document.createElement('li');
      item.id = 'gh-dl-header-item';
      item.className = 'gh-dl-header-li';
      actionsList.insertBefore(item, actionsList.firstChild);
    }

    const sig = JSON.stringify({
      lang: currentLang,
      sort: overlaySortBy,
      platformFilter: activePlatformFilter,
      loading: isLoading,
      error: currentError,
      total: currentRepoData ? currentRepoData.totalDownloads : null,
      delta: currentRepoData ? currentRepoData.deltaTotal : null,
      fetchedAt: currentRepoData ? currentRepoData.fetchedAt : null
    });

    if (item.dataset.sig === sig) return;
    item.dataset.sig = sig;

    let countText = '·';
    let tooltip = t('loadingTooltip');
    if (!isLoading && currentError) {
      countText = '0';
      tooltip = currentError;
    } else if (!isLoading && currentRepoData) {
      const delta = currentRepoData.deltaTotal || 0;
      countText =
        delta > 0
          ? `${formatCompact(currentRepoData.totalDownloads)} (+${formatCompact(delta)})`
          : formatCompact(currentRepoData.totalDownloads);
      tooltip =
        t('totalTooltip', {
          total: formatExact(currentRepoData.totalDownloads),
          releases: currentRepoData.totalReleases
        }) + (delta > 0 ? t('deltaTooltip', { delta: formatExact(delta) }) : '');
    }

    const sampleBtn = actionsList.querySelector(
      'a[data-component="Button"], button[data-component="Button"], .btn-sm.btn'
    );
    const sampleContent = sampleBtn ? sampleBtn.querySelector('[data-component="buttonContent"]') : null;
    const sampleVisual = sampleBtn ? sampleBtn.querySelector('[data-component="leadingVisual"]') : null;
    const sampleLabel = sampleBtn ? sampleBtn.querySelector('[data-component="text"]') : null;
    const sampleCounter = actionsList.querySelector('[data-component="CounterLabel"], .Counter');

    const btnClass = sampleBtn ? sampleBtn.className.replace(/IconOnlyWhenNarrow\S*/g, '').trim() : 'btn btn-sm';
    const contentClass = sampleContent ? sampleContent.className : 'gh-dl-btn-content-fallback';
    const visualClass = sampleVisual ? sampleVisual.className : 'gh-dl-btn-visual-fallback';
    const labelClass = sampleLabel ? sampleLabel.className : '';
    const counterClass = sampleCounter ? sampleCounter.className : 'Counter ml-1';

    item.innerHTML = `
      <div class="gh-dl-pos-rel">
        <button
          type="button"
          id="gh-dl-trigger-btn"
          data-component="Button"
          data-size="small"
          data-variant="default"
          class="${escapeHtml(btnClass)} gh-dl-native-btn"
          title="${escapeHtml(tooltip)}"
          aria-label="${escapeHtml(t('downloadsBtn'))}: ${escapeHtml(tooltip)}"
          aria-haspopup="dialog"
          aria-controls="gh-dl-popover"
          aria-expanded="${isPopoverOpen}"
        >
          <span data-component="buttonContent" data-align="center" class="${escapeHtml(contentClass)}">
            <span data-component="leadingVisual" class="${escapeHtml(visualClass)}">
              ${OCTICONS.download}
            </span>
            <span data-component="text" class="${escapeHtml(labelClass)}">
              ${escapeHtml(t('downloadsBtn'))}<span aria-hidden="true" data-variant="secondary" data-component="CounterLabel" class="${escapeHtml(counterClass)}"><span>${escapeHtml(countText)}</span></span>
            </span>
          </span>
        </button>
        <div id="gh-dl-popover" class="gh-dl-overlay ${isPopoverOpen ? 'gh-dl-open' : ''}" role="dialog" aria-label="${escapeHtml(t('overlayTitle'))}">
          ${buildOverlayHTML()}
        </div>
      </div>
    `;

    bindOverlayEvents(item);
  }

  function buildOverlayHTML() {
    if (isLoading) {
      return `
        <div class="gh-dl-overlay-header">
          <span class="gh-dl-overlay-title">${escapeHtml(t('overlayTitle'))}</span>
        </div>
        <div class="gh-dl-overlay-blank">${escapeHtml(t('loading'))}</div>
      `;
    }

    if (currentError) {
      return `
        <div class="gh-dl-overlay-header">
          <span class="gh-dl-overlay-title">${escapeHtml(t('overlayTitle'))}</span>
          <button type="button" class="gh-dl-close-btn" data-action="close" title="${escapeHtml(t('close'))}" aria-label="${escapeHtml(t('close'))}">${OCTICONS.x}</button>
        </div>
        <div class="gh-dl-overlay-blank" role="alert">
          <div class="gh-dl-error-text">${escapeHtml(currentError)}</div>
          <button type="button" class="gh-dl-retry-btn" data-action="refresh">${escapeHtml(t('retry'))}</button>
        </div>
      `;
    }

    if (!currentRepoData) return '';

    const { owner, repo, totalDownloads, deltaTotal = 0, totalReleases, totalAssets, releases } = currentRepoData;

    if (releases.length === 0 || totalAssets === 0) {
      return `
        <div class="gh-dl-overlay-header">
          <span class="gh-dl-overlay-title">${escapeHtml(t('overlayTitle'))}</span>
          <button type="button" class="gh-dl-close-btn" data-action="close" title="${escapeHtml(t('close'))}" aria-label="${escapeHtml(t('close'))}">${OCTICONS.x}</button>
        </div>
        <div class="gh-dl-overlay-blank">
          ${escapeHtml(releases.length === 0 ? t('noReleases') : t('noAssets'))}
        </div>
      `;
    }

    const sortedReleases =
      overlaySortBy === 'downloads'
        ? releases.slice().sort((a, b) => b.total_downloads - a.total_downloads)
        : releases;

    const { osList, archList } = computePlatformBreakdown(releases);
    const hasBreakdown = osList.length > 0 || archList.length > 0;

    const breakdownHTML = hasBreakdown
      ? `
      <div class="gh-dl-breakdown-bar">
        ${
          osList.length > 0
            ? `<div class="gh-dl-breakdown-row">
                <span class="gh-dl-breakdown-lbl">${escapeHtml(t('osLabel'))}</span>
                ${osList
                  .map((item) => {
                    const key = `os:${item.name}`;
                    const isActive = activePlatformFilter === key;
                    const active = isActive ? 'gh-dl-chip-active' : '';
                    return `<button type="button" class="gh-dl-platform-chip ${active}" aria-pressed="${isActive}" data-platform-filter="${escapeHtml(key)}" title="${escapeHtml(
                      t('filterByPlatformTitle', { name: item.name, count: formatExact(item.count) })
                    )}">${escapeHtml(item.name)} <strong>${item.pct}%</strong></button>`;
                  })
                  .join('<span class="gh-dl-dot" aria-hidden="true">·</span>')}
              </div>`
            : ''
        }
        ${
          archList.length > 0
            ? `<div class="gh-dl-breakdown-row">
                <span class="gh-dl-breakdown-lbl">${escapeHtml(t('archLabel'))}</span>
                ${archList
                  .map((item) => {
                    const key = `arch:${item.name}`;
                    const isActive = activePlatformFilter === key;
                    const active = isActive ? 'gh-dl-chip-active' : '';
                    return `<button type="button" class="gh-dl-platform-chip ${active}" aria-pressed="${isActive}" data-platform-filter="${escapeHtml(key)}" title="${escapeHtml(
                      t('filterByPlatformTitle', { name: item.name, count: formatExact(item.count) })
                    )}">${escapeHtml(item.name)} <strong>${item.pct}%</strong></button>`;
                  })
                  .join('<span class="gh-dl-dot" aria-hidden="true">·</span>')}
              </div>`
            : ''
        }
      </div>
    `
      : '';

    const deltaStr = deltaTotal > 0 ? ` (+${formatExact(deltaTotal)})` : '';

    return `
      <div class="gh-dl-overlay-header">
        <div class="gh-dl-overlay-header-left">
          <span class="gh-dl-overlay-title">${escapeHtml(t('overlayTitle'))}</span>
          <span class="gh-dl-overlay-subtitle">${escapeHtml(
            t('overlaySubtitle', {
              total: formatExact(totalDownloads),
              delta: deltaStr,
              releases: totalReleases
            })
          )}</span>
        </div>
        <div class="gh-dl-overlay-header-right">
          <button type="button" class="gh-dl-sort-btn" data-action="toggle-sort">
            ${escapeHtml(overlaySortBy === 'downloads' ? t('sortTop') : t('sortLatest'))}
          </button>
          <button type="button" class="gh-dl-close-btn" data-action="refresh" title="${escapeHtml(t('refresh'))}" aria-label="${escapeHtml(t('refresh'))}">${OCTICONS.sync}</button>
          <button type="button" class="gh-dl-close-btn" data-action="close" title="${escapeHtml(t('close'))}" aria-label="${escapeHtml(t('close'))}">${OCTICONS.x}</button>
        </div>
      </div>
      ${breakdownHTML}
      <div class="gh-dl-overlay-filter">
        <input type="text" id="gh-dl-filter-input" aria-label="${escapeHtml(t('filterPlaceholder'))}" placeholder="${escapeHtml(t('filterPlaceholder'))}" autocomplete="off" spellcheck="false" />
      </div>
      <div class="gh-dl-overlay-list">
        ${sortedReleases.map((rel, i) => renderOverlayRelease(rel, i === 0 && rel.assets.length > 0)).join('')}
      </div>
      <div class="gh-dl-overlay-footer">
        <a href="/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases">${escapeHtml(t('viewAllReleases'))}</a>
      </div>
    `;
  }

  function renderOverlayRelease(rel, expanded) {
    const assets = (rel.assets || []).slice().sort((a, b) => b.download_count - a.download_count);
    const showPct = assets.length > 1 && rel.total_downloads > 0;
    const assetsRows =
      assets.length > 0
        ? assets
            .map((a) => {
              const pct = showPct ? Math.round((a.download_count / rel.total_downloads) * 100) : null;
              const { os, arch } = classifyAssetPlatform(a.name);
              const assetDelta = a.delta_count > 0 ? ` (+${formatExact(a.delta_count)})` : '';
              return `
          <div class="gh-dl-overlay-asset" data-asset-name="${escapeHtml(a.name.toLowerCase())}" data-os="${escapeHtml(os || '')}" data-arch="${escapeHtml(arch || '')}">
            <a href="${sanitizeUrl(a.browser_download_url)}" class="gh-dl-overlay-asset-name" title="${escapeHtml(a.name)} (${formatBytes(a.size)})">${escapeHtml(a.name)}</a>
            <span class="gh-dl-overlay-asset-meta">${formatBytes(a.size)}${pct !== null ? ` · ${pct}%` : ''}</span>
            <span class="gh-dl-overlay-asset-count">${formatExact(a.download_count)}${escapeHtml(assetDelta)}</span>
          </div>
        `;
            })
            .join('')
        : `<div class="gh-dl-overlay-empty-rel">${escapeHtml(t('sourceOnly'))}</div>`;

    const relDelta = rel.delta_downloads > 0 ? ` (+${formatExact(rel.delta_downloads)})` : '';

    return `
      <div class="gh-dl-overlay-rel ${expanded ? 'gh-dl-rel-open' : ''}" data-tag="${escapeHtml((rel.tag_name || '').toLowerCase())}" data-name="${escapeHtml((rel.name || '').toLowerCase())}">
        <div class="gh-dl-overlay-rel-row" role="button" tabindex="0" aria-expanded="${expanded ? 'true' : 'false'}" data-action="toggle-rel">
          <div class="gh-dl-overlay-rel-left">
            <span class="gh-dl-rel-chevron" aria-hidden="true">${OCTICONS.chevronRight}</span>
            <a href="${sanitizeUrl(rel.html_url)}" class="gh-dl-overlay-rel-tag">${escapeHtml(rel.tag_name)}</a>
            ${rel.prerelease ? `<span class="gh-dl-rel-label">${escapeHtml(t('prerelease'))}</span>` : ''}
          </div>
          <span class="gh-dl-overlay-rel-count">${formatExact(rel.total_downloads)}${escapeHtml(relDelta)}</span>
        </div>
        <div class="gh-dl-overlay-rel-assets">
          ${assetsRows}
        </div>
      </div>
    `;
  }

  function applyOverlayFilters(container) {
    const filterInput = container.querySelector('#gh-dl-filter-input');
    const q = filterInput ? (filterInput.value || '').trim().toLowerCase() : '';
    const [filterType, filterVal] = activePlatformFilter ? activePlatformFilter.split(':') : [null, null];

    container.querySelectorAll('.gh-dl-overlay-rel').forEach((relEl) => {
      if (!q && !activePlatformFilter) {
        relEl.style.display = '';
        relEl.querySelectorAll('.gh-dl-overlay-asset').forEach((a) => (a.style.display = ''));
        return;
      }

      const tagMatch = q ? (relEl.dataset.tag || '').includes(q) || (relEl.dataset.name || '').includes(q) : false;
      let anyVisibleAsset = false;

      relEl.querySelectorAll('.gh-dl-overlay-asset').forEach((a) => {
        const textMatch = !q || tagMatch || (a.dataset.assetName || '').includes(q);
        const platMatch =
          !activePlatformFilter ||
          (filterType === 'os' && a.dataset.os === filterVal) ||
          (filterType === 'arch' && a.dataset.arch === filterVal);

        const visible = textMatch && platMatch;
        a.style.display = visible ? '' : 'none';
        if (visible) anyVisibleAsset = true;
      });

      if ((tagMatch && !activePlatformFilter) || anyVisibleAsset) {
        relEl.style.display = '';
        relEl.classList.add('gh-dl-rel-open');
      } else {
        relEl.style.display = 'none';
      }
    });
  }

  function bindOverlayEvents(container) {
    const triggerBtn = container.querySelector('#gh-dl-trigger-btn');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isPopoverOpen = !isPopoverOpen;
        const pop = container.querySelector('#gh-dl-popover');
        if (pop) pop.classList.toggle('gh-dl-open', isPopoverOpen);
        triggerBtn.setAttribute('aria-expanded', String(isPopoverOpen));
        if (isPopoverOpen) {
          const input = container.querySelector('#gh-dl-filter-input');
          if (input) setTimeout(() => input.focus(), 30);
        }
      });
    }

    container.querySelectorAll('[data-action="close"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePopover();
      });
    });

    container.querySelectorAll('[data-action="refresh"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        checkPageAndLoad(true);
      });
    });

    container.querySelectorAll('[data-action="toggle-sort"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        overlaySortBy = overlaySortBy === 'latest' ? 'downloads' : 'latest';
        delete container.dataset.sig;
        renderHeaderAction();
      });
    });

    container.querySelectorAll('[data-platform-filter]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = chip.getAttribute('data-platform-filter');
        activePlatformFilter = activePlatformFilter === key ? null : key;
        container.querySelectorAll('[data-platform-filter]').forEach((c) => {
          const isCurrent = c.getAttribute('data-platform-filter') === activePlatformFilter;
          c.classList.toggle('gh-dl-chip-active', isCurrent);
          c.setAttribute('aria-pressed', String(isCurrent));
        });
        applyOverlayFilters(container);
      });
    });

    container.querySelectorAll('[data-action="toggle-rel"]').forEach((row) => {
      const toggleReleaseRow = (e) => {
        if (e.target.closest('.gh-dl-overlay-rel-tag')) return;
        e.stopPropagation();
        const rel = row.closest('.gh-dl-overlay-rel');
        if (rel) {
          const isOpen = rel.classList.toggle('gh-dl-rel-open');
          row.setAttribute('aria-expanded', String(isOpen));
        }
      };
      row.addEventListener('click', toggleReleaseRow);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleReleaseRow(e);
        }
      });
    });

    const filterInput = container.querySelector('#gh-dl-filter-input');
    if (filterInput) {
      filterInput.addEventListener('click', (e) => e.stopPropagation());
      filterInput.addEventListener('input', () => {
        applyOverlayFilters(container);
      });
    }

    if (activePlatformFilter) {
      applyOverlayFilters(container);
    }
  }

  function closePopover() {
    isPopoverOpen = false;
    const pop = document.getElementById('gh-dl-popover');
    if (pop) pop.classList.remove('gh-dl-open');
    const btn = document.getElementById('gh-dl-trigger-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  // 2. RIGHT SIDEBAR "ABOUT" STATS ROW
  function renderAboutSidebarStat() {
    if (!currentRepoData || isLoading) return;
    const parsed = parseRepoFromLocation();
    if (!parsed) return;

    const forksPath = `/${parsed.owner}/${parsed.repo}/forks`.toLowerCase();
    const networkPath = `/${parsed.owner}/${parsed.repo}/network/members`.toLowerCase();

    const forkLinks = Array.from(document.querySelectorAll('a[href$="/forks"], a[href$="/network/members"]')).filter(
      (a) => {
        const p = (a.getAttribute('href') || '').toLowerCase();
        return (
          (p === forksPath || p === networkPath) &&
          !a.closest('ul[data-testid="repo-header-actions"], ul.pagehead-actions')
        );
      }
    );

    forkLinks.forEach((forkLink) => {
      const forkWrapper = forkLink.closest('div.mt-2') || forkLink.parentElement;
      if (!forkWrapper || !forkWrapper.parentElement) return;

      const parent = forkWrapper.parentElement;
      let dlRow = parent.querySelector('.gh-dl-about-stat-row');
      if (!dlRow) {
        dlRow = document.createElement('div');
        dlRow.className = `${forkWrapper.className} gh-dl-about-stat-row`;
        forkWrapper.insertAdjacentElement('afterend', dlRow);
      }

      const delta = currentRepoData.deltaTotal || 0;
      const sig = `${currentLang}_${currentRepoData.totalDownloads}_${delta}`;
      if (dlRow.dataset.sig === sig) return;
      dlRow.dataset.sig = sig;

      const linkClass = forkLink.className;
      const svgEl = forkLink.querySelector('svg');
      const rawSvgClass = svgEl ? svgEl.getAttribute('class') || 'octicon mr-2' : 'octicon mr-2';
      const svgClass = rawSvgClass.replace('octicon-repo-forked', 'octicon-download');
      const deltaText = delta > 0 ? ` (+${formatCompact(delta)})` : '';

      dlRow.innerHTML = `
        <a class="${escapeHtml(linkClass)}" data-component="Link" data-muted="true" href="/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/releases" title="${escapeHtml(
          t('totalTooltip', {
            total: formatExact(currentRepoData.totalDownloads),
            releases: currentRepoData.totalReleases
          }) + (delta > 0 ? t('deltaTooltip', { delta: formatExact(delta) }) : '')
        )}">
          <svg data-component="Octicon" aria-hidden="true" focusable="false" class="${escapeHtml(svgClass)}" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align:text-bottom"><path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"></path><path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z"></path></svg><span><strong>${escapeHtml(formatCompact(currentRepoData.totalDownloads))}</strong></span><span> ${escapeHtml(t('downloadsLower'))}${escapeHtml(deltaText)}</span>
        </a>
      `;
    });
  }

  // 3. RIGHT SIDEBAR "RELEASES" SECTION
  function renderSidebarReleasesStat() {
    if (!currentRepoData || isLoading || currentRepoData.totalDownloads === 0) return;

    const headings = Array.from(document.querySelectorAll('h2'));
    for (const h2 of headings) {
      const text = (h2.textContent || '').trim();
      if (!text.startsWith('Releases')) continue;

      const section = h2.closest('div[class*="sidebarSection"], .BorderGrid-cell') || h2.parentElement;
      if (!section) continue;

      if (section.querySelector('[data-component="SkeletonText"]')) continue;

      let statLine = section.querySelector('.gh-dl-sidebar-release-stat');
      if (!statLine) {
        statLine = document.createElement('div');
        statLine.className = 'gh-dl-sidebar-release-stat color-fg-muted text-small mt-2';
        section.appendChild(statLine);
      }

      const latest = currentRepoData.releases[0];
      const delta = currentRepoData.deltaTotal || 0;
      const sig = `${currentLang}_${currentRepoData.totalDownloads}_${delta}_${latest ? latest.total_downloads : 0}`;
      if (statLine.dataset.sig === sig) continue;
      statLine.dataset.sig = sig;

      const { osList } = computePlatformBreakdown(currentRepoData.releases);
      const topOsSummary =
        osList.length > 1
          ? `<div class="mt-1">${osList
              .slice(0, 3)
              .map((o) => `${escapeHtml(o.name)} ${o.pct}%`)
              .join(' · ')}</div>`
          : '';

      statLine.innerHTML = `
        <div>
          <span>${formatExact(currentRepoData.totalDownloads)} ${escapeHtml(t('totalDownloadsLower'))}${delta > 0 ? ` (+${formatExact(delta)})` : ''}</span>
          ${latest && latest.total_downloads > 0 ? `<span> · ${escapeHtml(latest.tag_name)} (${formatCompact(latest.total_downloads)})</span>` : ''}
        </div>
        ${topOsSummary}
      `;
    }
  }

  // 4. RELEASES PAGE (`/releases` and `/releases/tag/...`)
  function renderReleasesPage() {
    if (!currentRepoData && extraReleasesByTag.size === 0) return;
    const parsed = parseRepoFromLocation();
    if (!parsed) return;

    if (currentRepoData && currentRepoData.totalDownloads > 0) {
      const subnav = document.querySelector('nav[aria-label="Releases and Tags"]');
      if (subnav && subnav.parentElement && !subnav.parentElement.querySelector('.gh-dl-subnav-total')) {
        const delta = currentRepoData.deltaTotal || 0;
        const { osList } = computePlatformBreakdown(currentRepoData.releases);
        const osText =
          osList.length > 1
            ? ` · ${osList
                .slice(0, 3)
                .map((o) => `${escapeHtml(o.name)} ${o.pct}%`)
                .join(' · ')}`
            : '';

        const totalEl = document.createElement('div');
        totalEl.className = 'color-fg-muted text-small d-flex flex-items-center mr-3 mb-2 gh-dl-subnav-total';
        totalEl.title =
          t('totalTooltip', {
            total: formatExact(currentRepoData.totalDownloads),
            releases: currentRepoData.totalReleases
          }) + (delta > 0 ? t('deltaTooltip', { delta: formatExact(delta) }) : '');
        totalEl.innerHTML = `${OCTICONS.download}<span class="ml-1"><strong>${formatExact(currentRepoData.totalDownloads)}</strong> ${escapeHtml(t('totalDownloadsLower'))}${delta > 0 ? ` (+${formatExact(delta)})` : ''}${osText}</span>`;
        subnav.insertAdjacentElement('afterend', totalEl);
      }
    }

    const releaseBoxes = document.querySelectorAll('section[id^="release-"] .Box, [data-hpc] > .Box, .release-entry');
    releaseBoxes.forEach((box) => {
      if (box.classList.contains('Box--condensed')) return;

      const tag = resolveReleaseTagFromBox(box, parsed);
      if (!tag) return;

      const release = findReleaseByTag(tag);
      if (!release) return;

      const relDelta = release.delta_downloads > 0 ? ` (+${formatExact(release.delta_downloads)})` : '';
      const { osList } = computePlatformBreakdown([release]);
      const relOsSummary =
        osList.length > 1
          ? ` · ${osList
              .slice(0, 3)
              .map((o) => `${o.name} ${o.pct}%`)
              .join(' · ')}`
          : '';

      const metaBar = box.querySelector('.d-flex.flex-row.flex-wrap.color-fg-muted');
      if (metaBar && !metaBar.querySelector('.gh-dl-release-meta-item')) {
        const metaItem = document.createElement('div');
        metaItem.className = 'tmp-mr-4 mr-4 mb-2 gh-dl-release-meta-item';
        metaItem.title = t('releaseMetaTooltip', {
          total: formatExact(release.total_downloads),
          assets: release.assets.length
        });
        metaItem.innerHTML = `${OCTICONS.download} <span>${formatExact(release.total_downloads)} ${escapeHtml(t('downloadsLower'))}${escapeHtml(relDelta)}${escapeHtml(relOsSummary)}</span>`;
        metaBar.appendChild(metaItem);
      }

      const summaries = box.querySelectorAll('details summary');
      summaries.forEach((summary) => {
        if (!summary.textContent.includes('Assets')) return;
        if (summary.querySelector('.gh-dl-assets-summary-count')) return;
        const flexSpan = summary.querySelector('.d-inline-flex.flex-items-center') || summary;
        const countSpan = document.createElement('span');
        countSpan.className = 'color-fg-muted text-normal f5 ml-2 gh-dl-assets-summary-count';
        countSpan.textContent = `· ${formatExact(release.total_downloads)} ${t('downloadsLower')}${relDelta}`;
        flexSpan.appendChild(countSpan);

        if (release.assets.length > 1 && release.total_downloads > 0) {
          const sortBtn = document.createElement('button');
          sortBtn.type = 'button';
          sortBtn.className = 'gh-dl-sort-assets-btn ml-2';
          sortBtn.textContent = t('sortAssetsBtn');
          sortBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const detailsEl = summary.closest('details');
            if (!detailsEl) return;
            const ul = detailsEl.querySelector('ul');
            if (!ul) return;
            const rows = Array.from(ul.querySelectorAll('li.Box-row'));
            if (rows.length <= 1) return;

            rows.sort((a, b) => {
              const ca = Number(a.dataset.dlCount || -1);
              const cb = Number(b.dataset.dlCount || -1);
              return cb - ca;
            });
            rows.forEach((r) => ul.appendChild(r));
            sortBtn.textContent = t('sortedAssetsBtn');
          });
          flexSpan.appendChild(sortBtn);
        }
      });
    });

    const downloadLinks = document.querySelectorAll('a[href*="/releases/download/"]');
    downloadLinks.forEach((a) => {
      if (a.classList.contains('gh-dl-overlay-asset-name')) return;

      const row = a.closest('li.Box-row, div.Box-row');
      if (!row || row.querySelector('.gh-dl-asset-col')) return;

      const match = findAssetByDownloadUrl(a.href);
      if (!match) return;

      const { asset, release } = match;
      row.dataset.dlCount = String(asset.download_count);

      const showPct = release.assets.length > 1 && release.total_downloads > 0;
      const pct = showPct ? Math.round((asset.download_count / release.total_downloads) * 100) : null;
      const deltaStr = asset.delta_count > 0 ? ` (+${formatExact(asset.delta_count)})` : '';

      const col = document.createElement('span');
      col.className =
        'color-fg-muted text-right flex-shrink-0 flex-grow-0 ml-2 tmp-ml-2 ml-sm-3 tmp-ml-sm-3 ml-md-4 tmp-ml-md-4 gh-dl-asset-col';
      col.style.whiteSpace = 'nowrap';
      col.title = `${formatExact(asset.download_count)} ${t('downloadsLower')}${deltaStr}${pct !== null ? ` (${pct}%)` : ''}`;
      col.textContent = `${formatExact(asset.download_count)} ${t('downloadsLower')}${deltaStr}${pct !== null ? ` (${pct}%)` : ''}`;

      const timeEl = row.querySelector('relative-time');
      const timeWrapper = timeEl ? timeEl.closest('span') : null;
      const sizeWrapper = timeWrapper ? timeWrapper.previousElementSibling : null;

      if (sizeWrapper && sizeWrapper.parentElement) {
        sizeWrapper.parentElement.insertBefore(col, sizeWrapper);
      } else {
        const rightSide = row.querySelector('.d-flex.flex-justify-end') || row;
        rightSide.appendChild(col);
      }
    });
  }

  function resolveReleaseTagFromBox(box, parsed) {
    const section = box.closest('section[id^="release-"]');
    if (section && section.id) {
      return decodeURIComponent(section.id.slice('release-'.length));
    }

    const fragment = box.querySelector(
      'include-fragment[src*="/releases/expanded_assets/"], include-fragment[data-deferred-src*="/releases/expanded_assets/"]'
    );
    if (fragment) {
      const src = fragment.getAttribute('src') || fragment.getAttribute('data-deferred-src') || '';
      const marker = '/releases/expanded_assets/';
      const idx = src.indexOf(marker);
      if (idx !== -1) {
        return decodeURIComponent(src.slice(idx + marker.length).split('?')[0]);
      }
    }

    const tagPrefix = `/${parsed.owner}/${parsed.repo}/releases/tag/`;
    const tagLink = box.querySelector('a[href*="/releases/tag/"]');
    if (tagLink) {
      try {
        const u = new URL(tagLink.href, window.location.origin);
        if (u.pathname.toLowerCase().startsWith(tagPrefix.toLowerCase())) {
          const raw = u.pathname.slice(tagPrefix.length).split('/')[0];
          if (raw) return decodeURIComponent(raw);
        }
      } catch (_) {}
    }

    if (parsed.subpath.startsWith('releases/tag/')) {
      const raw = parsed.subpath.slice('releases/tag/'.length).split('/')[0];
      if (raw) return decodeURIComponent(raw);
    }

    return null;
  }

  function findAssetByDownloadUrl(href) {
    if (!href) return null;
    let pathname = '';
    try {
      pathname = new URL(href, window.location.origin).pathname;
    } catch (_) {
      return null;
    }

    const marker = '/releases/download/';
    const idx = pathname.indexOf(marker);
    if (idx === -1) return null;

    const rest = pathname.slice(idx + marker.length);
    const slashIdx = rest.indexOf('/');
    if (slashIdx === -1) return null;

    const rawTag = rest.slice(0, slashIdx);
    const rawFile = rest.slice(slashIdx + 1);
    const decodedTag = decodeURIComponent(rawTag);
    const decodedFile = decodeURIComponent(rawFile);

    const release = findReleaseByTag(decodedTag) || findReleaseByTag(rawTag);
    if (!release || !Array.isArray(release.assets)) return null;

    const asset = release.assets.find((item) => {
      if (item.name === decodedFile || item.name === rawFile) return true;
      try {
        const assetPath = new URL(item.browser_download_url).pathname;
        return assetPath === pathname || decodeURIComponent(assetPath) === decodeURIComponent(pathname);
      } catch (_) {
        return false;
      }
    });

    if (!asset) return null;
    return { asset, release };
  }

  init();
})();
