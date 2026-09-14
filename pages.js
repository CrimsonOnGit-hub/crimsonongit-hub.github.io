import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBSSJKDrFJ1_qlliZqgw34CY2TSaKOxxxM",
    authDomain: "crimsonflame-8169e.firebaseapp.com",
    projectId: "crimsonflame-8169e",
    storageBucket: "crimsonflame-8169e.firebasestorage.app",
    messagingSenderId: "406321213530",
    appId: "1:406321213530:web:92d27a69d34d147393a863"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── PARSE ROUTE OR QUERY PARAMETERS ───
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

    if (!pageName && username) {
        pageName = 'me';
    }

    return {
        username: username.toLowerCase().replace(/^@/, ''),
        pageName: pageName.toLowerCase(),
        isBuildStatus: isBuildStatus
    };
}

// ─── BUILD & DEPLOYMENT PIPELINE SIMULATOR ───
function runBuildPipeline(targetUrl) {
    const buildView = document.getElementById('pages-view-build');
    if (!buildView) return;
    buildView.style.display = 'block';

    const urlDisplay = document.getElementById('build-target-url');
    if (urlDisplay) urlDisplay.innerText = targetUrl;

    const fill = document.getElementById('build-progress-bar-fill');
    const visitBtn = document.getElementById('btn-visit-built-page');

    const steps = [
        { id: 'bstep-1', progress: 25, delay: 400 },
        { id: 'bstep-2', progress: 55, delay: 900 },
        { id: 'bstep-3', progress: 85, delay: 1500 },
        { id: 'bstep-4', progress: 100, delay: 2100 }
    ];

    steps.forEach((step, idx) => {
        setTimeout(() => {
            const el = document.getElementById(step.id);
            if (el) el.classList.add('active');
            if (fill) fill.style.width = step.progress + '%';

            if (idx > 0) {
                const prev = document.getElementById(steps[idx - 1].id);
                if (prev) {
                    prev.classList.remove('active');
                    prev.classList.add('done');
                }
            }

            if (idx === steps.length - 1) {
                if (el) el.classList.add('done');
                if (visitBtn) {
                    visitBtn.style.display = 'inline-block';
                    visitBtn.href = targetUrl;
                }
            }
        }, step.delay);
    });
}

// ─── REPOSITORY TAB SWITCHER ───
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

// ─── DOWNLOAD FILE HELPER ───
window.downloadRepoFile = function(fileName, contentBase64, mimeType = 'text/plain') {
    try {
        const link = document.createElement('a');
        link.download = fileName;
        if (contentBase64.startsWith('data:')) {
            link.href = contentBase64;
        } else {
            link.href = `data:${mimeType};charset=utf-8,` + encodeURIComponent(contentBase64);
        }
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch(e) {
        alert("Failed to download file: " + e.message);
    }
};

// ─── PAGE INITIALIZER ───
async function initPages() {
    const { username, pageName, isBuildStatus } = getRouteParams();

    if (!username) {
        renderCustom404('[USERNAME]', '[PAGE NAME]');
        return;
    }

    const fullPageKey = `${username}_${pageName}`;
    const pageUrlDisplay = pageName === 'me'
        ? `crimx.crimsonflame.net/${username}`
        : `crimx.crimsonflame.net/${username}/${pageName}`;

    // 1. Build Status View
    if (isBuildStatus) {
        runBuildPipeline(pageUrlDisplay);
        return;
    }

    try {
        // 2. Query Firestore for Page
        let pageData = null;

        // Try direct document ID lookup
        const pageDocSnap = await getDoc(doc(db, "user_pages", fullPageKey));
        if (pageDocSnap.exists()) {
            pageData = pageDocSnap.data();
        } else {
            // Try query by username and pageName
            const q = query(
                collection(db, "user_pages"),
                where("username", "==", username),
                where("pageName", "==", pageName)
            );
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
                pageData = qSnap.docs[0].data();
            }
        }

        // 3. If "me" page not explicitly saved, fallback to user's profile card
        if (!pageData && pageName === 'me') {
            const userQ = query(collection(db, "users"), where("username", "==", username));
            const userSnap = await getDocs(userQ);
            if (!userSnap.empty) {
                const u = userSnap.docs[0].data();
                renderMePage({
                    username: username,
                    displayName: u.displayName || u.username || username,
                    avatar: u.photoURL || u.avatarUrl || 'https://i.ibb.co/TBkJR2Jn/unnamed-removebg-preview.png',
                    banner: u.bannerUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1600',
                    userNumber: u.userNumber || 1,
                    bio: u.bio || 'CrimX Community Member',
                    sections: []
                });
                return;
            }
        }

        // 4. If Page Exists, render template
        if (pageData && pageData.published !== false) {
            if (pageData.template === 'repo') {
                renderRepositoryPage(username, pageName, pageData);
            } else if (pageData.template === 'html') {
                renderPureHtmlPage(pageData.htmlContent || '<h1>Empty Page</h1>');
            } else {
                renderMePage(pageData);
            }
            return;
        }

        // 5. Not found -> Custom Pages 404
        renderCustom404(username, pageName);

    } catch(err) {
        console.error("Error loading CrimX Page:", err);
        renderCustom404(username, pageName);
    }
}

// ─── RENDERERS ───
function renderCustom404(username, pageName) {
    document.querySelectorAll('.pages-container, #pages-view-html').forEach(el => el.style.display = 'none');
    const view404 = document.getElementById('pages-view-404');
    if (view404) {
        view404.style.display = 'flex';
        const urlEl = document.getElementById('pages-404-url');
        if (urlEl) {
            urlEl.innerText = pageName === 'me'
                ? `crimx.crimsonflame.net/${username}`
                : `crimx.crimsonflame.net/${username}/${pageName}`;
        }
    }
}

function renderRepositoryPage(username, pageName, data) {
    document.getElementById('pages-view-404').style.display = 'none';
    const repoView = document.getElementById('pages-view-repo');
    if (!repoView) return;
    repoView.style.display = 'block';

    document.getElementById('repo-user-prefix').innerText = username;
    document.getElementById('repo-name-text').innerText = data.repoName || pageName;
    document.getElementById('repo-desc-text').innerText = data.description || 'No description provided for this repository.';

    // Files List
    const files = data.files || [];
    const tbody = document.getElementById('repo-files-tbody');
    if (tbody) {
        if (files.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #8b949e; padding: 24px;">No files uploaded yet.</td></tr>`;
        } else {
            tbody.innerHTML = files.map(f => {
                const sizeStr = f.size ? `${(f.size / 1024).toFixed(1)} KB` : '1 KB';
                const dateStr = f.updatedAt ? new Date(f.updatedAt).toLocaleDateString() : 'Recent';
                const contentData = f.content || f.data || 'Empty file';
                return `
                    <tr>
                        <td>
                            <div class="repo-file-link" onclick="window.downloadRepoFile('${f.name}', '${encodeURIComponent(contentData)}')">
                                📄 ${f.name}
                            </div>
                        </td>
                        <td style="color: #8b949e; font-size: 0.8rem;">${sizeStr}</td>
                        <td style="color: #8b949e; font-size: 0.8rem;">${dateStr}</td>
                        <td style="text-align: right;">
                            <button type="button" class="repo-btn-download" onclick="window.downloadRepoFile('${f.name}', '${encodeURIComponent(contentData)}')">Download</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
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
                const date = r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : 'Latest';
                return `
                    <div class="repo-release-card">
                        <div class="repo-release-header">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span class="repo-tag-badge">${tag}</span>
                                <h3 style="margin: 0; color: #f0f6fc; font-size: 1.15rem;">${title}</h3>
                            </div>
                            <span style="font-size: 0.8rem; color: #8b949e;">${date}</span>
                        </div>
                        <div style="color: #c9d1d9; font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; margin-bottom: 14px;">${notes}</div>
                        ${r.downloadUrl ? `<a href="${r.downloadUrl}" target="_blank" class="repo-btn-download" style="background: #238636; border-color: #2ea043; color: #fff;">⬇ Download ${tag} Asset</a>` : ''}
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
            window.downloadRepoFile(`${data.repoName || pageName}_bundle.txt`, allText);
        };
    }
}

function renderMePage(data) {
    document.getElementById('pages-view-404').style.display = 'none';
    const meView = document.getElementById('pages-view-me');
    if (!meView) return;
    meView.style.display = 'block';

    const bannerImg = document.getElementById('me-page-banner');
    if (bannerImg) {
        bannerImg.src = data.banner || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1600';
    }

    const avatarImg = document.getElementById('me-page-avatar');
    if (avatarImg) {
        avatarImg.src = data.avatar || 'https://i.ibb.co/TBkJR2Jn/unnamed-removebg-preview.png';
    }

    const nameEl = document.getElementById('me-page-display-name');
    if (nameEl) nameEl.innerText = data.displayName || data.username;

    const handleEl = document.getElementById('me-page-handle');
    if (handleEl) handleEl.innerText = `@${data.username}`;

    const numBadge = document.getElementById('me-page-user-number');
    if (numBadge) numBadge.innerText = `Member #${data.userNumber || 1}`;

    const bioEl = document.getElementById('me-page-bio');
    if (bioEl) bioEl.innerText = data.bio || 'Welcome to my CrimX Page!';

    const secContainer = document.getElementById('me-page-sections');
    if (secContainer && data.sections) {
        secContainer.innerHTML = data.sections.map(s => `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--page-border); border-radius: 14px; padding: 20px;">
                <h3 style="color: #fff; font-family: 'Outfit', sans-serif; margin: 0 0 8px 0;">${s.title || ''}</h3>
                <div style="color: var(--page-text-muted); font-size: 0.92rem; line-height: 1.5;">${s.content || ''}</div>
            </div>
        `).join('');
    }
}

function renderPureHtmlPage(html) {
    document.getElementById('pages-view-404').style.display = 'none';
    const htmlView = document.getElementById('pages-view-html');
    const frame = document.getElementById('pages-html-frame');
    if (htmlView && frame) {
        htmlView.style.display = 'block';
        frame.srcdoc = html;
    }
}

window.addEventListener('DOMContentLoaded', initPages);
