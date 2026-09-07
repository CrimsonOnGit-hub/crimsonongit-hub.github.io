// ─── CrimX Global Theme Engine ───
(function() {
    const savedTheme = localStorage.getItem('crimx-theme') || 'crimson';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

window.setCrimXTheme = function(themeName) {
    const validThemes = ['crimson', 'emerald', 'void', 'solar', 'glacier'];
    if (!validThemes.includes(themeName)) themeName = 'crimson';
    
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('crimx-theme', themeName);

    // Update UI active card if present
    document.querySelectorAll('.theme-card-option').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-theme-val') === themeName);
    });

    if (window.playSfx) window.playSfx('click');
    if (window.showToast) window.showToast(`Theme set to ${themeName.charAt(0).toUpperCase() + themeName.slice(1)}!`, 'info');
};

document.addEventListener('DOMContentLoaded', () => {
    const currentTheme = localStorage.getItem('crimx-theme') || 'crimson';
    document.querySelectorAll('.theme-card-option').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-theme-val') === currentTheme);
    });
});
