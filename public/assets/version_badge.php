<?php
$YSS_VERSION = 'v0.15.3-alpha-2';
?>
<style>
  .yss-version-badge{
    position: fixed;
    bottom: 10px;
    right: 12px;
    z-index: 9999;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 0.62rem;
    letter-spacing: .04em;
    color: rgba(255,255,255,0.28);
    background: transparent;
    padding: 2px 6px;
    pointer-events: none;   /* lets clicks pass through to whatever is underneath */
    user-select: none;      /* not selectable */
    -webkit-user-select: none;
    -moz-user-select: none;
    cursor: default;        /* never shows as clickable/text-select cursor */
  }
</style>
<div class="yss-version-badge" aria-hidden="true" onmousedown="return false;" oncopy="return false;" oncontextmenu="return false;">
  <?= htmlspecialchars($YSS_VERSION) ?>
</div>