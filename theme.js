// ─── CrimX Global Theme Engine ───
(function() {
    const savedTheme = localStorage.getItem('crimx-theme') || 'crimson';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.removeAttribute('data-animated-bg');
    document.documentElement.removeAttribute('data-cool-bg');
    localStorage.removeItem('crimx-animated-bg');
    localStorage.removeItem('crimx-cool-bg');
})();

window.setCrimXTheme = function(themeName) {
    const validThemes = ['crimson', 'emerald', 'void', 'solar', 'glacier', 'frutiger-aero', 'frutiger-metro'];
    if (!validThemes.includes(themeName)) themeName = 'crimson';
    
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('crimx-theme', themeName);

    // Dispatch global event so 3D planet and dynamic elements update live across the entire site
    window.dispatchEvent(new CustomEvent('crimx-theme-changed', { detail: { theme: themeName } }));

    // Update UI active card if present
    document.querySelectorAll('.theme-card-option').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-theme-val') === themeName);
    });

    const formattedName = themeName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    if (window.playSfx) window.playSfx('click');
    if (window.showToast) window.showToast(`Theme set to ${formattedName}!`, 'info');
};

document.addEventListener('DOMContentLoaded', () => {
    const currentTheme = localStorage.getItem('crimx-theme') || 'crimson';
    document.querySelectorAll('.theme-card-option').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-theme-val') === currentTheme);
    });
});
