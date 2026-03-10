/**
 * Content Script
 *
 * Runs in the context of web pages to detect login forms and enable autofill.
 *
 * SECURITY CONSTRAINTS:
 * - NO access to cryptographic operations
 * - NO access to decrypted vault data
 * - Can only request autofill via background worker
 * - Cannot read master password or encryption keys
 *
 * This script is intentionally minimal to maintain security boundaries.
 */

console.log('[VaultSync:Extension] Content script loaded')

function shouldInject(): boolean {
  // Avoid mutating Next.js/React apps before hydration
  if (document.getElementById('__NEXT_DATA__')) return false
  if (document.querySelector('meta[name="next-head-count"]')) return false
  const host = window.location.hostname.toLowerCase()
  const port = window.location.port
  if ((host === 'localhost' || host === '127.0.0.1') && port === '3000') return false
  return true
}

const canInject = shouldInject()
if (!canInject) {
  console.log('[VaultSync:Extension] Skipping injection on app page')
}

// ============================================================================
// Form Detection
// ============================================================================

function getSiteName(): string {
  try {
    return new URL(window.location.href).hostname;
  } catch {
    return 'Website';
  }
}

function continueNativeSubmit(form: HTMLFormElement, submitter?: HTMLElement | null) {
  if (typeof form.requestSubmit === 'function') {
    if (submitter) {
      form.requestSubmit(submitter);
      return;
    }
    form.requestSubmit();
    return;
  }

  if (submitter instanceof HTMLElement && typeof submitter.click === 'function') {
    submitter.click();
    return;
  }

  form.submit();
}

function detectLoginForms() {
  const forms = document.querySelectorAll('form')

  forms.forEach(form => {
    if (form.dataset.pmInjected) return;
    form.dataset.pmInjected = 'true';
    let isContinuingSubmit = false;

    const passwordInputs = form.querySelectorAll('input[type="password"]')
    const usernameInputs = form.querySelectorAll('input[type="text"], input[type="email"]')

    if (passwordInputs.length > 0 && usernameInputs.length > 0) {
      console.log('[VaultSync:Extension] Login form detected')
      const usernameInput = usernameInputs[0] as HTMLInputElement;
      const passwordInput = passwordInputs[0] as HTMLInputElement;
      addAutofillButton(form, usernameInput, passwordInput);

      // Add submission detection for offering to save credentials
      form.addEventListener('submit', (e) => {
        if (isContinuingSubmit) {
          isContinuingSubmit = false;
          return;
        }
        const submitter = (e as SubmitEvent).submitter as HTMLElement | null;
        e.preventDefault();
        handleFormSubmit(form, usernameInput.value, passwordInput.value, () => {
          isContinuingSubmit = true;
          continueNativeSubmit(form, submitter);
        });
      });

      // Also handle enter key on password input
      passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleFormSubmit(form, usernameInput.value, passwordInput.value, () => {
            isContinuingSubmit = true;
            continueNativeSubmit(form);
          });
        }
      });
    }
  })
}

function handleFormSubmit(
  form: HTMLFormElement,
  username: string,
  password: string,
  continueSubmit: () => void,
) {
  if (!username || !password) {
    continueSubmit();
    return;
  }
  const currentUrl = window.location.href;

  // Ask background worker if we should save this (checks if it already exists)
  chrome.runtime.sendMessage({
    type: 'CHECK_NEW_CREDENTIAL',
    url: currentUrl,
    username: username
  }, (response) => {
    if (chrome.runtime.lastError || !response) {
      console.error('[VaultSync:Extension] Background worker error or no response', chrome.runtime.lastError);
      continueSubmit();
      return;
    }

    if (response && response.shouldPrompt) {
      showSavePrompt(currentUrl, username, password, () => {
        continueSubmit();
      });
    } else {
      // If we shouldn't prompt, proceed with form submission natively
      continueSubmit();
    }
  });
}

// ============================================================================
// Save Prompt UI
// ============================================================================

function showSavePrompt(url: string, username: string, password: string, continueSubmit: () => void) {
  // Remove existing if any
  const existing = document.getElementById('pm-save-prompt');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'pm-save-prompt';
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
  `;

  const shadow = container.attachShadow({ mode: 'closed' });

  const prompt = document.createElement('div');
  prompt.style.cssText = `
    background: oklch(0.12 0.02 90);
    border: 1px solid oklch(0.38 0.01 0);
    border-radius: 12px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.8), 0 0 15px rgba(218, 165, 32, 0.15);
    padding: 20px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: oklch(0.98 0.01 90);
    width: 320px;
    animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  // Add keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(120%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(120%); opacity: 0; }
    }
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-save {
      background: linear-gradient(135deg, oklch(0.86 0.19 89) 0%, oklch(0.7 0.15 89) 100%);
      color: oklch(0.05 0 0);
    }
    .btn-save:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }
    .btn-cancel {
      background: oklch(0.08 0 0);
      color: oklch(0.8 0.01 90);
      border: 1px solid oklch(0.38 0.01 0);
    }
    .btn-cancel:hover {
      background: oklch(0.38 0.01 0);
      color: oklch(0.98 0.01 90);
    }
  `;
  shadow.appendChild(style);

  prompt.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 12px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="oklch(0.86 0.19 89)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 12px;">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
      <h3 style="margin: 0; font-size: 16px; font-weight: 700;">Save Password?</h3>
    </div>
    <p style="margin: 0 0 16px 0; font-size: 13px; color: oklch(0.6 0.02 90); line-height: 1.5;">
      Would you like Zenith Vault to securely save this login for <strong>${new URL(url).hostname}</strong>?
    </p>
    <div style="display: flex; gap: 10px; justify-content: flex-end;">
      <button class="btn btn-cancel" id="pm-btn-cancel">Never</button>
      <button class="btn btn-save" id="pm-btn-save">Save to Vault</button>
    </div>
  `;

  shadow.appendChild(prompt);
  document.body.appendChild(container);

  const removePrompt = () => {
    prompt.style.animation = 'fadeOut 0.3s ease-in forwards';
    setTimeout(() => {
      container.remove();
      continueSubmit();
    }, 300);
  };

  shadow.getElementById('pm-btn-cancel')?.addEventListener('click', () => {
    // Optionally alert background script to never ask for this domain again
    removePrompt();
  });

  shadow.getElementById('pm-btn-save')?.addEventListener('click', () => {
    const saveBtn = shadow.getElementById('pm-btn-save') as HTMLButtonElement;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    chrome.runtime.sendMessage({
      type: 'SAVE_NEW_CREDENTIAL',
      url: url,
      siteName: new URL(url).hostname,
      username: username,
      password: password
    }, (response) => {
      if (response && response.success) {
        saveBtn.textContent = 'Saved!';
        saveBtn.style.background = '#10b981';
        saveBtn.style.color = 'white';
        setTimeout(removePrompt, 1000); // Reduced delay before continuing
      } else {
        saveBtn.textContent = 'Failed';
        saveBtn.style.background = '#ef4444';
        setTimeout(removePrompt, 1500);
      }
    });
  });
}

// ============================================================================
// Initialize
// ============================================================================

function addAutofillButton(form: HTMLFormElement, usernameInput: HTMLInputElement, passwordInput: HTMLInputElement) {
  // Check if button already exists
  if (form.querySelector('.pm-autofill-btn')) {
    return
  }

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pm-autofill-btn'
  button.textContent = 'Autofill'
  button.style.cssText = `
    position: absolute;
    top: -30px;
    right: 0;
    padding: 6px 12px;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  `

  const indicator = document.createElement('span')
  indicator.className = 'pm-safe-indicator'
  indicator.textContent = '●'
  indicator.style.cssText = `
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 10px;
    height: 10px;
    color: #10b981;
    font-size: 14px;
    line-height: 10px;
    display: none;
    pointer-events: none;
    z-index: 10001;
  `

  const pwdParent = passwordInput.parentElement || form
  const parentStyle = window.getComputedStyle(pwdParent)
  if (parentStyle.position === 'static') {
    ;(pwdParent as HTMLElement).style.position = 'relative'
  }
  pwdParent.appendChild(indicator)

  function fillInputs(entry: any) {
    if (usernameInput) usernameInput.value = entry.username
    if (passwordInput) passwordInput.value = entry.password

    if (usernameInput) usernameInput.dispatchEvent(new Event('input', { bubbles: true }))
    if (passwordInput) passwordInput.dispatchEvent(new Event('input', { bubbles: true }))

    button.textContent = 'Filled'
    setTimeout(() => {
      button.textContent = 'Autofill'
    }, 2000)
  }

  button.addEventListener('click', async (e) => {
    e.stopPropagation()
    const currentUrl = window.location.href

    // Request autofill from background worker
    chrome.runtime.sendMessage({
      type: 'REQUEST_AUTOFILL',
      url: currentUrl
    }, (response) => {
      if (response && response.success && response.entries && response.entries.length > 0) {
        if (response.entries.length === 1) {
          fillInputs(response.entries[0]);
        } else {
          showCredentialsDropdown(response.entries, button, (selectedEntry) => {
             fillInputs(selectedEntry);
          });
        }
      } else {
        button.textContent = 'Not found'
        setTimeout(() => {
          button.textContent = 'Autofill'
        }, 2000)
      }
    })
  })

  // Position button relative to form
  const formRect = form.getBoundingClientRect()
  if (formRect.top > 40) {
    form.style.position = 'relative'
    form.appendChild(button)
  }

  // Check URL safety and update indicator/button state
  const currentUrl = window.location.href
  chrome.runtime.sendMessage({ type: 'CHECK_URL_MATCH', url: currentUrl }, (response) => {
    const isSafe = Boolean(response && response.success && response.match)
    console.log('[VaultSync:Extension] URL match check:', {
      currentUrl,
      currentNormalized: response?.currentNormalized,
      sampleEntries: response?.sampleEntries,
      match: response?.match
    })
    indicator.style.display = isSafe ? 'block' : 'none'
    button.disabled = !isSafe
    button.style.background = isSafe ? '#10b981' : '#9ca3af'
    button.style.cursor = isSafe ? 'pointer' : 'not-allowed'
    button.textContent = isSafe ? 'Autofill' : 'URL unavailable'
  })
}

// ============================================================================
// Credentials Dropdown UI
// ============================================================================

function showCredentialsDropdown(entries: any[], button: HTMLElement, onSelect: (entry: any) => void) {
  // Remove existing if any
  const existing = document.getElementById('pm-dropdown-container');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'pm-dropdown-container';
  container.style.cssText = `
    position: absolute;
    z-index: 2147483647;
  `;
  
  const rect = button.getBoundingClientRect();
  container.style.top = `${rect.bottom + window.scrollY + 5}px`;
  container.style.left = `${rect.left + window.scrollX}px`;

  const shadow = container.attachShadow({ mode: 'closed' });

  const dropdown = document.createElement('div');
  dropdown.style.cssText = `
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 8px 0;
    font-family: system-ui, sans-serif;
    min-width: 200px;
    border: 1px solid #e5e7eb;
  `;

  entries.forEach(entry => {
    const item = document.createElement('div');
    item.style.cssText = `
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      color: #374151;
      display: flex;
      flex-direction: column;
    `;
    item.innerHTML = `
      <span style="font-weight: 500">${entry.username}</span>
      <span style="font-size: 12px; color: #6b7280; margin-top: 2px;">Stored Password</span>
    `;
    item.addEventListener('mouseover', () => {
      item.style.backgroundColor = '#f3f4f6';
    });
    item.addEventListener('mouseout', () => {
      item.style.backgroundColor = 'transparent';
    });
    item.addEventListener('click', () => {
      onSelect(entry);
      container.remove();
    });
    dropdown.appendChild(item);
  });

  shadow.appendChild(dropdown);
  document.body.appendChild(container);

  const closeDropdown = (e: MouseEvent) => {
    if (!container.contains(e.target as Node) && e.target !== button) {
      container.remove();
      document.removeEventListener('click', closeDropdown);
    }
  };
  
  setTimeout(() => {
    document.addEventListener('click', closeDropdown);
  }, 10);
}

// ============================================================================
// Initialize
// ============================================================================

// Detect forms on page load
if (canInject) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.addEventListener('load', () => {
        setTimeout(detectLoginForms, 0)
      }, { once: true })
    })
  } else {
    window.addEventListener('load', () => {
      setTimeout(detectLoginForms, 0)
    }, { once: true })
  }
}

// Re-detect forms when DOM changes (for SPAs)
const observer = new MutationObserver(() => {
  if (canInject) detectLoginForms()
})

if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

// SECURITY NOTE: This content script has NO access to:
// - Master password
// - Derived encryption key
// - Decrypted vault data
// - Cryptographic operations
//
// All sensitive operations are handled by the background service worker.
