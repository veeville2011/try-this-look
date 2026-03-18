(() => {
  "use strict";

  if (typeof window === "undefined") return;
  if (window.__NUSENSE_LANDING_TRYON_INITIALIZED__) return;
  window.__NUSENSE_LANDING_TRYON_INITIALIZED__ = true;

  const CONSTANTS = {
    OVERLAY_Z_INDEX: 9999,
    DEFAULT_MODAL_WIDTH: 900,
  };

  const normalizeUrl = (url) => {
    if (!url) return "";
    return String(url).trim().replace(/\/+$/, "");
  };

  const validateWidgetUrl = (url) => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && parsed.hostname;
    } catch {
      return false;
    }
  };

  const getWidgetUrl = () => {
    const fromGlobal = window?.NUSENSE_CONFIG?.widgetUrl;
    const fallback = "https://try-this-look-jet.vercel.app";
    const url = normalizeUrl(fromGlobal || fallback);
    return validateWidgetUrl(url) ? url : normalizeUrl(fallback);
  };

  const getWidgetOrigin = (widgetUrl) => {
    try {
      return new URL(widgetUrl).origin;
    } catch {
      return null;
    }
  };

  /** Base URL for Nusense generation/customer API (same backend as try-on generation). */
  const getNusenseApiBase = () => {
    const fromConfig = window?.NUSENSE_CONFIG?.nusenseApiUrl;
    if (fromConfig && typeof fromConfig === "string" && fromConfig.trim()) {
      return fromConfig.trim().replace(/\/+$/, "");
    }
    return "https://ai.nusense.ddns.net";
  };

  const normalizeStoreDomain = (shop) => {
    if (!shop || typeof shop !== "string") return "";
    let s = shop.trim().toLowerCase();
    s = s.replace(/^https?:\/\//, "");
    if (!s.includes(".myshopify.com")) s = s ? s + ".myshopify.com" : "";
    return s;
  };

  const getCustomerInfoFromScriptTag = () => {
    try {
      const el = document.getElementById("nusense-customer-info");
      if (!el || !el.textContent) return null;
      const parsed = JSON.parse(el.textContent);
      if (!parsed || typeof parsed !== "object") return null;
      return {
        id: parsed.id != null ? String(parsed.id) : null,
        email: parsed.email ? String(parsed.email) : null,
        firstName: parsed.firstName ? String(parsed.firstName) : null,
        lastName: parsed.lastName ? String(parsed.lastName) : null,
      };
    } catch {
      return null;
    }
  };

  const isHomeTemplate = () => {
    try {
      if (document.body && typeof document.body.className === "string") {
        if (document.body.className.includes("template-index")) return true;
        if (document.body.className.includes("template-home")) return true;
      }
    } catch {
      // ignore
    }
    return window.location && window.location.pathname === "/";
  };

  const discoverProductHandlesOnPage = () => {
    const handles = new Set();
    try {
      const links = document.querySelectorAll('a[href*="/products/"]');
      for (const a of links) {
        const href = a.getAttribute("href") || "";
        const match = href.match(/\/products\/([^/?#]+)/i);
        if (match && match[1]) handles.add(match[1]);
      }
    } catch {
      // ignore
    }
    return Array.from(handles);
  };

  const fetchProductJsonByHandle = async (handle) => {
    if (!handle) return null;
    try {
      const res = await fetch(`/products/${encodeURIComponent(handle)}.js`, {
        credentials: "same-origin",
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const pickVariantIdFromProductJson = (productJson) => {
    try {
      const variants = productJson?.variants;
      if (!Array.isArray(variants) || variants.length === 0) return null;
      const available = variants.find((v) => v?.available) || variants[0];
      const id = available?.id != null ? String(available.id) : null;
      return id && /^\d+$/.test(id) ? id : null;
    } catch {
      return null;
    }
  };

  const toVariantGid = (variantId) => {
    if (!variantId) return null;
    const s = String(variantId).trim();
    if (!s) return null;
    if (/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(s)) return s;
    if (/^\d+$/.test(s)) return `gid://shopify/ProductVariant/${s}`;
    return null;
  };

  const applyPersonalizedImageSwaps = (handleToImageUrl) => {
    if (!handleToImageUrl || typeof handleToImageUrl !== "object") return;
    try {
      const entries = Object.entries(handleToImageUrl);
      for (const [handle, imageUrl] of entries) {
        if (!handle || !imageUrl) continue;
        const selector = `a[href*="/products/${CSS.escape(handle)}"]`;
        const links = document.querySelectorAll(selector);
        links.forEach((link) => {
          const imgs = link.querySelectorAll("img");
          imgs.forEach((img) => {
            if (!(img instanceof HTMLImageElement)) return;
            if (!img.dataset.nusenseOriginalSrc) {
              img.dataset.nusenseOriginalSrc = img.currentSrc || img.src || "";
            }
            img.src = imageUrl;
            img.removeAttribute("srcset");
            img.removeAttribute("sizes");
          });
        });
      }
    } catch {
      // ignore
    }
  };

  const fetchAndApplyExistingPersonalizedImages = async ({
    shopDomain,
    customerInfo,
    products,
  }) => {
    try {
      const email = customerInfo?.email ? String(customerInfo.email).trim() : "";
      if (!email) return;
      const store = normalizeStoreDomain(shopDomain);
      if (!store) return;
      if (!Array.isArray(products) || products.length === 0) return;

      const base = getNusenseApiBase();
      const url = new URL(`${base}/api/image-generations/customer`);
      url.searchParams.set("email", email);
      url.searchParams.set("store", store);
      url.searchParams.set("page", "1");
      url.searchParams.set("limit", "50");

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        mode: "cors",
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (!json?.success || !Array.isArray(json.data)) return;

      const variantToUrl = new Map();
      for (const it of json.data) {
        const gid = toVariantGid(it?.variantId ?? it?.variant_id);
        const u = it?.generatedImageUrl ? String(it.generatedImageUrl).trim() : "";
        if (!gid || !u) continue;
        variantToUrl.set(gid, u);
      }

      const handleToUrl = {};
      for (const p of products || []) {
        const gid = p?.variantGid;
        if (!gid) continue;
        const mapped = variantToUrl.get(gid);
        if (mapped) handleToUrl[p.handle] = mapped;
      }

      applyPersonalizedImageSwaps(handleToUrl);
    } catch {
      // ignore
    }
  };

  const trapFocus = (container) => {
    if (!container) return () => {};

    const getFocusableElements = () => {
      const selectors = [
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        'iframe',
      ];
      return Array.from(container.querySelectorAll(selectors.join(","))).filter((el) => {
        if (!(el instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        return true;
      });
    };

    const handleTab = (e) => {
      if (e.key !== "Tab") return;
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement || !container.contains(document.activeElement)) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement || !container.contains(document.activeElement)) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener("keydown", handleTab);

    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      setTimeout(() => {
        const firstElement = focusableElements[0];
        if (firstElement && container.contains(firstElement)) firstElement.focus();
      }, 100);
    }

    return () => container.removeEventListener("keydown", handleTab);
  };

  const buildIframeUrl = ({ widgetUrl, shopDomain, customerInfo }) => {
    const base = normalizeUrl(widgetUrl);
    if (!base) return null;

    try {
      const url = new URL(`${base}/landing-tryon`);
      if (shopDomain) url.searchParams.set("shop_domain", shopDomain);
      if (customerInfo?.id) url.searchParams.set("customerId", customerInfo.id);
      if (customerInfo?.email) url.searchParams.set("customerEmail", customerInfo.email);
      if (customerInfo?.firstName) url.searchParams.set("customerFirstName", customerInfo.firstName);
      if (customerInfo?.lastName) url.searchParams.set("customerLastName", customerInfo.lastName);
      return url.toString();
    } catch {
      return null;
    }
  };

  const openLandingOverlay = ({ widgetUrl, shopDomain, customerInfo }) => {
    if (!document.body) return;

    const widgetOrigin = getWidgetOrigin(widgetUrl);
    const overlayId = "nusense-landing-tryon-overlay";
    const titleId = "nusense-landing-tryon-title";
    const iframeId = "nusense-landing-tryon-iframe";

    const existing = document.getElementById(overlayId);
    if (existing) existing.remove();

    const previousOverflow = document.body.style.overflow || window.getComputedStyle(document.body).overflow || "";
    const scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.dataset.nusenseScrollY = String(scrollY);

    const overlay = document.createElement("div");
    overlay.id = overlayId;
    overlay.className = "nusense-widget-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", titleId);
    overlay.style.cssText = [
      "position: fixed",
      "top: 0",
      "left: 0",
      "width: 100%",
      "height: 100%",
      "background: rgba(0, 0, 0, 0.5)",
      `z-index: ${CONSTANTS.OVERLAY_Z_INDEX}`,
      "display: flex",
      "align-items: center",
      "justify-content: center",
      "padding: 1rem",
    ].join(";");

    const title = document.createElement("h2");
    title.id = titleId;
    title.textContent = "NUSENSE Landing Try-On";
    title.style.cssText = "position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;";

    const container = document.createElement("div");
    container.className = "nusense-widget-container";
    container.setAttribute("role", "document");
    container.style.cssText = [
      "position: relative",
      "width: 95vw",
      `max-width: ${CONSTANTS.DEFAULT_MODAL_WIDTH}px`,
      "height: 98vh",
      "background: #fff",
      "border-radius: 0.75rem",
      "overflow: hidden",
    ].join(";");

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    closeBtn.style.cssText = [
      "position: absolute",
      "top: 10px",
      "right: 12px",
      "z-index: 2",
      "width: 44px",
      "height: 44px",
      "border-radius: 9999px",
      "border: 1px solid rgba(0,0,0,0.12)",
      "background: rgba(255,255,255,0.9)",
      "cursor: pointer",
      "font-size: 22px",
      "line-height: 1",
    ].join(";");

    const iframeHref = buildIframeUrl({ widgetUrl, shopDomain, customerInfo });
    if (!iframeHref) return;

    const iframe = document.createElement("iframe");
    iframe.id = iframeId;
    iframe.src = iframeHref;
    iframe.setAttribute("title", "NUSENSE Landing Try-On");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.style.cssText = ["width: 100%", "height: 100%", "border: none", "display: block"].join(";");

    let cleanedUp = false;
    let focusTrapCleanup = null;

    const handleCleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;

      try {
        window.removeEventListener("message", handleMessage);
        document.removeEventListener("keydown", handleKeyDown);
        if (focusTrapCleanup) focusTrapCleanup();
      } catch {
        // ignore
      }

      try {
        overlay.remove();
      } catch {
        // ignore
      }

      try {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        document.body.style.overflow = previousOverflow;

        const savedScrollY = document.body.dataset.nusenseScrollY;
        if (savedScrollY) {
          delete document.body.dataset.nusenseScrollY;
          window.scrollTo(0, parseInt(savedScrollY, 10) || 0);
        }
      } catch {
        // ignore
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleCleanup();
    };

    const handleMessage = (event) => {
      try {
        if (widgetOrigin && event.origin !== widgetOrigin) return;
        if (event.data?.type === "NUSENSE_CLOSE_WIDGET") handleCleanup();
        if (event.data?.type === "NUSENSE_LANDING_TRYON_RESULTS") {
          const items = Array.isArray(event.data.items) ? event.data.items : [];
          const handleToUrl = {};
          for (const it of items) {
            const handle = it?.handle ? String(it.handle) : "";
            const u = it?.generatedImageUrl ? String(it.generatedImageUrl).trim() : "";
            if (!handle || !u) continue;
            handleToUrl[handle] = u;
          }
          applyPersonalizedImageSwaps(handleToUrl);
        }
      } catch {
        // ignore
      }
    };

    closeBtn.addEventListener("click", handleCleanup);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) handleCleanup();
    });

    container.appendChild(closeBtn);
    container.appendChild(iframe);
    overlay.appendChild(title);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    focusTrapCleanup = trapFocus(container);
    window.addEventListener("message", handleMessage);
    document.addEventListener("keydown", handleKeyDown);
  };

  const createFloatingButton = ({ text, onClick }) => {
    const id = "nusense-landing-tryon-fab";
    if (document.getElementById(id)) return;

    const btn = document.createElement("button");
    btn.id = id;
    btn.type = "button";
    btn.setAttribute("aria-label", text || "My Try-On");
    btn.textContent = text || "My Try-On";
    btn.style.cssText = [
      "position: fixed",
      "right: 16px",
      "bottom: 16px",
      `z-index: ${CONSTANTS.OVERLAY_Z_INDEX}`,
      "min-width: 44px",
      "min-height: 44px",
      "padding: 12px 14px",
      "border-radius: 9999px",
      "background: #111827",
      "color: #ffffff",
      "font-size: 14px",
      "font-weight: 600",
      "line-height: 1",
      "box-shadow: 0 10px 25px rgba(0,0,0,0.25)",
      "border: 1px solid rgba(255,255,255,0.12)",
      "cursor: pointer",
    ].join(";");
    btn.addEventListener("click", onClick);
    document.body.appendChild(btn);
  };

  const init = async () => {
    if (!isHomeTemplate()) return;
    const customerInfo = getCustomerInfoFromScriptTag();
    if (!customerInfo) return;

    const shopDomain = window?.NUSENSE_CONFIG?.shopDomain || "";
    if (!shopDomain) return;

    const widgetUrl = getWidgetUrl();
    const handles = discoverProductHandlesOnPage();

    const products = [];
    for (const handle of handles) {
      // eslint-disable-next-line no-await-in-loop
      const productJson = await fetchProductJsonByHandle(handle);
      const variantId = pickVariantIdFromProductJson(productJson);
      const variantGid = toVariantGid(variantId);
      if (!variantGid) continue;
      products.push({ handle, variantId, variantGid });
    }

    await fetchAndApplyExistingPersonalizedImages({
      shopDomain,
      customerInfo,
      products,
    });

    createFloatingButton({
      text: "My Try-On",
      onClick: () => openLandingOverlay({ widgetUrl, shopDomain, customerInfo }),
    });

    const widgetOrigin = getWidgetOrigin(widgetUrl);
    if (!widgetOrigin) return;

    window.addEventListener("message", (event) => {
      try {
        if (event.origin !== widgetOrigin) return;
        if (event.data?.type !== "NUSENSE_LANDING_REQUEST_CONTEXT") return;
        event.source?.postMessage(
          {
            type: "NUSENSE_LANDING_CONTEXT",
            shopDomain,
            customerInfo,
            products,
          },
          event.origin
        );
      } catch {
        // ignore
      }
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init().catch(() => {});
    });
  } else {
    init().catch(() => {});
  }
})();

