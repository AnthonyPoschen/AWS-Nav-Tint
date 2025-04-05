const aliasInput = document.getElementById("aliasInput");
const colorInput = document.getElementById("colorInput");
const addButton = document.getElementById("addButton");
const aliasList = document.getElementById("aliasList");

// --- Event Listeners ---
document.addEventListener("DOMContentLoaded", onPopupLoad); // Renamed for clarity
addButton.addEventListener("click", addOrUpdateAlias);
aliasList.addEventListener("click", handleDelete);

// --- Functions ---

// Function runs when the popup HTML is loaded
function onPopupLoad() {
  loadSettings();
  prepopulateAliasFromCurrentTab(); // Attempt to fill alias input
}

// Function to try and get alias from the active AWS tab
async function prepopulateAliasFromCurrentTab() {
  try {
    // 1. Get the current active tab
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // 2. Check if the tab URL looks like an AWS console page
    const awsConsolePattern = /^https?:\/\/.*\.console\.aws\.amazon\.com\//;
    const awsComPattern = /^https?:\/\/.*\.console\.aws\.com\//; // Also check .com variant

    if (
      currentTab?.url &&
      (awsConsolePattern.test(currentTab.url) ||
        awsComPattern.test(currentTab.url))
    ) {
      // 3. Try to get the specific cookie
      const cookie = await chrome.cookies.get({
        url: currentTab.url,
        name: "aws-userInfo",
      }); // Use correct name

      if (cookie?.value) {
        // 4. Decode and parse the cookie value
        try {
          const decodedValue = decodeURIComponent(cookie.value);
          const userInfo = JSON.parse(decodedValue);
          if (userInfo?.alias) {
            // 5. Set the input field value
            aliasInput.value = userInfo.alias;
            console.log(
              "AWS Account Colorizer Popup: Pre-populated alias:",
              userInfo.alias,
            );
          }
        } catch (parseError) {
          console.warn(
            "AWS Account Colorizer Popup: Could not parse aws-userInfo cookie.",
            parseError,
          );
        }
      } else {
        // console.log("AWS Account Colorizer Popup: aws-userInfo cookie not found on current tab."); // Optional debug
      }
    } else {
      // console.log("AWS Account Colorizer Popup: Not on an AWS Console tab."); // Optional debug
    }
  } catch (error) {
    console.error(
      "AWS Account Colorizer Popup: Error getting current tab or cookie:",
      error,
    );
  }
}

async function loadSettings() {
  const result = await chrome.storage.sync.get(["aliasColors"]);
  const aliasColors = result.aliasColors || {};
  renderList(aliasColors);
}

function renderList(aliasColors) {
  aliasList.innerHTML = ""; // Clear the current list
  const sortedAliases = Object.keys(aliasColors).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );

  if (sortedAliases.length === 0) {
    aliasList.innerHTML = "<li>No aliases configured yet.</li>";
    return;
  }

  sortedAliases.forEach((alias) => {
    const color = aliasColors[alias];
    const listItem = document.createElement("li");

    const colorPreview = document.createElement("span");
    colorPreview.className = "color-preview";
    colorPreview.style.backgroundColor = color;

    const aliasNameSpan = document.createElement("span");
    aliasNameSpan.className = "alias-name";
    aliasNameSpan.textContent = alias;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.dataset.alias = alias;

    listItem.appendChild(colorPreview);
    listItem.appendChild(aliasNameSpan);
    listItem.appendChild(deleteButton);
    aliasList.appendChild(listItem);
  });
}

async function addOrUpdateAlias() {
  const alias = aliasInput.value.trim();
  const color = colorInput.value;

  if (!alias) {
    alert("Please enter an AWS account alias.");
    return;
  }

  const result = await chrome.storage.sync.get(["aliasColors"]);
  const aliasColors = result.aliasColors || {};
  aliasColors[alias] = color;

  await chrome.storage.sync.set({ aliasColors });
  renderList(aliasColors);
  aliasInput.value = ""; // Clear input after adding/updating
  // Optionally pre-populate again if they are still on an AWS tab
  // prepopulateAliasFromCurrentTab(); // Or just leave it cleared
}

async function handleDelete(event) {
  if (event.target.classList.contains("delete-button")) {
    const aliasToDelete = event.target.dataset.alias;
    if (
      aliasToDelete &&
      confirm(
        `Are you sure you want to delete the configuration for alias "${aliasToDelete}"?`,
      )
    ) {
      const result = await chrome.storage.sync.get(["aliasColors"]);
      const aliasColors = result.aliasColors || {};
      if (aliasColors[aliasToDelete]) {
        delete aliasColors[aliasToDelete];
        await chrome.storage.sync.set({ aliasColors });
        renderList(aliasColors);
        // console.log(`Deleted alias: ${aliasToDelete}`); // Optional debug
      }
    }
  }
}
