import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence, updateProfile, sendEmailVerification, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, query, orderBy, where, doc, onSnapshot, updateDoc, serverTimestamp, arrayUnion, arrayRemove, setDoc, deleteDoc, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBSSJKDrFJ1_qlliZqgw34CY2TSaKOxxxM",
    authDomain: "crimsonflame-8169e.firebaseapp.com",
    projectId: "crimsonflame-8169e",
    storageBucket: "crimsonflame-8169e.firebasestorage.app",
    messagingSenderId: "406321213530",
    appId: "1:406321213530:web:92d27a69d34d147393a863"
};

const ADMIN_EMAIL = "allaboutwaterdiamond@gmail.com";
const DEFAULT_PFP = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const IMGBB_API_KEY = "d5fd4e3e9fedc18b9bed075f980f12b7";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
setPersistence(auth, browserLocalPersistence);

let currentUser = null;
let isGlobalAdmin = false; 
let isLogin = true;

const currentPage = window.location.pathname.split('/').pop() || 'index.html';
const isIndex = currentPage === 'index.html' || currentPage === '';

window.routeTo = function(page) {
    if (page === 'home' || page === 'updates' || page === 'terms' || page === 'privacy') {
        if (!isIndex) {
            window.location.href = `index.html#${page}`;
        } else {
            document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
            const pg = document.getElementById('page-' + page);
            if (pg) pg.style.display = 'block';
            
            document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
            const activeLink = document.querySelector(`.nav-links a[onclick="routeTo('${page}')"]`);
            if (activeLink) activeLink.classList.add('active');

            if (page === 'home') window.fetchHomeImages();
            if (page === 'updates') window.fetchNews();
            if (page === 'terms') window.fetchTerms();
            if (page === 'privacy') window.fetchPrivacy();
        }
    } else {
        window.location.href = `${page}.html`;
    }
};

const urlParams = new URLSearchParams(window.location.search);
const quickAuthAppName = urlParams.get('app_name');
const quickAuthRedirectUri = urlParams.get('redirect_uri');

if (isIndex && quickAuthAppName && quickAuthRedirectUri) {
    setTimeout(() => {
        document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
        const modal = document.getElementById('page-auth-quick');
        if (modal) modal.style.display = 'flex';
        const title = document.getElementById('auth-quick-title');
        if (title) title.innerText = `Connect to ${quickAuthAppName}`;
        var nav = document.querySelector('.pill-nav');
        if (nav) nav.style.display = 'none';
    }, 150);
}

window.updateQuickAuthUI = function() {
    if (!quickAuthAppName || !document.getElementById('page-auth-quick')) return;
    if (currentUser) {
        document.getElementById('auth-quick-user-info').style.display = 'block';
        document.getElementById('auth-quick-login-prompt').style.display = 'none';
        document.getElementById('auth-quick-actions').style.display = 'flex';
        document.getElementById('auth-quick-name').innerText = currentUser.displayName || currentUser.email.split('@')[0];
        document.getElementById('auth-quick-email').innerText = currentUser.email;
        document.getElementById('auth-quick-pfp').src = currentUser.photoURL || DEFAULT_PFP;
    } else {
        document.getElementById('auth-quick-user-info').style.display = 'none';
        document.getElementById('auth-quick-login-prompt').style.display = 'block';
        document.getElementById('auth-quick-actions').style.display = 'none';
    }
};

window.cancelQuickAuth = function() { window.location.href = `${quickAuthRedirectUri}?cf_auth=canceled`; };
window.approveQuickAuth = function() {
    if (!currentUser) return;
    const userData = { uid: currentUser.uid, name: currentUser.displayName || currentUser.email.split('@')[0], email: currentUser.email, pfp: currentUser.photoURL || DEFAULT_PFP };
    window.location.href = `${quickAuthRedirectUri}?cf_auth=success&user_data=${encodeURIComponent(JSON.stringify(userData))}`;
};

window.showCustomPrompt = function(title, desc, placeholder, onConfirm) {
    const overlay = document.getElementById('custom-prompt'); if(!overlay) return;
    const input = document.getElementById('custom-prompt-input');
    document.getElementById('custom-prompt-title').innerText = title; document.getElementById('custom-prompt-desc').innerText = desc;
    input.style.display = 'block'; input.placeholder = placeholder; input.value = "";
    overlay.classList.add('active'); input.focus();
    document.getElementById('custom-prompt-cancel').onclick = () => overlay.classList.remove('active');
    const submitAction = () => { if(input.value.trim() !== "") { overlay.classList.remove('active'); onConfirm(input.value.trim()); } };
    document.getElementById('custom-prompt-confirm').onclick = submitAction;
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submitAction(); } };
};

window.showCustomAlert = function(message) {
    const overlay = document.getElementById('custom-alert'); if(!overlay) { alert(message); return; }
    document.getElementById('custom-alert-message').innerText = message; overlay.classList.add('active');
    document.getElementById('custom-alert-ok').onclick = () => overlay.classList.remove('active');
};

function showResponseText(element, type, text) {
    const existing = element.parentNode.querySelectorAll('.status-text');
    existing.forEach(el => el.remove());

    const statusDiv = document.createElement('div'); 
    statusDiv.className = `status-text ${type}`; 
    statusDiv.innerText = text; 
    statusDiv.style.display = 'block';
    element.parentNode.insertBefore(statusDiv, element.nextSibling); 
    setTimeout(() => statusDiv.remove(), 4000); 
}

function formatTime(timestamp) {
    if(!timestamp) return 'Just now'; return timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

window.submitLogin = async function(e) {
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = "Processing...";
    try {
        if(isLogin) {
            const cred = await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            if (!cred.user.emailVerified) { await sendEmailVerification(cred.user); await signOut(auth); window.showCustomAlert("Email not verified. Link sent."); } 
            else { window.routeTo('home'); }
        } else {
            const cred = await createUserWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            await sendEmailVerification(cred.user); await signOut(auth); window.showCustomAlert("Account created! Check inbox."); window.toggleLoginMode();
        }
    } catch (err) { showResponseText(btn, 'error', err.message); } finally { btn.disabled = false; btn.innerText = "Submit"; }
};

window.loginWithGoogle = async function(e) { e.preventDefault(); try { await signInWithPopup(auth, googleProvider); window.routeTo('home'); } catch (err) { window.showCustomAlert(err.message); } };

window.submitProfile = async function(e) {
    e.preventDefault(); 
    const btn = e.target.querySelector('button[type="submit"]');
    const newName = document.getElementById('display-name').value.trim();
    const newUsername = document.getElementById('username-input').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const newPfp = document.getElementById('dashboard-pfp-preview').src;
    
    if (!currentUser) return;
    btn.disabled = true; 
    btn.innerText = "Checking...";

    try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        let updates = { displayName: newName, photoURL: newPfp };

        if (newUsername && newUsername !== userData.username) {
            if (newUsername.length < 3) throw new Error("Username must be at least 3 characters.");

            if (userData.lastUsernameChange) {
                const lastChange = userData.lastUsernameChange.toDate();
                const daysSince = (new Date() - lastChange) / (1000 * 60 * 60 * 24);
                if (daysSince < 30) {
                    throw new Error(`Usernames can only be changed once every 30 days. You have ${Math.ceil(30 - daysSince)} days left.`);
                }
            }

            const q = query(collection(db, "users"), where("username", "==", newUsername));
            const snap = await getDocs(q);
            if (!snap.empty) {
                throw new Error(`Username @${newUsername} is already taken!`);
            }

            updates.username = newUsername;
            updates.lastUsernameChange = serverTimestamp();
        }

        await updateProfile(currentUser, { displayName: newName, photoURL: newPfp });
        await setDoc(userRef, updates, { merge: true });
        showResponseText(btn, 'success', "Profile Saved!");
    } catch (err) {
        window.showCustomAlert(err.message);
        showResponseText(btn, 'error', "Update Blocked.");
    } finally {
        btn.disabled = false; 
        btn.innerText = "Save Profile Info";
    }
};

window.logOutUser = function() { signOut(auth); window.routeTo('home'); };
window.toggleLoginMode = function() { isLogin = !isLogin; document.getElementById('auth-title').innerText = isLogin ? "Login" : "Register"; document.getElementById('toggle-auth').innerText = isLogin ? "Register here" : "Login here"; };

window.generateDiscordLinkCode = async function() {
    if(!currentUser) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString(); 
    await setDoc(doc(db, "users", currentUser.uid), { linkCode: code }, { merge: true });
    const display = document.getElementById('discord-link-code-display');
    display.style.display = 'block'; display.innerText = `DM the bot: !link ${code}`;
};

window.unlinkDiscord = async function() {
    if(!currentUser) return;
    await updateDoc(doc(db, "users", currentUser.uid), { discordId: null, discordUsername: null, discordAvatar: null, linkCode: null });
    window.showCustomAlert("Discord account unlinked.");
};

window.toggleRPC = async function(e) {
    if(!currentUser) return;
    try {
        await updateDoc(doc(db, "users", currentUser.uid), { rpcEnabled: e.target.checked });
        window.showCustomAlert(e.target.checked ? "Discord RPC Broadcast Enabled" : "Discord RPC Broadcast Disabled");
    } catch(err) { console.error(err); }
};

let userDocUnsub = null;

onAuthStateChanged(auth, user => {
    const navAuth = document.getElementById('nav-auth-link');
    if (user && (user.emailVerified || user.providerData.some(p => p.providerId === 'google.com'))) {
        currentUser = user; isGlobalAdmin = (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
        
        if (navAuth) { navAuth.innerText = "Dashboard"; navAuth.onclick = () => window.routeTo('dashboard'); }
        
        getDoc(doc(db, "users", currentUser.uid)).then(docSnap => {
            if (!docSnap.exists() || !docSnap.data().username) {
                const baseName = (user.displayName || user.email.split('@')[0]);
                setDoc(doc(db, "users", currentUser.uid), { 
                    uid: currentUser.uid, 
                    username: baseName.toLowerCase().replace(/[^a-z0-9_]/g, ''), 
                    displayName: baseName 
                }, { merge: true });
            }
        });

        if (currentPage === 'dashboard.html') {
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('dashboard-container').style.display = 'block';
            document.getElementById('user-display-email').innerText = user.email;
            document.getElementById('display-name').value = user.displayName || "";
            document.getElementById('dashboard-pfp-preview').src = user.photoURL || DEFAULT_PFP;
            
            if (userDocUnsub) userDocUnsub();
            userDocUnsub = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
                if(docSnap.exists()) {
                    const data = docSnap.data();
                    
                    document.getElementById('username-input').value = data.username || "";

                    if(data.discordId) {
                        document.getElementById('discord-unlinked').style.display = 'none';
                        document.getElementById('discord-linked').style.display = 'flex';
                        document.getElementById('rpc-settings').style.display = 'block';
                        document.getElementById('discord-username').innerText = `@${data.discordUsername}`;
                        document.getElementById('discord-avatar').src = data.discordAvatar || DEFAULT_PFP;
                        if(document.getElementById('rpc-toggle')) document.getElementById('rpc-toggle').checked = data.rpcEnabled || false;
                    } else {
                        document.getElementById('discord-unlinked').style.display = 'block';
                        document.getElementById('discord-linked').style.display = 'none';
                        document.getElementById('rpc-settings').style.display = 'none';
                    }
                }
            });
        }
        
        if (currentPage === 'chatter.html') { document.getElementById('chatter-locked').style.display = 'none'; document.getElementById('chatter-system').style.display = 'flex'; window.initChatter(); }
        if (currentPage === 'support.html') { document.getElementById('support-locked').style.display = 'none'; document.getElementById('support-system').style.display = 'block'; window.fetchTickets(); }
        if (isIndex) {
            if (isGlobalAdmin && document.getElementById('admin-home-editor')) document.getElementById('admin-home-editor').style.display = 'block';
            if (isGlobalAdmin && document.getElementById('admin-panel')) document.getElementById('admin-panel').style.display = 'block';
            window.updateQuickAuthUI();
        }
        handleAccountPresence(currentUser);

    } else {
        currentUser = null; isGlobalAdmin = false;
        if (navAuth) { navAuth.innerText = "Login"; navAuth.onclick = () => window.routeTo('dashboard'); }
        
        if (currentPage === 'dashboard.html') { document.getElementById('login-container').style.display = 'block'; document.getElementById('dashboard-container').style.display = 'none'; }
        if (currentPage === 'chatter.html') { document.getElementById('chatter-locked').style.display = 'block'; document.getElementById('chatter-system').style.display = 'none'; }
        if (currentPage === 'support.html') { document.getElementById('support-locked').style.display = 'block'; document.getElementById('support-system').style.display = 'none'; }
        if (isIndex) { window.updateQuickAuthUI(); }
        if (userDocUnsub) { userDocUnsub(); userDocUnsub = null; }
        handleAccountPresence(null);
    }
});

window.fetchHomeImages = async function() {
    const gal = document.getElementById('home-gallery'); if(!gal) return;
    try {
        const snap = await getDocs(query(collection(db, "home_images"), orderBy("timestamp", "desc")));
        gal.innerHTML = ""; snap.forEach(d => gal.innerHTML += `<img src="${d.data().url}">`);
    } catch(e) {}
};
window.fetchNews = async function() {
    const feed = document.getElementById('news-feed'); if(!feed) return;
    try {
        const snap = await getDocs(query(collection(db, "news"), orderBy("timestamp", "desc")));
        feed.innerHTML = ""; snap.forEach(d => feed.innerHTML += `<div class="news-card"><small style="color:var(--crimson);">${d.data().date}</small><h3>${d.data().title}</h3><div>${marked.parse(d.data().body)}</div></div>`);
    } catch(e) {}
};
window.submitNews = async function(e) {
    e.preventDefault(); await addDoc(collection(db, "news"), { title: document.getElementById('news-title').value, body: document.getElementById('news-body').value, date: new Date().toLocaleDateString(), timestamp: serverTimestamp() });
    window.showCustomAlert("Update Posted!"); window.fetchNews();
};
window.fetchTerms = async function() { const box = document.getElementById('terms-content'); if(!box) return; try { const res = await fetch('terms.md'); box.innerHTML = marked.parse(await res.text()); } catch(e) { box.innerHTML = "Error"; } };
window.fetchPrivacy = async function() { const box = document.getElementById('privacy-content'); if(!box) return; try { const res = await fetch('privacy.md'); box.innerHTML = marked.parse(await res.text()); } catch(e) { box.innerHTML = "Error"; } };

let activeServerId = null; let activeServerData = null; let activeChannelId = null;
let chatterServersUnsub = null; let chatterChannelsUnsub = null; let chatterMessagesUnsub = null;

window.initChatter = function() {
    if(chatterServersUnsub || !currentUser) return;
    chatterServersUnsub = onSnapshot(query(collection(db, "discord_servers"), where("members", "array-contains", currentUser.uid)), snap => {
        const list = document.getElementById('server-list'); if(!list) return;
        list.innerHTML = "";
        snap.forEach(d => {
            const el = document.createElement('div'); el.className = `server-icon ${activeServerId === d.id ? 'active' : ''}`;
            if(d.data().photoURL) el.innerHTML = `<img src="${d.data().photoURL}">`; else el.innerText = d.data().name.substring(0,2).toUpperCase();
            el.onclick = () => window.selectServer(d.id, d.data(), el); list.appendChild(el);
        });
    });
};

window.selectServer = function(id, data, el) {
    activeServerId = id; activeServerData = data; activeChannelId = null;
    document.getElementById('discovery-box').style.display = 'none'; document.getElementById('chat-box').style.display = 'flex';
    document.getElementById('active-server-name').innerText = data.name;
    document.getElementById('chat-box').innerHTML = ""; 
    document.getElementById('chat-form').style.display = 'none';
    document.querySelectorAll('.server-icon').forEach(e => e.classList.remove('active')); if(el) el.classList.add('active');

    const isAdmin = data.admins?.includes(currentUser.uid) || data.owner === currentUser.uid;
    document.getElementById('add-channel-btn').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('server-settings-btn').style.display = isAdmin ? 'block' : 'none';

    if(chatterChannelsUnsub) chatterChannelsUnsub();
    chatterChannelsUnsub = onSnapshot(query(collection(db, "discord_servers", id, "channels"), orderBy("timestamp", "asc")), snap => {
        const cList = document.getElementById('channel-list'); cList.innerHTML = "";
        snap.forEach(cDoc => {
            const cEl = document.createElement('div'); cEl.className = `channel-item ${activeChannelId === cDoc.id ? 'active' : ''}`;
            cEl.innerText = cDoc.data().name; cEl.onclick = () => window.selectChannel(cDoc.id, cDoc.data().name, cEl); cList.appendChild(cEl);
        });
    });
};

window.selectChannel = function(id, name, el) {
    activeChannelId = id;
    document.getElementById('active-channel-name').innerText = `# ${name}`; document.getElementById('chat-form').style.display = 'block';
    document.querySelectorAll('.channel-item').forEach(e => e.classList.remove('active')); if(el) el.classList.add('active');

    const chatForm = document.getElementById('chat-form');
    if(chatForm && !document.getElementById('slash-menu-container')) {
        const slashMenu = document.createElement('div');
        slashMenu.id = 'slash-menu-container';
        slashMenu.style.cssText = "display:none; position:absolute; bottom:100%; left:0; width:100%; max-width:400px; background:rgba(20,20,20,0.9); border:1px solid rgba(255,255,255,0.1); border-radius:8px; z-index:100; margin-bottom:10px; max-height:200px; overflow-y:auto; box-shadow:0 8px 16px rgba(0,0,0,0.5); padding:5px; backdrop-filter:blur(10px);";
        chatForm.style.position = 'relative';
        chatForm.insertBefore(slashMenu, chatForm.firstChild);
        
        const inp = document.getElementById('chat-input');
        inp.addEventListener('input', (e) => {
            const val = e.target.value;
            if(val.startsWith('/')) {
                let cmds = [];
                if(activeServerData && activeServerData.bots) {
                    activeServerData.bots.forEach(b => {
                        if(b.graph?.drawflow?.Home?.data) {
                            Object.values(b.graph.drawflow.Home.data).forEach(n => {
                                if(n.name === 'trigger' && n.data.keyword?.startsWith('/')) {
                                    let baseCmd = n.data.keyword.split(' ')[0];
                                    if(baseCmd.toLowerCase().startsWith(val.split(' ')[0].toLowerCase())) {
                                        cmds.push({ name: b.name, pfp: b.pfp || DEFAULT_PFP, cmd: n.data.keyword });
                                    }
                                }
                            });
                        }
                    });
                }
                if(cmds.length > 0) {
                    slashMenu.innerHTML = cmds.map(c => `
                        <div style="display:flex; align-items:center; gap:10px; padding:8px; cursor:pointer; border-radius:4px;" 
                             onmouseover="this.style.background='rgba(255,255,255,0.1)'" 
                             onmouseout="this.style.background='transparent'"
                             onclick="document.getElementById('chat-input').value='${c.cmd.split(' ')[0]} '; document.getElementById('slash-menu-container').style.display='none'; document.getElementById('chat-input').focus();">
                            <img src="${c.pfp}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                            <div style="line-height:1.2;">
                                <strong style="color:white; font-size:14px;">${c.cmd}</strong><br>
                                <span style="color:#a1a1aa; font-size:11px;">${c.name} APP</span>
                            </div>
                        </div>
                    `).join('');
                    slashMenu.style.display = 'block';
                } else {
                    slashMenu.style.display = 'none';
                }
            } else {
                slashMenu.style.display = 'none';
            }
        });
    }

    if(chatterMessagesUnsub) chatterMessagesUnsub();
    const box = document.getElementById('chat-box'); box.innerHTML = "";
    chatterMessagesUnsub = onSnapshot(query(collection(db, "discord_servers", activeServerId, "channels", id, "messages"), orderBy("timestamp", "asc")), snap => {
        box.innerHTML = "";
        snap.forEach(mDoc => {
            const m = mDoc.data(); const timeStr = formatTime(m.timestamp); const botTag = m.isBot ? `<span class="bot-tag">APP</span>` : '';
            let txt = m.text; if (txt.startsWith('chatter-bot-code-')) txt = `<span style="color:#4ade80; font-family:monospace;">[WEBHOOK]: ${txt}</span>`;
            box.innerHTML += `<div class="msg"><img src="${m.senderPfp || DEFAULT_PFP}" class="chat-pfp"><div class="msg-content"><div class="msg-header"><span class="msg-sender">${m.senderName}</span> ${botTag} <span class="msg-timestamp">${timeStr}</span></div><div class="msg-text">${txt}</div></div></div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
};

window.submitChat = async function(e) {
    e.preventDefault(); 
    const inp = document.getElementById('chat-input'); 
    const text = inp.value.trim(); 
    
    if(!text || !currentUser || !activeServerId || !activeChannelId) return;
    
    const sMenu = document.getElementById('slash-menu-container');
    if(sMenu) sMenu.style.display = 'none';

    const ref = collection(db, "discord_servers", activeServerId, "channels", activeChannelId, "messages");
    
    await addDoc(ref, { 
        text, 
        senderUid: currentUser.uid, 
        senderName: currentUser.displayName || "User", 
        senderPfp: currentUser.photoURL || DEFAULT_PFP, 
        timestamp: serverTimestamp() 
    });
    inp.value = "";
    
    if(activeServerData && activeServerData.bots) {
        activeServerData.bots.forEach(bot => {
            if (bot.graph?.drawflow?.Home?.data) {
                const nodes = bot.graph.drawflow.Home.data;
                Object.values(nodes).forEach(n => {
                    if (n.name === 'trigger') {
                        let keyword = n.data.keyword || '';
                        let isMatch = false;
                        
                        let state = {
                            user: currentUser.displayName || "User",
                            message: text,
                            vars: {}
                        };

                        if (keyword.includes('{') && keyword.includes('}')) {
                            let regexPattern = keyword.replace(/[-[\]/()*.+?^$\\|]/g, "\\$&");
                            regexPattern = regexPattern.replace(/\\\{(\w+)\\\}/g, "(?<$1>.+)");
                            try {
                                let regex = new RegExp(`^${regexPattern}`, "i");
                                let match = text.match(regex);
                                if (match) {
                                    isMatch = true;
                                    if (match.groups) {
                                        for (let key in match.groups) {
                                            state.vars[key] = match.groups[key].trim();
                                        }
                                    }
                                }
                            } catch(e) {
                                if (text.toLowerCase().includes(keyword.toLowerCase())) isMatch = true;
                            }
                        } else {
                            if (keyword && text.toLowerCase().includes(keyword.toLowerCase())) isMatch = true;
                        }

                        if (isMatch) {
                            const traverse = async (nodeId) => {
                                const node = nodes[nodeId];
                                if (!node) return;

                                const replaceVars = (str) => {
                                    if (!str) return str;
                                    let res = str.replace(/\{user\}/gi, state.user).replace(/\{message\}/gi, state.message);
                                    for (let key in state.vars) {
                                        res = res.replace(new RegExp(`\\{${key}\\}`, 'gi'), state.vars[key]);
                                    }
                                    return res;
                                };

                                if (node.name === 'action' && node.data.reply) {
                                    setTimeout(() => addDoc(ref, { 
                                        text: replaceVars(node.data.reply), 
                                        senderName: bot.name, 
                                        senderPfp: bot.pfp || 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png', 
                                        isBot: true, 
                                        timestamp: serverTimestamp() 
                                    }), 600);
                                } 
                                else if (node.name === 'set_variable' && node.data.var_name) {
                                    state.vars[node.data.var_name] = replaceVars(node.data.var_value);
                                }
                                else if (node.name === 'code' && node.data.url && node.data.code) {
                                    fetch(`https://YOUR_DISCLOUD_URL_HERE/api/send_discord`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ 
                                            channelId: replaceVars(node.data.url),
                                            message: replaceVars(node.data.code)
                                        })
                                    })
                                    .then(res => res.json())
                                    .then(data => {
                                        if(data.success) {
                                            addDoc(ref, { text: `System: ${bot.name} pushed logic to Discord API.`, senderName: bot.name, senderPfp: bot.pfp || 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png', isBot: true, timestamp: serverTimestamp() });
                                        }
                                    }).catch(()=>{});
                                }
                                else if (node.name === 'discord_webhook' && node.data.url && node.data.code) {
                                    fetch(replaceVars(node.data.url), {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            content: replaceVars(node.data.code),
                                            username: bot.name,
                                            avatar_url: bot.pfp || 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png'
                                        })
                                    })
                                    .then(res => {
                                        if(res.ok) {
                                            addDoc(ref, { text: `System: ${bot.name} triggered a Discord Webhook.`, senderName: bot.name, senderPfp: bot.pfp || 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png', isBot: true, timestamp: serverTimestamp() });
                                        }
                                    }).catch(()=>{});
                                }
                                else if (node.name === 'webhook' && node.data.url && node.data.payload) {
                                    try {
                                        let payloadData = JSON.parse(replaceVars(node.data.payload));
                                        fetch(replaceVars(node.data.url), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payloadData)
                                        })
                                        .then(res => {
                                            if(res.ok) {
                                                addDoc(ref, { text: `System: ${bot.name} triggered a generic server webhook.`, senderName: bot.name, senderPfp: bot.pfp || 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png', isBot: true, timestamp: serverTimestamp() });
                                            }
                                        }).catch(()=>{});
                                    } catch(e) {
                                        console.error("Invalid JSON payload for webhook node.");
                                    }
                                }

                                for (let outputKey in node.outputs) {
                                    const conns = node.outputs[outputKey].connections;
                                    for (let conn of conns) {
                                        await traverse(conn.node);
                                    }
                                }
                            };

                            if (n.outputs['output_1']) {
                                for (let conn of n.outputs['output_1'].connections) {
                                    traverse(conn.node);
                                }
                            }
                        }
                    }
                });
            }
        });
    }
};

window.openDiscovery = async function() {
    document.querySelectorAll('.server-icon').forEach(e => e.classList.remove('active')); document.getElementById('btn-discovery').classList.add('active');
    document.getElementById('active-server-name').innerText = "Discovery"; document.getElementById('channel-list').innerHTML = "";
    document.getElementById('chat-box').style.display = 'none'; document.getElementById('chat-form').style.display = 'none';
    document.getElementById('active-channel-name').innerText = "Discover Public Servers";
    
    const box = document.getElementById('discovery-box'); box.style.display = 'flex'; box.innerHTML = "Loading...";
    const snap = await getDocs(collection(db, "discord_servers")); box.innerHTML = "";
    snap.forEach(d => {
        if(!d.data().members?.includes(currentUser.uid)) {
            const imgHtml = d.data().photoURL ? `<img src="${d.data().photoURL}">` : `<div style="width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.1);margin:0 auto 10px;line-height:80px;font-size:1.5rem;">${d.data().name.substring(0,2).toUpperCase()}</div>`;
            box.innerHTML += `<div class="discovery-card">${imgHtml}<h3>${d.data().name}</h3><button class="btn-primary" onclick="joinServer('${d.id}')">Join</button></div>`;
        }
    });
};
window.joinServer = async function(id) { await updateDoc(doc(db, "discord_servers", id), { members: arrayUnion(currentUser.uid) }); window.openDiscovery(); };
window.createServer = async function() { window.showCustomPrompt("Create Server", "Name:", "Name...", async (n) => { const s = await addDoc(collection(db, "discord_servers"), { name: n, owner: currentUser.uid, members: [currentUser.uid], admins: [currentUser.uid], timestamp: serverTimestamp() }); await addDoc(collection(db, "discord_servers", s.id, "channels"), { name: "general", timestamp: serverTimestamp() }); }); };
window.createChannel = async function() { window.showCustomPrompt("Add Channel", "Name:", "Name...", async (n) => { await addDoc(collection(db, "discord_servers", activeServerId, "channels"), { name: n.toLowerCase().replace(/\s+/g, '-'), timestamp: serverTimestamp() }); }); };

window.botEditor = null; window.editingBotId = null;
window.openServerSettings = async function() {
    document.getElementById('server-settings-main-view').style.display = 'block'; document.getElementById('bot-builder-ui').style.display = 'none';
    document.getElementById('server-settings-modal').classList.add('active');
    const s = await getDoc(doc(db, "discord_servers", activeServerId)); activeServerData = s.data();
    const p = document.getElementById('server-icon-preview'); if(activeServerData.photoURL) { p.src = activeServerData.photoURL; p.style.display = 'block'; }
    window.renderBotList();
};
window.renderBotList = function() {
    const list = document.getElementById('bot-list'); list.innerHTML = "";
    if(!activeServerData.bots || !activeServerData.bots.length) { list.innerHTML = "<p style='color:#aaa;'>No bots yet.</p>"; return; }
    activeServerData.bots.forEach(b => {
        list.innerHTML += `<div class="bot-list-item"><div><strong style="color:white;">${b.name}</strong> <span class="bot-tag">APP</span></div>
        <div><button class="btn-secondary" style="padding:5px;" onclick="startVisualBotBuilder('${b.id}')">Edit</button>
        <button class="btn-danger" style="padding:5px;" onclick="deleteBot('${b.id}')">Delete</button></div></div>`;
    });
};

window.startVisualBotBuilder = function(id = null) {
    document.getElementById('server-settings-main-view').style.display = 'none'; document.getElementById('bot-builder-ui').style.display = 'flex';
    
    if (!document.getElementById('botPfp')) {
        const nameInput = document.getElementById('botName');
        if (nameInput) {
            const pfpInput = document.createElement('input');
            pfpInput.type = 'text';
            pfpInput.id = 'botPfp';
            pfpInput.placeholder = 'Bot PFP Image URL...';
            pfpInput.style.marginLeft = '10px';
            pfpInput.style.padding = '8px';
            pfpInput.style.borderRadius = '5px';
            pfpInput.style.border = '1px solid rgba(255,255,255,0.1)';
            pfpInput.style.background = 'rgba(0,0,0,0.5)';
            pfpInput.style.color = 'white';
            nameInput.parentNode.insertBefore(pfpInput, nameInput.nextSibling);
        }
    }

    const c = document.getElementById('drawflow-container'); c.innerHTML = ""; window.botEditor = new Drawflow(c); window.botEditor.start(); window.editingBotId = id;
    
    if(id) { 
        const b = activeServerData.bots.find(x => x.id === id); 
        if(b) { 
            document.getElementById('botName').value = b.name; 
            if(document.getElementById('botPfp')) document.getElementById('botPfp').value = b.pfp || '';
            try{window.botEditor.import(b.graph);}catch(e){} 
        } 
    } else { 
        document.getElementById('botName').value = ""; 
        if(document.getElementById('botPfp')) document.getElementById('botPfp').value = "";
    }
};

window.cancelBotBuild = function() { document.getElementById('server-settings-main-view').style.display = 'block'; document.getElementById('bot-builder-ui').style.display = 'none'; };

window.addBotNode = function(t) {
    if(t==='trigger') window.botEditor.addNode('trigger', 0, 1, 50, 100, 'trigger', {keyword:''}, `<div><div class="title-box" style="background:rgba(0,0,0,0.5); padding:8px;">Trigger</div><input type="text" df-keyword placeholder="Keyword (e.g. /give {item})..." style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white;"></div>`);
    else if(t==='action') window.botEditor.addNode('action', 1, 1, 350, 50, 'action', {reply:''}, `<div><div class="title-box" style="background:rgba(0,0,0,0.5); padding:8px;">Action</div><input type="text" df-reply placeholder="Reply..." style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white;"></div>`);
    else if(t==='code') window.botEditor.addNode('code', 1, 1, 350, 200, 'code', {url:'',code:''}, `<div><div class="title-box" style="background:rgba(0,0,0,0.5); padding:8px;">Discord API Send</div><input type="text" df-url placeholder="Discord Channel ID..." style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white;"><input type="text" df-code placeholder="Message..." style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white;"></div>`);
    else if(t==='discord_webhook') window.botEditor.addNode('discord_webhook', 1, 1, 350, 350, 'discord_webhook', {url:'', code:''}, `<div><div class="title-box" style="background:rgba(0,0,0,0.5); padding:8px;">Discord Webhook</div><input type="text" df-url placeholder="Webhook URL..." style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white;"><textarea df-code placeholder="Message content..." style="width:100%; margin-top:5px; background:rgba(0,0,0,0.3); color:white; border:1px solid rgba(255,255,255,0.1); padding:5px; resize:vertical;"></textarea></div>`);
    else if(t==='webhook') window.botEditor.addNode('webhook', 1, 1, 350, 500, 'webhook', {url:'', payload:''}, `<div><div class="title-box" style="background:rgba(0,0,0,0.5); padding:8px;">Generic Webhook</div><input type="text" df-url placeholder="URL (e.g. Unity Server)..." style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white;"><textarea df-payload placeholder='{"command": "spawn", "item": "{item}"}' style="width:100%; margin-top:5px; background:rgba(0,0,0,0.3); color:white; border:1px solid rgba(255,255,255,0.1); padding:5px; resize:vertical;"></textarea></div>`);
    else if(t==='set_variable') window.botEditor.addNode('set_variable', 1, 1, 200, 200, 'set_variable', {var_name:'', var_value:''}, `<div><div class="title-box" style="background:rgba(0,0,0,0.5); padding:8px;">Set Variable</div><input type="text" df-var_name placeholder="Variable Name..." style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white;"><input type="text" df-var_value placeholder="Value..." style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white;"></div>`);
};

window.saveVisualBot = async function() {
    const n = document.getElementById('botName').value.trim(); 
    const p = document.getElementById('botPfp') ? document.getElementById('botPfp').value.trim() : '';
    if(!n) return window.showCustomAlert("Need a name!");
    
    const g = window.botEditor.export(); let bots = activeServerData.bots ? [...activeServerData.bots] : [];
    
    if(window.editingBotId) { 
        const i = bots.findIndex(x=>x.id===window.editingBotId); 
        if(i>-1) bots[i] = {id:window.editingBotId, name:n, pfp:p, graph:g}; 
    } else { 
        bots.push({id:Date.now().toString(), name:n, pfp:p, graph:g}); 
    }
    
    await updateDoc(doc(db, "discord_servers", activeServerId), { bots }); 
    window.showCustomAlert("Saved!"); 
    window.cancelBotBuild(); 
    window.openServerSettings();
};
window.deleteBot = async function(id) { await updateDoc(doc(db, "discord_servers", activeServerId), { bots: arrayRemove(activeServerData.bots.find(x=>x.id===id)) }); window.openServerSettings(); };

let activeTicketId = null; let ticketChatUnsubscribe = null;
window.fetchTickets = async function() {
    if(!currentUser) return;
    const list = document.getElementById('ticket-list'); if(!list) return;
    let q = query(collection(db, "tickets"), orderBy("timestamp", "desc"));
    if(!isGlobalAdmin) q = query(collection(db, "tickets"), where("userId", "==", currentUser.uid), orderBy("timestamp", "desc"));
    try {
        const snap = await getDocs(q); list.innerHTML = "";
        if(snap.empty) { list.innerHTML = "<p>No tickets.</p>"; return; }
        snap.forEach(d => {
            const el = document.createElement('div'); el.className = "auth-card"; el.style.cursor = "pointer";
            el.innerHTML = `<strong>${d.data().subject}</strong> <span style="float:right;">${d.data().status}</span>`;
            el.onclick = () => window.openThread(d.id, d.data()); list.appendChild(el);
        });
    } catch(err) { list.innerHTML = `<p>Error loading.</p>`; }
};
window.submitTicket = async function(e) {
    e.preventDefault(); await addDoc(collection(db, "tickets"), { userId: currentUser.uid, userEmail: currentUser.email, subject: document.getElementById('ticket-subject').value, message: document.getElementById('ticket-msg').value, status: "Open", timestamp: serverTimestamp() });
    window.showCustomAlert("Ticket submitted."); window.fetchTickets(); document.getElementById('ticket-form').reset();
};
window.openThread = function(id, data) {
    activeTicketId = id; document.getElementById('list-view').style.display = 'none'; document.getElementById('thread-view').style.display = 'block';
    document.getElementById('active-subject').innerText = data.subject;
    document.getElementById('ticket-chat-form').style.display = data.status === "Closed" ? 'none' : 'flex';
    document.getElementById('admin-close-area').style.display = (isGlobalAdmin && data.status !== "Closed") ? 'block' : 'none';
    if(ticketChatUnsubscribe) ticketChatUnsubscribe();
    ticketChatUnsubscribe = onSnapshot(query(collection(db, "tickets", id, "messages"), orderBy("timestamp", "asc")), snap => {
        const box = document.getElementById('ticket-chat-box'); box.innerHTML = "";
        snap.forEach(m => { box.innerHTML += `<div style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.1);"><strong>${m.data().senderName}</strong>: ${m.data().text}</div>`; });
        box.scrollTop = box.scrollHeight;
    });
};
window.closeThreadView = () => { document.getElementById('list-view').style.display = 'block'; document.getElementById('thread-view').style.display = 'none'; };
window.closeActiveTicket = () => { window.showCustomPrompt("Close", "Reason:", "Reason...", async (r) => { await updateDoc(doc(db, "tickets", activeTicketId), { status: "Closed", closeReason: r }); window.closeThreadView(); }); };
window.submitTicketChat = async function(e) { e.preventDefault(); const inp = document.getElementById('ticket-chat-input'); await addDoc(collection(db, "tickets", activeTicketId, "messages"), { text: inp.value, sender: currentUser.email, senderName: currentUser.displayName, timestamp: serverTimestamp() }); inp.value = ""; };

document.querySelectorAll('.drop-zone').forEach(zone => {
    const input = zone.querySelector('input[type="file"]'); if(!input) return;
    zone.onclick = () => input.click();
    zone.ondragover = e => { e.preventDefault(); zone.classList.add('dragover'); };
    zone.ondragleave = () => zone.classList.remove('dragover');
    zone.ondrop = e => { e.preventDefault(); zone.classList.remove('dragover'); if(e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0], zone.id); };
    input.onchange = e => { if(e.target.files.length) handleUpload(e.target.files[0], zone.id); };
});

async function handleUpload(file, sourceId) {
    if (!file || !file.type.startsWith('image/')) return window.showCustomAlert("Not a valid image.");
    let previewId = '', statusId = '', action = '';
    if (sourceId === 'pfp-drop-zone') { previewId = 'dashboard-pfp-preview'; statusId = 'upload-status'; action = 'pfp'; }
    else if (sourceId === 'server-drop-zone') { previewId = 'server-icon-preview'; statusId = 'server-upload-status'; action = 'server'; }
    else if (sourceId === 'home-drop-zone') { statusId = 'home-upload-status'; action = 'home'; }

    const sEl = document.getElementById(statusId); if(sEl) { sEl.style.display = 'block'; sEl.innerText = 'Uploading...'; }
    try {
        const fd = new FormData(); fd.append("image", file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd });
        const json = await res.json(); if (!json.success) throw new Error("Upload Failed");
        if(previewId) { const p = document.getElementById(previewId); p.src = json.data.url; p.style.display = 'block'; }
        if(action === 'server' && activeServerId) await updateDoc(doc(db, "discord_servers", activeServerId), { photoURL: json.data.url });
        if(action === 'home') { await addDoc(collection(db, "home_images"), { url: json.data.url, timestamp: serverTimestamp() }); window.fetchHomeImages(); }
        if(sEl) sEl.innerText = "Success!";
    } catch (err) { if(sEl) sEl.innerText = "Error uploading."; }
    setTimeout(() => { if(sEl) sEl.style.display = 'none'; }, 3000);
}

setTimeout(() => {
    if (isIndex && window.location.hash) {
        const hash = window.location.hash.replace('#', '');
        window.routeTo(hash);
    } else if (isIndex) {
        window.routeTo('home');
    }
}, 100);

// ─── CRIMSONFLAME ACCOUNT MODAL & REAL PRESENCE SYSTEM ───
let activeAccountTab = 'account';
let accountUserDocUnsub = null;
let accountFriendsUnsub = null;
let accountRequestsUnsub = null;
let presenceHeartbeatInterval = null;
let currentUserAccountData = null;
const friendPresenceUnsubs = new Map();
const friendPresenceCache = new Map();

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const TAB_TITLES = {
    account: { icon: "👤", text: "My Account" },
    security: { icon: "🛡️", text: "Security Check" },
    profile: { icon: "🪪", text: "Profile" },
    notifications: { icon: "🔔", text: "Notifications" },
    settings: { icon: "⚙️", text: "Settings" },
    users: { icon: "🌐", text: "Users" },
    friends: { icon: "🤝", text: "Friends" }
};

function updateAccountModalUserUI(user, userData) {
    const fabPfp = document.getElementById('fab-user-pfp');
    const fabDot = document.getElementById('fab-status-dot');
    const modalAvatar = document.getElementById('modal-user-avatar');
    const modalDot = document.getElementById('modal-user-dot');
    const modalName = document.getElementById('modal-user-name');
    const modalSub = document.getElementById('modal-user-sub');
    const authBtnText = document.getElementById('modal-auth-btn-text');

    if (!user) {
        if (fabPfp) fabPfp.src = DEFAULT_PFP;
        if (fabDot) { fabDot.classList.add('offline'); fabDot.title = 'Offline'; }
        if (modalAvatar) modalAvatar.src = DEFAULT_PFP;
        if (modalDot) modalDot.classList.add('offline');
        if (modalName) modalName.innerText = 'Guest';
        if (modalSub) modalSub.innerText = 'Not Logged In';
        if (authBtnText) authBtnText.innerText = 'Log In';
        return;
    }

    const pfp = (userData && userData.photoURL) || user.photoURL || DEFAULT_PFP;
    const displayName = (userData && userData.displayName) || user.displayName || user.email.split('@')[0];
    const username = (userData && userData.username) ? `@${userData.username}` : `@${user.email.split('@')[0]}`;
    const isOnline = userData ? userData.online !== false : true;

    if (fabPfp) fabPfp.src = pfp;
    if (fabDot) {
        if (isOnline) {
            fabDot.classList.remove('offline');
            fabDot.title = 'Online';
        } else {
            fabDot.classList.add('offline');
            fabDot.title = 'Offline';
        }
    }

    if (modalAvatar) modalAvatar.src = pfp;
    if (modalDot) {
        if (isOnline) modalDot.classList.remove('offline');
        else modalDot.classList.add('offline');
    }
    if (modalName) modalName.innerText = displayName;
    if (modalSub) modalSub.innerText = username;
    if (authBtnText) authBtnText.innerText = 'Log Out';
}

window.setOnlineStatus = async function(isOnline) {
    if (!currentUser) return;
    try {
        const targetOnline = !!isOnline;
        const targetStatus = targetOnline ? "Browsing the Website" : "Offline";
        await updateDoc(doc(db, "users", currentUser.uid), {
            online: targetOnline,
            statusText: targetStatus,
            lastActive: serverTimestamp()
        });
        if (currentUserAccountData) {
            currentUserAccountData.online = targetOnline;
            currentUserAccountData.statusText = targetStatus;
        }
        updateAccountModalUserUI(currentUser, currentUserAccountData);
        renderActiveModalTab();
    } catch (err) {
        console.error("[Account Modal] Failed to update status:", err);
    }
};

function handleAccountPresence(user) {
    if (presenceHeartbeatInterval) {
        clearInterval(presenceHeartbeatInterval);
        presenceHeartbeatInterval = null;
    }
    if (accountUserDocUnsub) {
        accountUserDocUnsub();
        accountUserDocUnsub = null;
    }

    if (!user) {
        currentUserAccountData = null;
        updateAccountModalUserUI(null, null);
        renderActiveModalTab();
        return;
    }

    // Set initial presence on website visit
    getDoc(doc(db, "users", user.uid)).then(snap => {
        const data = snap.exists() ? snap.data() : {};
        const isOnline = data.online !== false;
        const status = isOnline ? "Browsing the Website" : "Offline";

        updateDoc(doc(db, "users", user.uid), {
            online: isOnline,
            statusText: status,
            lastActive: serverTimestamp()
        }).catch(() => {});
    }).catch(() => {});

    // Periodic heartbeat every 60s
    presenceHeartbeatInterval = setInterval(() => {
        if (currentUser && currentUserAccountData && currentUserAccountData.online !== false) {
            updateDoc(doc(db, "users", currentUser.uid), {
                lastActive: serverTimestamp()
            }).catch(() => {});
        }
    }, 60000);

    // Live listener for own user doc
    accountUserDocUnsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
        if (snap.exists()) {
            currentUserAccountData = snap.data();
            updateAccountModalUserUI(user, currentUserAccountData);
            renderActiveModalTab();
        }
    });
}

function switchAccountTab(tabName) {
    activeAccountTab = tabName;
    document.querySelectorAll('.account-nav-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const info = TAB_TITLES[tabName] || { icon: "👤", text: "My Account" };
    const titleIcon = document.getElementById('tab-title-icon');
    const titleText = document.getElementById('tab-title-text');
    if (titleIcon) titleIcon.innerText = info.icon;
    if (titleText) titleText.innerText = info.text;

    document.querySelectorAll('.account-tab-pane').forEach(pane => {
        pane.style.display = 'none';
        pane.classList.remove('active');
    });

    const targetPane = document.getElementById(`pane-${tabName}`);
    if (targetPane) {
        targetPane.style.display = 'block';
        targetPane.classList.add('active');
    }

    renderActiveModalTab();
}

function renderActiveModalTab() {
    const pane = document.getElementById(`pane-${activeAccountTab}`);
    if (!pane) return;

    if (!currentUser) {
        pane.innerHTML = `
            <div class="account-empty-state">
                <div class="account-empty-icon">${TAB_TITLES[activeAccountTab]?.icon || '👤'}</div>
                <div class="account-empty-title">Not logged in</div>
                <div class="account-empty-desc">Sign in to manage your account.</div>
                <button class="account-login-btn" onclick="window.location.href='/auth'">Login</button>
            </div>
        `;
        return;
    }

    switch (activeAccountTab) {
        case 'account':
            renderModalAccount(pane);
            break;
        case 'security':
            renderModalSecurity(pane);
            break;
        case 'profile':
            renderModalProfile(pane);
            break;
        case 'notifications':
            renderModalNotifications(pane);
            break;
        case 'settings':
            renderModalSettings(pane);
            break;
        case 'users':
            renderModalUsers(pane);
            break;
        case 'friends':
            renderModalFriends(pane);
            break;
        default:
            renderModalAccount(pane);
            break;
    }
}

function renderModalAccount(pane) {
    const data = currentUserAccountData || {};
    const isOnline = data.online !== false;
    const statusText = isOnline ? (data.statusText || "Browsing the Website") : "Offline";
    const displayName = data.displayName || currentUser.displayName || currentUser.email.split('@')[0];
    const username = data.username ? `@${data.username}` : `@${currentUser.email.split('@')[0]}`;

    pane.innerHTML = `
        <div class="account-section-card">
            <div class="account-card-title"><span>📡</span> Presence & Live Status</div>
            <div class="account-status-row">
                <div class="account-status-preview">
                    <div class="status-dot-indicator ${isOnline ? '' : 'offline'}"></div>
                    <div>
                        <div style="font-weight: 700; color: #fff;">${escapeHtml(statusText)}</div>
                        <div style="font-size: 0.72rem; color: var(--text-secondary);">Visible to your friends across the CrimsonFlame network</div>
                    </div>
                </div>
                <div class="account-status-toggle-btns">
                    <button type="button" class="status-toggle-btn ${isOnline ? 'active-online' : ''}" onclick="window.setOnlineStatus(true)">
                        🟢 Online
                    </button>
                    <button type="button" class="status-toggle-btn ${!isOnline ? 'active-offline' : ''}" onclick="window.setOnlineStatus(false)">
                        ⚪ Offline
                    </button>
                </div>
            </div>
        </div>

        <div class="account-section-card">
            <div class="account-card-title"><span>👤</span> Account Details</div>
            <div class="account-info-grid">
                <div class="account-info-item">
                    <div class="account-info-label">Display Name</div>
                    <div class="account-info-value">${escapeHtml(displayName)}</div>
                </div>
                <div class="account-info-item">
                    <div class="account-info-label">Username</div>
                    <div class="account-info-value">${escapeHtml(username)}</div>
                </div>
                <div class="account-info-item">
                    <div class="account-info-label">Email</div>
                    <div class="account-info-value" style="font-size: 0.85rem; word-break: break-all;">${escapeHtml(currentUser.email)}</div>
                </div>
                <div class="account-info-item">
                    <div class="account-info-label">Membership</div>
                    <div class="account-info-value" style="color: #ef4444;">${isGlobalAdmin ? 'CrimX Admin' : 'CrimX Member'}</div>
                </div>
            </div>

            <div style="margin-top: 18px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button type="button" class="account-login-btn" style="padding: 9px 20px;" onclick="window.location.href='/dashboard'">
                    Open Full CrimX Dashboard 🚀
                </button>
                <button type="button" class="status-toggle-btn" style="padding: 9px 16px; border-radius: 10px; color: #fff;" onclick="window.location.href='/support'">
                    Support Tickets 💬
                </button>
            </div>
        </div>
    `;
}

function renderModalSecurity(pane) {
    const isEmailVerified = currentUser.emailVerified;
    pane.innerHTML = `
        <div class="account-section-card">
            <div class="account-card-title"><span>🛡️</span> Security & Verification</div>
            <div class="account-info-grid">
                <div class="account-info-item">
                    <div class="account-info-label">Account ID (UID)</div>
                    <div class="account-info-value" style="font-size: 0.76rem; font-family: monospace; color: #94a3b8; word-break: break-all;">
                        ${escapeHtml(currentUser.uid)}
                    </div>
                </div>
                <div class="account-info-item">
                    <div class="account-info-label">Email Verified</div>
                    <div class="account-info-value" style="color: ${isEmailVerified ? '#4ade80' : '#fb923c'};">
                        ${isEmailVerified ? '✅ Verified' : '⚠️ Pending Verification'}
                    </div>
                </div>
                <div class="account-info-item">
                    <div class="account-info-label">DoorAuth Protected</div>
                    <div class="account-info-value" style="color: #4ade80;">Active</div>
                </div>
                <div class="account-info-item">
                    <div class="account-info-label">Sign-In Method</div>
                    <div class="account-info-value">${currentUser.providerData.some(p => p.providerId === 'google.com') ? 'Google OAuth' : 'Email / Password'}</div>
                </div>
            </div>
            <div style="margin-top: 16px;">
                <button type="button" class="account-login-btn" style="padding: 8px 18px; font-size: 0.85rem;" onclick="window.location.href='/reset-password'">
                    Reset Password
                </button>
            </div>
        </div>
    `;
}

function renderModalProfile(pane) {
    const data = currentUserAccountData || {};
    const displayName = data.displayName || currentUser.displayName || '';
    const username = data.username || '';
    pane.innerHTML = `
        <div class="account-section-card">
            <div class="account-card-title"><span>🪪</span> Profile Information</div>
            <div style="margin-bottom: 14px;">
                <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 6px;">DISPLAY NAME</label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="modal-quick-name-input" value="${escapeHtml(displayName)}" style="flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(220,38,38,0.3); border-radius: 8px; padding: 8px 12px; color: #fff;">
                    <button type="button" class="account-login-btn" style="padding: 8px 16px; font-size: 0.85rem;" onclick="window.saveModalDisplayName()">Save</button>
                </div>
            </div>
            <div class="account-info-grid">
                <div class="account-info-item">
                    <div class="account-info-label">Current Handle</div>
                    <div class="account-info-value">@${escapeHtml(username || 'user')}</div>
                </div>
                <div class="account-info-item">
                    <div class="account-info-label">Custom Avatar & Banner</div>
                    <div class="account-info-value">
                        <a href="/dashboard" style="color: #ef4444; text-decoration: underline; font-size: 0.85rem;">Manage on Dashboard</a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.saveModalDisplayName = async function() {
    if (!currentUser) return;
    const inp = document.getElementById('modal-quick-name-input');
    if (!inp) return;
    const newName = inp.value.trim();
    if (!newName) return window.showCustomAlert("Please enter a valid display name.");
    try {
        await updateDoc(doc(db, "users", currentUser.uid), { displayName: newName });
        await updateProfile(currentUser, { displayName: newName });
        window.showCustomAlert("Display name updated!");
    } catch (err) {
        window.showCustomAlert("Failed to update name: " + err.message);
    }
};

function renderModalNotifications(pane) {
    pane.innerHTML = `
        <div class="account-section-card">
            <div class="account-card-title"><span>🔔</span> Incoming Friend Requests</div>
            <div id="modal-notifications-list">
                <div style="color: var(--text-secondary); font-size: 0.88rem; padding: 12px 0;">Loading notifications...</div>
            </div>
        </div>
    `;

    if (accountRequestsUnsub) accountRequestsUnsub();
    const reqRef = collection(db, "users", currentUser.uid, "friend_requests");
    accountRequestsUnsub = onSnapshot(reqRef, (snap) => {
        const list = document.getElementById('modal-notifications-list');
        if (!list) return;

        if (snap.empty) {
            list.innerHTML = `<div style="color: var(--text-secondary); font-size: 0.88rem; padding: 12px 0;">No pending friend requests or notifications.</div>`;
            return;
        }

        const requests = [];
        snap.forEach(d => requests.push({ id: d.id, ...d.data() }));

        list.innerHTML = requests.map(req => `
            <div class="account-friend-card">
                <div class="account-friend-left">
                    <div class="account-friend-pfp">
                        <img src="${req.fromPfp || DEFAULT_PFP}" alt="${escapeHtml(req.fromName || 'User')}">
                    </div>
                    <div class="account-friend-meta">
                        <div class="account-friend-name">${escapeHtml(req.fromName || 'Player')}</div>
                        <div class="account-friend-handle">@${escapeHtml(req.fromUsername || 'user')}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="account-login-btn" style="padding: 6px 12px; font-size: 0.78rem;" onclick="window.acceptAccountFriendRequest('${req.id}', '${escapeHtml(req.fromName || '')}', '${escapeHtml(req.fromUsername || '')}', '${escapeHtml(req.fromPfp || '')}')">
                        Accept
                    </button>
                    <button type="button" class="status-toggle-btn" style="padding: 6px 12px; font-size: 0.78rem; color: #f87171;" onclick="window.declineAccountFriendRequest('${req.id}')">
                        Decline
                    </button>
                </div>
            </div>
        `).join('');
    });
}

function renderModalSettings(pane) {
    pane.innerHTML = `
        <div class="account-section-card">
            <div class="account-card-title"><span>⚙️</span> Website & Preferences</div>
            <div class="account-status-row" style="margin-bottom: 10px;">
                <div>
                    <div style="font-weight: 700; color: #fff;">Dark Crimson Theme</div>
                    <div style="font-size: 0.72rem; color: var(--text-secondary);">Default high-fidelity Obsidian Crimson palette</div>
                </div>
                <span style="color: #4ade80; font-weight: 700; font-size: 0.82rem;">ENABLED</span>
            </div>
            <div class="account-status-row">
                <div>
                    <div style="font-weight: 700; color: #fff;">Live Online Presence</div>
                    <div style="font-size: 0.72rem; color: var(--text-secondary);">Allows friends to see when you're browsing the website or playing games</div>
                </div>
                <span style="color: #4ade80; font-weight: 700; font-size: 0.82rem;">ACTIVE</span>
            </div>
        </div>
    `;
}

function renderModalUsers(pane) {
    pane.innerHTML = `
        <div class="account-section-card">
            <div class="account-card-title"><span>🌐</span> Discover & Add Friends</div>
            <div style="display: flex; gap: 8px; margin-bottom: 14px;">
                <input type="text" id="modal-user-search-input" placeholder="Search by @username..." style="flex: 1; background: rgba(0,0,0,0.35); border: 1px solid rgba(220,38,38,0.3); border-radius: 10px; padding: 10px 14px; color: #fff;">
                <button type="button" class="account-login-btn" style="padding: 10px 18px;" onclick="window.searchModalUsers()">Search</button>
            </div>
            <div id="modal-users-search-results">
                <div style="color: var(--text-secondary); font-size: 0.85rem; padding: 10px 0;">Type a username above to search for players across CrimX.</div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const inp = document.getElementById('modal-user-search-input');
        if (inp) {
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') window.searchModalUsers();
            });
        }
    }, 50);
}

window.searchModalUsers = async function() {
    const inp = document.getElementById('modal-user-search-input');
    const container = document.getElementById('modal-users-search-results');
    if (!inp || !container) return;

    const queryStr = inp.value.trim().toLowerCase().replace('@', '');
    if (!queryStr) {
        container.innerHTML = `<div style="color: #f87171; font-size: 0.85rem; padding: 10px 0;">Please enter a username to search.</div>`;
        return;
    }

    container.innerHTML = `<div style="color: var(--text-secondary); font-size: 0.85rem; padding: 10px 0;">Searching...</div>`;

    try {
        const q = query(
            collection(db, "users"),
            where("username", ">=", queryStr),
            where("username", "<=", queryStr + "\uf8ff"),
            limit(10)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            container.innerHTML = `<div style="color: var(--text-secondary); font-size: 0.85rem; padding: 10px 0;">No users found matching "@${escapeHtml(queryStr)}".</div>`;
            return;
        }

        const users = [];
        snap.forEach(d => {
            if (currentUser && d.id !== currentUser.uid) {
                users.push({ id: d.id, ...d.data() });
            }
        });

        if (users.length === 0) {
            container.innerHTML = `<div style="color: var(--text-secondary); font-size: 0.85rem; padding: 10px 0;">No other users found matching "@${escapeHtml(queryStr)}".</div>`;
            return;
        }

        container.innerHTML = users.map(u => `
            <div class="account-friend-card">
                <div class="account-friend-left">
                    <div class="account-friend-pfp">
                        <img src="${u.photoURL || DEFAULT_PFP}" alt="${escapeHtml(u.displayName || 'Player')}">
                        <div class="friend-dot ${u.online !== false ? '' : 'offline'}"></div>
                    </div>
                    <div class="account-friend-meta">
                        <div class="account-friend-name">${escapeHtml(u.displayName || 'CrimX Player')}</div>
                        <div class="account-friend-handle">@${escapeHtml(u.username || 'user')}</div>
                        <div class="account-friend-status">${escapeHtml(u.online !== false ? (u.statusText || 'Browsing the Website') : 'Offline')}</div>
                    </div>
                </div>
                <button type="button" class="account-login-btn" style="padding: 6px 14px; font-size: 0.78rem;" onclick="window.sendAccountFriendRequest('${u.id}', '${escapeHtml(u.username || '')}')">
                    Add Friend
                </button>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div style="color: #f87171; font-size: 0.85rem; padding: 10px 0;">Search failed: ${escapeHtml(err.message)}</div>`;
    }
};

window.sendAccountFriendRequest = async function(targetUid, targetUsername) {
    if (!currentUser) return;
    try {
        const myData = currentUserAccountData || {};
        const myUsername = myData.username || currentUser.email.split('@')[0];
        const myName = myData.displayName || currentUser.displayName || myUsername;
        const myPfp = myData.photoURL || currentUser.photoURL || DEFAULT_PFP;

        await setDoc(doc(db, "users", targetUid, "friend_requests", currentUser.uid), {
            fromUid: currentUser.uid,
            fromName: myName,
            fromUsername: myUsername,
            fromPfp: myPfp,
            timestamp: serverTimestamp()
        });

        window.showCustomAlert(`Friend request sent to @${targetUsername}!`);
    } catch (err) {
        window.showCustomAlert("Failed to send request: " + err.message);
    }
};

function renderModalFriends(pane) {
    pane.innerHTML = `
        <div class="account-section-card">
            <div class="account-card-title"><span>🤝</span> Friends & Network</div>
            <div id="modal-friends-list">
                <div style="color: var(--text-secondary); font-size: 0.88rem; padding: 12px 0;">Loading friends...</div>
            </div>
        </div>
    `;

    if (accountFriendsUnsub) accountFriendsUnsub();

    const friendsRef = collection(db, "users", currentUser.uid, "friends");
    accountFriendsUnsub = onSnapshot(friendsRef, (snap) => {
        const container = document.getElementById('modal-friends-list');
        if (!container) return;

        if (snap.empty) {
            container.innerHTML = `
                <div style="text-align: center; padding: 24px 12px; color: var(--text-secondary);">
                    <div style="font-size: 2rem; margin-bottom: 6px;">🎮</div>
                    <div style="font-weight: 700; color: #fff; font-size: 0.98rem; margin-bottom: 4px;">No friends connected yet</div>
                    <div style="font-size: 0.82rem; margin-bottom: 14px;">Find players across CrimsonFlame games and website by searching in the Users tab!</div>
                    <button type="button" class="account-login-btn" style="padding: 7px 18px; font-size: 0.82rem;" onclick="window.switchAccountTab('users')">Find Players</button>
                </div>
            `;
            return;
        }

        const rawFriends = [];
        snap.forEach(d => rawFriends.push({ id: d.id, ...d.data() }));

        // Ensure live listener for each friend's user document
        rawFriends.forEach(friend => {
            const fUid = friend.uid || friend.id;
            if (!friendPresenceUnsubs.has(fUid)) {
                const unsub = onSnapshot(doc(db, "users", fUid), (userSnap) => {
                    if (userSnap.exists()) {
                        friendPresenceCache.set(fUid, userSnap.data());
                        updateModalFriendsListDOM(rawFriends);
                    }
                });
                friendPresenceUnsubs.set(fUid, unsub);
            }
        });

        updateModalFriendsListDOM(rawFriends);
    });
}

function updateModalFriendsListDOM(friendsList) {
    const container = document.getElementById('modal-friends-list');
    if (!container) return;

    container.innerHTML = friendsList.map(friend => {
        const fUid = friend.uid || friend.id;
        const live = friendPresenceCache.get(fUid) || {};
        const isOnline = live.online !== undefined ? live.online : (friend.online !== false);
        const statusText = isOnline ? (live.statusText || friend.statusText || 'Browsing the Website') : 'Offline';
        const pfp = live.photoURL || friend.photoURL || DEFAULT_PFP;
        const dispName = live.displayName || friend.displayName || 'CrimX Player';
        const handle = live.username || friend.username || 'user';

        return `
            <div class="account-friend-card">
                <div class="account-friend-left">
                    <div class="account-friend-pfp">
                        <img src="${pfp}" alt="${escapeHtml(dispName)}">
                        <div class="friend-dot ${isOnline ? '' : 'offline'}" title="${isOnline ? 'Online' : 'Offline'}"></div>
                    </div>
                    <div class="account-friend-meta">
                        <div class="account-friend-name">${escapeHtml(dispName)}</div>
                        <div class="account-friend-handle">@${escapeHtml(handle)}</div>
                        <div class="account-friend-status" style="color: ${isOnline ? '#f87171' : '#9ca3af'};">
                            ${escapeHtml(statusText)}
                        </div>
                    </div>
                </div>
                <button type="button" class="status-toggle-btn" style="padding: 6px 12px; font-size: 0.74rem; color: #f87171; border-color: rgba(239, 68, 68, 0.25);" onclick="window.removeAccountFriend('${friend.id}', '${escapeHtml(dispName)}')">
                    Remove
                </button>
            </div>
        `;
    }).join('');
}

window.acceptAccountFriendRequest = async function(fromUid, fromName, fromUsername, fromPfp) {
    if (!currentUser) return;
    try {
        const myData = currentUserAccountData || {};
        const myUsername = myData.username || currentUser.email.split('@')[0];
        const myName = myData.displayName || currentUser.displayName || myUsername;
        const myPfp = myData.photoURL || currentUser.photoURL || DEFAULT_PFP;

        await setDoc(doc(db, "users", currentUser.uid, "friends", fromUid), {
            uid: fromUid,
            displayName: fromName || 'Player',
            username: fromUsername || 'user',
            photoURL: fromPfp || DEFAULT_PFP,
            online: true,
            statusText: "Browsing the Website",
            addedAt: serverTimestamp()
        });

        await setDoc(doc(db, "users", fromUid, "friends", currentUser.uid), {
            uid: currentUser.uid,
            displayName: myName,
            username: myUsername,
            photoURL: myPfp,
            online: true,
            statusText: "Browsing the Website",
            addedAt: serverTimestamp()
        });

        await deleteDoc(doc(db, "users", currentUser.uid, "friend_requests", fromUid));
        window.showCustomAlert(`You are now friends with @${fromUsername}!`);
    } catch (err) {
        window.showCustomAlert("Failed to accept friend request: " + err.message);
    }
};

window.declineAccountFriendRequest = async function(fromUid) {
    if (!currentUser) return;
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "friend_requests", fromUid));
        window.showCustomAlert("Request declined.");
    } catch (err) {
        window.showCustomAlert("Failed to decline request: " + err.message);
    }
};

window.removeAccountFriend = async function(friendUid, friendName) {
    if (!currentUser) return;
    if (!confirm(`Are you sure you want to remove ${friendName} from your friends?`)) return;
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "friends", friendUid));
        await deleteDoc(doc(db, "users", friendUid, "friends", currentUser.uid));
        window.showCustomAlert(`Removed ${friendName} from your friends.`);
    } catch (err) {
        window.showCustomAlert("Failed to remove friend: " + err.message);
    }
};

function initAccountModal() {
    const fab = document.getElementById('account-fab');
    const modal = document.getElementById('account-modal');
    const closeBtn = document.getElementById('account-modal-close');
    const authBtn = document.getElementById('modal-auth-btn');

    if (fab && modal) {
        fab.addEventListener('click', () => {
            const isHidden = modal.style.display === 'none' || !modal.style.display;
            modal.style.display = isHidden ? 'flex' : 'none';
            if (isHidden) renderActiveModalTab();
        });
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
            modal.style.display = 'none';
        }
    });

    document.querySelectorAll('.account-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            if (tab) switchAccountTab(tab);
        });
    });

    if (authBtn) {
        authBtn.addEventListener('click', async () => {
            if (currentUser) {
                try {
                    await updateDoc(doc(db, "users", currentUser.uid), {
                        online: false,
                        statusText: "Offline",
                        lastActive: serverTimestamp()
                    });
                } catch (e) {}
                await signOut(auth);
                window.location.reload();
            } else {
                window.location.href = '/auth';
            }
        });
    }

    window.switchAccountTab = switchAccountTab;
    updateAccountModalUserUI(currentUser, currentUserAccountData);
    renderActiveModalTab();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccountModal);
} else {
    initAccountModal();
}

