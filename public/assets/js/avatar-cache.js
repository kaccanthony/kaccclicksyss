// avatar-cache.js
// Include this on every page that shows a profile avatar (alongside the matching
// HTML pattern: a fallback <i class="avatar-fallback-icon">, plus an
// <img class="js-avatar" data-avatar-id="..."> that starts hidden).
//
// Behavior:
// 1. On page load, instantly shows the avatar from localStorage if we have one cached
//    — no network wait, no flicker, works the same on every page across the site.
// 2. In the background, re-checks the server at most once every REFRESH_INTERVAL_MS
//    per user, and only swaps/updates the cache if the avatar actually changed.
(function () {
  const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // don't re-check the server more than once per 5 min

  function cacheKey(id) { return 'yss_avatar_' + id; }
  function tsKey(id) { return 'yss_avatar_' + id + '_ts'; }

  function showAvatar(img, dataUrl) {
    img.src = dataUrl;
    img.style.display = '';
    const icon = img.previousElementSibling;
    if (icon && icon.classList.contains('avatar-fallback-icon')) {
      icon.style.display = 'none';
    }
  }

  function refreshAvatar(id, imgs) {
    const lastChecked = parseInt(localStorage.getItem(tsKey(id)) || '0', 10);
    if (Date.now() - lastChecked < REFRESH_INTERVAL_MS) return; // checked recently, skip

    fetch(`../modules/profiles/avatar.php?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(res => (res.ok ? res.blob() : Promise.reject()))
      .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }))
      .then(dataUrl => {
        localStorage.setItem(tsKey(id), Date.now().toString());
        const cached = localStorage.getItem(cacheKey(id));
        if (cached !== dataUrl) {
          localStorage.setItem(cacheKey(id), dataUrl);
          imgs.forEach(img => showAvatar(img, dataUrl));
        }
      })
      .catch(() => { /* silent — keep showing whatever's already on screen */ });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const imgs = Array.from(document.querySelectorAll('img.js-avatar'));
    if (!imgs.length) return;
    const id = imgs[0].dataset.avatarId;
    if (!id) return;

    const cached = localStorage.getItem(cacheKey(id));
    if (cached) {
      imgs.forEach(img => showAvatar(img, cached));
    }
    refreshAvatar(id, imgs);
  });
})();