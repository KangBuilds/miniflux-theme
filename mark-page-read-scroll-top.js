(() => {
  const FLAG = "mf-scroll-top-after-confirmed-mark-page-read";
  const REQUEST_HINT = "mark-all-as-read";

  function normalize(text) {
    return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function scrollToTop() {
    // Run the jump more than once so it still lands at the top after async DOM updates.
    window.scrollTo({ top: 0, behavior: "instant" });
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 250);
  }

  function arm() {
    // Persist across the follow-up request so the next render knows to scroll.
    sessionStorage.setItem(FLAG, "1");
  }

  function consumeIfArmed() {
    if (sessionStorage.getItem(FLAG) !== "1") return false;
    sessionStorage.removeItem(FLAG);
    scrollToTop();
    return true;
  }

  function isConfirmYesClick(el) {
    if (!el) return false;

    const clickable = el.closest("a, button");
    if (!clickable) return false;

    const text = normalize(clickable.textContent);
    if (text !== "yes" && text !== ", yes" && text !== "yes,") return false;

    // Only treat the click as confirmation when the inline warning is visible.
    const pageText = normalize(document.body.innerText);
    return pageText.includes("are you sure?");
  }

  function isMarkAllReadRequest(url) {
    return typeof url === "string" && url.includes(REQUEST_HINT);
  }

  // Handle the page right after Miniflux finishes the confirmed action.
  consumeIfArmed();

  document.addEventListener(
    "click",
    (event) => {
      if (isConfirmYesClick(event.target)) {
        arm();
      }
    },
    true
  );

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = args[0] instanceof Request ? args[0].url : String(args[0] || "");
    const response = await originalFetch.apply(this, args);

    if (sessionStorage.getItem(FLAG) === "1" && isMarkAllReadRequest(url)) {
      setTimeout(consumeIfArmed, 0);
      setTimeout(consumeIfArmed, 150);
      setTimeout(consumeIfArmed, 500);
    }

    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__mfUrl = String(url || "");
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("loadend", () => {
      if (
        sessionStorage.getItem(FLAG) === "1" &&
        isMarkAllReadRequest(this.__mfUrl)
      ) {
        setTimeout(consumeIfArmed, 0);
        setTimeout(consumeIfArmed, 150);
        setTimeout(consumeIfArmed, 500);
      }
    });

    return originalSend.apply(this, args);
  };
})();
