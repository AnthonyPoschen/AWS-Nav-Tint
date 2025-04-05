console.log("AWS Account Colorizer: Initialized."); // Simple startup message

async function applyAccountColor() {
  // 1. Find the target navigation element
  const navHeader = document.getElementById("awsc-nav-header");
  const navElement = navHeader ? navHeader.querySelector("nav") : null;

  if (!navElement) {
    // Don't log repeatedly if element isn't found yet, MutationObserver will trigger re-check
    // console.log("AWS Account Colorizer: Nav element not found yet.");
    // Retry mechanism removed - rely on MutationObserver or initial load
    return;
  }

  // Store original background color
  if (!navElement.dataset.originalBgColor) {
    navElement.dataset.originalBgColor =
      navElement.style.backgroundColor ||
      getComputedStyle(navElement).backgroundColor;
  }
  const originalBgColor = navElement.dataset.originalBgColor;

  // 2. Read the 'aws-userInfo' cookie (Corrected Case)
  const cookieString = document.cookie;
  const cookies = cookieString.split(";");
  const userInfoCookieString = cookies.find((cookiePart) => {
    const trimmedPart = cookiePart.trim();
    return trimmedPart.startsWith("aws-userInfo="); // Corrected case
  });

  if (!userInfoCookieString) {
    // console.log("AWS Account Colorizer: 'aws-userInfo' cookie not found."); // Optional: uncomment for specific debugging
    navElement.style.backgroundColor = originalBgColor; // Reset if cookie disappears
    return;
  }

  let currentUserAlias = null;
  try {
    const trimmedUserInfoCookie = userInfoCookieString.trim();
    const encodedUserInfo = trimmedUserInfoCookie.split("=")[1];

    if (!encodedUserInfo) {
      // console.error("AWS Account Colorizer: Found 'aws-userInfo=' but value is empty."); // Keep errors if needed
      navElement.style.backgroundColor = originalBgColor;
      return;
    }

    const decodedUserInfo = decodeURIComponent(encodedUserInfo);
    const userInfo = JSON.parse(decodedUserInfo);
    currentUserAlias = userInfo.alias; // Assuming 'alias' is the correct field

    if (!currentUserAlias) {
      // console.log("AWS Account Colorizer: 'alias' field not found in cookie data."); // Optional debug
      navElement.style.backgroundColor = originalBgColor;
      return;
    }
  } catch (error) {
    console.error(
      "AWS Account Colorizer: Error parsing 'aws-userInfo' cookie:",
      error,
      "Cookie part:",
      userInfoCookieString,
    );
    navElement.style.backgroundColor = originalBgColor; // Reset on error
    return;
  }

  // 3. Get user settings from storage
  try {
    const result = await chrome.storage.sync.get(["aliasColors"]);
    const aliasColors = result.aliasColors || {};

    // 4. Compare alias and apply color
    let colorToApply = originalBgColor;
    let matchFound = false;
    const lowerCaseCurrentUserAlias = currentUserAlias.toLowerCase();

    for (const configuredAlias in aliasColors) {
      if (configuredAlias.toLowerCase() === lowerCaseCurrentUserAlias) {
        colorToApply = aliasColors[configuredAlias];
        matchFound = true;
        break;
      }
    }

    // Apply the determined color only if it's different or a match was found
    if (navElement.style.backgroundColor !== colorToApply) {
      navElement.style.backgroundColor = colorToApply;
      if (matchFound) {
        console.log(
          `AWS Account Colorizer: Applied color ${colorToApply} for alias "${currentUserAlias}".`,
        );
      } else {
        // console.log("AWS Account Colorizer: Resetting to original color."); // Optional debug
      }
    }
  } catch (error) {
    console.error("AWS Account Colorizer: Error retrieving settings:", error);
    navElement.style.backgroundColor = originalBgColor; // Reset on error
  }
}

// --- Run the function ---
applyAccountColor(); // Run on initial load

// --- Handle Potential SPA Navigation ---
let navObserver = null;
let observerDebounceTimer = null;
const targetNode = document.body;

const observerCallback = (mutationsList, observer) => {
  let navMightHaveChanged = false;
  for (const mutation of mutationsList) {
    // Simplified check: If the nav header or anything inside it changes significantly
    if (
      mutation.target.closest &&
      mutation.target.closest("#awsc-nav-header")
    ) {
      navMightHaveChanged = true;
      break; // One relevant mutation is enough to trigger a check
    }
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node.id === "awsc-nav-header" ||
            node.querySelector("#awsc-nav-header"))
        ) {
          navMightHaveChanged = true;
        }
      });
      if (navMightHaveChanged) break; // Exit loop early
    }
  }

  if (navMightHaveChanged) {
    // console.log("AWS Account Colorizer: Detected potential nav change. Debouncing color check."); // Optional debug
    clearTimeout(observerDebounceTimer);
    observerDebounceTimer = setTimeout(() => {
      // console.log("AWS Account Colorizer: Re-applying color after debounce."); // Optional debug
      applyAccountColor();
    }, 300);
  }
};

const observerConfig = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["style", "class", "id"], // Observe common changes
};

function startObserver() {
  if (!document.body) {
    console.error(
      "AWS Account Colorizer: Cannot start observer, document.body not found.",
    );
    return;
  }
  if (navObserver) navObserver.disconnect();

  navObserver = new MutationObserver(observerCallback);
  navObserver.observe(targetNode, observerConfig);
  // console.log("AWS Account Colorizer: MutationObserver started."); // Optional debug
}

// --- Initialize Observer ---
requestAnimationFrame(() => {
  if (document.body) {
    startObserver();
  } else {
    document.addEventListener("DOMContentLoaded", startObserver);
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync" && changes.aliasColors) {
    // console.log('AWS Account Colorizer: Settings changed, re-applying color.'); // Optional debug
    applyAccountColor();
  }
});
