import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { CrimX } from "/crimx.js";

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
let projectsList = [];
let currentProject = null;
let activeCodeLang = 'js';
let projectUsersData = [];

const IMGBB_API_KEY = "d5fd4e3e9fedc18b9bed075f980f12b7";

// ─── UTILITY HELPERS ───
function generateSecureRandomHex(bytesCount = 16) {
    const rand = new Uint8Array(bytesCount);
    crypto.getRandomValues(rand);
    return Array.from(rand, b => ('0' + b.toString(16)).slice(-2)).join('');
}

window.showToast = function(msg) {
    const t = document.getElementById('dev-toast');
    const m = document.getElementById('dev-toast-msg');
    if (!t || !m) return;
    m.innerText = msg;
    t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); }, 3000);
};

window.copyInputVal = function(id) {
    const el = document.getElementById(id);
    if (!el || !el.value) return;
    navigator.clipboard.writeText(el.value).then(() => {
        window.showToast("✓ Copied to clipboard");
    }).catch(() => {
        window.showToast("Copy failed");
    });
};

function getStarredProjects() {
    try {
        const raw = localStorage.getItem('dev_starred_projects');
        return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
}

function toggleStarredProject(id, e) {
    if (e) e.stopPropagation();
    const starred = getStarredProjects();
    starred[id] = !starred[id];
    localStorage.setItem('dev_starred_projects', JSON.stringify(starred));
    window.renderProjectsList();
}

// ─── HOMEPAGE CONTROLLER ───
window.openCreateModal = function() {
    const m = document.getElementById('modal-create-project');
    const inp = document.getElementById('new-project-name');
    if (m) m.classList.add('active');
    if (inp) {
        inp.value = '';
        setTimeout(() => inp.focus(), 50);
    }
};

window.closeCreateModal = function() {
    const m = document.getElementById('modal-create-project');
    if (m) m.classList.remove('active');
};

const createCardBtn = document.getElementById('btn-open-create-modal');
if (createCardBtn) {
    createCardBtn.addEventListener('click', window.openCreateModal);
    createCardBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.openCreateModal();
        }
    });
}

window.submitNewProject = async function(e) {
    e.preventDefault();
    if (!currentUser) return;
    const btn = document.getElementById('btn-submit-new-project');
    const nameInput = document.getElementById('new-project-name');
    const appName = nameInput.value.trim();
    if (!appName) return;

    btn.disabled = true;
    btn.innerText = "Creating...";

    try {
        const clientId = `crimx_client_${generateSecureRandomHex(8)}`;
        const clientSecret = `crimx_secret_${generateSecureRandomHex(18)}`;
        const defaultLogo = "https://i.ibb.co/TBkJR2Jn/unnamed-removebg-preview.png";

        const projectData = {
            clientId: clientId,
            linkkey: clientId,
            appName: appName,
            appLogo: defaultLogo,
            ownerUid: currentUser.uid,
            redirectUrl: "",
            redirectUris: [],
            permissions: ["Access player profile & avatar", "View verified email address"],
            totalAuthorizations: 0,
            authorizedUserUids: {},
            createdAt: new Date().toISOString()
        };

        // Real Firestore creation
        await setDoc(doc(db, "sso_links", clientId), projectData);

        try {
            localStorage.setItem('cf_sso_key_' + clientId, JSON.stringify(projectData));
        } catch(err) {}

        window.closeCreateModal();
        window.showToast(`✓ Project "${appName}" created!`);

        await window.loadProjects();

    } catch(err) {
        console.error("Error creating project:", err);
        alert("Failed to create project: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Create Project";
    }
};

window.loadProjects = async function() {
    if (!currentUser) return;
    try {
        const q = query(collection(db, "sso_links"), where("ownerUid", "==", currentUser.uid));
        const snap = await getDocs(q);
        const list = [];
        snap.forEach(d => {
            list.push({ id: d.id, ...d.data() });
        });

        // Sort by creation date descending
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        projectsList = list;
        window.renderProjectsList();
        window.renderProjectDropdownList();

        // Check if query param specifies an active project
        const params = new URLSearchParams(window.location.search);
        const projectIdParam = params.get('project');
        if (projectIdParam) {
            const match = projectsList.find(p => p.clientId === projectIdParam || p.id === projectIdParam);
            if (match) {
                window.openProject(match.clientId || match.id);
            }
        }
    } catch(err) {
        console.error("Error loading projects:", err);
    }
};

window.renderProjectsList = function() {
    const container = document.getElementById('home-projects-list');
    const countEl = document.getElementById('home-projects-count');
    const searchInp = document.getElementById('dev-project-search');
    const queryTerm = searchInp ? searchInp.value.trim().toLowerCase() : '';

    if (!container) return;

    let filtered = projectsList;
    if (queryTerm) {
        filtered = projectsList.filter(p => 
            (p.appName && p.appName.toLowerCase().includes(queryTerm)) ||
            (p.clientId && p.clientId.toLowerCase().includes(queryTerm))
        );
    }

    const starred = getStarredProjects();

    if (countEl) {
        countEl.innerText = `${filtered.length} of ${projectsList.length} projects`;
    }

    if (filtered.length === 0) {
        if (projectsList.length === 0) {
            container.innerHTML = `
                <div class="dev-empty-state">
                    <div style="font-size: 1.8rem; margin-bottom: 6px;">📂</div>
                    <div style="font-weight: 700; color: #fff; margin-bottom: 4px;">No projects yet</div>
                    <div style="color: var(--dev-text-muted); font-size: 0.82rem;">Click "Create a new project" to register your first app.</div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="dev-empty-state">
                    No projects matching "${queryTerm}".
                </div>
            `;
        }
        return;
    }

    container.innerHTML = filtered.map(p => {
        const id = p.clientId || p.id;
        const icon = p.appLogo || "https://i.ibb.co/TBkJR2Jn/unnamed-removebg-preview.png";
        const usersCount = p.authorizedUserUids ? Object.keys(p.authorizedUserUids).length : 0;
        const isStarred = !!starred[id];

        return `
            <div class="dev-project-row" onclick="window.openProject('${id}')">
                <div class="dev-project-row-left">
                    <img src="${icon}" alt="${p.appName}" class="dev-project-icon" onerror="this.src='https://i.ibb.co/TBkJR2Jn/unnamed-removebg-preview.png'">
                    <div class="dev-project-info">
                        <div class="dev-project-name">${p.appName || 'Untitled Project'}</div>
                        <div class="dev-project-id">${id}</div>
                    </div>
                </div>
                <div class="dev-project-row-right">
                    <span class="dev-project-users-badge">${usersCount} Players</span>
                    <button type="button" class="dev-star-btn ${isStarred ? 'active' : ''}" title="Star project" onclick="window.toggleStar('${id}', event)">
                        ${isStarred ? '★' : '☆'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

window.toggleStar = function(id, e) {
    toggleStarredProject(id, e);
};

const searchInputEl = document.getElementById('dev-project-search');
if (searchInputEl) {
    searchInputEl.addEventListener('input', window.renderProjectsList);
}

// ─── CONSOLE WORKSPACE CONTROLLER ───
window.openProject = function(id) {
    const proj = projectsList.find(p => p.clientId === id || p.id === id);
    if (!proj) return;
    currentProject = proj;

    // Update URL query string
    const url = new URL(window.location);
    url.searchParams.set('project', id);
    window.history.pushState({}, '', url);

    // Switch Views
    document.getElementById('dev-homepage-view').style.display = 'none';
    document.getElementById('dev-project-view').style.display = 'flex';

    // Populate Top Bar
    document.getElementById('topbar-project-name').innerText = proj.appName;
    document.getElementById('topbar-client-id').innerText = `ID: ${proj.clientId || proj.id}`;

    // Switch default nav to Overview
    window.switchConsoleNav('overview');

    // Populate views with project data
    populateProjectData();
    window.loadProjectUsers();
};

window.backToHomepage = function() {
    currentProject = null;
    const url = new URL(window.location);
    url.searchParams.delete('project');
    window.history.pushState({}, '', url);

    document.getElementById('dev-project-view').style.display = 'none';
    document.getElementById('dev-homepage-view').style.display = 'flex';
    const drop = document.getElementById('project-dropdown-menu');
    if (drop) drop.classList.remove('active');

    window.renderProjectsList();
};

// Project Switcher Dropdown
const switcherBtn = document.getElementById('project-switcher-btn');
if (switcherBtn) {
    switcherBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const drop = document.getElementById('project-dropdown-menu');
        if (drop) drop.classList.toggle('active');
    });
}
document.addEventListener('click', () => {
    const drop = document.getElementById('project-dropdown-menu');
    if (drop) drop.classList.remove('active');
});

window.renderProjectDropdownList = function() {
    const listEl = document.getElementById('project-dropdown-items-list');
    if (!listEl) return;
    listEl.innerHTML = projectsList.map(p => {
        const id = p.clientId || p.id;
        return `
            <div class="dev-dropdown-item" onclick="window.openProject('${id}')">
                <span>🔥</span> ${p.appName}
            </div>
        `;
    }).join('');
};

// Console Sidebar Navigation
window.switchConsoleNav = function(section, subtab = null) {
    // Update sidebar active state
    document.querySelectorAll('.dev-nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${section}`);
    if (activeNav) activeNav.classList.add('active');

    // Hide all panes
    document.querySelectorAll('.dev-console-pane').forEach(p => p.style.display = 'none');

    // Show target pane
    const targetPane = document.getElementById(`pane-${section}`);
    if (targetPane) targetPane.style.display = 'block';

    // Update breadcrumb label
    const sectionNames = {
        overview: 'Project Overview',
        auth: 'Authentication',
        analytics: 'Analytics',
        settings: 'Project Settings'
    };
    const breadcrumbLabel = document.getElementById('topbar-section-label');
    if (breadcrumbLabel) breadcrumbLabel.innerText = sectionNames[section] || 'Console';

    if (subtab && section === 'auth') {
        window.switchAuthTab(subtab);
    }
};

// Authentication Sub-tabs
window.switchAuthTab = function(tabName) {
    document.querySelectorAll('.dev-tab-btn').forEach(b => {
        if (b.id && b.id.startsWith('tab-btn-')) b.classList.remove('active');
    });
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    if (activeBtn) activeBtn.classList.add('active');

    document.querySelectorAll('.dev-auth-subtab').forEach(el => el.style.display = 'none');
    const targetTab = document.getElementById(`auth-tab-${tabName}`);
    if (targetTab) targetTab.style.display = 'block';

    if (tabName === 'users') {
        window.loadProjectUsers();
    } else if (tabName === 'sdk') {
        updateSdkSnippets();
    }
};

function populateProjectData() {
    if (!currentProject) return;
    const cId = currentProject.clientId || currentProject.id;
    const authUrl = `${window.location.origin}/link?client_id=${cId}`;

    // Overview pane
    const uniqueUsersCount = currentProject.authorizedUserUids ? Object.keys(currentProject.authorizedUserUids).length : 0;
    const totalAuthsCount = currentProject.totalAuthorizations || 0;

    document.getElementById('overview-unique-users').innerText = uniqueUsersCount;
    document.getElementById('overview-total-auths').innerText = totalAuthsCount;
    document.getElementById('overview-client-id').value = cId;
    document.getElementById('overview-auth-url').value = authUrl;

    // OAuth pane
    document.getElementById('oauth-client-id').value = cId;
    document.getElementById('oauth-client-secret').value = currentProject.clientSecret || '';
    
    const uris = currentProject.redirectUris && currentProject.redirectUris.length > 0
        ? currentProject.redirectUris.join('\n')
        : (currentProject.redirectUrl || '');
    document.getElementById('oauth-redirect-uris').value = uris;

    // Analytics pane
    document.getElementById('analytics-total-auths').innerText = totalAuthsCount;
    document.getElementById('analytics-unique-users').innerText = uniqueUsersCount;
    document.getElementById('analytics-last-active').innerText = currentProject.lastAuthorizedAt 
        ? new Date(currentProject.lastAuthorizedAt).toLocaleString() 
        : 'Never';

    // Settings pane
    document.getElementById('settings-project-name').value = currentProject.appName || '';
    document.getElementById('settings-project-logo').value = currentProject.appLogo || '';
    document.getElementById('settings-created-at').value = currentProject.createdAt 
        ? new Date(currentProject.createdAt).toLocaleString() 
        : 'Unknown';

    updateSdkSnippets();
}

// ─── REAL WORKING USERS DIRECTORY ───
window.loadProjectUsers = async function() {
    if (!currentProject) return;
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--dev-text-dim); padding: 24px;">Loading real player records...</td></tr>`;

    try {
        // Fetch fresh project document to get latest authorizedUserUids
        const cId = currentProject.clientId || currentProject.id;
        const appDoc = await getDoc(doc(db, "sso_links", cId));
        if (appDoc.exists()) {
            currentProject = { id: appDoc.id, ...appDoc.data() };
        }

        const userUidsMap = currentProject.authorizedUserUids || {};
        const uids = Object.keys(userUidsMap);

        if (uids.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--dev-text-dim); padding: 36px;">
                        <div style="font-size: 1.6rem; margin-bottom: 6px;">👥</div>
                        <div style="font-weight: 700; color: #fff; margin-bottom: 4px;">No authenticated users yet</div>
                        <div style="font-size: 0.8rem;">Players will automatically appear here once they log into your app with CrimX.</div>
                    </td>
                </tr>
            `;
            projectUsersData = [];
            return;
        }

        // Fetch user profiles in parallel
        const userPromises = uids.map(async (uid) => {
            try {
                const uDoc = await getDoc(doc(db, "users", uid));
                if (uDoc.exists()) {
                    const uData = uDoc.data();
                    return {
                        uid: uid,
                        displayName: uData.username || uData.displayName || `Player ${uid.slice(0, 6)}`,
                        email: uData.email || 'Private / Hidden',
                        avatar: uData.photoURL || uData.avatarUrl || 'https://i.ibb.co/TBkJR2Jn/unnamed-removebg-preview.png',
                        authorizedAt: userUidsMap[uid]?.authorizedAt || currentProject.lastAuthorizedAt || currentProject.createdAt
                    };
                }
            } catch(e) {
                console.warn("Could not fetch user profile:", uid, e);
            }
            return {
                uid: uid,
                displayName: `Player ${uid.slice(0, 6)}`,
                email: 'Protected',
                avatar: 'https://i.ibb.co/TBkJR2Jn/unnamed-removebg-preview.png',
                authorizedAt: currentProject.lastAuthorizedAt || currentProject.createdAt
            };
        });

        projectUsersData = await Promise.all(userPromises);
        window.renderUsersTable();

    } catch(err) {
        console.error("Error loading project users:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #f87171; padding: 24px;">Failed to load player records: ${err.message}</td></tr>`;
    }
};

window.renderUsersTable = function() {
    const tbody = document.getElementById('users-table-body');
    const searchInp = document.getElementById('users-search-input');
    const filterTerm = searchInp ? searchInp.value.trim().toLowerCase() : '';

    if (!tbody) return;

    let filtered = projectUsersData;
    if (filterTerm) {
        filtered = projectUsersData.filter(u => 
            u.displayName.toLowerCase().includes(filterTerm) ||
            u.email.toLowerCase().includes(filterTerm) ||
            u.uid.toLowerCase().includes(filterTerm)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--dev-text-dim); padding: 24px;">No players match "${filterTerm}".</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(u => {
        const dateStr = u.authorizedAt ? new Date(u.authorizedAt).toLocaleDateString() : 'Active';
        return `
            <tr>
                <td>
                    <div class="dev-user-cell">
                        <img src="${u.avatar}" alt="${u.displayName}" class="dev-table-avatar" onerror="this.src='https://i.ibb.co/TBkJR2Jn/unnamed-removebg-preview.png'">
                        <span class="dev-user-name">${u.displayName}</span>
                    </div>
                </td>
                <td style="color: var(--dev-text-muted); font-family: monospace; font-size: 0.8rem;">${u.email}</td>
                <td style="color: var(--dev-text-dim); font-family: monospace; font-size: 0.76rem;">${u.uid}</td>
                <td style="color: var(--dev-text-muted); font-size: 0.82rem;">${dateStr}</td>
                <td>
                    <button type="button" class="dev-btn-revoke" onclick="window.revokePlayerAccess('${u.uid}', '${u.displayName}')">Revoke Access</button>
                </td>
            </tr>
        `;
    }).join('');
};

window.filterUsersTable = function() {
    window.renderUsersTable();
};

window.revokePlayerAccess = async function(uid, name) {
    if (!currentProject) return;
    if (!confirm(`Are you sure you want to revoke ${name}'s access to ${currentProject.appName}?`)) return;

    const cId = currentProject.clientId || currentProject.id;

    try {
        // 1. Remove user from app's authorizedUserUids map
        const userMap = { ...(currentProject.authorizedUserUids || {}) };
        delete userMap[uid];

        await updateDoc(doc(db, "sso_links", cId), {
            authorizedUserUids: userMap
        });
        currentProject.authorizedUserUids = userMap;

        // 2. Remove app from user's connected_apps collection
        try {
            await deleteDoc(doc(db, "users", uid, "connected_apps", cId));
        } catch(e) {
            console.warn("Could not delete connected_apps doc:", e);
        }

        window.showToast(`✓ Access revoked for ${name}`);
        await window.loadProjectUsers();
        populateProjectData();

    } catch(err) {
        console.error("Error revoking access:", err);
        alert("Failed to revoke player access: " + err.message);
    }
};

// ─── OAUTH & SETTINGS ACTIONS ───
window.toggleSecretVisibility = function() {
    const input = document.getElementById('oauth-client-secret');
    const btn = document.getElementById('btn-toggle-secret');
    if (!input || !btn) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerText = 'Hide';
    } else {
        input.type = 'password';
        btn.innerText = 'Show';
    }
};

window.copySecretVal = function() {
    if (!currentProject || !currentProject.clientSecret) return;
    navigator.clipboard.writeText(currentProject.clientSecret).then(() => {
        window.showToast("✓ Client Secret copied");
    });
};

window.regenerateSecret = async function() {
    if (!currentProject) return;
    if (!confirm("Regenerating the secret will immediately invalidate your current secret. Continue?")) return;
    const cId = currentProject.clientId || currentProject.id;
    const newSecret = `crimx_secret_${generateSecureRandomHex(18)}`;

    try {
        await updateDoc(doc(db, "sso_links", cId), {
            clientSecret: newSecret
        });
        currentProject.clientSecret = newSecret;
        document.getElementById('oauth-client-secret').value = newSecret;
        window.showToast("✓ New Client Secret generated!");
    } catch(err) {
        alert("Failed to regenerate secret: " + err.message);
    }
};

window.saveProjectOAuth = async function(e) {
    e.preventDefault();
    if (!currentProject) return;
    const btn = document.getElementById('btn-save-oauth');
    btn.disabled = true;
    btn.innerText = "Saving...";

    const cId = currentProject.clientId || currentProject.id;
    const redirectRaw = document.getElementById('oauth-redirect-uris').value.trim();
    const redirectUris = redirectRaw ? redirectRaw.split(/[\n,]+/).map(u => u.trim()).filter(Boolean) : [];

    const perms = [];
    if (document.getElementById('scope-profile').checked) perms.push("Access player profile & avatar");
    if (document.getElementById('scope-email').checked) perms.push("View verified email address");

    try {
        await updateDoc(doc(db, "sso_links", cId), {
            redirectUris: redirectUris,
            redirectUrl: redirectUris[0] || "",
            permissions: perms
        });
        currentProject.redirectUris = redirectUris;
        currentProject.permissions = perms;
        window.showToast("✓ OAuth settings saved successfully!");
        updateSdkSnippets();
    } catch(err) {
        alert("Failed to save settings: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Changes";
    }
};

window.saveProjectSettings = async function(e) {
    e.preventDefault();
    if (!currentProject) return;
    const btn = document.getElementById('btn-save-settings');
    btn.disabled = true;
    btn.innerText = "Saving...";

    const cId = currentProject.clientId || currentProject.id;
    const appName = document.getElementById('settings-project-name').value.trim();
    const appLogo = document.getElementById('settings-project-logo').value.trim() || currentProject.appLogo;

    try {
        await updateDoc(doc(db, "sso_links", cId), {
            appName: appName,
            appLogo: appLogo
        });
        currentProject.appName = appName;
        currentProject.appLogo = appLogo;

        document.getElementById('topbar-project-name').innerText = appName;
        document.getElementById('overview-title').innerText = appName;

        window.showToast("✓ Project settings updated!");
        window.loadProjects();
    } catch(err) {
        alert("Failed to update project: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Settings";
    }
};

window.uploadProjectLogo = async function(file) {
    if (!file || !file.type.startsWith('image/')) return alert("Not a valid image file.");
    window.showToast("Uploading logo...");
    try {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd });
        const json = await res.json();
        if (!json.success) throw new Error("Upload Failed");
        document.getElementById('settings-project-logo').value = json.data.url;
        window.showToast("✓ Logo uploaded!");
    } catch(e) {
        alert("Upload error: " + e.message);
    }
};

window.deleteCurrentProject = async function() {
    if (!currentProject) return;
    const cId = currentProject.clientId || currentProject.id;
    const confirmation = prompt(`To confirm deletion, type the project name "${currentProject.appName}":`);
    if (confirmation !== currentProject.appName) {
        alert("Deletion cancelled. Project name did not match.");
        return;
    }

    try {
        await deleteDoc(doc(db, "sso_links", cId));
        window.showToast(`✓ Project "${currentProject.appName}" deleted.`);
        window.backToHomepage();
        await window.loadProjects();
    } catch(err) {
        alert("Failed to delete project: " + err.message);
    }
};

window.testOpenAuthUrl = function() {
    if (!currentProject) return;
    const cId = currentProject.clientId || currentProject.id;
    window.open(`/link?client_id=${cId}`, '_blank');
};

// ─── SDK CODE SNIPPETS ───
window.switchCodeLang = function(lang) {
    activeCodeLang = lang;
    ['js', 'node', 'py', 'curl'].forEach(l => {
        const btn = document.getElementById(`code-tab-${l}`);
        if (btn) btn.classList.toggle('active', l === lang);
    });
    updateSdkSnippets();
};

function updateSdkSnippets() {
    const el = document.getElementById('sdk-code-display');
    if (!el || !currentProject) return;

    const origin = window.location.origin;
    const cId = currentProject.clientId || currentProject.id;
    const redirectUri = (currentProject.redirectUris && currentProject.redirectUris[0]) || 'https://yourgame.com/callback';

    const snippets = {
        js: `// 1. Include CrimX SDK:
import { CrimX } from "${origin}/crimx.js";

// 2. Launch player sign-in:
const loginUrl = CrimX.getAuthUrl({
  clientId: "${cId}",
  redirectUri: "${redirectUri}",
  scope: "profile email"
});
window.location.href = loginUrl;

// 3. On your callback page, parse token:
const callback = CrimX.parseCallback();
if (callback.success) {
  const session = await CrimX.exchangeCode({
    code: callback.code,
    clientId: "${cId}"
  });
  console.log("Player Authenticated:", session.user.name, session.user.uid);
}`,
        node: `// Node.js Backend Verification:
import { CrimX } from "${origin}/crimx.js";

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const session = await CrimX.exchangeCode({
      code: code,
      clientId: "${cId}",
      clientSecret: process.env.CRIMX_CLIENT_SECRET
    });

    // Verified player profile:
    req.session.player = session.user;
    res.redirect('/game');
  } catch (err) {
    res.status(401).send("Verification failed: " + err.message);
  }
});`,
        py: `# Python / FastAPI backend exchange:
from fastapi import FastAPI, Request
from crimx import CrimX

@app.get("/callback")
async def callback(code: str):
    session = await CrimX.exchange_code(
        code=code,
        client_id="${cId}",
        client_secret="YOUR_CLIENT_SECRET"
    )
    return {"status": "authenticated", "player": session["user"]}`,
        curl: `# Exchange an authorization code:
curl -X POST "${origin}/auth/token" \\
  -d "grant_type=authorization_code" \\
  -d "code=crimx_code_abc123" \\
  -d "client_id=${cId}" \\
  -d "client_secret=YOUR_CLIENT_SECRET"`
    };

    el.textContent = snippets[activeCodeLang] || snippets.js;
}

window.copyActiveCode = function() {
    const el = document.getElementById('sdk-code-display');
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => {
        window.showToast("✓ Integration code copied");
    });
};

// ─── AUTH STATE INITIALIZATION ───
onAuthStateChanged(auth, user => {
    if (user && (user.emailVerified || user.providerData.some(p => p.providerId === 'google.com'))) {
        currentUser = user;
        document.getElementById('dev-auth-notice').style.display = 'none';

        const name = user.displayName || user.email.split('@')[0] || 'Developer';
        const avatar = user.photoURL || 'https://i.ibb.co/TBkJR2Jn/unnamed-removebg-preview.png';

        const greetingEl = document.getElementById('home-greeting-name');
        if (greetingEl) greetingEl.innerText = name;

        const homeAvatar = document.getElementById('home-user-avatar');
        if (homeAvatar) homeAvatar.src = avatar;

        const consoleAvatar = document.getElementById('console-user-avatar');
        if (consoleAvatar) consoleAvatar.src = avatar;

        document.getElementById('dev-homepage-view').style.display = 'flex';
        window.loadProjects();
    } else {
        currentUser = null;
        document.getElementById('dev-auth-notice').style.display = 'flex';
        document.getElementById('dev-homepage-view').style.display = 'none';
        document.getElementById('dev-project-view').style.display = 'none';
    }
});
