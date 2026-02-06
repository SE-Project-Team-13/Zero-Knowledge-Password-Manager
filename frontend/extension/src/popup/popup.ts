/**
 * Popup UI Script
 *
 * Handles user interaction and communicates with the background service worker.
 *
 * SECURITY NOTES:
 * - Master password is sent to background worker and immediately cleared
 * - No cryptographic operations happen here
 * - All sensitive operations delegated to background worker
 */

// Local interface for extension's password entries
interface PasswordEntry {
  id: string;
  siteName: string;
  siteUrl: string;
  username: string;
  password: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// DOM Elements
// ============================================================================

// Screens
const unlockScreen = document.getElementById("unlock-screen") as HTMLElement;
const registerScreen = document.getElementById(
  "register-screen",
) as HTMLElement;
const vaultScreen = document.getElementById("vault-screen") as HTMLElement;

// Unlock form
const unlockForm = document.getElementById("unlock-form") as HTMLFormElement;
const userIdInput = document.getElementById("user-id") as HTMLInputElement;
const masterPasswordInput = document.getElementById(
  "master-password",
) as HTMLInputElement;
const unlockBtn = document.getElementById("unlock-btn") as HTMLButtonElement;
const unlockLoading = document.getElementById("unlock-loading") as HTMLElement;
const unlockError = document.getElementById("unlock-error") as HTMLElement;
const goToRegisterBtn = document.getElementById(
  "go-to-register",
) as HTMLElement;

// Register form
const registerForm = document.getElementById(
  "register-form",
) as HTMLFormElement;
const regEmailInput = document.getElementById("reg-email") as HTMLInputElement;
const regPasswordInput = document.getElementById(
  "reg-password",
) as HTMLInputElement;
const regPasswordConfirmInput = document.getElementById(
  "reg-password-confirm",
) as HTMLInputElement;
const registerBtn = document.getElementById(
  "register-btn",
) as HTMLButtonElement;

// Vault Elements
const confirmModal = document.getElementById("confirm-modal") as HTMLElement;
const modalCancelBtn = document.getElementById(
  "modal-cancel-btn",
) as HTMLElement;
const modalConfirmBtn = document.getElementById(
  "modal-confirm-btn",
) as HTMLElement;
const registerLoading = document.getElementById(
  "register-loading",
) as HTMLElement;
const registerError = document.getElementById("register-error") as HTMLElement;
const goToLoginBtn = document.getElementById("go-to-login") as HTMLElement;

// Vault screen
const lockBtn = document.getElementById("lock-btn") as HTMLButtonElement;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const vaultList = document.getElementById("vault-list") as HTMLElement;
const emptyState = document.getElementById("empty-state") as HTMLElement;

const userDisplay = document.getElementById("user-display") as HTMLElement;
const displayUserEmail = document.getElementById(
  "display-user-email",
) as HTMLElement;

// ============================================================================
// State
// ============================================================================

let currentVault: PasswordEntry[] = [];
let currentUserId = "";

// ============================================================================
// Initialization
// ============================================================================

async function init() {
  // Clear any previously saved User ID for privacy
  chrome.storage.local.remove(["userId"]).catch(() => {});

  // Check if vault is already unlocked
  const status = await sendMessage({ type: "GET_STATUS" });

  if (status && !status.isLocked) {
    await loadVault();
    showScreen("vault");
  } else {
    showScreen("unlock");
  }

  // Start heartbeat to keep background script alive while popup is open
  setInterval(() => {
    chrome.runtime.sendMessage({ type: "HEARTBEAT" }).catch(() => {});
  }, 10000);
}

// ============================================================================
// Screen Management
// ============================================================================

function showScreen(screenName: string) {
  if (unlockScreen) unlockScreen.classList.add("hidden");
  if (registerScreen) registerScreen.classList.add("hidden");
  if (vaultScreen) vaultScreen.classList.add("hidden");

  switch (screenName) {
    case "unlock":
      if (unlockScreen) unlockScreen.classList.remove("hidden");
      if (userIdInput) userIdInput.focus();
      break;
    case "register":
      if (registerScreen) registerScreen.classList.remove("hidden");
      if (regEmailInput) regEmailInput.focus();
      break;
    case "vault":
      if (vaultScreen) vaultScreen.classList.remove("hidden");
      if (userDisplay) userDisplay.classList.remove("hidden");
      if (displayUserEmail) displayUserEmail.textContent = currentUserId;
      if (searchInput) searchInput.focus();
      break;
  }
}

// ============================================================================
// Unlock Vault
// ============================================================================

if (unlockForm) {
  unlockForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userId = userIdInput.value.trim();
    const masterPassword = masterPasswordInput.value;

    if (!userId || !masterPassword) {
      showError(unlockError, "Please enter both User ID and Master Password");
      return;
    }

    // Show loading state
    if (unlockBtn) unlockBtn.disabled = true;
    if (unlockLoading) unlockLoading.classList.remove("hidden");
    if (unlockError) unlockError.classList.add("hidden");

    try {
      // Send unlock request to background worker
      const response = await sendMessage({
        type: "UNLOCK_VAULT",
        masterPassword,
        userId,
      });

      if (response && response.success) {
        // SECURITY: Clear master password immediately
        if (masterPasswordInput) masterPasswordInput.value = "";

        // Set current user ID session
        currentUserId = userId;

        // Load and display vault
        await loadVault();
        showScreen("vault");
      } else {
        showError(
          unlockError,
          (response && response.error) || "Failed to unlock vault",
        );
      }
    } catch (error: any) {
      showError(unlockError, error.message);
    } finally {
      if (unlockBtn) unlockBtn.disabled = false;
      if (unlockLoading) unlockLoading.classList.add("hidden");
    }
  });
}

// Navigation
if (goToRegisterBtn) {
  goToRegisterBtn.addEventListener("click", (e) => {
    e.preventDefault();
    showScreen("register");
  });
}

if (goToLoginBtn) {
  goToLoginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    showScreen("unlock");
  });
}

// ============================================================================
// Register User
// ============================================================================

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = regEmailInput.value.trim();
    const password = regPasswordInput.value;
    const confirm = regPasswordConfirmInput.value;

    if (!email || !password || !confirm) {
      showError(registerError, "Please fill in all fields");
      return;
    }

    if (password !== confirm) {
      showError(registerError, "Passwords do not match");
      return;
    }

    if (password.length < 8) {
      showError(registerError, "Password must be at least 8 characters");
      return;
    }

    // Show loading state
    if (registerBtn) registerBtn.disabled = true;
    if (registerLoading) registerLoading.classList.remove("hidden");
    if (registerError) registerError.classList.add("hidden");

    try {
      const response = await sendMessage({
        type: "REGISTER_USER",
        email,
        masterPassword: password,
      });

      if (response && response.success) {
        // Registration successful
        currentUserId = email;

        // Clear inputs
        if (regPasswordInput) regPasswordInput.value = "";
        if (regPasswordConfirmInput) regPasswordConfirmInput.value = "";

        // Show vault
        await loadVault();
        showScreen("vault");
      } else {
        showError(
          registerError,
          (response && response.error) || "Failed to register",
        );
      }
    } catch (error: any) {
      showError(registerError, error.message);
    } finally {
      if (registerBtn) registerBtn.disabled = false;
      if (registerLoading) registerLoading.classList.add("hidden");
    }
  });
}

// ============================================================================
// Load Vault
// ============================================================================

async function loadVault() {
  try {
    const response = await sendMessage({ type: "GET_VAULT" });

    if (response && response.success) {
      currentVault = response.vault;
      renderVault(currentVault);
    } else {
      showError(
        unlockError,
        (response && response.error) || "Failed to load vault",
      );
    }
  } catch (error) {
    console.error("Failed to load vault:", error);
  }
}

// ============================================================================
// Render Vault
// ============================================================================

function renderVault(entries: PasswordEntry[]) {
  if (!vaultList) return;
  vaultList.innerHTML = "";

  if (entries.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  entries.forEach((entry, index) => {
    const item = createVaultItem(entry, index);
    vaultList.appendChild(item);
  });
}

function createVaultItem(entry: PasswordEntry, index: number) {
  const div = document.createElement("div");
  div.className = "vault-item";

  div.innerHTML = `
    <div class="vault-item-content">
      <div class="vault-item-title">${escapeHtml(entry.siteName)}</div>
      <div class="vault-item-url">${escapeHtml(entry.siteUrl)}</div>
      <div class="vault-item-username">${escapeHtml(entry.username)}</div>
    </div>
    <div class="vault-item-actions">
      <button class="action-btn delete-btn delete">Delete</button>
      <button class="copy-btn">Copy</button>
    </div>
  `;

  // Add copy functionality
  const copyBtn = div.querySelector(".copy-btn") as HTMLButtonElement;
  if (copyBtn) {
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      copyToClipboard(entry.password, copyBtn);
    });
  }

  // Add delete functionality
  const deleteBtn = div.querySelector(".delete-btn") as HTMLButtonElement;
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await handleDelete(entry.id);
    });
  }

  return div;
}

function showConfirmationModal(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!confirmModal) {
      resolve(
        confirm(
          "Are you sure you want to delete this password? (Modal not found)",
        ),
      );
      return;
    }

    confirmModal.classList.add("active");

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      confirmModal.classList.remove("active");
      modalConfirmBtn?.removeEventListener("click", handleConfirm);
      modalCancelBtn?.removeEventListener("click", handleCancel);
    };

    modalConfirmBtn?.addEventListener("click", handleConfirm);
    modalCancelBtn?.addEventListener("click", handleCancel);
  });
}

async function handleDelete(entryId: string) {
  const confirmed = await showConfirmationModal();
  if (!confirmed) return;

  try {
    const response = await sendMessage({
      type: "DELETE_PASSWORD",
      entryId,
    });

    if (response && response.success) {
      await loadVault();
    } else {
      alert((response && response.error) || "Failed to delete password");
    }
  } catch (error: any) {
    alert(error.message);
  }
}

// ============================================================================
// Search
// ============================================================================

if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase();

    if (!query) {
      renderVault(currentVault);
      return;
    }

    const filtered = currentVault.filter(
      (entry) =>
        entry.siteName.toLowerCase().includes(query) ||
        entry.siteUrl.toLowerCase().includes(query) ||
        entry.username.toLowerCase().includes(query),
    );

    renderVault(filtered);
  });
}

// ============================================================================
// Lock Vault
// ============================================================================

if (lockBtn) {
  lockBtn.addEventListener("click", async () => {
    await sendMessage({ type: "LOCK_VAULT" });
    currentVault = [];
    showScreen("unlock");
    if (masterPasswordInput) masterPasswordInput.value = "";
  });
}

// Listen for lock events from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "VAULT_LOCKED") {
    currentVault = [];
    showScreen("unlock");
    if (masterPasswordInput) masterPasswordInput.value = "";
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

async function sendMessage(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        // Automatic redirection if vault is locked
        if (response && response.error === "Vault is locked") {
          console.warn("[Popup] Vault is locked, redirecting to unlock screen");
          currentVault = [];
          showScreen("unlock");
          if (masterPasswordInput) masterPasswordInput.value = "";
        }
        resolve(response);
      }
    });
  });
}

function showError(element: HTMLElement | null, message: string) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove("hidden");

  setTimeout(() => {
    element.classList.add("hidden");
  }, 5000);
}

function escapeHtml(text: string) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function copyToClipboard(text: string, button: HTMLButtonElement) {
  try {
    await navigator.clipboard.writeText(text);

    const originalText = button.textContent;
    button.textContent = "✓ Copied";
    button.classList.add("copied");

    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove("copied");
    }, 2000);
  } catch (error) {
    console.error("Failed to copy:", error);
  }
}

// ============================================================================
// Initialize
// ============================================================================

init();
