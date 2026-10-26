# GitHub Release Downloads

A lightweight Manifest V3 browser extension (Chrome, Brave, Edge, Arc, Firefox, Safari) that surfaces total, per-release, and per-asset download counts natively inside GitHub's interface using Primer design tokens and classes.

## Features

- **Repository Header Counter & Overlay (`[data-testid="repo-header-actions"]` / `.pagehead-actions`):**
  Adds a native `Downloads` button alongside `Watch`, `Fork`, and `Star`. Clicking it opens a Primer-styled overlay listing releases and individual binary asset download counts with instant filtering and sorting (`Latest` vs. `Most downloaded`).
- **OS & CPU Architecture Breakdown:**
  Automatically classifies release assets by operating system (`macOS`, `Windows`, `Linux`, `Android`, `iOS`) and architecture (`arm64`, `x64`, `Universal`) with interactive click-to-filter chips.
- **Since-Last-Visit Delta (`+Δ`):**
  Tracks download count growth since your previous visit (minimum 24-hour baseline snapshot) across total, release, and asset views.
- **About Sidebar Stat:**
  Appends a `downloads` counter row directly beneath `stars`, `watching`, and `forks` in the repository sidebar.
- **Releases Page & Tag Views (`/releases`, `/releases/tag/*`):**
  - Displays repository-wide total downloads next to the `Releases / Tags` navigation bar.
  - Adds per-release download totals to each release's metadata bar and `Assets` summary header, plus a one-click **Sort by downloads** button.
  - Injects individual asset download counts and percentage share alongside file sizes inside `Assets` rows (including lazy-loaded `<include-fragment>` asset lists).
- **Rate-Limit Friendly Architecture:**
  - **Zero-API DOM Pre-Check:** Skips API calls completely on repositories that visibly have no published releases.
  - **HTTP `ETag` (`If-None-Match`) Revalidation:** Uses conditional requests when refreshing expired cache entries; `304 Not Modified` responses do not consume GitHub API rate-limit quota.
  - **Local Caching & Optional PAT:** Caches responses in `chrome.storage.local` (default 15 min TTL) and supports an optional Personal Access Token (PAT) to raise the limit from 60 to 5,000 requests/hour and support private repositories.
- **Multi-Language Support (English & Turkish):**
  Automatically detects browser language (`en` / `tr`) with an instant language switcher in the extension popup.

## Installation

### Chrome / Brave / Edge / Firefox (Unpacked)
1. Clone this repository or download the latest `.zip` from [**Releases**](https://github.com/brktlhylmz/github-release-downloads/releases):
   ```bash
   git clone https://github.com/brktlhylmz/github-release-downloads.git
   ```
2. Open `chrome://extensions/` in Chrome (or `about:debugging#/runtime/this-firefox` in Firefox).
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the project directory.

### Safari (macOS)
Open `safari/GitHub Release Downloads.xcodeproj` in Xcode and press `Cmd + R` to build and enable the extension in **Safari → Settings → Extensions**.

## Project Structure

```text
├── .github/workflows/release.yml  # Automated GitHub Release ZIP packaging on tag push
├── _locales/                      # Chrome/Firefox/Safari WebExtension localization (en, tr)
├── icons/                         # Extension icons (16px–1024px PNG + SVG)
├── safari/                        # macOS Safari Web Extension Xcode project
├── manifest.json                  # Manifest V3 configuration (Chromium, Firefox Gecko, Safari)
├── background.js                  # Service worker (GitHub API, ETag revalidation, delta & caching)
├── content.js                     # Native Primer DOM injection, OS/Arch classifier & i18n
├── styles.css                     # Primer-compatible CSS variables for Light & Dark themes
├── popup.html                     # Extension settings popup
├── popup.css                      # Popup styles
└── popup.js                       # Token validation, language switcher & cache controls
```

## Permissions & Privacy

- `storage`: Stores cached release counts, language preference, and your optional Personal Access Token locally in `chrome.storage.local`.
- `https://api.github.com/*`: Fetches release metadata from the official GitHub REST API.
- Zero analytics, tracking, or third-party servers. All requests go directly from your browser to `api.github.com`.

---

## Türkçe Özet

GitHub repo ana sayfasında (`Notifications / Fork / Star` barında ve sağ `About` panelinde) ve `Releases` sayfalarında toplam, sürüm bazlı ve dosya (asset/build) bazlı indirme sayılarını GitHub'ın kendi Primer tasarım yapısıyla gösteren açık kaynaklı tarayıcı eklentisi.

### Öne Çıkan Özellikler
- **Sıfır Kota Harcayan Akıllı Mimari:** Release olmayan repolarda API isteği atmaz; önbellek süresi dolduğunda ise `ETag` (`If-None-Match`) kullanarak `304 Not Modified` yanıtlarıyla saatlik 60 istek kotasından düşmeden doğrulama yapar.
- **Sıralama ve Yüzde Payı:** Açılır menüde sürümleri en çok indirilene göre sıralayabilir, `/releases` sayfasında ise **İndirmeye göre sırala** butonuyla bir sürüm altındaki build dosyalarını en çok indirilenden en aza doğru dizebilirsiniz.
- **Türkçe & İngilizce Dil Desteği:** Tarayıcı dilini otomatik algılar veya eklenti menüsünden anlık olarak değiştirilebilir.

## License

[MIT](LICENSE)
