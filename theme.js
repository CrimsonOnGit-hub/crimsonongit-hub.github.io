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
