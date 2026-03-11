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
      Save this login to Zenith Vault for <strong>${new URL(url).hostname}</strong>? It will sync across all your devices.
    </p>
    <div style="display: flex; gap: 10px; justify-content: flex-end;">
      <button class="btn btn-cancel" id="pm-btn-cancel">Not now</button>
      <button class="btn btn-save" id="pm-btn-save">Save & Sync</button>
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
    const cancelBtn = shadow.getElementById('pm-btn-cancel') as HTMLButtonElement;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    cancelBtn.disabled = true;

    console.log('[VaultSync:Extension] Saving new credential...', {
      url,
      username,
      siteName: new URL(url).hostname
    });

    chrome.runtime.sendMessage({
      type: 'SAVE_NEW_CREDENTIAL',
      url: url,
      siteName: new URL(url).hostname,
      username: username,
      password: password
    }, (response) => {
      console.log('[VaultSync:Extension] Save response:', response);
      
      if (response && response.success) {
        saveBtn.textContent = '✓ Saved & Synced!';
        saveBtn.style.background = '#10b981';
        saveBtn.style.color = 'white';
        console.log('[VaultSync:Extension] Credential saved successfully and synced to cloud');
        setTimeout(removePrompt, 1200); // Slightly longer to show success message
      } else {
        saveBtn.textContent = 'Failed to save';
        saveBtn.style.background = '#ef4444';
        console.error('[VaultSync:Extension] Failed to save credential:', response?.error);
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
  
  // Create button with logo
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 128 128" style="margin-right: 6px; vertical-align: middle;">
      <defs>
        <linearGradient id="btn-grad-${Date.now()}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e0e7ff;stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="64" r="60" fill="url(#btn-grad-${Date.now()})"/>
      <rect x="44" y="60" width="40" height="36" rx="4" fill="#6366f1"/>
      <path d="M 50 60 L 50 48 Q 50 36 64 36 Q 78 36 78 48 L 78 60" 
            stroke="#6366f1" stroke-width="8" fill="none" stroke-linecap="round"/>
      <circle cx="64" cy="72" r="4" fill="white"/>
      <rect x="62" y="72" width="4" height="8" fill="white"/>
    </svg>
    <span>Autofill with Zenith</span>
  `
  
  button.style.cssText = `
    position: relative !important;
    width: auto !important;
    margin-top: 12px !important;
    margin-bottom: 8px !important;
    padding: 8px 14px !important;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
    color: white !important;
    border: none !important;
    border-radius: 6px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    z-index: 10000 !important;
    box-shadow: 0 3px 10px rgba(99, 102, 241, 0.3) !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all 0.2s ease !important;
    font-family: system-ui, -apple-system, sans-serif !important;
    white-space: nowrap !important;
  `

  function fillInputs(entry: any) {
    // Fill both username and password together
    if (usernameInput) {
      usernameInput.value = entry.username
      // Dispatch multiple events for compatibility with various frameworks
      usernameInput.dispatchEvent(new Event('input', { bubbles: true }))
      usernameInput.dispatchEvent(new Event('change', { bubbles: true }))
      usernameInput.dispatchEvent(new Event('blur', { bubbles: true }))
      // Trigger React's value setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(usernameInput, entry.username);
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    
    if (passwordInput) {
      passwordInput.value = entry.password
      // Dispatch multiple events for compatibility with various frameworks
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }))
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }))
      passwordInput.dispatchEvent(new Event('blur', { bubbles: true }))
      // Trigger React's value setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(passwordInput, entry.password);
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" style="margin-right: 6px; vertical-align: middle;">
        <path d="M5 13l4 4L19 7" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Filled!</span>
    `
    setTimeout(() => {
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 128 128" style="margin-right: 6px; vertical-align: middle;">
          <defs>
            <linearGradient id="btn-grad-${Date.now()}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#e0e7ff;stop-opacity:1" />
            </linearGradient>
          </defs>
          <circle cx="64" cy="64" r="60" fill="url(#btn-grad-${Date.now()})"/>
          <rect x="44" y="60" width="40" height="36" rx="4" fill="#6366f1"/>
          <path d="M 50 60 L 50 48 Q 50 36 64 36 Q 78 36 78 48 L 78 60" 
                stroke="#6366f1" stroke-width="8" fill="none" stroke-linecap="round"/>
          <circle cx="64" cy="72" r="4" fill="white"/>
          <rect x="62" y="72" width="4" height="8" fill="white"/>
        </svg>
        <span>Autofill with Zenith</span>
      `
    }, 2000)
  }

  // Add hover effects
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-1px)'
    button.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.4)'
  })
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)'
    button.style.boxShadow = '0 3px 10px rgba(99, 102, 241, 0.3)'
  })

  button.addEventListener('click', async (e) => {
    e.preventDefault()
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
        button.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" style="margin-right: 6px; vertical-align: middle;">
            <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2" fill="none"/>
            <path d="M12 8v4M12 16h.01" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>No credentials saved</span>
        `
        setTimeout(() => {
          button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 128 128" style="margin-right: 6px; vertical-align: middle;">
              <defs>
                <linearGradient id="btn-grad-${Date.now()}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#e0e7ff;stop-opacity:1" />
                </linearGradient>
              </defs>
              <circle cx="64" cy="64" r="60" fill="url(#btn-grad-${Date.now()})"/>
              <rect x="44" y="60" width="40" height="36" rx="4" fill="#6366f1"/>
              <path d="M 50 60 L 50 48 Q 50 36 64 36 Q 78 36 78 48 L 78 60" 
                    stroke="#6366f1" stroke-width="8" fill="none" stroke-linecap="round"/>
              <circle cx="64" cy="72" r="4" fill="white"/>
              <rect x="62" y="72" width="4" height="8" fill="white"/>
            </svg>
            <span>Autofill with Zenith</span>
          `
        }, 2000)
      }
    })
  })

  // Smart button insertion logic - works with various form structures
  function insertButton() {
    // Strategy 1: Insert after password input within its container
    const passwordParent = passwordInput.parentElement;
    if (passwordParent) {
      // Check if there's a submit button we can insert before
      const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
      
      // Find the best insertion point
      let insertionPoint = null;
      let currentElement = passwordInput.nextElementSibling;
      
      // Look for the next sibling that's not hidden or has display: none
      while (currentElement && !insertionPoint) {
        const style = window.getComputedStyle(currentElement as Element);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          insertionPoint = currentElement;
          break;
        }
        currentElement = currentElement.nextElementSibling;
      }
      
      // Try to insert within the password input's parent first
      if (insertionPoint) {
        passwordParent.insertBefore(button, insertionPoint);
      } else if (submitButton && submitButton.parentElement === passwordParent) {
        passwordParent.insertBefore(button, submitButton);
      } else {
        passwordParent.appendChild(button);
      }
      return;
    }
    
    // Strategy 2: If password parent doesn't exist, try form-level insertion
    const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitButton) {
      submitButton.parentElement?.insertBefore(button, submitButton);
    } else {
      form.appendChild(button);
    }
  }
  
  // Insert the button
  insertButton();
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
  container.style.top = `${rect.bottom + window.scrollY + 8}px`;
  container.style.left = `${rect.left + window.scrollX}px`;

  const shadow = container.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from { 
        opacity: 0;
        transform: translateY(-10px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }
    .dropdown-item:hover {
      background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%) !important;
    }
  `;
  shadow.appendChild(style);

  const dropdown = document.createElement('div');
  dropdown.style.cssText = `
    background: oklch(0.98 0.01 90);
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(99, 102, 241, 0.1);
    padding: 8px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    min-width: 280px;
    max-width: 350px;
    animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  // Header with logo
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 12px 12px 8px;
    border-bottom: 1px solid oklch(0.9 0.01 90);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  header.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="dropdown-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#4f46e5;stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="64" r="60" fill="url(#dropdown-grad)"/>
      <rect x="44" y="60" width="40" height="36" rx="4" fill="white"/>
      <path d="M 50 60 L 50 48 Q 50 36 64 36 Q 78 36 78 48 L 78 60" 
            stroke="white" stroke-width="8" fill="none" stroke-linecap="round"/>
      <circle cx="64" cy="72" r="4" fill="#6366f1"/>
      <rect x="62" y="72" width="4" height="8" fill="#6366f1"/>
    </svg>
    <div style="flex: 1;">
      <div style="font-size: 13px; font-weight: 700; color: oklch(0.2 0.02 90);">Zenith Vault</div>
      <div style="font-size: 11px; color: oklch(0.5 0.02 90);">Select credential to autofill</div>
    </div>
  `;
  dropdown.appendChild(header);

  // Credentials list
  entries.forEach((entry, index) => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    item.style.cssText = `
      padding: 12px;
      cursor: pointer;
      font-size: 14px;
      border-radius: 8px;
      margin: 4px 0;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: all 0.15s ease;
      background: transparent;
    `;
    
    item.innerHTML = `
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="
          font-weight: 600;
          color: oklch(0.2 0.02 90);
          font-size: 14px;
          margin-bottom: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        ">${entry.username}</div>
        <div style="
          font-size: 12px;
          color: oklch(0.5 0.02 90);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        ">${entry.siteName || new URL(entry.siteUrl).hostname}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="oklch(0.5 0.02 90)" stroke-width="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    `;
    
    item.addEventListener('click', () => {
      onSelect(entry);
      container.remove();
    });
    
    dropdown.appendChild(item);
  });

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 8px 12px 4px;
    border-top: 1px solid oklch(0.9 0.01 90);
    margin-top: 4px;
    font-size: 11px;
    color: oklch(0.5 0.02 90);
    text-align: center;
  `;
  footer.textContent = `${entries.length} credential${entries.length > 1 ? 's' : ''} found`;
  dropdown.appendChild(footer);

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
