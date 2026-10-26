// Background Service Worker - GitHub Release Downloads

const DEFAULT_CACHE_TTL_MINUTES = 15;
const MAX_PAGES_TO_FETCH = 3; // Up to 300 releases per repository
const MAX_CACHED_REPOS = 60;
const DELTA_RETENTION_MS = 24 * 60 * 60 * 1000; // Keep last-visit delta visible for 24h if unchanged

const inflightRequests = new Map();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'GET_REPO_DOWNLOADS') {
    const { owner, repo, forceRefresh = false } = message;
    handleGetRepoDownloads(owner, repo, forceRefresh)
      .then((result) => sendResponse({ ok: true, data: result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error.message || 'GitHub API request failed.',
          errorCode: error.errorCode || 'API_ERROR',
          status: error.status || 0,
          rateLimitReset: error.rateLimitReset || null
        })
      );
    return true;
  }

  if (message.type === 'GET_RELEASE_BY_TAG') {
    const { owner, repo, tag } = message;
    handleGetReleaseByTag(owner, repo, tag)
      .then((result) => sendResponse({ ok: true, data: result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error.message || 'Failed to fetch release.'
        })
      );
    return true;
  }

  if (message.type === 'CHECK_RATE_LIMIT') {
    handleCheckRateLimit(message.token)
      .then((result) => sendResponse({ ok: true, data: result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error.message || 'Failed to check API rate limit.'
        })
      );
    return true;
  }

  if (message.type === 'CLEAR_CACHE') {
    clearRepoCache()
      .then((clearedCount) => sendResponse({ ok: true, clearedCount }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function getSettings() {
  const stored = await chrome.storage.local.get(['githubToken', 'cacheTtlMinutes']);
  return {
    githubToken: (stored.githubToken || '').trim(),
    cacheTtlMinutes:
      typeof stored.cacheTtlMinutes === 'number' && stored.cacheTtlMinutes > 0
        ? stored.cacheTtlMinutes
        : DEFAULT_CACHE_TTL_MINUTES
  };
}

function buildHeaders(token, etag) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (etag) {
    headers['If-None-Match'] = etag;
  }
  return headers;
}

async function updateRateLimitFromHeaders(headers) {
  const limit = headers.get('x-ratelimit-limit');
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  const used = headers.get('x-ratelimit-used');

  if (limit !== null && remaining !== null) {
    const rateLimit = {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: reset ? parseInt(reset, 10) * 1000 : null,
      used: used ? parseInt(used, 10) : 0,
      updatedAt: Date.now()
    };
    await chrome.storage.local.set({ rateLimit });
    return rateLimit;
  }
  return null;
}

async function handleGetRepoDownloads(owner, repo, forceRefresh) {
  if (!owner || !repo) {
    throw new Error('Invalid repository identifier.');
  }

  const repoKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const cacheKey = `cache_${repoKey}`;
  const settings = await getSettings();
  const ttlMs = settings.cacheTtlMinutes * 60 * 1000;

  const cachedObj = await chrome.storage.local.get([cacheKey]);
  const cached = cachedObj[cacheKey] || null;

  if (!forceRefresh && cached && cached.fetchedAt && Date.now() - cached.fetchedAt < ttlMs) {
    return { ...cached, fromCache: true };
  }

  if (inflightRequests.has(repoKey)) {
    return inflightRequests.get(repoKey);
  }

  const fetchPromise = fetchRepoReleasesFromGitHub(owner, repo, settings.githubToken, cacheKey, cached);
  inflightRequests.set(repoKey, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inflightRequests.delete(repoKey);
  }
}

async function fetchPageWithFallback(url, token, etag) {
  let response = await fetch(url, { headers: buildHeaders(token, etag) });
  if (
    !response.ok &&
    response.status !== 304 &&
    token &&
    (response.status === 401 || response.status === 403 || response.status === 404)
  ) {
    const anonResponse = await fetch(url, { headers: buildHeaders('', etag) });
    if (anonResponse.ok || anonResponse.status === 304) {
      return anonResponse;
    }
  }
  return response;
}

async function fetchRepoReleasesFromGitHub(owner, repo, token, cacheKey, previousCache) {
  let allReleases = [];
  let page = 1;
  let hasMorePages = false;
  let firstPageEtag = null;

  while (page <= MAX_PAGES_TO_FETCH) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=100&page=${page}`;
    const etagToSend = page === 1 && previousCache && previousCache.etag ? previousCache.etag : null;
    const response = await fetchPageWithFallback(url, token, etagToSend);
    const rateLimit = await updateRateLimitFromHeaders(response.headers);

    if (page === 1 && response.status === 304 && previousCache) {
      const refreshedCache = {
        ...previousCache,
        fetchedAt: Date.now()
      };
      await chrome.storage.local.set({ [cacheKey]: refreshedCache });
      return { ...refreshedCache, fromCache: true, revalidated: true };
    }

    if (!response.ok) {
      let errMsg = `GitHub API error (${response.status})`;
      try {
        const errBody = await response.json();
        if (errBody && errBody.message) {
          errMsg = errBody.message;
        }
      } catch (_) {}

      const error = new Error(errMsg);
      error.status = response.status;
      if (rateLimit && rateLimit.reset) {
        error.rateLimitReset = rateLimit.reset;
      }

      if (response.status === 403 && rateLimit && rateLimit.remaining === 0) {
        error.errorCode = 'RATE_LIMIT';
      } else if (response.status === 404) {
        error.errorCode = 'NOT_FOUND_OR_PRIVATE';
      } else if (response.status === 401) {
        error.errorCode = 'UNAUTHORIZED';
      } else {
        error.errorCode = 'API_ERROR';
      }
      throw error;
    }

    if (page === 1) {
      firstPageEtag = response.headers.get('etag') || null;
    }

    const pageData = await response.json();
    if (!Array.isArray(pageData) || pageData.length === 0) {
      break;
    }

    allReleases = allReleases.concat(pageData);

    const linkHeader = response.headers.get('link') || '';
    const hasNext = linkHeader.includes('rel="next"');
    if (!hasNext || pageData.length < 100) {
      hasMorePages = false;
      break;
    } else {
      hasMorePages = true;
      page += 1;
    }
  }

  const processed = processReleasesData(owner, repo, allReleases, hasMorePages, firstPageEtag, previousCache);

  await pruneCacheIfNeeded();
  await chrome.storage.local.set({ [cacheKey]: processed });

  return { ...processed, fromCache: false };
}

function processReleasesData(owner, repo, rawReleases, hasMorePages, etag = null, previousCache = null) {
  let totalDownloads = 0;
  let totalAssets = 0;

  // Build lookup maps from previous cache for delta calculation
  const prevReleaseMap = new Map();
  const prevAssetMap = new Map();
  if (previousCache && Array.isArray(previousCache.releases)) {
    for (const r of previousCache.releases) {
      prevReleaseMap.set(r.tag_name, {
        total: r.total_downloads || 0,
        delta: r.delta_downloads || 0
      });
      if (Array.isArray(r.assets)) {
        for (const a of r.assets) {
          prevAssetMap.set(a.id, {
            count: a.download_count || 0,
            delta: a.delta_count || 0
          });
        }
      }
    }
  }

  const keepRecentDelta =
    previousCache &&
    previousCache.deltaSince &&
    Date.now() - previousCache.deltaSince < DELTA_RETENTION_MS;

  const releases = rawReleases.map((rel) => {
    const assets = Array.isArray(rel.assets)
      ? rel.assets.map((asset) => {
          const count = Number(asset.download_count) || 0;
          totalDownloads += count;
          totalAssets += 1;

          let deltaCount = 0;
          const prevAsset = prevAssetMap.get(asset.id);
          if (prevAsset) {
            const diff = count - prevAsset.count;
            if (diff > 0) {
              deltaCount = diff;
            } else if (diff === 0 && keepRecentDelta && prevAsset.delta > 0) {
              deltaCount = prevAsset.delta;
            }
          }

          return {
            id: asset.id,
            name: asset.name,
            size: asset.size || 0,
            download_count: count,
            delta_count: deltaCount,
            browser_download_url: asset.browser_download_url || '',
            updated_at: asset.updated_at || asset.created_at || null
          };
        })
      : [];

    const releaseDownloads = assets.reduce((sum, a) => sum + a.download_count, 0);
    let releaseDelta = 0;
    const prevRel = prevReleaseMap.get(rel.tag_name || '');
    if (prevRel) {
      const diff = releaseDownloads - prevRel.total;
      if (diff > 0) {
        releaseDelta = diff;
      } else if (diff === 0 && keepRecentDelta && prevRel.delta > 0) {
        releaseDelta = prevRel.delta;
      }
    }

    return {
      id: rel.id,
      tag_name: rel.tag_name || '',
      name: rel.name || rel.tag_name || 'Untitled release',
      published_at: rel.published_at || rel.created_at || null,
      prerelease: Boolean(rel.prerelease),
      draft: Boolean(rel.draft),
      html_url:
        rel.html_url ||
        `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tag/${encodeURIComponent(rel.tag_name || '')}`,
      total_downloads: releaseDownloads,
      delta_downloads: releaseDelta,
      assets
    };
  });

  let deltaTotal = 0;
  let deltaSince = null;
  if (previousCache && typeof previousCache.totalDownloads === 'number') {
    const diff = totalDownloads - previousCache.totalDownloads;
    if (diff > 0) {
      deltaTotal = diff;
      deltaSince = previousCache.fetchedAt || Date.now();
    } else if (diff === 0 && keepRecentDelta && previousCache.deltaTotal > 0) {
      deltaTotal = previousCache.deltaTotal;
      deltaSince = previousCache.deltaSince;
    }
  }

  return {
    owner,
    repo,
    totalDownloads,
    deltaTotal,
    deltaSince,
    totalReleases: releases.length,
    totalAssets,
    hasMorePages,
    etag,
    releases,
    fetchedAt: Date.now()
  };
}

async function handleGetReleaseByTag(owner, repo, tag) {
  const settings = await getSettings();
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tags/${encodeURIComponent(tag)}`;

  const response = await fetchPageWithFallback(url, settings.githubToken, null);
  await updateRateLimitFromHeaders(response.headers);

  if (!response.ok) {
    throw new Error(`Release not found (${response.status})`);
  }

  const rel = await response.json();
  const processed = processReleasesData(owner, repo, [rel], false, null, null);
  return processed.releases[0] || null;
}

async function handleCheckRateLimit(overrideToken) {
  const settings = await getSettings();
  const tokenToUse = overrideToken !== undefined ? overrideToken.trim() : settings.githubToken;
  const headers = buildHeaders(tokenToUse, null);

  const response = await fetch('https://api.github.com/rate_limit', { headers });
  await updateRateLimitFromHeaders(response.headers);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid GitHub token (401 Unauthorized).');
    }
    throw new Error(`API error (${response.status}).`);
  }

  const data = await response.json();
  const core = data && data.resources && data.resources.core ? data.resources.core : data.rate;
  const rateLimit = {
    limit: core.limit,
    remaining: core.remaining,
    reset: core.reset * 1000,
    used: core.used || 0,
    authenticated: Boolean(tokenToUse),
    updatedAt: Date.now()
  };

  await chrome.storage.local.set({ rateLimit });
  return rateLimit;
}

async function pruneCacheIfNeeded() {
  const allData = await chrome.storage.local.get(null);
  const cacheEntries = Object.entries(allData)
    .filter(([key]) => key.startsWith('cache_'))
    .map(([key, val]) => ({ key, fetchedAt: (val && val.fetchedAt) || 0 }));

  if (cacheEntries.length >= MAX_CACHED_REPOS) {
    cacheEntries.sort((a, b) => a.fetchedAt - b.fetchedAt);
    const toRemove = cacheEntries.slice(0, cacheEntries.length - MAX_CACHED_REPOS + 10).map((e) => e.key);
    if (toRemove.length > 0) {
      await chrome.storage.local.remove(toRemove);
    }
  }
}

async function clearRepoCache() {
  const allData = await chrome.storage.local.get(null);
  const cacheKeys = Object.keys(allData).filter((key) => key.startsWith('cache_'));
  if (cacheKeys.length > 0) {
    await chrome.storage.local.remove(cacheKeys);
  }
  return cacheKeys.length;
}
