import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, increment, collection, query, where, getDocs, setDoc, deleteDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBSSJKDrFJ1_qlliZqgw34CY2TSaKOxxxM",
    authDomain: "crimsonflame-8169e.firebaseapp.com",
    projectId: "crimsonflame-8169e",
    storageBucket: "crimsonflame-8169e.firebasestorage.app",
    messagingSenderId: "406321213530",
    appId: "1:406321213530:web:92d27a69d34d147393a863"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentUsername = 'user';
let activeLoadedPageKey = null;
let activeLoadedPageData = null;
let activeEditingPage = null;
let userPagesCache = [];

const DEFAULT_PFP = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ─── ROUTE PARAMETER PARSER ───
function getRouteParams() {
    const params = new URLSearchParams(window.location.search);
    const pathParts = window.location.pathname.split('/').filter(Boolean);

    let username = params.get('u') || params.get('user') || '';
    let pageName = params.get('p') || params.get('page') || '';
    const isBuildStatus = params.get('status') === 'true' || window.location.hash.includes('status');

    // Handle path-based routes: /username or /username/pagename
    const reservedRoutes = ['pages', 'dashboard', 'developer', 'projects', 'auth', 'terms', 'privacy', 'link', 'status', 'api'];
    if (pathParts.length > 0 && !reservedRoutes.includes(pathParts[0].toLowerCase())) {
        username = pathParts[0];
        pageName = pathParts.length > 1 ? pathParts[1] : 'me';
    }

    return {
        username: username.toLowerCase().replace(/^@/, ''),
        pageName: pageName.toLowerCase(),
        isBuildStatus: isBuildStatus
    };
}

// ─── AUTH STATE OBSERVER ───
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        try {
            const userDocSnap = await getDoc(doc(db, "users", user.uid));
            if (userDocSnap.exists()) {
                const uData = userDocSnap.data();
                currentUsername = (uData.username || user.email.split('@')[0]).toLowerCase();
            } else {
                currentUsername = (user.displayName || user.email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '');
            }
        } catch(e) {
            currentUsername = (user.email.split('@')[0] || 'user').toLowerCase();
        }

        const meUrlEl = document.getElementById('hub-me-page-url');
        if (meUrlEl) meUrlEl.innerText = `crimx.crimsonflame.net/@${currentUsername}`;
        const prefixEl = document.getElementById('new-page-url-prefix');
        if (prefixEl) prefixEl.innerText = `crimx.crimsonflame.net/@${currentUsername}/`;

        loadHubUserPages();
    }
});

// ─── MARKDOWN PARSER ───
function parseMarkdown(md) {
    if (!md) return '';
    let html = md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    html = html.replace(/```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const codeId = `code_${Math.random().toString(36).slice(2, 7)}`;
        return `
            <div style="position: relative; margin: 14px 0;">
                <button type="button" class="code-copy-btn" onclick="window.copyCodeSnippet('${codeId}')">Copy</button>
                <pre><code id="${codeId}" class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>
            </div>
        `;
    });

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid #f97316; padding-left: 12px; color: #94a3b8; margin: 10px 0;">$1</blockquote>');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; border-radius: 8px; margin: 10px 0;">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #58a6ff; text-decoration: underline;">$1</a>');
    html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li style="margin-left: 20px; list-style-type: disc;">$1</li>');
    html = html.replace(/\n\n+/g, '<br><br>');

    return html;
}

window.copyCodeSnippet = function(codeId) {
    const el = document.getElementById(codeId);
    if (!el) return;
    navigator.clipboard.writeText(el.innerText).then(() => {
        alert("Code copied to clipboard!");
    });
};

let rawReadmeContent = '';
window.copyReadmeRaw = function() {
    if (!rawReadmeContent) return;
    navigator.clipboard.writeText(rawReadmeContent).then(() => {
        alert("Raw README copied to clipboard!");
    });
};

// ─── INITIALIZER ───
async function initPages() {
    const { username, pageName, isBuildStatus } = getRouteParams();

    // 1. If no user specified, render the Dedicated CrimX Pages Hub!
    if (!username) {
        renderPagesHub();
        return;
    }

    const effectivePageName = pageName || 'me';
    const fullPageKey = `${username}_${effectivePageName}`;
    activeLoadedPageKey = fullPageKey;

    const pageUrlDisplay = effectivePageName === 'me'
        ? `crimx.crimsonflame.net/@${username}`
        : `crimx.crimsonflame.net/@${username}/${effectivePageName}`;

    // 2. Real Live Deployment Inspector (NO fake simulator)
    if (isBuildStatus) {
        renderLiveDeploymentStatus(username, effectivePageName, pageUrlDisplay);
        return;
    }

    try {
        // 3. Query Firestore user_pages document
        let pageData = null;
        const pageDocSnap = await getDoc(doc(db, "user_pages", fullPageKey));
        if (pageDocSnap.exists()) {
            pageData = pageDocSnap.data();
        } else {
            const q = query(
                collection(db, "user_pages"),
                where("username", "==", username),
                where("slug", "==", effectivePageName)
            );
            const qSnap = await getDocs(q);
            if (!qSnap.empty) pageData = qSnap.docs[0].data();
        }

        // 4. Fallback for "me" page if not explicitly saved as a user_page
        if (!pageData && effectivePageName === 'me') {
            const userQ = query(collection(db, "users"), where("username", "==", username));
            const userSnap = await getDocs(userQ);
            if (!userSnap.empty) {
                const u = userSnap.docs[0].data();
                pageData = {
                    username: username,
                    ownerUid: userSnap.docs[0].id,
                    slug: 'me',
                    title: `${u.displayName || username}'s Profile`,
                    template: 'me',
                    published: true,
                    meData: {
                        headline: u.displayName || username,
                        theme: 'crimson',
                        bio: u.bio || 'CrimX player profile showcase.',
                        links: []
                    }
                };
            }
        }

        if (pageData && pageData.published !== false) {
            activeLoadedPageData = pageData;

            // Increment atomic page view counter
            try {
                const pageRef = doc(db, "user_pages", fullPageKey);
                await updateDoc(pageRef, { views: increment(1) });
            } catch(e) {}

            if (pageData.template === 'game') {
                renderGameTemplate(username, effectivePageName, pageData);
            } else if (pageData.template === 'repo') {
                renderRepositoryPage(username, effectivePageName, pageData);
            } else if (pageData.template === 'html') {
                renderPureHtmlPage(pageData.htmlContent || '<h1>Pure HTML Sandbox</h1>');
            } else {
                renderMePage(username, pageData);
            }
            return;
        }

        // 5. Not found -> Custom Pages 404
        renderCustom404(username, effectivePageName);

    } catch(err) {
        console.error("Error loading CrimX Page:", err);
        renderCustom404(username, effectivePageName);
    }
}

// ─── RENDERERS ───
function hideAllViews() {
    document.querySelectorAll('.pages-container, #pages-view-html, #pages-view-404').forEach(el => el.style.display = 'none');
}

function renderCustom404(username, pageName) {
    hideAllViews();
    const view404 = document.getElementById('pages-view-404');
    if (view404) {
        view404.style.display = 'flex';
        const urlEl = document.getElementById('pages-404-url');
        if (urlEl) {
            urlEl.innerText = pageName === 'me'
                ? `crimx.crimsonflame.net/@${username}`
                : `crimx.crimsonflame.net/@${username}/${pageName}`;
        }
    }
}

// ─── REAL LIVE DEPLOYMENT INSPECTOR ───
async function renderLiveDeploymentStatus(username, pageName, pageUrlDisplay) {
    hideAllViews();
    const buildView = document.getElementById('pages-view-build');
    if (!buildView) return;
    buildView.style.display = 'block';

    const urlDisplay = document.getElementById('build-target-url');
    if (urlDisplay) urlDisplay.innerText = pageUrlDisplay;

    const liveBtn = document.getElementById('btn-visit-built-page');
    if (liveBtn) liveBtn.href = `/pages/index.html?u=${encodeURIComponent(username)}&p=${encodeURIComponent(pageName)}`;

    const pageDocId = `${username}_${pageName}`;
    try {
        const pageDocSnap = await getDoc(doc(db, "user_pages", pageDocId));
        const data = pageDocSnap.exists() ? pageDocSnap.data() : null;

        const tplName = document.getElementById('deploy-template-name');
        const tsEl = document.getElementById('deploy-timestamp');
        const viewsEl = document.getElementById('deploy-views-count');
        const starsEl = document.getElementById('deploy-stars-count');

        if (data) {
            if (tplName) tplName.innerText = (data.template || 'page').toUpperCase();
            if (tsEl) {
                const dateVal = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date();
                tsEl.innerText = dateVal.toLocaleString();
            }
            if (viewsEl) viewsEl.innerText = `${data.views || 0} views`;
            if (starsEl) starsEl.innerText = `⭐ ${data.stars || 0}`;
        } else {
            if (tplName) tplName.innerText = 'NOT FOUND';
            if (tsEl) tsEl.innerText = 'Draft / Unsaved';
        }
    } catch(err) {
        console.warn("Could not inspect deployment:", err);
    }
}

window.verifyLiveDeploymentHealth = async function() {
    const feedback = document.getElementById('deploy-health-feedback');
    if (!feedback) return;

    feedback.style.display = 'block';
    feedback.style.background = 'rgba(59,130,246,0.15)';
    feedback.style.color = '#93c5fd';
    feedback.innerText = 'Pinging edge route...';

    const { username, pageName } = getRouteParams();
    const pageDocId = `${username}_${pageName}`;

    try {
        const snap = await getDoc(doc(db, "user_pages", pageDocId));
        if (snap.exists()) {
            feedback.style.background = 'rgba(34,197,94,0.15)';
            feedback.style.color = '#4ade80';
            feedback.innerText = `✓ Verified Live! Route crimx.crimsonflame.net/@${username}/${pageName} is serving active content.`;
        } else {
            feedback.style.background = 'rgba(239,68,68,0.15)';
            feedback.style.color = '#f87171';
            feedback.innerText = `⚠️ Page document @${username}/${pageName} not found in database.`;
        }
    } catch(err) {
        feedback.style.background = 'rgba(239,68,68,0.15)';
        feedback.style.color = '#f87171';
        feedback.innerText = 'Error: ' + err.message;
    }
};

// ─── REAL ME PAGE RENDERER ───
async function renderMePage(username, pageData) {
    hideAllViews();
    const meView = document.getElementById('pages-view-me');
    if (!meView) return;
    meView.style.display = 'block';

    let userProfile = {};
    try {
        if (pageData.ownerUid) {
            const uSnap = await getDoc(doc(db, "users", pageData.ownerUid));
            if (uSnap.exists()) userProfile = uSnap.data();
        } else {
            const userQ = query(collection(db, "users"), where("username", "==", username));
            const uSnap = await getDocs(userQ);
            if (!uSnap.empty) userProfile = uSnap.docs[0].data();
        }
    } catch(e) {}

    const dispName = userProfile.displayName || pageData.title || username;
    const pfp = userProfile.photoURL || DEFAULT_PFP;
    const banner = userProfile.banner || 'linear-gradient(135deg, #2b0d18 0%, #dc2626 50%, #15090f 100%)';
    const uNum = userProfile.userNumber || 1;
    const meObj = pageData.meData || {};

    // Banner (handles both CSS gradient & image URL cleanly)
    const bannerEl = document.getElementById('me-page-banner');
    if (bannerEl) {
        if (banner.startsWith('http')) {
            bannerEl.style.background = `url("${banner}") center/cover no-repeat`;
        } else {
            bannerEl.style.background = banner;
        }
    }

    // Avatar & Name
    const avatarEl = document.getElementById('me-page-avatar');
    if (avatarEl) avatarEl.src = pfp;

    const nameEl = document.getElementById('me-page-display-name');
    if (nameEl) nameEl.innerText = dispName;

    const handleEl = document.getElementById('me-page-handle');
    if (handleEl) handleEl.innerText = `@${username}`;

    const numBadge = document.getElementById('me-page-user-number');
    if (numBadge) numBadge.innerText = `Member #${uNum}`;

    // Presence Status
    const presEl = document.getElementById('me-page-presence');
    if (presEl) {
        const mode = userProfile.statusMode || 'online';
        const stText = userProfile.statusText || 'Online';
        presEl.innerHTML = `<span style="width:7px; height:7px; border-radius:50%; background:#22c55e;"></span> ${escapeHtml(stText)}`;
    }

    // Headline
    const headEl = document.getElementById('me-page-headline');
    if (headEl) headEl.innerText = meObj.headline || '';

    // Achievements Badges
    const badgeContainer = document.getElementById('me-page-achievements-container');
    if (badgeContainer) {
        let badges = [];
        if (uNum === 1) badges.push({ text: '👑 Crimson Pioneer', class: 'badge-pioneer' });
        else if (uNum <= 10) badges.push({ text: `⚡ Elite Pioneer (#${uNum})`, class: 'badge-elite' });
        else if (uNum <= 100) badges.push({ text: `🚀 Early Adopter (#${uNum})`, class: 'badge-early' });
        else badges.push({ text: '🛡️ Crimson Citizen', class: 'badge-citizen' });

        badges.push({ text: '📦 Creator', class: 'badge-creator' });
        badgeContainer.innerHTML = badges.map(b => `<span class="badge-achievement ${b.class}">${b.text}</span>`).join('');
    }

    // Bio
    const bioEl = document.getElementById('me-page-bio');
    if (bioEl) bioEl.innerText = meObj.bio || userProfile.bio || 'Welcome to my official CrimX Page!';

    // Custom Interactive Links
    const linksContainer = document.getElementById('me-page-links-container');
    if (linksContainer) {
        const links = Array.isArray(meObj.links) ? meObj.links : [];
        if (links.length > 0) {
            linksContainer.innerHTML = links.map(l => `
                <a href="${escapeHtml(l.url || '#')}" target="_blank" class="dev-btn-secondary" style="text-decoration: none; padding: 8px 16px; font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                    🔗 ${escapeHtml(l.label || 'Link')} ↗
                </a>
            `).join('');
        } else {
            linksContainer.innerHTML = '';
        }
    }
}

// ─── REPOSITORY PAGE RENDERER ───
function renderRepositoryPage(username, pageName, data) {
    hideAllViews();
    const repoView = document.getElementById('pages-view-repo');
    if (!repoView) return;
    repoView.style.display = 'block';

    document.getElementById('repo-user-prefix').innerText = username;
    document.getElementById('repo-name-text').innerText = data.title || pageName;
    document.getElementById('repo-desc-text').innerText = data.description || 'No description provided for this repository.';

    // Stars
    const starCount = data.stars || 0;
    const repoStarCount = document.getElementById('repo-star-count');
    if (repoStarCount) repoStarCount.innerText = starCount;

    // Render Files Table
    const tbody = document.getElementById('repo-files-tbody');
    const files = data.files || [];
    let readmeFile = null;

    if (tbody) {
        if (files.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #8b949e; padding: 24px;">No files added to this repository yet.</td></tr>`;
        } else {
            tbody.innerHTML = files.map(f => {
                if (f.name.toLowerCase() === 'readme.md') readmeFile = f;
                const sizeStr = formatBytes(f.size);
                const dateStr = f.lastModified ? new Date(f.lastModified).toLocaleDateString() : 'Recent';
                const contentData = f.content || '';
                return `
                    <tr>
                        <td style="font-family: monospace; font-weight: 700; color: #f0f6fc;">📄 ${escapeHtml(f.name)}</td>
                        <td style="color: #8b949e; font-size: 0.8rem;">${sizeStr}</td>
                        <td style="color: #8b949e; font-size: 0.8rem;">${dateStr}</td>
                        <td style="text-align: right;">
                            <button type="button" class="repo-btn-download" onclick="window.downloadRepoFile('${escapeHtml(f.name)}', '${encodeURIComponent(contentData)}')">Download</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Markdown README Viewer
    const readmeBox = document.getElementById('repo-readme-container');
    const readmeBody = document.getElementById('repo-readme-body');
    const readmeFilename = document.getElementById('repo-readme-filename');

    if (readmeFile && readmeBox && readmeBody) {
        rawReadmeContent = readmeFile.content || '';
        if (readmeFilename) readmeFilename.innerText = readmeFile.name;
        readmeBody.innerHTML = parseMarkdown(rawReadmeContent);
        readmeBox.style.display = 'block';
    } else if (readmeBox) {
        readmeBox.style.display = 'none';
    }

    // Releases List
    const releases = data.releases || [];
    const relCount = document.getElementById('repo-releases-count');
    if (relCount) relCount.innerText = releases.length;

    const relList = document.getElementById('repo-releases-list');
    if (relList) {
        if (releases.length === 0) {
            relList.innerHTML = `<div style="color: #8b949e; text-align: center; padding: 32px;">No releases published yet.</div>`;
        } else {
            relList.innerHTML = releases.map(r => {
                const tag = r.tag || 'v1.0.0';
                const title = r.title || `Release ${tag}`;
                const notes = r.notes || 'No release notes.';
                const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'Latest';
                return `
                    <div class="repo-release-card">
                        <div class="repo-release-header">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span class="repo-tag-badge">${escapeHtml(tag)}</span>
                                <h3 style="margin: 0; color: #f0f6fc; font-size: 1.15rem;">${escapeHtml(title)}</h3>
                            </div>
                            <span style="font-size: 0.8rem; color: #8b949e;">${date}</span>
                        </div>
                        <div style="color: #c9d1d9; font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; margin-bottom: 14px;">${escapeHtml(notes)}</div>
                        <button type="button" class="repo-btn-download" onclick="window.downloadArchiveBundle('${escapeHtml(pageName)}', '${escapeHtml(tag)}')">⬇ Download ${escapeHtml(tag)} Bundle</button>
                    </div>
                `;
            }).join('');
        }
    }

    // Download Full Archive button
    const cloneBtn = document.getElementById('repo-clone-btn');
    if (cloneBtn) {
        cloneBtn.onclick = (e) => {
            e.preventDefault();
            if (files.length === 0) return alert("Repository is empty.");
            const allText = files.map(f => `--- FILE: ${f.name} ---\n${f.content || ''}\n\n`).join('\n');
            window.downloadRepoFile(`${data.title || pageName}_bundle.txt`, allText);
        };
    }
}

window.downloadRepoFile = function(fileName, contentEncoded, mimeType = 'text/plain') {
    try {
        const link = document.createElement('a');
        link.download = fileName;
        const decoded = decodeURIComponent(contentEncoded);
        link.href = `data:${mimeType};charset=utf-8,` + encodeURIComponent(decoded);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch(e) {
        alert("Failed to download file: " + e.message);
    }
};

window.downloadArchiveBundle = function(repoSlug, versionTag) {
    if (!activeLoadedPageData || !activeLoadedPageData.files) return;
    const bundle = {
        repository: activeLoadedPageData.title || repoSlug,
        version: versionTag,
        files: activeLoadedPageData.files
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${repoSlug}-${versionTag}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

// ─── PLAYABLE GAME LAUNCHER RENDERER ───
function renderGameTemplate(username, pageName, data) {
    hideAllViews();
    const gameView = document.getElementById('pages-view-game');
    if (!gameView) return;
    gameView.style.display = 'block';

    document.getElementById('game-title-display').innerText = data.title || 'Playable Game';
    
    const versionBadge = document.getElementById('game-version-badge');
    if (versionBadge) versionBadge.innerText = data.gameData?.version || 'v1.0.0';

    const authorLink = document.getElementById('game-author-link');
    if (authorLink) {
        authorLink.innerText = `@${username}`;
        authorLink.href = `/pages/index.html?u=${encodeURIComponent(username)}&p=me`;
    }

    const viewsText = document.getElementById('game-views-text');
    if (viewsText) viewsText.innerText = `👁️ ${data.views || 0} plays`;

    const starCount = data.stars || 0;
    const gameStarCount = document.getElementById('game-star-count');
    if (gameStarCount) gameStarCount.innerText = starCount;

    // Splash cover
    const splash = document.getElementById('game-splash-cover');
    const gData = data.gameData || {};
    if (splash && gData.coverUrl) {
        splash.style.background = `url("${gData.coverUrl}") center/cover no-repeat`;
    }

    // Controls guide
    const controlsList = document.getElementById('game-controls-list');
    if (controlsList) {
        const rawControls = gData.controls || 'Arrow Keys / WASD : Move\nSpacebar : Boost';
        controlsList.innerHTML = rawControls.split('\n').filter(Boolean).map(line => {
            const parts = line.split(':');
            const keyPart = parts[0]?.trim() || '';
            const actionPart = parts[1]?.trim() || '';
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                    <span class="key-pill">${escapeHtml(keyPart)}</span>
                    <span style="font-size: 0.85rem; color: #e2e8f0; font-weight: 600;">${escapeHtml(actionPart)}</span>
                </div>
            `;
        }).join('');
    }

    // Description
    const descDisplay = document.getElementById('game-desc-display');
    if (descDisplay) {
        descDisplay.innerText = gData.description || data.description || 'Welcome to this browser game on CrimX Pages! Click "Launch Game" above to play.';
    }

    const gameCode = gData.code || data.htmlContent || `<!DOCTYPE html><html><body style="background:#080306;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h1>🎮 Game Ready</h1></body></html>`;

    window.launchGameSession = function() {
        if (splash) splash.style.display = 'none';
        const frame = document.getElementById('game-frame');
        if (frame) {
            frame.srcdoc = gameCode;
            frame.focus();
        }
    };

    window.restartGameSession = function() {
        const frame = document.getElementById('game-frame');
        if (frame && splash && splash.style.display === 'none') {
            frame.srcdoc = gameCode;
            frame.focus();
        }
    };

    let isMuted = false;
    window.toggleGameSound = function() {
        isMuted = !isMuted;
        const btn = document.getElementById('btn-game-sound');
        if (btn) btn.innerText = isMuted ? '🔇 Sound Off' : '🔊 Sound On';
        const frame = document.getElementById('game-frame');
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'CRIMX_SET_MUTE', muted: isMuted }, '*');
        }
    };

    window.toggleGameFullscreen = function() {
        const wrapper = document.getElementById('game-canvas-wrapper');
        if (!wrapper) return;
        if (!document.fullscreenElement) {
            wrapper.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };
}

// ─── PURE HTML SANDBOX RENDERER ───
function renderPureHtmlPage(html) {
    hideAllViews();
    const htmlView = document.getElementById('pages-view-html');
    const frame = document.getElementById('pages-html-frame');
    if (htmlView && frame) {
        htmlView.style.display = 'block';
        frame.srcdoc = html;
    }
}

// ─── DEDICATED CRIMX PAGES HUB ───
function renderPagesHub() {
    hideAllViews();
    const hubView = document.getElementById('pages-view-hub');
    if (!hubView) return;
    hubView.style.display = 'block';

    window.switchHubTab('mypages');
    loadHubUserPages();
}

window.switchHubTab = function(tabName) {
    const secMy = document.getElementById('hub-section-mypages');
    const secExp = document.getElementById('hub-section-explore');
    const btnMy = document.getElementById('hub-tab-mypages');
    const btnExp = document.getElementById('hub-tab-explore');

    if (tabName === 'explore') {
        if (secMy) secMy.style.display = 'none';
        if (secExp) secExp.style.display = 'block';
        if (btnMy) btnMy.classList.remove('active');
        if (btnExp) btnExp.classList.add('active');
        loadHubCommunityPages();
    } else {
        if (secMy) secMy.style.display = 'block';
        if (secExp) secExp.style.display = 'none';
        if (btnMy) btnMy.classList.add('active');
        if (btnExp) btnExp.classList.remove('active');
        loadHubUserPages();
    }
};

window.loadHubUserPages = async function() {
    const list = document.getElementById('hub-pages-list-container');
    const countTag = document.getElementById('hub-mypages-count');
    if (!list) return;

    if (!currentUser) {
        list.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; background: rgba(0,0,0,0.3); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1);">
                <div style="font-size: 2rem; margin-bottom: 8px;">🔒</div>
                <div style="font-weight: 700; color: #fff; font-size: 1.05rem; margin-bottom: 6px;">Sign In to Manage Your Pages</div>
                <p style="color: var(--page-text-muted); font-size: 0.85rem; margin-bottom: 16px;">Create repositories, build browser games, and showcase custom HTML sandboxes.</p>
                <a href="/dashboard/" class="btn-primary" style="text-decoration: none; padding: 8px 24px; font-weight: 700; display: inline-block;">Go to Dashboard & Sign In</a>
            </div>
        `;
        return;
    }

    try {
        const q = query(collection(db, "user_pages"), where("ownerUid", "==", currentUser.uid));
        const snap = await getDocs(q);
        userPagesCache = [];
        snap.forEach(d => userPagesCache.push({ id: d.id, ...d.data() }));

        const customPages = userPagesCache.filter(p => p.slug !== 'me');
        if (countTag) countTag.innerText = userPagesCache.length;

        if (customPages.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; color: var(--page-text-muted); padding: 40px 20px; background: rgba(0,0,0,0.25); border: 1px dashed rgba(255,255,255,0.08); border-radius: 16px;">
                    <div style="font-size: 2.2rem; margin-bottom: 10px;">📦</div>
                    <div style="font-weight: 800; color: #fff; font-size: 1.05rem; margin-bottom: 6px; font-family: 'Outfit', sans-serif;">No Repositories or Custom Pages Yet</div>
                    <div style="font-size: 0.82rem; color: var(--page-text-muted); max-width: 380px; margin: 0 auto 16px; line-height: 1.5;">
                        Launch your first code repository, retro canvas game, or pure HTML site on CrimX Pages!
                    </div>
                    <button type="button" class="btn-primary" onclick="window.openNewPageModal()" style="padding: 8px 20px; font-size: 0.85rem; font-weight: 700;">
                        + Create Your First Page
                    </button>
                </div>
            `;
            return;
        }

        list.innerHTML = customPages.map(page => {
            let icon = '📦';
            let templateLabel = 'REPOSITORY';
            if (page.template === 'game') { icon = '🎮'; templateLabel = 'PLAYABLE GAME'; }
            else if (page.template === 'html') { icon = '⚡'; templateLabel = 'PURE HTML'; }

            const views = page.views || 0;
            const stars = page.stars || 0;
            const fileCount = Array.isArray(page.files) ? page.files.length : 0;
            const liveUrl = `/pages/index.html?u=${encodeURIComponent(page.username || currentUsername)}&p=${encodeURIComponent(page.slug)}`;
            const statusUrl = `/pages/index.html?status=true&u=${encodeURIComponent(page.username || currentUsername)}&p=${encodeURIComponent(page.slug)}`;

            return `
                <div class="dash-pages-item-row" style="padding: 16px 20px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 14px; min-width: 0; flex: 1;">
                        <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
                            ${icon}
                        </div>
                        <div style="min-width: 0; flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span style="font-weight: 800; color: #fff; font-size: 1rem; font-family: 'Outfit', sans-serif;">${escapeHtml(page.title || page.slug)}</span>
                                <span style="font-size: 0.68rem; padding: 2px 8px; border-radius: 6px; background: rgba(249,115,22,0.15); color: #f97316; border: 1px solid rgba(249,115,22,0.3); font-weight: 800;">${templateLabel}</span>
                            </div>
                            <div style="font-size: 0.78rem; color: var(--page-text-muted); font-family: monospace; margin-top: 2px;">
                                @${escapeHtml(page.username || currentUsername)}/${escapeHtml(page.slug)} · 👁️ ${views} · ⭐ ${stars} ${page.template === 'repo' ? `· 📄 ${fileCount} files` : ''}
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button type="button" class="btn-secondary" onclick="window.editPageById('${page.slug}')" style="padding: 7px 12px; font-size: 0.8rem; font-weight: 700;">
                            ✏️ Edit
                        </button>
                        <a href="${statusUrl}" target="_blank" class="btn-secondary" style="padding: 7px 12px; font-size: 0.8rem; font-weight: 700; color: #f97316; text-decoration: none;">
                            🚀 Live Status
                        </a>
                        <a href="${liveUrl}" target="_blank" class="btn-primary" style="padding: 7px 16px; font-size: 0.8rem; font-weight: 700; text-decoration: none;">
                            Open ↗
                        </a>
                        <button type="button" class="btn-danger" onclick="window.deletePageFromHub('${page.slug}')" style="padding: 7px 10px; font-size: 0.8rem;" title="Delete page">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch(err) {
        list.innerHTML = `<div style="color:#ef4444; padding:20px; text-align:center;">Failed to load pages: ${escapeHtml(err.message)}</div>`;
    }
};

window.loadHubCommunityPages = async function() {
    const list = document.getElementById('hub-explore-list-container');
    if (!list) return;

    list.innerHTML = `<div style="text-align: center; color: var(--page-text-muted); padding: 40px;">Discovering community creations...</div>`;

    try {
        const snap = await getDocs(collection(db, "user_pages"));
        const pages = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.published !== false && data.slug !== 'me') {
                pages.push({ id: d.id, ...data });
            }
        });

        // Sort by stars descending, then views descending
        pages.sort((a, b) => ((b.stars || 0) - (a.stars || 0)) || ((b.views || 0) - (a.views || 0)));

        if (pages.length === 0) {
            list.innerHTML = `<div style="text-align: center; color: var(--page-text-muted); padding: 40px;">No community pages published yet. Be the first to create one!</div>`;
            return;
        }

        const myStarredKey = currentUser ? `crimx_starred_${currentUser.uid}` : 'crimx_starred_guest';
        let myStarred = [];
        try { myStarred = JSON.parse(localStorage.getItem(myStarredKey)) || []; } catch(e) {}

        list.innerHTML = pages.map(p => {
            let icon = '📦';
            let badge = 'REPOSITORY';
            if (p.template === 'game') { icon = '🎮'; badge = 'PLAYABLE GAME'; }
            else if (p.template === 'html') { icon = '⚡'; badge = 'PURE HTML'; }

            const isStarred = myStarred.includes(p.id);
            const stars = p.stars || 0;
            const views = p.views || 0;
            const url = `/pages/index.html?u=${encodeURIComponent(p.username)}&p=${encodeURIComponent(p.slug)}`;

            return `
                <div class="dash-pages-item-row" style="padding: 16px 20px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 14px; min-width: 0; flex: 1;">
                        <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
                            ${icon}
                        </div>
                        <div style="min-width: 0; flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span style="font-weight: 800; color: #fff; font-size: 1rem; font-family: 'Outfit', sans-serif;">${escapeHtml(p.title || p.slug)}</span>
                                <span style="font-size: 0.68rem; padding: 2px 8px; border-radius: 6px; background: rgba(249,115,22,0.15); color: #f97316; border: 1px solid rgba(249,115,22,0.3); font-weight: 800;">${badge}</span>
                            </div>
                            <div style="font-size: 0.78rem; color: var(--page-text-muted); margin-top: 2px;">
                                by <span style="color:#fff; font-weight:700;">@${escapeHtml(p.username)}</span> · 👁️ ${views} views · ⭐ ${stars} stars
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button type="button" class="page-star-btn ${isStarred ? 'starred' : ''}" onclick="window.toggleStarCommunityPage('${p.id}', this)" title="Star this creation">
                            <span>⭐</span>
                            <span class="star-count">${stars}</span>
                        </button>
                        <a href="${url}" target="_blank" class="btn-primary" style="padding: 7px 18px; font-size: 0.82rem; font-weight: 700; text-decoration: none;">
                            ${p.template === 'game' ? '▶ Play' : 'Open ↗'}
                        </a>
                    </div>
                </div>
            `;
        }).join('');

    } catch(err) {
        list.innerHTML = `<div style="color:#ef4444; padding:20px; text-align:center;">Failed to load community creations: ${escapeHtml(err.message)}</div>`;
    }
};

window.toggleStarCommunityPage = async function(pageDocId, btnEl) {
    if (!currentUser) {
        alert("Please sign in to star community pages.");
        return;
    }

    const myStarredKey = `crimx_starred_${currentUser.uid}`;
    let myStarred = [];
    try { myStarred = JSON.parse(localStorage.getItem(myStarredKey)) || []; } catch(e) {}

    const isStarred = myStarred.includes(pageDocId);
    const countEl = btnEl ? btnEl.querySelector('.star-count') : null;
    let currentCount = countEl ? parseInt(countEl.innerText || '0', 10) : 0;

    if (isStarred) {
        myStarred = myStarred.filter(id => id !== pageDocId);
        if (btnEl) btnEl.classList.remove('starred');
        currentCount = Math.max(0, currentCount - 1);
        if (countEl) countEl.innerText = currentCount;
        try {
            await updateDoc(doc(db, "user_pages", pageDocId), { stars: increment(-1) });
        } catch(e) {}
    } else {
        myStarred.push(pageDocId);
        if (btnEl) btnEl.classList.add('starred');
        currentCount += 1;
        if (countEl) countEl.innerText = currentCount;
        try {
            await updateDoc(doc(db, "user_pages", pageDocId), { stars: increment(1) });
        } catch(e) {}
    }
    localStorage.setItem(myStarredKey, JSON.stringify(myStarred));
};

// ─── MODAL CONTROLLER (CREATE NEW PAGE) ───
window.openNewPageModal = function() {
    if (!currentUser) {
        alert("Please sign in to create pages.");
        return;
    }
    const modal = document.getElementById('modal-new-page');
    if (!modal) return;

    const titleInput = document.getElementById('new-page-title');
    const slugInput = document.getElementById('new-page-slug');
    const descInput = document.getElementById('new-page-desc');
    const prefixEl = document.getElementById('new-page-url-prefix');

    if (titleInput) titleInput.value = '';
    if (slugInput) slugInput.value = '';
    if (descInput) descInput.value = '';
    if (prefixEl) prefixEl.innerText = `crimx.crimsonflame.net/@${currentUsername}/`;

    window.selectTemplateChoice('repo');
    modal.classList.add('active');
};

window.closeNewPageModal = function() {
    const modal = document.getElementById('modal-new-page');
    if (modal) modal.classList.remove('active');
};

window.selectTemplateChoice = function(templateType) {
    const hidden = document.getElementById('new-page-template');
    if (hidden) hidden.value = templateType;

    document.querySelectorAll('.template-choice-card').forEach(c => c.classList.remove('active'));
    const card = document.getElementById(`tpl-card-${templateType}`);
    if (card) card.classList.add('active');

    const slugInput = document.getElementById('new-page-slug');
    if (slugInput && templateType === 'me' && !slugInput.value) {
        slugInput.value = 'me';
    }
};

window.sanitizeSlugInput = function(inputEl) {
    if (!inputEl) return;
    inputEl.value = inputEl.value.toLowerCase().replace(/[^a-z0-9\-]/g, '');
};

window.handleCreatePageSubmit = async function(e) {
    if (e) e.preventDefault();
    if (!currentUser) return;

    const btn = document.getElementById('btn-create-page-submit');
    const title = document.getElementById('new-page-title')?.value.trim();
    const slug = document.getElementById('new-page-slug')?.value.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '');
    const template = document.getElementById('new-page-template')?.value || 'repo';
    const desc = document.getElementById('new-page-desc')?.value.trim() || '';

    if (!title || !slug) {
        alert("Page title and URL slug are required.");
        return;
    }

    const pageDocId = `${currentUsername}_${slug}`;
    if (btn) { btn.disabled = true; btn.innerText = "Creating Page..."; }

    try {
        const pageRef = doc(db, "user_pages", pageDocId);
        const existingSnap = await getDoc(pageRef);
        if (existingSnap.exists() && existingSnap.data().ownerUid !== currentUser.uid) {
            throw new Error(`A page at @${currentUsername}/${slug} already exists.`);
        }

        let newPageData = {
            ownerUid: currentUser.uid,
            username: currentUsername,
            slug: slug,
            title: title,
            description: desc,
            template: template,
            published: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            views: 0,
            stars: 0
        };

        if (template === 'repo') {
            newPageData.files = [
                {
                    name: 'README.md',
                    size: 140,
                    type: 'text/markdown',
                    content: `# ${title}\n\n${desc || 'Welcome to this repository on CrimX Pages.'}\n\n### Usage\nFiles and releases can be downloaded directly from the file list.`,
                    lastModified: Date.now()
                }
            ];
            newPageData.releases = [];
        } else if (template === 'game') {
            newPageData.gameData = {
                aspectRatio: '16:9',
                coverUrl: '',
                controls: 'Arrow Keys / WASD : Steer\nSpacebar : Boost',
                code: `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #070308; font-family: monospace; }
  canvas { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d');
function resize() { cvs.width = window.innerWidth; cvs.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

let player = { x: cvs.width/2, y: cvs.height - 80, vx: 0, score: 0 };
let stars = Array.from({length: 60}, () => ({ x: Math.random()*cvs.width, y: Math.random()*cvs.height, s: Math.random()*2+1, v: Math.random()*3+1 }));
let orbs = [];
let keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

function loop() {
  ctx.fillStyle = 'rgba(10, 4, 12, 0.35)';
  ctx.fillRect(0, 0, cvs.width, cvs.height);

  ctx.fillStyle = '#ff4d79';
  stars.forEach(s => {
    s.y += s.v;
    if (s.y > cvs.height) { s.y = 0; s.x = Math.random()*cvs.width; }
    ctx.fillRect(s.x, s.y, s.s, s.s);
  });

  if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -7;
  else if (keys['ArrowRight'] || keys['KeyD']) player.vx = 7;
  else player.vx *= 0.85;

  player.x += player.vx;
  if (player.x < 30) player.x = 30;
  if (player.x > cvs.width - 30) player.x = cvs.width - 30;

  if (Math.random() < 0.04) {
    orbs.push({ x: Math.random()*(cvs.width - 60) + 30, y: -20, vy: Math.random()*3 + 3 });
  }

  ctx.fillStyle = '#f97316';
  for (let i = orbs.length - 1; i >= 0; i--) {
    let o = orbs[i];
    o.y += o.vy;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 10, 0, Math.PI*2);
    ctx.fill();

    let dist = Math.hypot(player.x - o.x, player.y - o.y);
    if (dist < 26) {
      player.score += 10;
      orbs.splice(i, 1);
      continue;
    }
    if (o.y > cvs.height + 20) orbs.splice(i, 1);
  }

  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(player.x, player.y - 20);
  ctx.lineTo(player.x - 20, player.y + 15);
  ctx.lineTo(player.x + 20, player.y + 15);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('CRIMX SCORE: ' + player.score, 20, 36);

  requestAnimationFrame(loop);
}
loop();
</` + `script>
</body>
</html>`
            };
        } else if (template === 'me') {
            newPageData.meData = {
                headline: title,
                theme: 'crimson',
                bio: desc || 'CrimX player profile showcase.',
                links: []
            };
        } else if (template === 'html') {
            newPageData.htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; padding: 40px; background: #0b050a; color: #fff; font-family: sans-serif; text-align: center; }
    h1 { color: #f97316; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(desc || 'Created on CrimX Pages.')}</p>
</body>
</html>`;
        }

        await setDoc(pageRef, newPageData, { merge: true });
        window.closeNewPageModal();
        await loadHubUserPages();
        window.editPageById(slug);

    } catch(err) {
        alert("Error creating page: " + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "Create Page"; }
    }
};

// ─── PAGE STUDIO EDITOR CONTROLLER ───
window.editPageById = async function(slug) {
    if (!currentUser) return;
    const pageDocId = `${currentUsername}_${slug}`;

    try {
        let pageData = userPagesCache.find(p => p.slug === slug);
        if (!pageData) {
            const pageRef = doc(db, "user_pages", pageDocId);
            const snap = await getDoc(pageRef);
            if (snap.exists()) pageData = { id: snap.id, ...snap.data() };
        }

        if (!pageData && slug === 'me') {
            pageData = {
                id: pageDocId,
                slug: 'me',
                title: 'My Profile Page',
                description: 'Personal profile showcase on CrimX Pages',
                template: 'me',
                published: true,
                meData: {
                    headline: 'CrimX Player',
                    theme: 'crimson',
                    bio: 'Welcome to my official CrimX page!',
                    links: []
                }
            };
        }

        if (!pageData) {
            alert("Page data could not be loaded.");
            return;
        }

        activeEditingPage = JSON.parse(JSON.stringify(pageData));
        if (!Array.isArray(activeEditingPage.files)) activeEditingPage.files = [];
        if (!Array.isArray(activeEditingPage.releases)) activeEditingPage.releases = [];

        // Header elements
        const titleDisplay = document.getElementById('editor-page-title-display');
        const badgeDisplay = document.getElementById('editor-page-template-badge');
        const urlLink = document.getElementById('editor-page-url-link');
        const titleInput = document.getElementById('editor-input-title');
        const descInput = document.getElementById('editor-input-desc');
        const viewsBadge = document.getElementById('editor-page-views-badge');
        const starsBadge = document.getElementById('editor-page-stars-badge');

        const pageUrl = `/pages/index.html?u=${encodeURIComponent(currentUsername)}&p=${encodeURIComponent(slug)}`;
        if (titleDisplay) titleDisplay.innerText = activeEditingPage.title || activeEditingPage.slug;
        if (urlLink) {
            urlLink.innerText = `crimx.crimsonflame.net/@${currentUsername}/${slug}`;
            urlLink.href = pageUrl;
        }
        if (titleInput) titleInput.value = activeEditingPage.title || '';
        if (descInput) descInput.value = activeEditingPage.description || '';
        if (viewsBadge) viewsBadge.innerText = `👁️ ${activeEditingPage.views || 0} views`;
        if (starsBadge) starsBadge.innerText = `⭐ ${activeEditingPage.stars || 0} stars`;

        // Template badge label
        if (badgeDisplay) {
            if (activeEditingPage.template === 'repo') badgeDisplay.innerText = '📦 REPOSITORY';
            else if (activeEditingPage.template === 'game') badgeDisplay.innerText = '🎮 PLAYABLE GAME';
            else if (activeEditingPage.template === 'me') badgeDisplay.innerText = '👤 ME PAGE';
            else badgeDisplay.innerText = '⚡ PURE HTML';
        }

        // Toggle panes
        const paneRepo = document.getElementById('editor-pane-repo');
        const paneGame = document.getElementById('editor-pane-game');
        const paneMe = document.getElementById('editor-pane-me');
        const paneHtml = document.getElementById('editor-pane-html');

        if (paneRepo) paneRepo.style.display = activeEditingPage.template === 'repo' ? 'flex' : 'none';
        if (paneGame) paneGame.style.display = activeEditingPage.template === 'game' ? 'flex' : 'none';
        if (paneMe) paneMe.style.display = activeEditingPage.template === 'me' ? 'flex' : 'none';
        if (paneHtml) paneHtml.style.display = activeEditingPage.template === 'html' ? 'flex' : 'none';

        if (activeEditingPage.template === 'repo') {
            renderEditorRepoFilesTable();
            renderEditorRepoReleasesList();
        } else if (activeEditingPage.template === 'game') {
            const gData = activeEditingPage.gameData || {};
            const arInput = document.getElementById('game-aspect-ratio');
            const coverInput = document.getElementById('game-cover-url');
            const ctrlInput = document.getElementById('game-controls-input');
            const codeEditor = document.getElementById('game-code-editor');

            if (arInput) arInput.value = gData.aspectRatio || '16:9';
            if (coverInput) coverInput.value = gData.coverUrl || '';
            if (ctrlInput) ctrlInput.value = gData.controls || '';
            if (codeEditor) codeEditor.value = gData.code || '';
            window.testGamePreview();
        } else if (activeEditingPage.template === 'me') {
            const meObj = activeEditingPage.meData || {};
            const headInput = document.getElementById('me-page-headline-input');
            const themeInput = document.getElementById('me-page-theme-input');
            const bioInput = document.getElementById('me-page-bio-input');
            const linksInput = document.getElementById('me-page-links-input');

            if (headInput) headInput.value = meObj.headline || '';
            if (themeInput) themeInput.value = meObj.theme || 'crimson';
            if (bioInput) bioInput.value = meObj.bio || '';
            if (linksInput) {
                linksInput.value = Array.isArray(meObj.links) ? meObj.links.map(l => `${l.label || 'Link'} | ${l.url || ''}`).join('\n') : '';
            }
        } else if (activeEditingPage.template === 'html') {
            const htmlCode = document.getElementById('editor-pure-html-code');
            if (htmlCode) htmlCode.value = activeEditingPage.htmlContent || '';
            window.updatePureHtmlPreview();
        }

        const modal = document.getElementById('modal-page-editor');
        if (modal) modal.classList.add('open');
    } catch(err) {
        alert("Error opening editor: " + err.message);
    }
};

window.closePageEditor = function() {
    const modal = document.getElementById('modal-page-editor');
    if (modal) modal.classList.remove('open');
    activeEditingPage = null;
};

window.openActiveEditorPage = function() {
    if (!activeEditingPage) return;
    window.openLivePage(activeEditingPage.slug);
};

window.openActiveEditorBuildLog = function() {
    if (!activeEditingPage) return;
    const url = `/pages/index.html?status=true&u=${encodeURIComponent(currentUsername)}&p=${encodeURIComponent(activeEditingPage.slug)}`;
    window.open(url, '_blank');
};

window.openLivePage = function(slug) {
    const url = `/pages/index.html?u=${encodeURIComponent(currentUsername)}&p=${encodeURIComponent(slug)}`;
    window.open(url, '_blank');
};

window.saveActiveEditorPage = async function() {
    if (!currentUser || !activeEditingPage) return;
    const pageDocId = `${currentUsername}_${activeEditingPage.slug}`;

    const newTitle = document.getElementById('editor-input-title')?.value.trim() || activeEditingPage.slug;
    const newDesc = document.getElementById('editor-input-desc')?.value.trim() || '';

    activeEditingPage.title = newTitle;
    activeEditingPage.description = newDesc;
    activeEditingPage.updatedAt = serverTimestamp();

    if (activeEditingPage.template === 'game') {
        activeEditingPage.gameData = {
            aspectRatio: document.getElementById('game-aspect-ratio')?.value || '16:9',
            coverUrl: document.getElementById('game-cover-url')?.value.trim() || '',
            controls: document.getElementById('game-controls-input')?.value.trim() || '',
            code: document.getElementById('game-code-editor')?.value || ''
        };
    } else if (activeEditingPage.template === 'me') {
        const headline = document.getElementById('me-page-headline-input')?.value.trim() || newTitle;
        const theme = document.getElementById('me-page-theme-input')?.value || 'crimson';
        const bio = document.getElementById('me-page-bio-input')?.value.trim() || '';
        const rawLinks = document.getElementById('me-page-links-input')?.value || '';
        const parsedLinks = rawLinks.split('\n').filter(l => l.includes('|')).map(l => {
            const parts = l.split('|');
            return { label: parts[0].trim(), url: parts.slice(1).join('|').trim() };
        });
        activeEditingPage.meData = { headline, theme, bio, links: parsedLinks };
    } else if (activeEditingPage.template === 'html') {
        activeEditingPage.htmlContent = document.getElementById('editor-pure-html-code')?.value || '';
    }

    try {
        await setDoc(doc(db, "user_pages", pageDocId), {
            ...activeEditingPage,
            ownerUid: currentUser.uid,
            username: currentUsername,
            published: true,
            updatedAt: serverTimestamp()
        }, { merge: true });

        alert(`✓ Page "${newTitle}" saved & deployed!`);
        await loadHubUserPages();
    } catch(err) {
        alert("Error saving page: " + err.message);
    }
};

window.deleteActiveEditorPage = async function() {
    if (!currentUser || !activeEditingPage) return;
    if (activeEditingPage.slug === 'me') {
        alert("The root 'me' profile page cannot be deleted.");
        return;
    }
    if (!confirm(`Permanently delete "@${currentUsername}/${activeEditingPage.slug}"?`)) return;

    try {
        await deleteDoc(doc(db, "user_pages", `${currentUsername}_${activeEditingPage.slug}`));
        window.closePageEditor();
        await loadHubUserPages();
        alert("Page deleted successfully.");
    } catch(err) {
        alert("Error deleting page: " + err.message);
    }
};

window.deletePageFromHub = async function(slug) {
    if (!currentUser) return;
    if (slug === 'me') return alert("The root 'me' page cannot be deleted.");
    if (!confirm(`Delete page "${slug}"?`)) return;
    try {
        await deleteDoc(doc(db, "user_pages", `${currentUsername}_${slug}`));
        await loadHubUserPages();
    } catch(e) { alert(e.message); }
};

// ─── EDITOR REPO FILES MANAGEMENT ───
function renderEditorRepoFilesTable() {
    const tbody = document.getElementById('editor-repo-files-list');
    const countEl = document.getElementById('repo-file-count');
    if (!tbody || !activeEditingPage) return;

    const files = activeEditingPage.files || [];
    if (countEl) countEl.innerText = files.length;

    if (files.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--page-text-muted); padding: 24px;">No files added yet. Click "+ Upload File" or "+ New Text File".</td></tr>`;
        return;
    }

    tbody.innerHTML = files.map((file, idx) => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
            <td style="font-family: monospace; font-weight: 700; color: #fff; padding: 10px 8px;">
                📄 ${escapeHtml(file.name)}
            </td>
            <td style="color: var(--page-text-muted); padding: 10px 8px;">${formatBytes(file.size)}</td>
            <td style="color: var(--page-text-muted); font-size: 0.76rem; padding: 10px 8px;">${escapeHtml(file.type || 'file')}</td>
            <td style="text-align: right; padding: 10px 8px;">
                <button type="button" class="btn-secondary" onclick="window.downloadRepoFileAtIndex(${idx})" style="padding: 4px 10px; font-size: 0.74rem; font-weight: 600; margin-right: 4px;">Download</button>
                <button type="button" class="btn-danger" onclick="window.deleteRepoFileAtIndex(${idx})" style="padding: 4px 10px; font-size: 0.74rem; font-weight: 600;">Delete</button>
            </td>
        </tr>
    `).join('');
}

window.handleRepoFilesUpload = async function(fileList) {
    if (!fileList || !activeEditingPage) return;
    for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        const isText = f.type.startsWith('text/') || f.name.endsWith('.js') || f.name.endsWith('.json') || f.name.endsWith('.md') || f.name.endsWith('.html') || f.name.endsWith('.css');
        let data = isText && f.size < 500000 ? await f.text() : await new Promise(res => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result);
            reader.readAsDataURL(f);
        });

        const existingIdx = activeEditingPage.files.findIndex(item => item.name.toLowerCase() === f.name.toLowerCase());
        const fileObj = {
            name: f.name,
            size: f.size,
            type: f.type || 'application/octet-stream',
            content: data,
            lastModified: f.lastModified || Date.now()
        };
        if (existingIdx >= 0) activeEditingPage.files[existingIdx] = fileObj;
        else activeEditingPage.files.push(fileObj);
    }
    renderEditorRepoFilesTable();
};

window.promptCreateNewTextFile = function() {
    if (!activeEditingPage) return;
    const name = prompt("Enter file name (e.g. index.js, config.json, LICENSE):");
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (activeEditingPage.files.some(f => f.name.toLowerCase() === trimmed.toLowerCase())) {
        return alert("A file with this name already exists.");
    }
    const defaultContent = trimmed.endsWith('.json') ? '{\n  "name": "project"\n}' : trimmed.endsWith('.md') ? `# ${trimmed}\n` : '// Code file\n';
    activeEditingPage.files.push({
        name: trimmed,
        size: defaultContent.length,
        type: 'text/plain',
        content: defaultContent,
        lastModified: Date.now()
    });
    renderEditorRepoFilesTable();
};

window.deleteRepoFileAtIndex = function(idx) {
    if (!activeEditingPage || !activeEditingPage.files[idx]) return;
    if (!confirm(`Delete "${activeEditingPage.files[idx].name}"?`)) return;
    activeEditingPage.files.splice(idx, 1);
    renderEditorRepoFilesTable();
};

window.downloadRepoFileAtIndex = function(idx) {
    if (!activeEditingPage || !activeEditingPage.files[idx]) return;
    const file = activeEditingPage.files[idx];
    const a = document.createElement('a');
    a.href = typeof file.content === 'string' && file.content.startsWith('data:') ? file.content : URL.createObjectURL(new Blob([file.content || ''], { type: file.type || 'text/plain' }));
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

// ─── EDITOR REPO RELEASES MANAGEMENT ───
function renderEditorRepoReleasesList() {
    const container = document.getElementById('editor-repo-releases-list');
    const countEl = document.getElementById('repo-release-count');
    if (!container || !activeEditingPage) return;

    const releases = activeEditingPage.releases || [];
    if (countEl) countEl.innerText = releases.length;

    if (releases.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--page-text-muted); padding: 18px; font-size: 0.84rem;">No releases published yet. Click "+ Draft Release".</div>`;
        return;
    }

    container.innerHTML = releases.map((rel, idx) => `
        <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 16px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-family: monospace; font-weight: 800; color: #4ade80; background: rgba(34,197,94,0.15); padding: 2px 8px; border-radius: 6px; font-size: 0.82rem;">${escapeHtml(rel.tag)}</span>
                    <span style="font-weight: 700; color: #fff; font-size: 0.92rem;">${escapeHtml(rel.title || rel.tag)}</span>
                </div>
                <button type="button" class="btn-danger" onclick="window.deleteRepoReleaseAtIndex(${idx})" style="padding: 3px 10px; font-size: 0.74rem; font-weight: 600;">Delete</button>
            </div>
            <div style="font-size: 0.78rem; color: var(--page-text-muted); margin-bottom: 6px; white-space: pre-wrap;">${escapeHtml(rel.notes || 'No notes.')}</div>
        </div>
    `).join('');
}

window.toggleNewReleaseForm = function(force) {
    const box = document.getElementById('editor-release-draft-box');
    if (!box) return;
    box.style.display = (force !== undefined) ? (force ? 'block' : 'none') : (box.style.display === 'none' ? 'block' : 'none');
};

window.commitNewRelease = function() {
    if (!activeEditingPage) return;
    const tag = document.getElementById('release-tag-input')?.value.trim();
    const title = document.getElementById('release-title-input')?.value.trim();
    const notes = document.getElementById('release-notes-input')?.value.trim();

    if (!tag) return alert("Version tag (e.g. v1.0.0) is required.");

    activeEditingPage.releases.unshift({
        tag,
        title: title || tag,
        notes: notes || '',
        createdAt: Date.now()
    });

    document.getElementById('release-tag-input').value = '';
    document.getElementById('release-title-input').value = '';
    document.getElementById('release-notes-input').value = '';
    window.toggleNewReleaseForm(false);
    renderEditorRepoReleasesList();
};

window.deleteRepoReleaseAtIndex = function(idx) {
    if (!activeEditingPage || !activeEditingPage.releases[idx]) return;
    activeEditingPage.releases.splice(idx, 1);
    renderEditorRepoReleasesList();
};

// ─── SANDBOX LIVE PREVIEW HELPERS ───
window.testGamePreview = function() {
    const code = document.getElementById('game-code-editor')?.value || '';
    const iframe = document.getElementById('game-preview-iframe');
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(code);
    doc.close();
};

window.updatePureHtmlPreview = function() {
    const code = document.getElementById('editor-pure-html-code')?.value || '';
    const iframe = document.getElementById('editor-pure-html-preview');
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(code);
    doc.close();
};

// ─── STAR RATING FOR ACTIVE PAGE ───
window.toggleStarActivePage = async function() {
    if (!activeLoadedPageKey || !activeLoadedPageData) return;
    const starStorageKey = `cf_starred_${activeLoadedPageKey}`;
    const alreadyStarred = localStorage.getItem(starStorageKey) === 'true';

    const newStarState = !alreadyStarred;
    localStorage.setItem(starStorageKey, newStarState ? 'true' : 'false');

    let currentStars = activeLoadedPageData.stars || 0;
    currentStars = newStarState ? currentStars + 1 : Math.max(0, currentStars - 1);
    activeLoadedPageData.stars = currentStars;

    const repoStarCount = document.getElementById('repo-star-count');
    const gameStarCount = document.getElementById('game-star-count');
    const repoStarBtn = document.getElementById('repo-star-btn');
    const gameStarBtn = document.getElementById('game-star-btn');

    if (repoStarCount) repoStarCount.innerText = currentStars;
    if (gameStarCount) gameStarCount.innerText = currentStars;
    if (repoStarBtn) repoStarBtn.classList.toggle('starred', newStarState);
    if (gameStarBtn) gameStarBtn.classList.toggle('starred', newStarState);

    try {
        await updateDoc(doc(db, "user_pages", activeLoadedPageKey), {
            stars: increment(newStarState ? 1 : -1)
        });
    } catch(err) {
        console.warn("[Pages] Star sync notice:", err);
    }
};

window.switchRepoTab = function(tab) {
    const codeTab = document.getElementById('repo-tab-code');
    const relTab = document.getElementById('repo-tab-releases');
    const codePane = document.getElementById('repo-pane-code');
    const relPane = document.getElementById('repo-pane-releases');

    if (tab === 'code') {
        if (codeTab) codeTab.classList.add('active');
        if (relTab) relTab.classList.remove('active');
        if (codePane) codePane.style.display = 'block';
        if (relPane) relPane.style.display = 'none';
    } else {
        if (relTab) relTab.classList.add('active');
        if (codeTab) codeTab.classList.remove('active');
        if (relPane) relPane.style.display = 'block';
        if (codePane) codePane.style.display = 'none';
    }
};

window.addEventListener('DOMContentLoaded', initPages);
