// ─── CrimX Theme Engine (CrimX Only) ───
(function() {
    // Only apply custom themes on CrimX surfaces
    const path = window.location.pathname.toLowerCase();
    const isCrimX = path.includes('/crimx') || path.includes('/dashboard') || path.includes('/auth') || path.includes('/link');

    if (isCrimX) {
        const savedTheme = localStorage.getItem('crimx-theme') || 'crimson';
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    document.documentElement.removeAttribute('data-animated-bg');
    document.documentElement.removeAttribute('data-cool-bg');
    localStorage.removeItem('crimx-animated-bg');
    localStorage.removeItem('crimx-cool-bg');
})();

window.setCrimXTheme = function(themeName) {
    const validThemes = ['crimson', 'emerald', 'void', 'solar', 'glacier', 'frutiger-aero', 'frutiger-metro'];
    if (!validThemes.includes(themeName)) themeName = 'crimson';
    
    localStorage.setItem('crimx-theme', themeName);

    const path = window.location.pathname.toLowerCase();
    const isCrimX = path.includes('/crimx') || path.includes('/dashboard') || path.includes('/auth') || path.includes('/link');

    if (isCrimX) {
        document.documentElement.setAttribute('data-theme', themeName);
        window.dispatchEvent(new CustomEvent('crimx-theme-changed', { detail: { theme: themeName } }));
    }

    // Update UI active card if present
    document.querySelectorAll('.theme-card-option').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-theme-val') === themeName);
    });

    const formattedName = themeName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    if (window.playSfx) window.playSfx('click');
    if (window.showToast) window.showToast(`CrimX theme set to ${formattedName}!`, 'info');
};

document.addEventListener('DOMContentLoaded', () => {
    const currentTheme = localStorage.getItem('crimx-theme') || 'crimson';
    document.querySelectorAll('.theme-card-option').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-theme-val') === currentTheme);
    });
});


// ── Universal Custom Dialog Engine (Rule 10: Zero alert/prompt) ──
function ensureCustomDialogElements() {
    if (typeof document === 'undefined' || !document.body) return;
    if (!document.getElementById('custom-alert')) {
        const alertOverlay = document.createElement('div');
        alertOverlay.id = 'custom-alert';
        alertOverlay.className = 'custom-modal-overlay';
        alertOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); z-index:999999; display:none; align-items:center; justify-content:center; padding:16px; box-sizing:border-box;';
        alertOverlay.innerHTML = `
            <div style="background:#141118; border:1px solid rgba(220,38,38,0.35); border-radius:18px; padding:28px 24px; max-width:440px; width:100%; box-shadow:0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(220,38,38,0.25); text-align:center; font-family:'Inter', sans-serif;">
                <div style="font-size:2rem; margin-bottom:10px;">🔥</div>
                <div id="custom-alert-message" style="color:#ede8ea; font-size:0.95rem; line-height:1.6; margin-bottom:22px; word-break:break-word;"></div>
                <button type="button" id="custom-alert-ok" style="background:#dc2626; color:#fff; border:none; padding:10px 28px; border-radius:10px; font-weight:700; font-size:0.9rem; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 15px rgba(220,38,38,0.4);">OK</button>
            </div>
        `;
        document.body.appendChild(alertOverlay);
    }

    if (!document.getElementById('custom-prompt')) {
        const promptOverlay = document.createElement('div');
        promptOverlay.id = 'custom-prompt';
        promptOverlay.className = 'custom-modal-overlay';
        promptOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); z-index:999999; display:none; align-items:center; justify-content:center; padding:16px; box-sizing:border-box;';
        promptOverlay.innerHTML = `
            <div style="background:#141118; border:1px solid rgba(220,38,38,0.35); border-radius:18px; padding:28px 24px; max-width:460px; width:100%; box-shadow:0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(220,38,38,0.25); font-family:'Inter', sans-serif;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                    <div style="font-size:1.5rem;">🔥</div>
                    <div id="custom-prompt-title" style="color:#fff; font-size:1.1rem; font-weight:800; font-family:'Outfit', sans-serif;">Prompt</div>
                </div>
                <div id="custom-prompt-desc" style="color:#94a3b8; font-size:0.86rem; line-height:1.5; margin-bottom:16px; word-break:break-word;"></div>
                <input type="text" id="custom-prompt-input" style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.15); border-radius:10px; padding:10px 14px; color:#fff; font-size:0.92rem; outline:none; margin-bottom:20px;">
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button type="button" id="custom-prompt-cancel" style="background:rgba(255,255,255,0.08); color:#ede8ea; border:1px solid rgba(255,255,255,0.12); padding:9px 20px; border-radius:10px; font-weight:600; font-size:0.88rem; cursor:pointer;">Cancel</button>
                    <button type="button" id="custom-prompt-confirm" style="background:#dc2626; color:#fff; border:none; padding:9px 22px; border-radius:10px; font-weight:700; font-size:0.88rem; cursor:pointer; box-shadow:0 4px 15px rgba(220,38,38,0.4);">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(promptOverlay);
    }
}

window.showCustomPrompt = function(title, desc, placeholder, onConfirm) {
    ensureCustomDialogElements();
    const overlay = document.getElementById('custom-prompt');
    const input = document.getElementById('custom-prompt-input');
    const titleEl = document.getElementById('custom-prompt-title');
    const descEl = document.getElementById('custom-prompt-desc');
    const cancelBtn = document.getElementById('custom-prompt-cancel');
    const confirmBtn = document.getElementById('custom-prompt-confirm');

    if (titleEl) titleEl.innerText = title || 'Prompt';
    if (descEl) descEl.innerText = desc || '';
    if (input) {
        input.style.display = 'block';
        input.placeholder = placeholder || '';
        input.value = '';
    }
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.classList.add('active');
    }
    setTimeout(() => { if (input) { input.focus(); input.select(); } }, 50);

    const closePrompt = () => {
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.display = 'none';
        }
    };

    if (cancelBtn) cancelBtn.onclick = closePrompt;

    const submitAction = () => {
        const val = input ? input.value.trim() : '';
        if (val !== '') {
            closePrompt();
            if (typeof onConfirm === 'function') onConfirm(val);
        }
    };

    if (confirmBtn) confirmBtn.onclick = submitAction;
    if (input) {
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitAction();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closePrompt();
            }
        };
    }
};

window.showCustomAlert = function(message, onOk) {
    ensureCustomDialogElements();
    const overlay = document.getElementById('custom-alert');
    const msgEl = document.getElementById('custom-alert-message');
    const okBtn = document.getElementById('custom-alert-ok');

    if (msgEl) msgEl.innerText = message || '';
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.classList.add('active');
    }

    const closeAlert = () => {
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.display = 'none';
        }
        if (typeof onOk === 'function') onOk();
    };

    if (okBtn) {
        okBtn.onclick = closeAlert;
        setTimeout(() => okBtn.focus(), 50);
    }
};
