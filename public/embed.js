/**
 * webinar.ai Embed Loader
 * Lightweight script (~1KB) that creates an iframe player for any page.
 *
 * Usage:
 * <div data-wai-project="YOUR_PROJECT_SLUG"></div>
 * <script src="https://your-domain.com/embed.js" async></script>
 */
(function() {
  'use strict';

  var BASE_URL = (document.currentScript && document.currentScript.src)
    ? new URL(document.currentScript.src).origin
    : 'https://webinar.ai';

  var containers = document.querySelectorAll('[data-wai-project]');
  if (!containers.length) return;

  containers.forEach(function(container) {
    var slug = container.getAttribute('data-wai-project');
    if (!slug) return;

    var iframe = document.createElement('iframe');
    iframe.src = BASE_URL + '/e/' + slug;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'autoplay; fullscreen');
    iframe.setAttribute('allowfullscreen', '');
    iframe.style.width = '100%';
    iframe.style.aspectRatio = '16 / 9';
    iframe.style.maxWidth = '100%';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    iframe.style.backgroundColor = '#000';

    container.appendChild(iframe);
  });
})();
