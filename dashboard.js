import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence, updateProfile, sendEmailVerification, sendPasswordResetEmail, updatePassword, verifyBeforeUpdateEmail, EmailAuthProvider, reauthenticateWithCredential, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, query, where, doc, onSnapshot, updateDoc, serverTimestamp, setDoc, deleteDoc, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const googleProvider = new GoogleAuthProvider();
setPersistence(auth, browserLocalPersistence);

// Route password reset and action links to /auth/action
const searchParams = new URLSearchParams(window.location.search);
if (searchParams.get('mode') === 'resetPassword' || searchParams.get('oobCode')) {
    window.location.replace('/auth/action' + window.location.search);
}

let currentUser = null;
let isLogin = true;
const DEFAULT_PFP = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const IMGBB_API_KEY = "d5fd4e3e9fedc18b9bed075f980f12b7";

let currentBannerStyle = "linear-gradient(135deg, #2b0d18 0%, #dc2626 50%, #15090f 100%)";
let currentBannerIsImage = false;

// ── Audio Feedback Synthesizer (Web Audio API) ──
function playSfx(type) {
    const prefSfx = document.getElementById('pref-sfx');
    if (prefSfx && !prefSfx.checked) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;

        if (type === 'click') {
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(340, now + 0.05);
            gain.gain.setValueAtTime(0.07, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'success') {
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(587.33, now + 0.07);
            osc.frequency.setValueAtTime(880, now + 0.15);
            gain.gain.setValueAtTime(0.09, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.28);
            osc.start(now);
            osc.stop(now + 0.28);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.linearRampToValueAtTime(140, now + 0.12);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        }
    } catch (e) {
        // audio context could be blocked by autoplay policies
    }
}

// ── Toast Notification Manager ──
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `cf-toast ${type}`;
    
    let icon = "ℹ️";
    if (type === 'success') icon = "✓";
    if (type === 'error') icon = "⚠️";

    toast.innerHTML = `<span style="font-weight: 800; font-size: 1rem;">${icon}</span><span style="flex:1;">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 320);
    }, 3500);
};

window.showCustomAlert = function(message) {
    const overlay = document.getElementById('custom-alert'); 
    if(!overlay) { alert(message); return; }
    document.getElementById('custom-alert-message').innerText = message; 
    overlay.classList.add('active');
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

// ── Helper: Apply Banner Style Cleanly without CSS Property Conflicts ──
function applyBannerStyle(element, bannerVal) {
    if (!element) return;
    if (!bannerVal) {
        element.style.backgroundImage = "none";
        element.style.background = "linear-gradient(135deg, #2b0d18 0%, #dc2626 50%, #15090f 100%)";
        return;
    }
    if (bannerVal.startsWith('http') || bannerVal.startsWith('data:image')) {
        element.style.background = "#12090e";
        element.style.backgroundImage = `url('${bannerVal}')`;
        element.style.backgroundSize = "cover";
        element.style.backgroundPosition = "center";
        element.style.backgroundRepeat = "no-repeat";
    } else {
        element.style.backgroundImage = "none";
        element.style.background = bannerVal;
    }
}

// ── Client-Side Base64 Image Compression Fallback ──
function compressImageFile(file, maxWidth = 1200, maxHeight = 600, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error("Image decode failed"));
            img.src = readerEvent.target.result;
        };
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(file);
    });
}

// ── Settings Studio Modal Controller ──
window.toggleSettingsStudio = function(show) {
    const modal = document.getElementById('settings-studio-modal');
    if (!modal) return;
    if (show) {
        modal.classList.add('open');
        playSfx('click');
    } else {
        modal.classList.remove('open');
        playSfx('click');
    }
};

// ── Tab Switching ──
window.switchSettingsTab = function(tabName, btn) {
    if (tabName === 'friends') {
        window.toggleSettingsStudio(false);
        const friendsEl = document.querySelector('.dash-friends-section');
        if (friendsEl) friendsEl.scrollIntoView({ behavior: 'smooth' });
        playSfx('click');
        return;
    }

    window.toggleSettingsStudio(true);

    document.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    playSfx('click');
};

// ── Live Gamer Profile Card Sync ──
window.updateLivePreview = function() {
    const displayNameVal = document.getElementById('display-name')?.value.trim() || "";
    const usernameVal = document.getElementById('username-input')?.value.trim() || "";
    const statusVal = document.getElementById('status-text-input')?.value.trim() || "";
    const bioVal = document.getElementById('bio-input')?.value.trim() || "";

    const finalName = displayNameVal || (currentUser ? (currentUser.displayName || currentUser.email.split('@')[0]) : "Player Name");
    const finalHandle = usernameVal ? `@${usernameVal}` : "@username";
    const finalStatus = statusVal || "Exploring CrimsonFlame";
    const finalBio = bioVal || "Welcome to my CrimsonFlame player profile!";

    // Update character counters
    const nameCount = document.getElementById('display-name-count');
    if (nameCount) nameCount.innerText = `${displayNameVal.length}/32`;
    const statusCount = document.getElementById('status-text-count');
    if (statusCount) statusCount.innerText = `${statusVal.length}/60`;
    const bioCount = document.getElementById('bio-count');
    if (bioCount) bioCount.innerText = `${bioVal.length}/160`;

    // Live preview card updates
    const pName = document.getElementById('preview-name');
    if (pName) pName.innerText = finalName;
    const pHandle = document.getElementById('preview-handle');
    if (pHandle) pHandle.innerText = finalHandle;
    const pStatus = document.getElementById('preview-status-text');
    if (pStatus) pStatus.innerText = finalStatus;
    const pBio = document.getElementById('preview-bio');
    if (pBio) pBio.innerText = finalBio;

    // Showcase Profile Banner Card updates
    const showName = document.getElementById('showcase-display-name');
    if (showName) showName.innerText = finalName;
    const showHandle = document.getElementById('showcase-handle');
    if (showHandle) showHandle.innerText = finalHandle;
    const showStatus = document.getElementById('showcase-status-text');
    if (showStatus) showStatus.innerText = finalStatus;
    const showBio = document.getElementById('showcase-bio');
    if (showBio) showBio.innerText = finalBio;

    // Sidebar summary updates
    const sName = document.getElementById('sidebar-user-name');
    if (sName) sName.innerText = finalName;
    const sHandle = document.getElementById('sidebar-user-handle');
    if (sHandle) sHandle.innerText = finalHandle;

    // CIM sidebar mini profile card updates (matches untitled.png)
    const cimName = document.getElementById('cim-profile-name');
    if (cimName) cimName.innerText = finalName;
    const cimHandle = document.getElementById('cim-profile-handle');
    if (cimHandle) cimHandle.innerText = finalHandle;
    const cimStatus = document.getElementById('cim-profile-status');
    if (cimStatus) cimStatus.innerText = finalStatus;
    const cimBio = document.getElementById('cim-profile-bio');
    if (cimBio) cimBio.innerText = finalBio;

    // Update live preview social chips
    const previewDiscordChip = document.getElementById('preview-discord-chip');
    const previewYouTubeChip = document.getElementById('preview-youtube-chip');
    const discordToggle = document.getElementById('pref-show-discord');
    const youtubeToggle = document.getElementById('pref-show-youtube');
    const discordLinked = document.getElementById('discord-linked');
    const youtubeLinked = document.getElementById('youtube-linked');

    if (previewDiscordChip) {
        const isDiscVisible = discordToggle ? discordToggle.checked : true;
        const isDiscLinked = discordLinked && discordLinked.style.display !== 'none';
        previewDiscordChip.style.display = (isDiscLinked && isDiscVisible) ? 'inline-flex' : 'none';
    }
    if (previewYouTubeChip) {
        const isYtVisible = youtubeToggle ? youtubeToggle.checked : true;
        const isYtLinked = youtubeLinked && youtubeLinked.style.display !== 'none';
        previewYouTubeChip.style.display = (isYtLinked && isYtVisible) ? 'inline-flex' : 'none';
    }
};

// ── Banner Preset Picker ──
window.selectPresetBanner = function(gradientCss) {
    currentBannerStyle = gradientCss;
    currentBannerIsImage = false;

    applyBannerStyle(document.getElementById('preview-banner'), gradientCss);
    applyBannerStyle(document.getElementById('showcase-banner-bg'), gradientCss);

    const bPreviewImg = document.getElementById('banner-preview-img');
    if (bPreviewImg) bPreviewImg.style.display = 'none';

    const bBox = document.getElementById('banner-uploader-box');
    if (bBox) bBox.style.background = gradientCss;

    const urlInput = document.getElementById('banner-url-input');
    if (urlInput) urlInput.value = '';

    document.querySelectorAll('.preset-banner-thumb').forEach(t => {
        t.classList.toggle('active', t.getAttribute('onclick')?.includes(gradientCss));
    });
    playSfx('click');
};

// ── Banner Direct URL Customizer ──
window.applyBannerUrl = function() {
    const input = document.getElementById('banner-url-input');
    const url = input?.value.trim();
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:image'))) {
        playSfx('error');
        window.showToast("Please enter a valid image URL (https://...)", "error");
        return;
    }

    currentBannerStyle = url;
    currentBannerIsImage = true;

    const bPreviewImg = document.getElementById('banner-preview-img');
    if (bPreviewImg) {
        bPreviewImg.src = url;
        bPreviewImg.style.display = 'block';
    }

    applyBannerStyle(document.getElementById('preview-banner'), url);
    applyBannerStyle(document.getElementById('showcase-banner-bg'), url);

    playSfx('success');
    window.showToast("Banner image URL applied! Click 'Save Profile' to keep changes.", "success");
};

// ── Reset Banner to Default ──
window.resetBannerToDefault = function() {
    const defaultGradient = "linear-gradient(135deg, #2b0d18 0%, #dc2626 50%, #15090f 100%)";
    currentBannerStyle = defaultGradient;
    currentBannerIsImage = false;

    const bPreviewImg = document.getElementById('banner-preview-img');
    if (bPreviewImg) {
        bPreviewImg.style.display = 'none';
        bPreviewImg.src = '';
    }

    const bBox = document.getElementById('banner-uploader-box');
    if (bBox) bBox.style.background = defaultGradient;

    applyBannerStyle(document.getElementById('preview-banner'), defaultGradient);
    applyBannerStyle(document.getElementById('showcase-banner-bg'), defaultGradient);

    const urlInput = document.getElementById('banner-url-input');
    if (urlInput) urlInput.value = '';

    document.querySelectorAll('.preset-banner-thumb').forEach((t, idx) => {
        t.classList.toggle('active', idx === 0);
    });

    playSfx('click');
    window.showToast("Banner reset to default gradient! Click 'Save Profile' to commit.", "info");
};

// ── Image Uploads (Avatar & Banner with Base64 Fallback) ──
window.handleUpload = async function(file, type) {
    if (!file || !file.type.startsWith('image/')) {
        window.showToast("Please choose a valid image file.", "error");
        return;
    }
    const sEl = document.getElementById('upload-status'); 
    if (sEl) { sEl.style.display = 'block'; sEl.innerText = 'Optimizing image...'; }

    let uploadedUrl = null;

    // Attempt 1: Upload to ImgBB CDN
    try {
        const fd = new FormData(); 
        fd.append("image", file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd });
        const json = await res.json(); 
        if (json.success && json.data && json.data.url) {
            uploadedUrl = json.data.url;
        }
    } catch (err) { 
        console.warn("ImgBB upload unreachable, engaging client-side compression fallback:", err);
    }

    // Attempt 2: Bulletproof client-side Base64 compression fallback
    if (!uploadedUrl) {
        try {
            if (sEl) sEl.innerText = 'Encoding locally...';
            uploadedUrl = await compressImageFile(file, type === 'banner' ? 1200 : 400, type === 'banner' ? 600 : 400, 0.82);
        } catch(fallbackErr) {
            if (sEl) sEl.innerText = "Upload failed.";
            playSfx('error');
            window.showToast("Upload failed: " + fallbackErr.message, "error");
            setTimeout(() => { if (sEl) sEl.style.display = 'none'; }, 3000);
            return;
        }
    }

    if (type === 'banner') {
        currentBannerStyle = uploadedUrl;
        currentBannerIsImage = true;

        const bPreviewImg = document.getElementById('banner-preview-img');
        if (bPreviewImg) {
            bPreviewImg.src = uploadedUrl;
            bPreviewImg.style.display = 'block';
        }
        applyBannerStyle(document.getElementById('preview-banner'), uploadedUrl);
        applyBannerStyle(document.getElementById('showcase-banner-bg'), uploadedUrl);

        const urlInput = document.getElementById('banner-url-input');
        if (urlInput && uploadedUrl.startsWith('http')) urlInput.value = uploadedUrl;

        playSfx('success');
        window.showToast("Custom banner applied! Click 'Save Profile' to keep changes.", "success");
    } else {
        document.getElementById('dashboard-pfp-preview').src = uploadedUrl;
        document.getElementById('preview-avatar').src = uploadedUrl;
        const showcaseAvatar = document.getElementById('showcase-avatar');
        if (showcaseAvatar) showcaseAvatar.src = uploadedUrl;
        const sidebarAvatar = document.getElementById('sidebar-user-avatar');
        if (sidebarAvatar) sidebarAvatar.src = uploadedUrl;

        playSfx('success');
        window.showToast("Avatar applied! Click 'Save Profile' to keep changes.", "success");
    }
    if (sEl) sEl.innerText = "Upload ready!";
    setTimeout(() => { if (sEl) sEl.style.display = 'none'; }, 2500);
};

// ── Save Profile Submission ──
window.submitProfile = async function(e) {
    e.preventDefault(); 
    const btn = e.target.querySelector('button[type="submit"]');
    const newName = document.getElementById('display-name').value.trim();
    const newUsername = document.getElementById('username-input').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const newStatus = document.getElementById('status-text-input')?.value.trim() || "";
    const newBio = document.getElementById('bio-input')?.value.trim() || "";
    const newPfp = document.getElementById('dashboard-pfp-preview').src;
    
    if (!currentUser) return;
    btn.disabled = true; 
    btn.innerText = "Saving Profile...";

    try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        
        let updates = { 
            displayName: newName, 
            photoURL: newPfp,
            banner: currentBannerStyle,
            statusText: newStatus,
            bio: newBio
        };

        if (newUsername && newUsername !== userData.username) {
            if (newUsername.length < 3) throw new Error("Username must be at least 3 characters.");
            if (userData.lastUsernameChange) {
                const daysSince = (new Date() - userData.lastUsernameChange.toDate()) / (1000 * 60 * 60 * 24);
                if (daysSince < 30) throw new Error(`Usernames can only be changed once every 30 days. You have ${Math.ceil(30 - daysSince)} days remaining.`);
            }
            const q = query(collection(db, "users"), where("username", "==", newUsername));
            const snap = await getDocs(q);
            if (!snap.empty) throw new Error(`Username @${newUsername} is already taken!`);

            updates.username = newUsername;
            updates.lastUsernameChange = serverTimestamp();
        }

        await updateProfile(currentUser, { displayName: newName, photoURL: newPfp });
        await setDoc(userRef, updates, { merge: true });
        
        playSfx('success');
        window.showToast("Profile changes saved successfully!", "success");
        window.updateLivePreview();
    } catch (err) {
        playSfx('error');
        window.showToast(err.message, "error");
    } finally {
        btn.disabled = false; 
        btn.innerText = "💾 Save Profile Changes";
    }
};

// ── Security Actions ──
window.copyCrimXUID = function() {
    if (!currentUser) return;
    navigator.clipboard.writeText(currentUser.uid);
    playSfx('click');
    window.showToast("CrimX UID copied to clipboard!", "success");
};

window.triggerPasswordReset = async function() {
    if (!currentUser || !currentUser.email) return;
    try {
        const resetUrl = `${window.location.origin}/auth/action`;
        const actionCodeSettings = {
            url: resetUrl,
            handleCodeInApp: true
        };
        await sendPasswordResetEmail(auth, currentUser.email, actionCodeSettings);
        playSfx('success');
        window.showToast(`Password reset link dispatched to ${currentUser.email}!`, "success");
    } catch (err) {
        playSfx('error');
        window.showToast("Failed to send reset link: " + err.message, "error");
    }
};

window.submitDirectPasswordChange = async function(e) {
    e.preventDefault();
    if (!currentUser) return;
    const currentPwd = document.getElementById('current-password-input').value;
    const newPwd = document.getElementById('new-password-input').value;
    const confirmPwd = document.getElementById('confirm-new-password-input').value;
    const btn = e.target.querySelector('button[type="submit"]');

    if (newPwd.length < 6) {
        playSfx('error');
        window.showToast("New password must be at least 6 characters.", "error");
        return;
    }
    if (newPwd !== confirmPwd) {
        playSfx('error');
        window.showToast("New passwords do not match.", "error");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Updating Password...";

    try {
        if (currentUser.email) {
            const credential = EmailAuthProvider.credential(currentUser.email, currentPwd);
            await reauthenticateWithCredential(currentUser, credential);
        }
        await updatePassword(currentUser, newPwd);
        dispatchSecurityAlert('password_changed', currentUser.email, currentUser.uid);
        playSfx('success');
        window.showToast("Password updated successfully!", "success");
        e.target.reset();
    } catch(err) {
        playSfx('error');
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            window.showToast("Incorrect current password.", "error");
        } else {
            window.showToast("Update failed: " + err.message, "error");
        }
    } finally {
        btn.disabled = false;
        btn.innerText = "Update Password";
    }
};

window.sendVerificationEmailAgain = async function() {
    if (!currentUser) return;
    try {
        await sendEmailVerification(currentUser);
        playSfx('success');
        window.showToast("Verification link dispatched! Check your inbox.", "success");
    } catch (err) {
        playSfx('error');
        window.showToast("Verification error: " + err.message, "error");
    }
};

// ── Change Email Flow ──
window.toggleChangeEmailForm = function(forceState) {
    const container = document.getElementById('change-email-container');
    if (!container) return;
    if (typeof forceState === 'boolean') {
        container.style.display = forceState ? 'block' : 'none';
    } else {
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
    }
    playSfx('click');
};

window.submitEmailChange = async function(e) {
    e.preventDefault();
    if (!currentUser) return;
    const newEmail = document.getElementById('new-email-input').value.trim();
    const currentPwd = document.getElementById('change-email-password-input').value;
    const btn = document.getElementById('btn-save-email');

    if (!newEmail || newEmail.toLowerCase() === currentUser.email.toLowerCase()) {
        playSfx('error');
        window.showToast("Please provide a different, valid email address.", "error");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Dispatching Link...";

    try {
        if (currentUser.email) {
            const credential = EmailAuthProvider.credential(currentUser.email, currentPwd);
            await reauthenticateWithCredential(currentUser, credential);
        }

        // Firebase verifyBeforeUpdateEmail sends confirmation link to the new address
        await verifyBeforeUpdateEmail(currentUser, newEmail);
        await setDoc(doc(db, "users", currentUser.uid), { pendingEmail: newEmail }, { merge: true });

        playSfx('success');
        window.showToast(`Verification dispatched to ${newEmail}! Click the link inside to complete the change.`, "success");
        e.target.reset();
        window.toggleChangeEmailForm(false);
    } catch(err) {
        playSfx('error');
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            window.showToast("Current password was incorrect.", "error");
        } else if (err.code === 'auth/email-already-in-use') {
            window.showToast("That email address is already taken by another account.", "error");
        } else {
            window.showToast("Failed to update email: " + err.message, "error");
        }
    } finally {
        btn.disabled = false;
        btn.innerText = "Send Confirmation Link";
    }
};

// ── Preferences Management ──
window.savePreferences = async function() {
    if (!currentUser) return;
    const sfx = document.getElementById('pref-sfx')?.checked ?? true;
    const beta = document.getElementById('pref-beta')?.checked ?? false;
    const emailUpdates = document.getElementById('pref-email-updates')?.checked ?? true;
    try {
        await setDoc(doc(db, "users", currentUser.uid), {
            preferences: { sfxEnabled: sfx, betaTester: beta, emailUpdates: emailUpdates }
        }, { merge: true });
        playSfx('click');
        window.showToast("Preferences updated!", "success");
    } catch (err) {
        console.error("Error saving preferences:", err);
    }
};

window.confirmDeleteAccount = function() {
    const confirmation = prompt("WARNING: This will permanently delete your CrimsonFlame profile and credentials.\n\nType DELETE to confirm:");
    if (confirmation === "DELETE" && currentUser) {
        deleteDoc(doc(db, "users", currentUser.uid)).then(() => {
            currentUser.delete().then(() => {
                alert("Account deleted.");
                window.location.reload();
            }).catch(err => {
                window.showToast("Please sign in again before deleting your account: " + err.message, "error");
            });
        }).catch(err => {
            window.showToast("Error removing data: " + err.message, "error");
        });
    }
};

// ── Authentication Flows ──
window.submitLogin = async function(e) {
    e.preventDefault(); 
    const btn = e.target.querySelector('button[type="submit"]'); 
    btn.disabled = true; btn.innerText = "Processing...";
    try {
        if(isLogin) {
            const cred = await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            if (!cred.user.emailVerified) { await sendEmailVerification(cred.user); await signOut(auth); window.showCustomAlert("Email not verified. Verification link sent to your inbox."); } 
        } else {
            const cred = await createUserWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            await sendEmailVerification(cred.user); await signOut(auth); window.showCustomAlert("Account created! Please check your inbox to verify your email."); window.toggleLoginMode();
        }
    } catch (err) { showResponseText(btn, 'error', err.message); } 
    finally { btn.disabled = false; btn.innerText = "Submit"; }
};

window.loginWithGoogle = async function(e) { 
    e.preventDefault(); 
    try { await signInWithPopup(auth, googleProvider); } 
    catch (err) { window.showCustomAlert(err.message); } 
};

window.logOutUser = function() { 
    playSfx('click');
    signOut(auth); 
};

window.toggleLoginMode = function() { 
    isLogin = !isLogin; 
    document.getElementById('auth-title').innerText = isLogin ? "Sign into CrimX" : "Register CrimX Account"; 
    document.getElementById('toggle-auth').innerText = isLogin ? "Register here" : "Sign in here"; 
};

window.toggleForgotPasswordView = function(show) {
    const loginWrapper = document.getElementById('login-form-wrapper');
    const forgotWrapper = document.getElementById('forgot-password-wrapper');
    const feedback = document.getElementById('forgot-feedback');
    if (feedback) {
        feedback.style.display = 'none';
        feedback.innerText = '';
    }
    if (show) {
        const loginEmail = document.getElementById('email')?.value.trim();
        const forgotEmail = document.getElementById('forgot-password-email');
        if (loginEmail && forgotEmail) forgotEmail.value = loginEmail;

        if (loginWrapper) loginWrapper.style.display = 'none';
        if (forgotWrapper) forgotWrapper.style.display = 'block';
    } else {
        if (loginWrapper) loginWrapper.style.display = 'block';
        if (forgotWrapper) forgotWrapper.style.display = 'none';
    }
    playSfx('click');
};

window.submitForgotPasswordFromLogin = async function(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-password-email')?.value.trim();
    const btn = document.getElementById('forgot-submit-btn');
    const feedback = document.getElementById('forgot-feedback');

    if (!email) return;

    btn.disabled = true;
    btn.innerText = "Dispatching Link...";
    if (feedback) feedback.style.display = 'none';

    try {
        const resetUrl = `${window.location.origin}/auth/action`;
        const actionCodeSettings = {
            url: resetUrl,
            handleCodeInApp: true
        };
        await sendPasswordResetEmail(auth, email, actionCodeSettings);
        playSfx('success');
        if (feedback) {
            feedback.style.display = 'block';
            feedback.style.background = "rgba(34, 197, 94, 0.15)";
            feedback.style.border = "1px solid rgba(34, 197, 94, 0.4)";
            feedback.style.color = "#4ade80";
            feedback.innerText = `✓ Password reset link sent to ${email}! Check your inbox.`;
        }
        window.showToast(`Reset link dispatched to ${email}`, "success");
    } catch(err) {
        playSfx('error');
        if (feedback) {
            feedback.style.display = 'block';
            feedback.style.background = "rgba(239, 68, 68, 0.15)";
            feedback.style.border = "1px solid rgba(239, 68, 68, 0.4)";
            feedback.style.color = "#f87171";
            feedback.innerText = err.message || "Failed to send reset link.";
        }
    } finally {
        btn.disabled = false;
        btn.innerText = "Send Reset Link";
    }
};

// ── Social & Gaming Integrations (Discord & YouTube with Profile Visibility) ──
window.linkDiscordHandle = async function() {
    if (!currentUser) return;
    const input = document.getElementById('discord-handle-input');
    const raw = (input ? input.value : '').trim();
    if (!raw) {
        playSfx('error');
        window.showToast("Please enter your Discord username or tag.", "error");
        return;
    }
    const clean = raw.replace(/^@/, '');
    const showOnProfile = document.getElementById('pref-show-discord')?.checked ?? true;

    try {
        await setDoc(doc(db, "users", currentUser.uid), {
            discordUsername: clean,
            discordId: 'manual_' + clean,
            discordAvatar: 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png',
            discordShowOnProfile: showOnProfile
        }, { merge: true });

        if (input) input.value = '';
        playSfx('success');
        window.showToast(`✓ Discord linked as @${clean}!`, "success");
    } catch (err) {
        playSfx('error');
        window.showToast("Failed to link Discord: " + err.message, "error");
    }
};

window.generateDiscordLinkCode = async function() {
    if(!currentUser) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString(); 
    await setDoc(doc(db, "users", currentUser.uid), { linkCode: code }, { merge: true });
    const display = document.getElementById('discord-link-code-display');
    if (display) {
        display.style.display = 'block'; 
        display.innerText = `DM the bot: !link ${code}`;
    }
    playSfx('click');
    window.showToast("Link code generated! DM the CrimsonFlame bot on Discord.", "info");
};

window.unlinkDiscord = async function() {
    if(!currentUser) return;
    try {
        await updateDoc(doc(db, "users", currentUser.uid), { 
            discordId: null, 
            discordUsername: null, 
            discordAvatar: null, 
            linkCode: null,
            discordShowOnProfile: false
        });
        playSfx('click');
        window.showToast("Discord account unlinked.", "info");
    } catch(err) {
        window.showToast("Error unlinking Discord: " + err.message, "error");
    }
};

window.linkYouTubeHandle = async function() {
    if (!currentUser) return;
    const input = document.getElementById('youtube-handle-input');
    const raw = (input ? input.value : '').trim();
    if (!raw) {
        playSfx('error');
        window.showToast("Please enter your YouTube handle or channel link.", "error");
        return;
    }

    let cleanHandle = raw;
    let channelUrl = '';

    if (raw.includes('youtube.com/') || raw.includes('youtu.be/')) {
        channelUrl = raw.startsWith('http') ? raw : `https://${raw}`;
        const match = raw.match(/@([a-zA-Z0-9_\-\.]+)/);
        cleanHandle = match ? `@${match[1]}` : (raw.split('/').pop() || raw);
    } else {
        cleanHandle = raw.startsWith('@') ? raw : `@${raw}`;
        channelUrl = `https://www.youtube.com/${cleanHandle}`;
    }

    const showOnProfile = document.getElementById('pref-show-youtube')?.checked ?? true;

    try {
        await setDoc(doc(db, "users", currentUser.uid), {
            youtubeHandle: cleanHandle,
            youtubeUrl: channelUrl,
            youtubeShowOnProfile: showOnProfile
        }, { merge: true });

        if (input) input.value = '';
        playSfx('success');
        window.showToast(`✓ YouTube linked as ${cleanHandle}!`, "success");
    } catch(err) {
        playSfx('error');
        window.showToast("Failed to link YouTube: " + err.message, "error");
    }
};

window.unlinkYouTube = async function() {
    if (!currentUser) return;
    try {
        await updateDoc(doc(db, "users", currentUser.uid), {
            youtubeHandle: null,
            youtubeUrl: null,
            youtubeShowOnProfile: false
        });
        playSfx('click');
        window.showToast("YouTube channel unlinked.", "info");
    } catch(err) {
        window.showToast("Error unlinking YouTube: " + err.message, "error");
    }
};

window.saveSocialVisibilityPreferences = async function() {
    if (!currentUser) return;
    const showDiscord = document.getElementById('pref-show-discord')?.checked ?? true;
    const showYouTube = document.getElementById('pref-show-youtube')?.checked ?? true;

    try {
        await setDoc(doc(db, "users", currentUser.uid), {
            discordShowOnProfile: showDiscord,
            youtubeShowOnProfile: showYouTube
        }, { merge: true });

        playSfx('click');
        window.showToast("Profile social visibility updated!", "info");
        window.updateLivePreview();
    } catch(err) {
        console.warn("Failed to update visibility preferences:", err);
    }
};

window.renderCIMProfileSocials = function(userData) {
    const container = document.getElementById('cim-profile-socials');
    if (!container) return;

    const showDiscord = userData?.discordShowOnProfile !== false;
    const showYouTube = userData?.youtubeShowOnProfile !== false;

    const hasDiscord = userData?.discordUsername && showDiscord;
    const hasYouTube = userData?.youtubeHandle && showYouTube;

    let html = '';
    if (hasDiscord) {
        html += `
            <div class="social-chip-aero discord" title="Discord: @${escapeHtml(userData.discordUsername)}">
                <img src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" alt="Discord">
                <span>@${escapeHtml(userData.discordUsername)}</span>
            </div>
        `;
    }
    if (hasYouTube) {
        const url = userData.youtubeUrl || `https://www.youtube.com/${escapeHtml(userData.youtubeHandle)}`;
        html += `
            <a href="${escapeHtml(url)}" target="_blank" class="social-chip-aero youtube" title="YouTube: ${escapeHtml(userData.youtubeHandle)}">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="#fff"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                <span>${escapeHtml(userData.youtubeHandle)}</span>
            </a>
        `;
    }
    container.innerHTML = html;
};

// ── Connected CrimX Applications ──
window.loadConnectedApps = async function() {
    if (!currentUser) return;
    const container = document.getElementById('connected-apps-list');
    if (!container) return;

    try {
        const snap = await getDocs(collection(db, "users", currentUser.uid, "connected_apps"));
        const apps = [];
        snap.forEach(d => apps.push({ id: d.id, ...d.data() }));

        if (apps.length === 0) {
            container.innerHTML = `<p id="connected-apps-empty" style="color: var(--text-secondary); font-size: 0.85rem; text-align: center; padding: 24px; background: rgba(0,0,0,0.3); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">No external applications have been authorized yet.</p>`;
            return;
        }

        container.innerHTML = apps.map(appItem => `
            <div class="linked-card" style="background: rgba(22, 12, 16, 0.8); border: 1px solid rgba(255,255,255,0.08); padding: 14px 16px; border-radius: 12px;">
                <img src="${appItem.appLogo || DEFAULT_PFP}" style="width: 42px; height: 42px; border-radius: 10px; object-fit: cover;">
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: #fff; font-size: 0.98rem;">${appItem.appName || "Connected Application"}</div>
                    <div style="font-size: 0.78rem; color: var(--text-secondary);">Authorized ${appItem.authorizedAt ? new Date(appItem.authorizedAt).toLocaleDateString() : 'recently'} · Read identity & game sync</div>
                </div>
                <button onclick="window.revokeConnectedApp('${appItem.id}')" class="btn-danger" style="width: auto; padding: 6px 14px; font-size: 0.8rem;">Revoke Access</button>
            </div>
        `).join('');
    } catch(err) {
        console.error("Error loading connected apps:", err);
    }
};

window.revokeConnectedApp = async function(appId) {
    if (!currentUser) return;
    if (!confirm("Revoke access for this application? It will no longer be able to access your CrimsonFlame identity.")) return;
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "connected_apps", appId));
        const snap = await getDocs(collection(db, "users", currentUser.uid, "connected_apps"));
        snap.forEach(async (d) => {
            const data = d.data();
            if (d.id === appId || data.linkkey === appId || (data.appName && data.appName.toLowerCase().includes(appId.toLowerCase()))) {
                await deleteDoc(doc(db, "users", currentUser.uid, "connected_apps", d.id));
            }
        });
        playSfx('click');
        window.showToast("Application access revoked.", "info");
        setTimeout(() => window.loadConnectedApps(), 300);
    } catch(err) {
        window.showToast("Failed to revoke: " + err.message, "error");
    }
};

// ── Security Alert Dispatcher (API + Notification) ──
async function dispatchSecurityAlert(type, email, uid) {
    if (!email) return;
    try {
        await fetch('/api/notifications/security-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                email,
                uid,
                clientDetails: { userAgent: navigator.userAgent },
                timestamp: Date.now()
            })
        });
    } catch(e) {
        console.warn("[CrimX] Security alert dispatch non-critical error:", e);
    }
}

// ── CrimX Real-Time Friends System ──
let friendsUnsub = null;
let requestsUnsub = null;
const friendDocUnsubs = new Map();
const friendLivePresence = new Map();

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function clearFriendPresenceSubscriptions() {
    friendDocUnsubs.forEach(unsub => unsub());
    friendDocUnsubs.clear();
    friendLivePresence.clear();
}

function renderFriendsDOM(friends) {
    const container = document.getElementById('active-friends-list');
    if (!container) return;

    if (!friends || friends.length === 0) {
        container.innerHTML = `
            <div class="friends-empty-state">
                <div style="font-size: 2.2rem; margin-bottom: 8px;">🎮</div>
                <div style="font-weight: 700; color: #fff; font-size: 1.05rem; margin-bottom: 4px;">No friends connected yet</div>
                <div style="color: var(--text-secondary); font-size: 0.85rem; max-width: 420px; margin: 0 auto;">
                    Connect with players across CrimsonFlame games and VR servers by searching their @username above!
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = friends.map(friend => {
        const fUid = friend.uid || friend.id;
        const live = friendLivePresence.get(fUid) || {};
        const isOnline = live.online !== undefined ? live.online : (friend.online !== false);
        const statusText = isOnline ? (live.statusText || friend.statusText || 'Browsing the Website') : 'Offline';
        const pfp = live.photoURL || friend.photoURL || DEFAULT_PFP;
        const dispName = live.displayName || friend.displayName || 'CrimX Player';
        const handle = live.username || friend.username || 'user';

        return `
            <div class="friend-card">
                <div class="friend-avatar-wrap">
                    <img src="${pfp}" alt="${escapeHtml(dispName)}">
                    <div class="friend-online-dot ${isOnline ? '' : 'offline'}" title="${isOnline ? 'Online' : 'Offline'}"></div>
                </div>
                <div class="friend-info">
                    <div class="friend-name">${escapeHtml(dispName)}</div>
                    <div class="friend-handle">@${escapeHtml(handle)}</div>
                    <div class="friend-status" style="color: ${isOnline ? '#f87171' : '#9ca3af'};">${escapeHtml(statusText)}</div>
                </div>
                <button type="button" class="btn-secondary" onclick="removeFriend('${friend.id}', '${escapeHtml(dispName)}')" style="width: auto; padding: 6px 12px; font-size: 0.74rem; color: #f87171; border-color: rgba(239, 68, 68, 0.25);" title="Remove Friend">
                    Remove
                </button>
            </div>
        `;
    }).join('');

    renderCIMFriends(friends);
}

// ── CIM (CrimX Instant Messager) System ──
let activeCIMRecipient = null;
let activeCIMChatUnsub = null;
let cimGlobalWatcherUnsub = null;
let fcmMessaging = null;
let fcmUnsub = null;
let cimSessionStartTime = Date.now();

function playCIMChime() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.1);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(880, now + 0.1);
        osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.22);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.12);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.35);
    } catch(e) {}
}

function showCIMNotification(senderUid, senderName, senderPfp, text) {
    const container = document.getElementById('cim-notification-container');
    if (!container) return;

    playCIMChime();

    const toast = document.createElement('div');
    toast.className = 'cim-notification-toast';
    toast.innerHTML = `
        <div class="cim-toast-avatar">
            <img src="${senderPfp || DEFAULT_PFP}" alt="${escapeHtml(senderName || 'Friend')}">
            <span class="cim-toast-dot"></span>
        </div>
        <div class="cim-toast-content">
            <div class="cim-toast-sender">
                ${escapeHtml(senderName || 'Friend')} <span class="cim-toast-tag">CIM</span>
            </div>
            <div class="cim-toast-msg">${escapeHtml(text || 'New instant message')}</div>
        </div>
        <button type="button" class="cim-toast-close" title="Dismiss">✕</button>
    `;

    toast.querySelector('.cim-toast-close').onclick = (e) => {
        e.stopPropagation();
        toast.remove();
    };

    toast.onclick = () => {
        window.openCIMChat(senderUid, senderName, senderPfp);
        window.focusCIM();
        toast.remove();
    };

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.transition = 'all 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5500);
}

function renderCIMFriends(friends) {
    const list = document.getElementById('cim-conversations-list');
    const countTag = document.getElementById('cim-friends-count');
    if (!list) return;

    if (countTag) countTag.innerText = friends ? friends.length : 0;
    const heroFriends = document.getElementById('hero-friends-stat');
    if (heroFriends) heroFriends.innerText = friends ? friends.length : 0;

    if (!friends || friends.length === 0) {
        list.innerHTML = `
            <div style="color: var(--text-secondary); font-size: 0.72rem; text-align: center; padding: 20px 4px;">
                No friends yet
            </div>
        `;
        return;
    }

    list.innerHTML = friends.map(friend => {
        const fUid = friend.uid || friend.id;
        const live = friendLivePresence.get(fUid) || {};
        const isOnline = live.online !== undefined ? live.online : (friend.online !== false);
        const pfp = live.photoURL || friend.photoURL || DEFAULT_PFP;
        const dispName = live.displayName || friend.displayName || 'CrimX Player';
        const handle = live.username || friend.username || 'user';
        const isActive = activeCIMRecipient && activeCIMRecipient.uid === fUid;

        return `
            <button type="button" class="cim-contact-btn ${isActive ? 'active' : ''}" onclick="openCIMChat('${fUid}', '${escapeHtml(dispName)}', '${escapeHtml(pfp)}', '${escapeHtml(handle)}')">
                <div class="cim-contact-avatar-wrap">
                    <img src="${pfp}" alt="${escapeHtml(dispName)}">
                    <span class="cim-contact-dot ${isOnline ? '' : 'offline'}"></span>
                </div>
                <div class="cim-contact-meta">
                    <div class="cim-contact-name">${escapeHtml(dispName)}</div>
                    <div class="cim-contact-sub">@${escapeHtml(handle)}</div>
                </div>
            </button>
        `;
    }).join('');

    // If currently active chat is open, refresh their status in the header
    if (activeCIMRecipient) {
        const live = friendLivePresence.get(activeCIMRecipient.uid) || {};
        const isOnline = live.online !== undefined ? live.online : true;
        const statusEl = document.getElementById('cim-active-status');
        const dotEl = document.getElementById('cim-active-dot');
        if (statusEl) statusEl.innerText = isOnline ? (live.statusText || 'Browsing the Website') : 'Offline';
        if (dotEl) {
            if (isOnline) dotEl.classList.remove('offline');
            else dotEl.classList.add('offline');
        }
    }
}

// Local Device Storage Helpers (Ensures 0 messages ever stored in Firestore cloud database)
function getCIMLocalMessages(myUid, friendUid) {
    try {
        const key = `cim_chat_${myUid}_${friendUid}`;
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
}

function saveCIMLocalMessage(myUid, friendUid, msg) {
    try {
        const key = `cim_chat_${myUid}_${friendUid}`;
        const msgs = getCIMLocalMessages(myUid, friendUid);
        // Avoid duplicate message
        const isDuplicate = msgs.some(m => 
            (m.id && msg.id && m.id === msg.id) ||
            ((m.senderId || m.senderUid) === (msg.senderId || msg.senderUid) && m.text === msg.text && Math.abs((m.timestamp || 0) - (msg.timestamp || 0)) < 4000)
        );
        if (isDuplicate) return false;
        msgs.push(msg);
        if (msgs.length > 100) msgs.shift();
        localStorage.setItem(key, JSON.stringify(msgs));
        return true;
    } catch(e) { return false; }
}

function renderCIMMessagesUI(messages) {
    const list = document.getElementById('cim-messages-list');
    if (!list) return;

    if (!messages || messages.length === 0) {
        list.innerHTML = `
            <div style="color: var(--text-secondary); font-size: 0.76rem; text-align: center; padding: 30px 10px;">
                No messages yet. Send an instant message to start chatting!
            </div>
        `;
        return;
    }

    list.innerHTML = messages.map(msg => {
        const isMine = msg.senderId === currentUser.uid || msg.senderUid === currentUser.uid;
        const timeVal = msg.timestamp ? new Date(msg.timestamp) : new Date();
        const timeStr = isNaN(timeVal.getTime()) ? 'Just now' : timeVal.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="cim-message-bubble ${isMine ? 'cim-message-sent' : 'cim-message-received'}">
                <div>${escapeHtml(msg.text || '')}</div>
                <div class="cim-message-time">${timeStr}</div>
            </div>
        `;
    }).join('');

    const box = document.getElementById('cim-messages-box');
    if (box) box.scrollTop = box.scrollHeight;
}

window.openCIMChat = function(friendUid, friendName, friendPfp, friendHandle) {
    activeCIMRecipient = {
        uid: friendUid,
        name: friendName || 'Friend',
        pfp: friendPfp || DEFAULT_PFP,
        handle: friendHandle || 'user'
    };

    const header = document.getElementById('cim-chat-header');
    const noChat = document.getElementById('cim-no-chat-state');
    const list = document.getElementById('cim-messages-list');
    const form = document.getElementById('cim-input-form');
    const input = document.getElementById('cim-message-input');

    if (header) header.style.display = 'flex';
    if (noChat) noChat.style.display = 'none';
    if (list) list.style.display = 'flex';
    if (form) form.style.display = 'flex';

    // Update active recipient header
    const avatar = document.getElementById('cim-active-avatar');
    const nameEl = document.getElementById('cim-active-name');
    const statusEl = document.getElementById('cim-active-status');
    const dotEl = document.getElementById('cim-active-dot');

    const live = friendLivePresence.get(friendUid) || {};
    const isOnline = live.online !== undefined ? live.online : true;

    if (avatar) avatar.src = live.photoURL || friendPfp || DEFAULT_PFP;
    if (nameEl) nameEl.innerText = live.displayName || friendName || 'Friend';
    if (statusEl) statusEl.innerText = isOnline ? (live.statusText || 'Browsing the Website') : 'Offline';
    if (dotEl) {
        if (isOnline) dotEl.classList.remove('offline');
        else dotEl.classList.add('offline');
    }

    if (input) {
        input.placeholder = `Message ${live.displayName || friendName}...`;
        input.focus();
    }

    // Highlight button in contact sidebar
    document.querySelectorAll('.cim-contact-btn').forEach(btn => {
        if (btn.getAttribute('onclick')?.includes(friendUid)) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // 1. Load messages from private local device memory immediately
    const messages = getCIMLocalMessages(currentUser.uid, friendUid);
    renderCIMMessagesUI(messages);

    // 2. Dynamically sync conversation history from in-memory relay (no refresh needed)
    const convoId = [currentUser.uid, friendUid].sort().join('_');
    fetch(`/api/cim/history?convoId=${convoId}`)
        .then(r => r.json())
        .then(data => {
            if (data && data.messages && Array.isArray(data.messages)) {
                let hasNew = false;
                data.messages.forEach(m => {
                    const saved = saveCIMLocalMessage(currentUser.uid, friendUid, m);
                    if (saved) hasNew = true;
                });
                if (hasNew && activeCIMRecipient && activeCIMRecipient.uid === friendUid) {
                    const updated = getCIMLocalMessages(currentUser.uid, friendUid);
                    renderCIMMessagesUI(updated);
                }
            }
        })
        .catch(() => {});
};

window.clearActiveCIMChat = function() {
    activeCIMRecipient = null;

    const header = document.getElementById('cim-chat-header');
    const noChat = document.getElementById('cim-no-chat-state');
    const list = document.getElementById('cim-messages-list');
    const form = document.getElementById('cim-input-form');

    if (header) header.style.display = 'none';
    if (noChat) noChat.style.display = 'flex';
    if (list) { list.style.display = 'none'; list.innerHTML = ''; }
    if (form) form.style.display = 'none';

    document.querySelectorAll('.cim-contact-btn').forEach(btn => btn.classList.remove('active'));
};

window.sendCIMMessage = async function(e) {
    if (e) e.preventDefault();
    if (!currentUser || !activeCIMRecipient) return;

    const input = document.getElementById('cim-message-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = '';

    try {
        const mySnap = await getDoc(doc(db, "users", currentUser.uid)).catch(() => null);
        const myData = mySnap && mySnap.exists() ? mySnap.data() : {};
        const myName = myData.displayName || currentUser.displayName || currentUser.email.split('@')[0];
        const myPfp = myData.photoURL || currentUser.photoURL || DEFAULT_PFP;
        const nowTime = Date.now();

        const newMsg = {
            id: `cim_${nowTime}_${Math.random().toString(36).slice(2, 7)}`,
            senderId: currentUser.uid,
            senderUid: currentUser.uid,
            senderName: myName,
            senderPfp: myPfp,
            recipientId: activeCIMRecipient.uid,
            text: text,
            timestamp: nowTime
        };

        // 1. Save directly to local device storage (NO Firestore cloud message leaks!)
        saveCIMLocalMessage(currentUser.uid, activeCIMRecipient.uid, newMsg);

        // 2. Render immediately in chat
        const currentMsgs = getCIMLocalMessages(currentUser.uid, activeCIMRecipient.uid);
        renderCIMMessagesUI(currentMsgs);

        // 3. Dispatch directly via Firebase Cloud Messaging & Realtime Relay
        const recipientSnap = await getDoc(doc(db, "users", activeCIMRecipient.uid)).catch(() => null);
        const rData = recipientSnap && recipientSnap.exists() ? recipientSnap.data() : {};

        fetch('/api/cim/send-fcm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: rData.fcmToken || null,
                title: `${myName} (CIM)`,
                body: text,
                senderUid: currentUser.uid,
                senderName: myName,
                senderPfp: myPfp,
                recipientUid: activeCIMRecipient.uid,
                timestamp: nowTime
            })
        }).catch(() => {});

    } catch (err) {
        console.error("Failed to send CIM message:", err);
        window.showToast("Failed to send message: " + err.message, "error");
    }
};

window.focusCIM = function() {
    const block = document.getElementById('dash-cim-block');
    if (block) {
        block.scrollIntoView({ behavior: 'smooth', block: 'center' });
        block.style.boxShadow = '0 0 35px rgba(220, 38, 38, 0.6)';
        setTimeout(() => { block.style.boxShadow = ''; }, 1600);
        const input = document.getElementById('cim-message-input');
        if (input && input.offsetParent !== null) input.focus();
    }
};

window.toggleCIMFullscreen = function() {
    const block = document.getElementById('dash-cim-block');
    const backdrop = document.getElementById('cim-fullscreen-backdrop');
    const expandIcon = document.getElementById('cim-fullscreen-icon-expand');
    const compressIcon = document.getElementById('cim-fullscreen-icon-compress');
    const label = document.getElementById('cim-fullscreen-label');
    if (!block) return;

    const isFs = block.classList.toggle('cim-fullscreen');
    document.body.classList.toggle('cim-fullscreen-active', isFs);
    if (backdrop) {
        if (isFs) backdrop.classList.add('active');
        else backdrop.classList.remove('active');
    }

    if (expandIcon && compressIcon) {
        expandIcon.style.display = isFs ? 'none' : 'block';
        compressIcon.style.display = isFs ? 'block' : 'none';
    }
    if (label) {
        label.innerText = isFs ? 'Exit Fullscreen' : 'Fullscreen';
    }

    const box = document.getElementById('cim-messages-box');
    if (box) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 100);
};

// Listen for Escape key to exit fullscreen
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const block = document.getElementById('dash-cim-block');
        if (block && block.classList.contains('cim-fullscreen')) {
            window.toggleCIMFullscreen();
        }
    }
});

function updateCIMProfileCard(userData) {
    if (!currentUser) return;
    const nameEl = document.getElementById('cim-profile-name');
    const handleEl = document.getElementById('cim-profile-handle');
    const statusEl = document.getElementById('cim-profile-status');
    const bioEl = document.getElementById('cim-profile-bio');
    const pfpEl = document.getElementById('cim-profile-pfp');
    const bannerEl = document.getElementById('cim-profile-banner');

    const name = userData?.displayName || currentUser.displayName || currentUser.email.split('@')[0];
    const username = userData?.username || currentUser.email.split('@')[0];
    const status = userData?.statusText || 'Browsing the Website';
    const bio = userData?.bio || 'The developer behind it all 👾';
    const pfp = userData?.photoURL || currentUser.photoURL || DEFAULT_PFP;
    const banner = userData?.banner || (typeof currentBannerStyle !== 'undefined' ? currentBannerStyle : null) || 'linear-gradient(135deg, #091e3a 0%, #2563eb 50%, #030a14 100%)';

    if (nameEl) nameEl.innerText = name;
    if (handleEl) handleEl.innerText = `@${username}`;
    if (statusEl) statusEl.innerText = status;
    if (bioEl) bioEl.innerText = bio;
    if (pfpEl) pfpEl.src = pfp;
    if (bannerEl) applyBannerStyle(bannerEl, banner);

    if (window.renderCIMProfileSocials) {
        window.renderCIMProfileSocials(userData);
    }
}

let cimEventSource = null;
let cimPollInterval = null;

function handleIncomingCIMMessage(msg) {
    if (!currentUser || !msg || !msg.senderUid) return;
    if (msg.senderUid === currentUser.uid) return;

    const saved = saveCIMLocalMessage(currentUser.uid, msg.senderUid, {
        id: msg.id || `msg_${msg.timestamp || Date.now()}`,
        senderId: msg.senderUid,
        senderUid: msg.senderUid,
        senderName: msg.senderName,
        senderPfp: msg.senderPfp,
        recipientId: currentUser.uid,
        text: msg.text,
        timestamp: msg.timestamp || Date.now()
    });

    if (!saved) return; // already processed / rendered

    playCIMChime();

    // If currently chatting with this friend, update chat UI in real time dynamically!
    if (activeCIMRecipient && activeCIMRecipient.uid === msg.senderUid) {
        const updated = getCIMLocalMessages(currentUser.uid, activeCIMRecipient.uid);
        renderCIMMessagesUI(updated);
    }

    // If chat not active or window backgrounded, show top-right notification toast
    if (!activeCIMRecipient || activeCIMRecipient.uid !== msg.senderUid || document.hidden) {
        showCIMNotification(msg.senderUid, msg.senderName, msg.senderPfp, msg.text);
    }
}

function checkCIMPendingMessages() {
    if (!currentUser) return;
    fetch(`/api/cim/poll?uid=${currentUser.uid}`)
        .then(r => r.json())
        .then(data => {
            if (data && data.messages && Array.isArray(data.messages)) {
                data.messages.forEach(msg => handleIncomingCIMMessage(msg));
            }
        })
        .catch(() => {});

    // If currently chatting with a friend, sync history dynamically as well!
    if (activeCIMRecipient && activeCIMRecipient.uid) {
        const convoId = [currentUser.uid, activeCIMRecipient.uid].sort().join('_');
        fetch(`/api/cim/history?convoId=${convoId}`)
            .then(r => r.json())
            .then(data => {
                if (data && data.messages && Array.isArray(data.messages)) {
                    let hasNew = false;
                    data.messages.forEach(m => {
                        const saved = saveCIMLocalMessage(currentUser.uid, activeCIMRecipient.uid, m);
                        if (saved) hasNew = true;
                    });
                    if (hasNew && activeCIMRecipient) {
                        const updated = getCIMLocalMessages(currentUser.uid, activeCIMRecipient.uid);
                        renderCIMMessagesUI(updated);
                    }
                }
            })
            .catch(() => {});
    }
}

function initCIMStream() {
    if (!currentUser) return;
    if (cimEventSource) { cimEventSource.close(); cimEventSource = null; }
    if (cimPollInterval) { clearInterval(cimPollInterval); cimPollInterval = null; }

    // 1. Realtime SSE connection (sub-millisecond delivery)
    try {
        cimEventSource = new EventSource(`/api/cim/stream?uid=${currentUser.uid}`);
        cimEventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data && data.type === 'cim_message') {
                    handleIncomingCIMMessage(data);
                }
            } catch(e) {}
        };
        cimEventSource.onerror = () => {
            // EventSource auto-reconnects; fast-poll ensures zero dropped messages
        };
    } catch(e) {}

    // 2. High-speed poll loop (every 750ms) ensures instant live updates without refresh
    checkCIMPendingMessages();
    cimPollInterval = setInterval(checkCIMPendingMessages, 750);
}

async function initFirebaseMessaging() {
    try {
        if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
            console.log("[CIM] Web Notifications or ServiceWorker not supported in this browser.");
            return;
        }

        const fcmModule = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js").catch(e => {
            console.warn("[CIM] Could not load firebase-messaging.js dynamically:", e);
            return null;
        });

        if (!fcmModule) return;
        const { getMessaging, getToken, onMessage, isSupported } = fcmModule;

        const supported = await isSupported().catch(() => false);
        if (!supported) {
            console.log("[CIM] Firebase Messaging is not supported in this browser context.");
            return;
        }

        // Register Service Worker for background push notifications
        let swReg = null;
        try {
            swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log("[CIM] Service Worker registered for Firebase Messaging");
        } catch(swErr) {
            console.warn("[CIM] Service Worker registration failed:", swErr);
        }

        fcmMessaging = getMessaging(app);

        // Request browser permission for notifications
        if (Notification.permission === 'default') {
            try {
                await Notification.requestPermission();
            } catch (pErr) {}
        }

        // Retrieve token if permission is granted
        if (Notification.permission === 'granted') {
            try {
                const tokenOpts = swReg ? { serviceWorkerRegistration: swReg } : {};
                const token = await getToken(fcmMessaging, tokenOpts).catch(() => null);
                if (token && currentUser) {
                    console.log("[CIM] Firebase Messaging Token acquired");
                    await setDoc(doc(db, "users", currentUser.uid), {
                        fcmToken: token,
                        fcmUpdatedAt: serverTimestamp()
                    }, { merge: true }).catch(() => {});
                }
            } catch (tErr) {
                console.warn("[CIM] FCM token retrieval error:", tErr);
            }
        }

        // Setup foreground message listener
        if (fcmUnsub) { fcmUnsub(); fcmUnsub = null; }
        fcmUnsub = onMessage(fcmMessaging, (payload) => {
            console.log("[CIM] FCM Message received in foreground:", payload);
            const data = payload.data || {};
            handleIncomingCIMMessage({
                senderUid: data.senderUid || data.senderId,
                senderName: data.senderName || payload.notification?.title || 'Friend',
                senderPfp: data.senderPfp || payload.notification?.icon || DEFAULT_PFP,
                text: payload.notification?.body || data.text || 'New instant message',
                timestamp: data.timestamp ? Number(data.timestamp) : Date.now()
            });
        });

    } catch (err) {
        console.warn("[CIM] Firebase Messaging initialization error:", err);
    }
}

function initCIMSystem() {
    if (!currentUser) return;
    cimSessionStartTime = Date.now();

    // 1. Initialize Firebase Cloud Messaging for CIM
    initFirebaseMessaging();

    // 2. Initialize Realtime Instant Message Stream (Zero-database storage!)
    initCIMStream();
}

function clearCIMSubscriptions() {
    window.clearActiveCIMChat();
    if (cimEventSource) { cimEventSource.close(); cimEventSource = null; }
    if (fcmUnsub) { fcmUnsub(); fcmUnsub = null; }
}

function initFriendsSystem() {
    if (!currentUser) return;
    if (friendsUnsub) friendsUnsub();
    if (requestsUnsub) requestsUnsub();
    clearFriendPresenceSubscriptions();

    // 1. Active Friends Listener
    const friendsRef = collection(db, "users", currentUser.uid, "friends");
    friendsUnsub = onSnapshot(friendsRef, (snap) => {
        const badge = document.getElementById('friends-count-badge');
        if (badge) badge.innerText = `${snap.size} Friend${snap.size === 1 ? '' : 's'}`;

        const container = document.getElementById('active-friends-list');
        if (!container) return;

        if (snap.empty) {
            renderFriendsDOM([]);
            return;
        }

        const friends = [];
        const activeFriendUids = new Set();
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const fUid = data.uid || docSnap.id;
            activeFriendUids.add(fUid);
            friends.push({ id: docSnap.id, uid: fUid, ...data });
        });

        // Clean up unsubs for removed friends
        friendDocUnsubs.forEach((unsub, uid) => {
            if (!activeFriendUids.has(uid)) {
                unsub();
                friendDocUnsubs.delete(uid);
                friendLivePresence.delete(uid);
            }
        });

        // Ensure live listener for each friend's user document
        friends.forEach(friend => {
            const fUid = friend.uid;
            if (!friendDocUnsubs.has(fUid)) {
                const unsub = onSnapshot(doc(db, "users", fUid), (userDocSnap) => {
                    if (userDocSnap.exists()) {
                        friendLivePresence.set(fUid, userDocSnap.data());
                        renderFriendsDOM(friends);
                    }
                });
                friendDocUnsubs.set(fUid, unsub);
            }
        });

        renderFriendsDOM(friends);
    });

    // 2. Incoming Friend Requests Listener
    const requestsRef = collection(db, "users", currentUser.uid, "friend_requests");
    requestsUnsub = onSnapshot(requestsRef, (snap) => {
        const box = document.getElementById('pending-requests-box');
        const countSpan = document.getElementById('pending-count');
        const list = document.getElementById('pending-requests-list');
        if (!box || !countSpan || !list) return;

        if (snap.empty) {
            box.style.display = 'none';
            list.innerHTML = '';
            countSpan.innerText = '0';
            return;
        }

        box.style.display = 'block';
        countSpan.innerText = snap.size;

        const requests = [];
        snap.forEach(docSnap => requests.push({ id: docSnap.id, ...docSnap.data() }));

        list.innerHTML = requests.map(req => `
            <div class="pending-request-card">
                <div class="friend-avatar-wrap">
                    <img src="${req.fromPfp || DEFAULT_PFP}" alt="${req.fromName || 'Player'}">
                </div>
                <div class="friend-info">
                    <div class="friend-name">${escapeHtml(req.fromName || 'CrimX Player')}</div>
                    <div class="friend-handle">@${escapeHtml(req.fromUsername || 'user')}</div>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn-primary" onclick="acceptFriendRequest('${req.id}', '${escapeHtml(req.fromName || '')}', '${escapeHtml(req.fromUsername || '')}', '${escapeHtml(req.fromPfp || '')}')" style="width: auto; padding: 6px 12px; font-size: 0.78rem; font-weight: 700;">
                        Accept ✓
                    </button>
                    <button type="button" class="btn-secondary" onclick="declineFriendRequest('${req.id}')" style="width: auto; padding: 6px 10px; font-size: 0.78rem;">
                        ✕
                    </button>
                </div>
            </div>
        `).join('');
    });
}

window.sendFriendRequestByUsername = async function(e) {
    e.preventDefault();
    if (!currentUser) return;
    const input = document.getElementById('friend-search-input');
    const feedback = document.getElementById('friend-action-feedback');
    const btn = e.target.querySelector('button[type="submit"]');

    const rawUsername = input?.value.trim() || '';
    const cleanUsername = rawUsername.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');

    function showFeedback(msg, type) {
        if (!feedback) return;
        feedback.style.display = 'block';
        feedback.style.background = type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        feedback.style.border = type === 'success' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)';
        feedback.style.color = type === 'success' ? '#4ade80' : '#f87171';
        feedback.innerText = (type === 'success' ? '✓ ' : '⚠️ ') + msg;
        setTimeout(() => { feedback.style.display = 'none'; }, 5000);
    }

    if (!cleanUsername || cleanUsername.length < 3) {
        showFeedback("Please enter a valid @username (at least 3 characters).", "error");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Searching...";

    try {
        const mySnap = await getDoc(doc(db, "users", currentUser.uid));
        const myData = mySnap.exists() ? mySnap.data() : {};
        const myUsername = myData.username || currentUser.email.split('@')[0];

        if (cleanUsername === myUsername) {
            throw new Error("You cannot send a friend request to yourself!");
        }

        const q = query(collection(db, "users"), where("username", "==", cleanUsername));
        const querySnap = await getDocs(q);

        if (querySnap.empty) {
            throw new Error(`Player @${cleanUsername} was not found on CrimX.`);
        }

        const targetDoc = querySnap.docs[0];
        const targetUid = targetDoc.id;

        const existingFriendSnap = await getDoc(doc(db, "users", currentUser.uid, "friends", targetUid));
        if (existingFriendSnap.exists()) {
            throw new Error(`You and @${cleanUsername} are already friends!`);
        }

        await setDoc(doc(db, "users", targetUid, "friend_requests", currentUser.uid), {
            fromUid: currentUser.uid,
            fromName: myData.displayName || currentUser.displayName || myUsername,
            fromUsername: myUsername,
            fromPfp: myData.photoURL || currentUser.photoURL || DEFAULT_PFP,
            requestedAt: serverTimestamp()
        });

        playSfx('success');
        showFeedback(`Friend request sent to @${cleanUsername}!`, "success");
        window.showToast(`Request sent to @${cleanUsername}!`, "success");
        input.value = '';
    } catch(err) {
        playSfx('error');
        showFeedback(err.message, "error");
        window.showToast(err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "+ Add Friend";
    }
};

window.acceptFriendRequest = async function(fromUid, fromName, fromUsername, fromPfp) {
    if (!currentUser) return;
    try {
        const mySnap = await getDoc(doc(db, "users", currentUser.uid));
        const myData = mySnap.exists() ? mySnap.data() : {};
        const myUsername = myData.username || currentUser.email.split('@')[0];

        // 1. Add to my friends
        await setDoc(doc(db, "users", currentUser.uid, "friends", fromUid), {
            uid: fromUid,
            displayName: fromName || 'Player',
            username: fromUsername || 'user',
            photoURL: fromPfp || DEFAULT_PFP,
            online: true,
            addedAt: serverTimestamp()
        });

        // 2. Add to their friends
        await setDoc(doc(db, "users", fromUid, "friends", currentUser.uid), {
            uid: currentUser.uid,
            displayName: myData.displayName || currentUser.displayName || myUsername,
            username: myUsername,
            photoURL: myData.photoURL || currentUser.photoURL || DEFAULT_PFP,
            online: true,
            addedAt: serverTimestamp()
        });

        // 3. Delete incoming request
        await deleteDoc(doc(db, "users", currentUser.uid, "friend_requests", fromUid));

        playSfx('success');
        window.showToast(`You are now friends with @${fromUsername}!`, "success");
    } catch(err) {
        playSfx('error');
        window.showToast("Failed to accept friend request: " + err.message, "error");
    }
};

window.declineFriendRequest = async function(fromUid) {
    if (!currentUser) return;
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "friend_requests", fromUid));
        playSfx('click');
        window.showToast("Friend request declined.", "info");
    } catch(err) {
        window.showToast("Error declining request: " + err.message, "error");
    }
};

window.removeFriend = async function(friendUid, friendName) {
    if (!currentUser) return;
    if (!confirm(`Are you sure you want to remove ${friendName} from your CrimX friends?`)) return;
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "friends", friendUid));
        await deleteDoc(doc(db, "users", friendUid, "friends", currentUser.uid));
        playSfx('click');
        window.showToast(`${friendName} removed from friends.`, "info");
    } catch(err) {
        window.showToast("Error removing friend: " + err.message, "error");
    }
};

// ── Auth State Listener & Realtime Sync ──
let userDocUnsub = null;

onAuthStateChanged(auth, user => {
    if (user && (user.emailVerified || user.providerData.some(p => p.providerId === 'google.com'))) {
        currentUser = user;
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('dashboard-container').style.display = 'block';

        // Set real-time online presence on website
        updateDoc(doc(db, "users", user.uid), {
            online: true,
            statusText: "Browsing the Website",
            lastActive: serverTimestamp()
        }).catch(() => {});

        // Dispatch security notification on fresh login session
        const sessionKey = 'crimx_sign_in_alert_' + user.uid;
        if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, 'dispatched');
            dispatchSecurityAlert('new_sign_in', user.email, user.uid);
        }

        // Security card values
        const uidEl = document.getElementById('security-uid-display');
        if (uidEl) uidEl.innerText = user.uid;

        const emailEl = document.getElementById('security-email-display');
        if (emailEl) emailEl.innerText = user.email;

        const resendBtn = document.getElementById('resend-verification-btn');
        const emailBadge = document.getElementById('security-email-badge');
        if (user.emailVerified) {
            if (resendBtn) resendBtn.style.display = 'none';
            if (emailBadge) { emailBadge.innerText = "✓ Verified Account"; emailBadge.style.color = "#4ade80"; }
        } else {
            if (resendBtn) resendBtn.style.display = 'inline-block';
            if (emailBadge) { emailBadge.innerText = "⚠️ Unverified Email"; emailBadge.style.color = "#f87171"; }
        }

        // Form initial values & showcase synchronization
        const nameVal = user.displayName || user.email.split('@')[0];
        document.getElementById('display-name').value = user.displayName || "";
        document.getElementById('dashboard-pfp-preview').src = user.photoURL || DEFAULT_PFP;
        document.getElementById('preview-avatar').src = user.photoURL || DEFAULT_PFP;
        document.getElementById('sidebar-user-avatar').src = user.photoURL || DEFAULT_PFP;
        const showcaseAvatar = document.getElementById('showcase-avatar');
        if (showcaseAvatar) showcaseAvatar.src = user.photoURL || DEFAULT_PFP;

        // Ensure user document exists with initial username
        getDoc(doc(db, "users", currentUser.uid)).then(docSnap => {
            if (!docSnap.exists() || !docSnap.data().username) {
                const baseName = nameVal.toLowerCase().replace(/[^a-z0-9_]/g, '');
                setDoc(doc(db, "users", currentUser.uid), { 
                    uid: currentUser.uid, 
                    username: baseName || `player_${Math.floor(Math.random()*9000+1000)}`, 
                    displayName: nameVal 
                }, { merge: true });
            }
        });

        // Initialize Realtime Friends System
        initFriendsSystem();

        // Initialize Realtime CIM Instant Messenger
        initCIMSystem();

        // Realtime Firestore synchronization
        if (userDocUnsub) userDocUnsub();
        userDocUnsub = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
            if(docSnap.exists()) {
                const data = docSnap.data();

                updateCIMProfileCard(data);

                // Input fields
                if (data.username) document.getElementById('username-input').value = data.username;
                if (data.displayName) document.getElementById('display-name').value = data.displayName;
                if (data.statusText) document.getElementById('status-text-input').value = data.statusText;
                if (data.bio) document.getElementById('bio-input').value = data.bio;

                // Banner
                if (data.banner) {
                    currentBannerStyle = data.banner;
                    const pBanner = document.getElementById('preview-banner');
                    const sBannerBg = document.getElementById('showcase-banner-bg');
                    const bPreviewImg = document.getElementById('banner-preview-img');
                    const bBox = document.getElementById('banner-uploader-box');

                    applyBannerStyle(pBanner, data.banner);
                    applyBannerStyle(sBannerBg, data.banner);

                    if (data.banner.startsWith('http') || data.banner.startsWith('data:image')) {
                        currentBannerIsImage = true;
                        if (bPreviewImg) { bPreviewImg.src = data.banner; bPreviewImg.style.display = 'block'; }
                        const urlInput = document.getElementById('banner-url-input');
                        if (urlInput && data.banner.startsWith('http')) urlInput.value = data.banner;
                    } else {
                        currentBannerIsImage = false;
                        if (bBox) bBox.style.background = data.banner;
                        if (bPreviewImg) bPreviewImg.style.display = 'none';
                    }
                }

                // Preferences
                if (data.preferences) {
                    if (data.preferences.sfxEnabled !== undefined) {
                        const sfxEl = document.getElementById('pref-sfx');
                        if (sfxEl) sfxEl.checked = data.preferences.sfxEnabled;
                    }
                    if (data.preferences.betaTester !== undefined) {
                        const betaEl = document.getElementById('pref-beta');
                        if (betaEl) betaEl.checked = data.preferences.betaTester;
                    }
                    if (data.preferences.emailUpdates !== undefined) {
                        const emailUpEl = document.getElementById('pref-email-updates');
                        if (emailUpEl) emailUpEl.checked = data.preferences.emailUpdates;
                    }
                }

                // Role Verification (Assigned strictly in Firebase/Firestore: isStaff / isDev / role)
                const isStaff = data.isStaff === true || data.staff === true || data.role === 'staff' || data.role === 'admin';
                const isDev = data.isDev === true || data.dev === true || data.developer === true || data.isDeveloper === true || data.role === 'developer' || data.role === 'dev';
                
                const previewStaffBadge = document.getElementById('preview-staff-badge');
                const previewDevBadge = document.getElementById('preview-dev-badge');
                const sidebarRoleBadge = document.getElementById('sidebar-role-badge');
                const showStaffBadge = document.getElementById('showcase-staff-badge');
                const showDevBadge = document.getElementById('showcase-dev-badge');

                if (previewStaffBadge) previewStaffBadge.style.display = isStaff ? 'inline-flex' : 'none';
                if (previewDevBadge) previewDevBadge.style.display = isDev ? 'inline-flex' : 'none';
                if (showStaffBadge) showStaffBadge.style.display = isStaff ? 'inline-flex' : 'none';
                if (showDevBadge) showDevBadge.style.display = isDev ? 'inline-flex' : 'none';

                if (sidebarRoleBadge) {
                    if (isStaff) {
                        sidebarRoleBadge.innerText = "🛡️ Staff";
                        sidebarRoleBadge.className = "settings-role-badge staff";
                    } else if (isDev) {
                        sidebarRoleBadge.innerText = "🛠️ Developer";
                        sidebarRoleBadge.className = "settings-role-badge dev";
                    } else {
                        sidebarRoleBadge.innerText = "🔥 Member";
                        sidebarRoleBadge.className = "settings-role-badge";
                    }
                }

                // Discord Integration status
                const previewDiscordChip = document.getElementById('preview-discord-chip');
                const previewDiscordText = document.getElementById('preview-discord-text');
                const discordStatusBadge = document.getElementById('discord-status-badge');
                const discordToggle = document.getElementById('pref-show-discord');

                const showDiscord = data.discordShowOnProfile !== false;
                if (discordToggle) discordToggle.checked = showDiscord;

                if (data.discordUsername) {
                    const dUnlinked = document.getElementById('discord-unlinked');
                    const dLinked = document.getElementById('discord-linked');
                    if (dUnlinked) dUnlinked.style.display = 'none';
                    if (dLinked) dLinked.style.display = 'flex';
                    const uName = document.getElementById('discord-username');
                    if (uName) uName.innerText = `@${data.discordUsername}`;
                    const dAvatar = document.getElementById('discord-avatar');
                    if (dAvatar) dAvatar.src = data.discordAvatar || 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png';
                    if (discordStatusBadge) {
                        discordStatusBadge.innerText = "Linked";
                        discordStatusBadge.style.background = "rgba(88, 101, 242, 0.35)";
                        discordStatusBadge.style.color = "#c7d2fe";
                    }

                    if (previewDiscordChip) {
                        previewDiscordChip.style.display = showDiscord ? 'inline-flex' : 'none';
                        previewDiscordChip.classList.add('active');
                    }
                    if (previewDiscordText) previewDiscordText.innerText = `@${data.discordUsername}`;
                } else {
                    const dUnlinked = document.getElementById('discord-unlinked');
                    const dLinked = document.getElementById('discord-linked');
                    if (dUnlinked) dUnlinked.style.display = 'block';
                    if (dLinked) dLinked.style.display = 'none';
                    if (discordStatusBadge) {
                        discordStatusBadge.innerText = "Unlinked";
                        discordStatusBadge.style.background = "rgba(88, 101, 242, 0.15)";
                        discordStatusBadge.style.color = "#818cf8";
                    }
                    if (previewDiscordChip) previewDiscordChip.style.display = 'none';
                }

                // YouTube Integration status
                const previewYouTubeChip = document.getElementById('preview-youtube-chip');
                const previewYouTubeText = document.getElementById('preview-youtube-text');
                const youtubeStatusBadge = document.getElementById('youtube-status-badge');
                const youtubeToggle = document.getElementById('pref-show-youtube');

                const showYouTube = data.youtubeShowOnProfile !== false;
                if (youtubeToggle) youtubeToggle.checked = showYouTube;

                if (data.youtubeHandle) {
                    const ytUnlinked = document.getElementById('youtube-unlinked');
                    const ytLinked = document.getElementById('youtube-linked');
                    if (ytUnlinked) ytUnlinked.style.display = 'none';
                    if (ytLinked) ytLinked.style.display = 'flex';
                    const cName = document.getElementById('youtube-channel-name');
                    if (cName) cName.innerText = data.youtubeHandle;
                    const cLink = document.getElementById('youtube-channel-link');
                    if (cLink) cLink.href = data.youtubeUrl || `https://www.youtube.com/${data.youtubeHandle}`;
                    if (youtubeStatusBadge) {
                        youtubeStatusBadge.innerText = "Linked";
                        youtubeStatusBadge.style.background = "rgba(220, 38, 38, 0.35)";
                        youtubeStatusBadge.style.color = "#fecaca";
                    }

                    if (previewYouTubeChip) {
                        previewYouTubeChip.style.display = showYouTube ? 'inline-flex' : 'none';
                        previewYouTubeChip.classList.add('active');
                    }
                    if (previewYouTubeText) previewYouTubeText.innerText = data.youtubeHandle;
                } else {
                    const ytUnlinked = document.getElementById('youtube-unlinked');
                    const ytLinked = document.getElementById('youtube-linked');
                    if (ytUnlinked) ytUnlinked.style.display = 'block';
                    if (ytLinked) ytLinked.style.display = 'none';
                    if (youtubeStatusBadge) {
                        youtubeStatusBadge.innerText = "Unlinked";
                        youtubeStatusBadge.style.background = "rgba(239, 68, 68, 0.15)";
                        youtubeStatusBadge.style.color = "#fca5a5";
                    }
                    if (previewYouTubeChip) previewYouTubeChip.style.display = 'none';
                }

                if (window.renderCIMProfileSocials) {
                    window.renderCIMProfileSocials(data);
                }

                window.updateLivePreview();
            }
        });

        window.loadConnectedApps();
        window.updateLivePreview();

        // Handle URL ?tab= deep links
        const urlTab = searchParams.get('tab');
        if (urlTab === 'friends') {
            setTimeout(() => {
                const friendsEl = document.querySelector('.dash-friends-section');
                if (friendsEl) friendsEl.scrollIntoView({ behavior: 'smooth' });
            }, 400);
        } else if (urlTab) {
            setTimeout(() => {
                window.switchSettingsTab(urlTab);
            }, 400);
        }
    } else {
        currentUser = null;
        document.getElementById('login-container').style.display = 'block';
        document.getElementById('dashboard-container').style.display = 'none';
        if (userDocUnsub) { userDocUnsub(); userDocUnsub = null; }
        if (friendsUnsub) { friendsUnsub(); friendsUnsub = null; clearFriendPresenceSubscriptions(); }
        if (requestsUnsub) { requestsUnsub(); requestsUnsub = null; }
        clearCIMSubscriptions();
    }
});

// ─── DOORAUTH LINKED APPS & CLIENT AUTH SYSTEM ───
const KNOWN_DOORAUTH_CLIENTS = {
    'cf_client_843fbbf7d0caba': { name: 'PluhMath', icon: '🧮' },
    'cf_client_pluhmath': { name: 'PluhMath', icon: '🧮' },
    'pluhmath': { name: 'PluhMath', icon: '🧮' }
};

function resolveDoorAppName(rawName, rawId) {
    const id = String(rawId || '').trim();
    const name = String(rawName || '').trim();
    const combined = (name + ' ' + id).toLowerCase();

    if (combined.includes('843fbbf7d0caba') || combined.includes('pluhmath') || combined.includes('pluh')) {
        return 'PluhMath';
    }
    if (id && KNOWN_DOORAUTH_CLIENTS[id]) {
        return KNOWN_DOORAUTH_CLIENTS[id].name;
    }
    if (name && KNOWN_DOORAUTH_CLIENTS[name]) {
        return KNOWN_DOORAUTH_CLIENTS[name].name;
    }
    // If name is missing or looks like an ID string
    if (!name || /^cf_client|^crimx_client|^app_code|^app\s*\(/i.test(name)) {
        return 'External Application';
    }
    return name;
}

function resolveDoorAppId(rawName, rawId) {
    const id = String(rawId || '').trim();
    const name = String(rawName || '').trim();

    if (id && !id.startsWith('app_code_') && id !== 'undefined' && id !== 'null') {
        return id;
    }
    if (/^cf_client|^crimx_client/i.test(name)) {
        return name;
    }
    const parenMatch = name.match(/\(([^)]+)\)/);
    if (parenMatch) {
        return parenMatch[1];
    }
    if (name.toLowerCase().includes('pluh') || id.toLowerCase().includes('pluh')) {
        return 'cf_client_843fbbf7d0caba';
    }
    return id || 'cf_client_app';
}

window.loadConnectedApps = function() {
    window.loadDoorAuthApps();
};

window.loadDoorAuthApps = async function() {
    if (!currentUser) return;
    const storageKey = `cf_doorauth_apps_${currentUser.uid}`;
    let apps = [];
    try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            apps = JSON.parse(raw);
            // Purge any legacy mock apps
            apps = apps.filter(a => a && a.id !== "app_cf_vr" && a.id !== "app_cf_bot" && a.name !== "CrimsonVR Portal" && a.name !== "Crimson Flame Community Bot");
        }
    } catch (e) {
        apps = [];
    }

    // Pull from Firestore connected_apps to merge
    try {
        const snap = await getDocs(collection(db, "users", currentUser.uid, "connected_apps"));
        snap.forEach(d => {
            const data = d.data();
            const docId = d.id;
            const cid = data.clientId || docId;
            const appFriendlyName = data.appName || data.name || (cid.includes('843fbbf7d0caba') || cid.includes('pluh') ? 'PluhMath' : '');
            
            const existingIdx = apps.findIndex(a => a.id === docId || a.clientId === cid || (a.name && appFriendlyName && a.name.toLowerCase() === appFriendlyName.toLowerCase()));
            if (existingIdx === -1) {
                apps.push({
                    id: docId,
                    clientId: cid,
                    name: appFriendlyName,
                    icon: data.icon || (cid.includes('843fbbf7d0caba') || cid.includes('pluh') ? '🧮' : '⚡'),
                    scopes: data.scope || 'Profile Access',
                    linkedAt: data.authorizedAt || Date.now()
                });
            } else {
                if (appFriendlyName) apps[existingIdx].name = appFriendlyName;
                if (cid) apps[existingIdx].clientId = cid;
            }
        });
    } catch (e) {
        console.debug("DoorAuth firestore sync notice:", e);
    }

    // Sanitize all apps so the displayed name is human-readable and ID is the random client string
    apps = apps.map(app => {
        const cleanName = resolveDoorAppName(app.name, app.clientId || app.id);
        const cleanId = resolveDoorAppId(app.name, app.clientId || app.id);
        const icon = (cleanName === 'PluhMath' || cleanId.includes('843fbbf7d0caba')) ? '🧮' : (app.icon || '⚡');
        return {
            ...app,
            id: app.id || cleanId,
            clientId: cleanId,
            name: cleanName,
            icon: icon
        };
    });

    try {
        localStorage.setItem(storageKey, JSON.stringify(apps));
    } catch(e) {}

    const countBadge = document.getElementById('doorauth-count-badge');
    const heroApps = document.getElementById('hero-apps-stat');
    const listEl = document.getElementById('doorauth-apps-list');
    if (countBadge) countBadge.innerText = `${apps.length} App${apps.length === 1 ? '' : 's'}`;
    if (heroApps) heroApps.innerText = apps.length;

    // Populate Settings tab connected-apps-list
    const settingsListEl = document.getElementById('connected-apps-list');
    if (settingsListEl) {
        if (apps.length === 0) {
            settingsListEl.innerHTML = `<p id="connected-apps-empty" style="color: var(--text-secondary); font-size: 0.85rem; text-align: center; padding: 24px; background: rgba(0,0,0,0.3); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">No external applications have been authorized yet.</p>`;
        } else {
            settingsListEl.innerHTML = apps.map(appItem => `
                <div class="linked-card" style="background: rgba(22, 12, 16, 0.8); border: 1px solid rgba(255,255,255,0.08); padding: 14px 16px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 42px; height: 42px; border-radius: 10px; background: #1f2937; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">${appItem.icon || '⚡'}</div>
                        <div>
                            <div style="font-weight: 700; color: #fff; font-size: 0.98rem;">${window.escapeHtml ? window.escapeHtml(appItem.name) : appItem.name}</div>
                            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                <span style="font-family: monospace; font-size: 0.72rem; color: #fca5a5; background: rgba(0,0,0,0.35); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(239,68,68,0.25);">ID: ${appItem.clientId}</span>
                                <span>· Authorized ${appItem.linkedAt ? new Date(appItem.linkedAt).toLocaleDateString() : 'recently'} · Read identity & game sync</span>
                            </div>
                        </div>
                    </div>
                    <button onclick="window.revokeDoorAuthApp('${appItem.id}')" class="btn-danger" style="width: auto; padding: 6px 14px; font-size: 0.8rem;">Revoke Access</button>
                </div>
            `).join('');
        }
    }

    if (!listEl) return;
    if (!apps || apps.length === 0) {
        listEl.innerHTML = `
            <div class="doorauth-empty-state">
                <div style="font-size: 1.6rem; margin-bottom: 4px;">🔗</div>
                <div style="font-weight: 700; color: #fff; font-size: 0.88rem; margin-bottom: 2px;">No External Apps Linked</div>
                <div style="color: var(--text-secondary); font-size: 0.76rem; line-height: 1.4;">
                    Use "Sign in with CrimX" on supported apps or link with a code below.
                </div>
            </div>`;
        return;
    }

    listEl.innerHTML = apps.map(app => `
        <div class="doorauth-app-card" id="doorauth-app-${app.id}">
            <div class="doorauth-app-info">
                <div class="doorauth-app-icon">${app.icon || '⚡'}</div>
                <div>
                    <div class="doorauth-app-name" style="font-weight: 800; font-size: 0.92rem; color: #ffffff;">${window.escapeHtml ? window.escapeHtml(app.name) : app.name}</div>
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px;">
                        <span class="doorauth-id-badge" style="font-family: monospace; font-size: 0.68rem; color: #fca5a5; background: rgba(0,0,0,0.35); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(239,68,68,0.2);">ID: ${app.clientId}</span>
                        <span class="doorauth-app-scopes" style="font-size: 0.68rem; color: var(--text-secondary);">${app.scopes || 'Profile Access'}</span>
                    </div>
                </div>
            </div>
            <button type="button" class="doorauth-revoke-btn" onclick="revokeDoorAuthApp('${app.id}')" title="Revoke app access">
                Revoke
            </button>
        </div>
    `).join('');
};

window.connectDoorAuthCode = async function(e) {
    if (e) e.preventDefault();
    if (!currentUser) return;

    const input = document.getElementById('doorauth-code-input');
    const feedback = document.getElementById('doorauth-feedback');
    if (!input) return;
    const code = input.value.trim();
    if (!code) return;

    let appName = 'External Application';
    let clientId = code;
    let appIcon = '⚡';

    if (code.toLowerCase().includes('pluh') || code.toLowerCase().includes('843fbbf7d0caba')) {
        appName = 'PluhMath';
        clientId = 'cf_client_843fbbf7d0caba';
        appIcon = '🧮';
    } else if (KNOWN_DOORAUTH_CLIENTS[code]) {
        appName = KNOWN_DOORAUTH_CLIENTS[code].name;
        clientId = code;
        appIcon = KNOWN_DOORAUTH_CLIENTS[code].icon || '⚡';
    } else if (!code.startsWith('cf_client') && !code.startsWith('crimx_client') && !code.startsWith('cf_code')) {
        appName = code;
        clientId = `cf_client_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    }

    // Also check Firestore sso_links for real metadata if exists
    try {
        const appDoc = await getDoc(doc(db, "sso_links", clientId));
        if (appDoc.exists() && appDoc.data().appName) {
            appName = appDoc.data().appName;
        }
    } catch(err) {}

    const storageKey = `cf_doorauth_apps_${currentUser.uid}`;
    let apps = [];
    try {
        const raw = localStorage.getItem(storageKey);
        apps = raw ? JSON.parse(raw) : [];
    } catch(err) {
        apps = [];
    }

    // Filter out existing app with same clientId or name
    apps = apps.filter(a => a.clientId !== clientId && a.id !== clientId && a.name !== appName);

    const newApp = {
        id: clientId,
        clientId: clientId,
        name: appName,
        icon: appIcon,
        scopes: "Profile, DoorAuth Token",
        linkedAt: Date.now()
    };

    apps.unshift(newApp);
    localStorage.setItem(storageKey, JSON.stringify(apps));

    // Also sync to Firestore users/{uid}/connected_apps
    try {
        await setDoc(doc(db, "users", currentUser.uid, "connected_apps", clientId), {
            clientId: clientId,
            appName: appName,
            name: appName,
            icon: appIcon,
            authorizedAt: new Date().toISOString(),
            scope: "identity,profile"
        }, { merge: true });
    } catch(e) {
        console.warn("Firestore connected_apps sync error:", e);
    }

    input.value = '';

    if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(34, 197, 94, 0.15)';
        feedback.style.border = '1px solid rgba(34, 197, 94, 0.4)';
        feedback.style.color = '#4ade80';
        feedback.innerText = `✓ Successfully linked ${appName} (ID: ${clientId}) to your CrimX account!`;
        setTimeout(() => { feedback.style.display = 'none'; }, 4000);
    }

    window.loadDoorAuthApps();
};

window.revokeDoorAuthApp = async function(appId) {
    if (!currentUser) return;
    const storageKey = `cf_doorauth_apps_${currentUser.uid}`;
    let apps = [];
    try {
        const raw = localStorage.getItem(storageKey);
        apps = raw ? JSON.parse(raw) : [];
    } catch(err) {
        apps = [];
    }

    apps = apps.filter(a => a.id !== appId && a.clientId !== appId);
    localStorage.setItem(storageKey, JSON.stringify(apps));

    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "connected_apps", appId));
        const snap = await getDocs(collection(db, "users", currentUser.uid, "connected_apps"));
        snap.forEach(async (d) => {
            const data = d.data();
            if (d.id === appId || data.clientId === appId) {
                await deleteDoc(doc(db, "users", currentUser.uid, "connected_apps", d.id));
            }
        });
    } catch(e) {}

    window.loadDoorAuthApps();
    if (window.showToast) window.showToast("App access revoked successfully.", "info");
};
