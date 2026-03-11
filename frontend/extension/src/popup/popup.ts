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
  isDeleted?: boolean;
}

// ============================================================================
// DOM Elements
// ============================================================================

// Screens
const unlockScreen = document.getElementById("unlock-screen") as HTMLElement;
const otpScreen = document.getElementById("otp-screen") as HTMLElement;
const vaultScreen = document.getElementById("vault-screen") as HTMLElement;

// Unlock form
const unlockForm = document.getElementById("unlock-form") as HTMLFormElement;
const masterPasswordInput = document.getElementById(
  "master-password",
) as HTMLInputElement;
const unlockBtn = document.getElementById("unlock-btn") as HTMLButtonElement;
const unlockLoading = document.getElementById("unlock-loading") as HTMLElement;
const unlockError = document.getElementById("unlock-error") as HTMLElement;
const browserAuthStatus = document.getElementById("browser-auth-status") as HTMLElement;

// OTP form
const otpForm = document.getElementById("otp-form") as HTMLFormElement;
const otpCodeInput = document.getElementById("otp-code") as HTMLInputElement;
const verifyBtn = document.getElementById("verify-btn") as HTMLButtonElement;
const resendBtn = document.getElementById("resend-btn") as HTMLButtonElement;
const otpLoading = document.getElementById("otp-loading") as HTMLElement;
const otpError = document.getElementById("otp-error") as HTMLElement;
const otpCountdown = document.getElementById("otp-countdown") as HTMLElement;

// Vault Elements
const confirmModal = document.getElementById("confirm-modal") as HTMLElement;
const modalCancelBtn = document.getElementById(
  "modal-cancel-btn",
) as HTMLElement;
const modalConfirmBtn = document.getElementById(
  "modal-confirm-btn",
) as HTMLElement;

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

interface PopupResponse {
  success?: boolean;
  error?: string;
  vault?: PasswordEntry[];
  isLocked?: boolean;
  isOtpVerified?: boolean;
  otpRequired?: boolean;
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
  // Clear any previously saved User ID for privacy
  chrome.storage.local.remove(["userId"]).catch(() => {});

  // Try to get user profile first
  const profileResponse: any = await sendMessage({ type: "GET_USER_PROFILE" });
  if (profileResponse?.success && profileResponse.profile?.email) {
    currentUserId = profileResponse.profile.email;
    if (browserAuthStatus) {
      browserAuthStatus.innerHTML = `<p style="color: #10b981;">Logged in as: <strong>${currentUserId}</strong></p>`;
    }
  } else {
    // Show error, disable form
    if (browserAuthStatus) {
      browserAuthStatus.innerHTML = `<p style="color: #ef4444;">Please sign into your browser profile to use the extension.</p>`;
    }
    if (unlockBtn) unlockBtn.disabled = true;
    if (masterPasswordInput) masterPasswordInput.disabled = true;
  }

  // Check if vault is already unlocked
  const status = await sendMessage({ type: "GET_STATUS" });

  if (status && !status.isLocked) {
    if (status.isOtpVerified) {
      await loadVault();
      showScreen("vault");
    } else {
      // Unlocked but OTP not verified
      startOtpCountdown(600); // 10 minutes
      showScreen("otp");
    }
  } else {
    showScreen("unlock");
  }

  // Start heartbeat to keep background script alive while popup is open
  setInterval(() => {
    chrome.runtime.sendMessage({ type: "HEARTBEAT" }).catch(() => {});
  }, 10000);

  // Keep popup view fresh while open - sync every 1 second for instant updates
  setInterval(async () => {
    try {
      const currentStatus = await sendMessage({ type: "GET_STATUS" });
      
      if (currentStatus) {
        // Handle state transitions
        if (currentStatus.isLocked) {
          // Vault got locked - show unlock screen
          if (!unlockScreen.classList.contains("hidden") === false) {
            showScreen("unlock");
          }
        } else if (!currentStatus.isOtpVerified) {
          // Unlocked but OTP not verified - show OTP screen
          if (otpScreen.classList.contains("hidden")) {
            startOtpCountdown(600);
            showScreen("otp");
          }
        } else {
          // Unlocked and OTP verified - show vault
          if (!vaultScreen.classList.contains("hidden")) {
            await loadVault();
          } else if (vaultScreen.classList.contains("hidden")) {
            await loadVault();
            showScreen("vault");
          }
        }
      }
    } catch {
      // no-op
    }
  }, 1000); // Changed from 15000 to 1000 for instant updates
}

// ============================================================================
// Screen Management
// ============================================================================

function showScreen(screenName: string) {
  if (unlockScreen) unlockScreen.classList.add("hidden");
  if (otpScreen) otpScreen.classList.add("hidden");
  if (vaultScreen) vaultScreen.classList.add("hidden");

  switch (screenName) {
    case "unlock":
      if (unlockScreen) unlockScreen.classList.remove("hidden");
      if (masterPasswordInput && !masterPasswordInput.disabled) masterPasswordInput.focus();
      break;
    case "otp":
      if (otpScreen) otpScreen.classList.remove("hidden");
      if (otpCodeInput) otpCodeInput.focus();
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

    const masterPassword = masterPasswordInput.value;

    if (!currentUserId) {
      showError(unlockError, "No browser identity detected.");
      return;
    }

    if (!masterPassword) {
      showError(unlockError, "Please enter your Master Password");
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
        userId: currentUserId,
      });

      if (response && response.success) {
        // SECURITY: Clear master password immediately
        if (masterPasswordInput) masterPasswordInput.value = "";

        // Check if OTP verification is required
        if (response.otpRequired) {
          startOtpCountdown(600); // 10 minutes
          showScreen("otp");
        } else {
          // Load and display vault (legacy path, should not happen)
          await loadVault();
          showScreen("vault");
        }
      } else {
        showError(
          unlockError,
          (response && response.error) || "Failed to unlock vault",
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to unlock vault";
      showError(unlockError, message);
    } finally {
      if (unlockBtn) unlockBtn.disabled = false;
      if (unlockLoading) unlockLoading.classList.add("hidden");
    }
  });
}

// ============================================================================
// OTP Verification
// ============================================================================

let otpCountdownInterval: number | null = null;

function startOtpCountdown(seconds: number) {
  if (otpCountdownInterval) clearInterval(otpCountdownInterval);
  
  let timeLeft = seconds;
  
  const updateCountdown = () => {
    const minutes = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    if (otpCountdown) {
      otpCountdown.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    if (timeLeft <= 0) {
      if (otpCountdownInterval) clearInterval(otpCountdownInterval);
      showError(otpError, "Verification code expired. Please unlock again.");
      if (verifyBtn) verifyBtn.disabled = true;
    }
    
    timeLeft--;
  };
  
  updateCountdown();
  otpCountdownInterval = window.setInterval(updateCountdown, 1000);
}

if (otpForm) {
  otpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const code = otpCodeInput.value.trim();

    if (!code || code.length !== 6) {
      showError(otpError, "Please enter a valid 6-digit code");
      return;
    }

    // Show loading state
    if (verifyBtn) verifyBtn.disabled = true;
    if (otpLoading) otpLoading.classList.remove("hidden");
    if (otpError) otpError.classList.add("hidden");

    try {
      const response = await sendMessage({
        type: "VERIFY_OTP",
        code,
      });

      if (response && response.success) {
        // Clear OTP input
        if (otpCodeInput) otpCodeInput.value = "";
        
        // Stop countdown
        if (otpCountdownInterval) clearInterval(otpCountdownInterval);

        // Load and display vault
        await loadVault();
        showScreen("vault");
      } else {
        showError(
          otpError,
          (response && response.error) || "Invalid verification code",
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Verification failed";
      showError(otpError, message);
    } finally {
      if (verifyBtn) verifyBtn.disabled = false;
      if (otpLoading) otpLoading.classList.add("hidden");
    }
  });
}

if (resendBtn) {
  resendBtn.addEventListener("click", async () => {
    if (resendBtn) resendBtn.disabled = true;
    if (otpError) otpError.classList.add("hidden");

    try {
      const response = await sendMessage({ type: "SEND_OTP" });

      if (response && response.success) {
        // Restart countdown
        startOtpCountdown(600);
        
        // Show success message temporarily
        if (otpError) {
          otpError.textContent = "New code sent!";
          otpError.style.color = "#10b981";
          otpError.classList.remove("hidden");
          setTimeout(() => {
            if (otpError) {
              otpError.classList.add("hidden");
              otpError.style.color = "";
            }
          }, 3000);
        }
      } else {
        showError(
          otpError,
          (response && response.error) || "Failed to resend code",
        );
      }
    } catch (error) {
      showError(otpError, "Failed to resend code");
    } finally {
      if (resendBtn) resendBtn.disabled = false;
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
      currentVault = response.vault || [];
      console.log('[Popup] Loaded vault:', {
        count: currentVault.length,
        entries: currentVault.map(e => ({ id: e.id, siteName: e.siteName, isDeleted: e.isDeleted }))
      });
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
  vaultList.replaceChildren();

  const visibleEntries = entries.filter((entry) => !entry.isDeleted);

  if (visibleEntries.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  visibleEntries.forEach((entry) => {
    // Hide internal system configuration entries from the vault view
    if (entry.siteName === "SYSTEM_SHARING_KEYS" || entry.siteUrl === "system-sharing-keys") {
      return;
    }
    const item = createVaultItem(entry);
    vaultList.appendChild(item);
  });
}

function createVaultItem(entry: PasswordEntry) {
  const div = document.createElement("div");
  div.className = "vault-item";

  const content = document.createElement("div");
  content.className = "vault-item-content";

  const title = document.createElement("div");
  title.className = "vault-item-title";
  title.textContent = entry.siteName;

  const credentialsContainer = document.createElement("div");
  credentialsContainer.className = "vault-item-credentials";

  const user = document.createElement("div");
  user.className = "vault-item-username";
  user.textContent = entry.username || "No username";

  const passwordContainer = document.createElement("div");
  passwordContainer.className = "vault-item-password-container";

  const passwordText = document.createElement("span");
  passwordText.className = "vault-item-password";
  passwordText.textContent = "•".repeat(entry.password.length || 8);

  const eyeIcon = document.createElement("button");
  eyeIcon.className = "vault-item-eye-btn";
  eyeIcon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;

  let isPasswordVisible = false;
  eyeIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    isPasswordVisible = !isPasswordVisible;
    passwordText.textContent = isPasswordVisible ? entry.password : "•".repeat(entry.password.length || 8);
    // If visible, switch to a slightly smaller letter spacing by toggling a class
    if (isPasswordVisible) {
      passwordText.classList.add("visible");
    } else {
      passwordText.classList.remove("visible");
    }

    eyeIcon.innerHTML = isPasswordVisible ? `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    ` : `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
    eyeIcon.style.color = isPasswordVisible ? "var(--primary)" : "var(--text-muted)";
  });

  passwordContainer.appendChild(passwordText);
  passwordContainer.appendChild(eyeIcon);

  credentialsContainer.appendChild(user);
  credentialsContainer.appendChild(passwordContainer);

  content.appendChild(title);
  content.appendChild(credentialsContainer);

  const actions = document.createElement("div");
  actions.className = "vault-item-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "action-btn copy-btn";
  copyBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    COPY
  `;

  actions.appendChild(copyBtn);

  div.appendChild(content);
  div.appendChild(actions);

  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    copyToClipboard(entry.password, copyBtn);
  });

  return div;
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

async function sendMessage(message: unknown): Promise<PopupResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        const typedResponse = (response || {}) as PopupResponse;
        // Automatic redirection if vault is locked
        if (typedResponse.error === "Vault is locked") {
          console.warn("[Popup] Vault is locked, redirecting to unlock screen");
          currentVault = [];
          showScreen("unlock");
          if (masterPasswordInput) masterPasswordInput.value = "";
        }
        resolve(typedResponse);
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
