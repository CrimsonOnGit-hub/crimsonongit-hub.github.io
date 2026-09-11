// ─── CrimX Global Theme Engine ───
(function() {
    const savedTheme = localStorage.getItem('crimx-theme') || 'crimson';
    document.documentElement.setAttribute('data-theme', savedTheme);
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

document.addEventListener('DOMContentLoaded', () => {
    const currentTheme = localStorage.getItem('crimx-theme') || 'crimson';
    document.querySelectorAll('.theme-card-option').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-theme-val') === currentTheme);
    });
});
