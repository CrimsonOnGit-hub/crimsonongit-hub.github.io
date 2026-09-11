// ─── CrimX Global Theme Engine ───
(function() {
    const savedTheme = localStorage.getItem('crimx-theme') || 'crimson';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Dynamic "cool bg" - disabled by default
    const coolBg = localStorage.getItem('crimx-cool-bg') === 'true';
    if (coolBg) {
        document.documentElement.setAttribute('data-cool-bg', 'true');
    } else {
        document.documentElement.removeAttribute('data-cool-bg');
    }
})();

window.setCrimXTheme = function(themeName) {
    const validThemes = ['crimson', 'emerald', 'void', 'solar', 'glacier', 'frutiger-aero', 'frutiger-metro'];
    if (!validThemes.includes(themeName)) themeName = 'crimson';
    
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('crimx-theme', themeName);

    // Update UI active card if present
    document.querySelectorAll('.theme-card-option').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-theme-val') === themeName);
    });

    const formattedName = themeName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    if (window.playSfx) window.playSfx('click');
    if (window.showToast) window.showToast(`Theme set to ${formattedName}!`, 'info');
};

window.toggleCoolBackground = function(enabled) {
    if (enabled) {
        document.documentElement.setAttribute('data-cool-bg', 'true');
        localStorage.setItem('crimx-cool-bg', 'true');
        if (window.showToast) window.showToast("Dynamic background enabled!", "info");
    } else {
        document.documentElement.removeAttribute('data-cool-bg');
        localStorage.setItem('crimx-cool-bg', 'false');
        if (window.showToast) window.showToast("Default signature background restored.", "info");
    }
    if (window.playSfx) window.playSfx('click');
};

document.addEventListener('DOMContentLoaded', () => {
    const currentTheme = localStorage.getItem('crimx-theme') || 'crimson';
    document.querySelectorAll('.theme-card-option').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-theme-val') === currentTheme);
    });

    const coolBgCheckbox = document.getElementById('pref-cool-bg');
    if (coolBgCheckbox) {
        // Disabled by default
        coolBgCheckbox.checked = (localStorage.getItem('crimx-cool-bg') === 'true');
    }
});
