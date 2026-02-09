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

function detectLoginForms() {
  const forms = document.querySelectorAll('form')

  forms.forEach(form => {
    const passwordInputs = form.querySelectorAll('input[type="password"]')
    const usernameInputs = form.querySelectorAll('input[type="text"], input[type="email"]')

    if (passwordInputs.length > 0 && usernameInputs.length > 0) {
      console.log('[VaultSync:Extension] Login form detected')
      addAutofillButton(form, usernameInputs[0] as HTMLInputElement, passwordInputs[0] as HTMLInputElement)
    }
  })
}

// ============================================================================
// Autofill Button + Safety Indicator
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

  button.addEventListener('click', async () => {
    const currentUrl = window.location.href

    // Request autofill from background worker
    chrome.runtime.sendMessage({
      type: 'REQUEST_AUTOFILL',
      url: currentUrl
    }, (response) => {
      if (response && response.success && response.entry) {
        if (usernameInput) usernameInput.value = response.entry.username
        if (passwordInput) passwordInput.value = response.entry.password

        // Trigger input events for frameworks like React
        if (usernameInput) usernameInput.dispatchEvent(new Event('input', { bubbles: true }))
        if (passwordInput) passwordInput.dispatchEvent(new Event('input', { bubbles: true }))

        button.textContent = 'Filled'
        setTimeout(() => {
          button.textContent = 'Autofill'
        }, 2000)
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
