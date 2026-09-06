import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence, updateProfile, sendEmailVerification, sendPasswordResetEmail, updatePassword, verifyBeforeUpdateEmail, EmailAuthProvider, reauthenticateWithCredential, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, linkWithPhoneNumber, unlink } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, query, where, doc, onSnapshot, updateDoc, serverTimestamp, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Route password reset links to custom reset-password page
const searchParams = new URLSearchParams(window.location.search);
if (searchParams.get('mode') === 'resetPassword' || searchParams.get('oobCode')) {
    window.location.replace('/reset-password.html' + window.location.search);
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

// ── Tab Switching ──
window.switchSettingsTab = function(tabName, btn) {
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

    // Update character counters
    const nameCount = document.getElementById('display-name-count');
    if (nameCount) nameCount.innerText = `${displayNameVal.length}/32`;
    const statusCount = document.getElementById('status-text-count');
    if (statusCount) statusCount.innerText = `${statusVal.length}/60`;
    const bioCount = document.getElementById('bio-count');
    if (bioCount) bioCount.innerText = `${bioVal.length}/160`;

    // Live preview card updates
    const pName = document.getElementById('preview-name');
    if (pName) pName.innerText = displayNameVal || (currentUser ? (currentUser.displayName || currentUser.email.split('@')[0]) : "Player Name");

    const pHandle = document.getElementById('preview-handle');
    if (pHandle) pHandle.innerText = usernameVal ? `@${usernameVal}` : "@username";

    const pStatus = document.getElementById('preview-status-text');
    if (pStatus) pStatus.innerText = statusVal || "Exploring CrimsonFlame";

    const pBio = document.getElementById('preview-bio');
    if (pBio) pBio.innerText = bioVal || "Welcome to my CrimsonFlame player profile!";

    // Sidebar summary updates
    const sName = document.getElementById('sidebar-user-name');
    if (sName) sName.innerText = displayNameVal || (currentUser ? (currentUser.displayName || currentUser.email.split('@')[0]) : "Loading...");
    const sHandle = document.getElementById('sidebar-user-handle');
    if (sHandle) sHandle.innerText = usernameVal ? `@${usernameVal}` : "@username";
};

// ── Banner Preset Picker ──
window.selectPresetBanner = function(gradientCss) {
    currentBannerStyle = gradientCss;
    currentBannerIsImage = false;

    const pBanner = document.getElementById('preview-banner');
    if (pBanner) {
        pBanner.style.background = gradientCss;
        pBanner.style.backgroundImage = "";
    }
    const bPreviewImg = document.getElementById('banner-preview-img');
    if (bPreviewImg) bPreviewImg.style.display = 'none';

    const bBox = document.getElementById('banner-uploader-box');
    if (bBox) bBox.style.background = gradientCss;

    document.querySelectorAll('.preset-banner-thumb').forEach(t => {
        t.classList.toggle('active', t.getAttribute('onclick')?.includes(gradientCss));
    });
    playSfx('click');
};

// ── Image Uploads (Avatar & Banner via ImgBB) ──
window.handleUpload = async function(file, type) {
    if (!file || !file.type.startsWith('image/')) {
        window.showToast("Please choose a valid image file.", "error");
        return;
    }
    const sEl = document.getElementById('upload-status'); 
    if (sEl) { sEl.style.display = 'block'; sEl.innerText = 'Uploading to CDN...'; }

    try {
        const fd = new FormData(); 
        fd.append("image", file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd });
        const json = await res.json(); 
        if (!json.success) throw new Error("Upload Failed");

        const uploadedUrl = json.data.url;

        if (type === 'banner') {
            currentBannerStyle = uploadedUrl;
            currentBannerIsImage = true;

            const bPreviewImg = document.getElementById('banner-preview-img');
            if (bPreviewImg) {
                bPreviewImg.src = uploadedUrl;
                bPreviewImg.style.display = 'block';
            }
            const pBanner = document.getElementById('preview-banner');
            if (pBanner) {
                pBanner.style.backgroundImage = `url('${uploadedUrl}')`;
                pBanner.style.backgroundSize = "cover";
            }
            playSfx('success');
            window.showToast("Custom banner uploaded! Click 'Save Profile' to keep changes.", "success");
        } else {
            document.getElementById('dashboard-pfp-preview').src = uploadedUrl;
            document.getElementById('preview-avatar').src = uploadedUrl;
            const sidebarAvatar = document.getElementById('sidebar-user-avatar');
            if (sidebarAvatar) sidebarAvatar.src = uploadedUrl;
            playSfx('success');
            window.showToast("Avatar uploaded! Click 'Save Profile' to keep changes.", "success");
        }
        if (sEl) sEl.innerText = "Upload ready!";
    } catch (err) { 
        if (sEl) sEl.innerText = "Error uploading image.";
        playSfx('error');
        window.showToast("Upload failed: " + err.message, "error");
    }
    setTimeout(() => { if (sEl) sEl.style.display = 'none'; }, 3000);
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
        const resetUrl = `${window.location.origin}/reset-password.html`;
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

// ── Mobile Phone & Real SMS Code Verification Flow ──
let pendingPhoneData = null;

window.toggleEditPhone = function(showEdit) {
    const linkedBox = document.getElementById('phone-linked-box');
    const step1 = document.getElementById('phone-step-1');
    const step2 = document.getElementById('phone-step-2');
    if (showEdit) {
        if (linkedBox) linkedBox.style.display = 'none';
        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
    } else {
        if (linkedBox) linkedBox.style.display = 'block';
        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'none';
    }
    playSfx('click');
};

window.sendPhoneVerificationCode = async function() {
    if (!currentUser) return;

    const countryCode = document.getElementById('phone-country-code').value;
    const rawNumber = document.getElementById('phone-number-input').value.trim();
    const btn = document.getElementById('btn-send-phone-code');

    if (!rawNumber) {
        playSfx('error');
        window.showToast("Please enter a mobile phone number.", "error");
        return;
    }

    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 7) {
        playSfx('error');
        window.showToast("Please enter a valid phone number.", "error");
        return;
    }

    const fullPhoneNumber = `${countryCode}${cleanNumber}`;
    const displayPhone = `${countryCode} ${rawNumber}`;

    btn.disabled = true;
    btn.innerText = "Dispatching SMS Code...";

    try {
        let usedProvider = 'firebase';
        let confirmationResult = null;

        // Ensure invisible reCAPTCHA verifier for Firebase live SMS
        try {
            if (!window.recaptchaVerifier) {
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    'size': 'invisible',
                    'callback': () => {}
                });
            }

            // Attempt to dispatch real SMS via Google Firebase Phone Auth carrier
            confirmationResult = await linkWithPhoneNumber(currentUser, fullPhoneNumber, window.recaptchaVerifier);
            window.phoneConfirmationResult = confirmationResult;
            window.lastDemoHint = null;
        } catch (firebaseErr) {
            console.warn("Firebase Phone Auth dispatch note:", firebaseErr);
            if (window.recaptchaVerifier) {
                try { window.recaptchaVerifier.clear(); } catch(e) {}
                window.recaptchaVerifier = null;
            }

            if (firebaseErr.code === 'auth/credential-already-in-use') {
                throw new Error("This phone number is already linked to another CrimX account.");
            } else if (firebaseErr.code === 'auth/invalid-phone-number') {
                throw new Error("Invalid phone number format. Please check your country code and digits.");
            } else if (firebaseErr.code === 'auth/quota-exceeded') {
                throw new Error("Daily SMS quota exceeded. Please try again later.");
            }

            // If Phone Auth is not enabled in Firebase Console, fallback to backend SMS service
            const res = await fetch('/api/sms/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: fullPhoneNumber, uid: currentUser.uid })
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || "Failed to dispatch SMS verification code.");
            }

            usedProvider = 'backend';
            window.phoneConfirmationResult = null;
            window.lastDemoHint = data.demoHint;
        }

        pendingPhoneData = {
            fullNumber: fullPhoneNumber,
            displayPhone: displayPhone,
            countryCode: countryCode,
            rawNumber: rawNumber,
            usedProvider: usedProvider,
            forwardCodes: document.getElementById('pref-forward-codes').checked,
            smsAlerts: document.getElementById('pref-sms-alerts').checked
        };

        // Transition to Step 2 (Code Entry)
        document.getElementById('phone-step-1').style.display = 'none';
        const step2 = document.getElementById('phone-step-2');
        step2.style.display = 'block';

        const desc = document.getElementById('phone-step-2-desc');
        if (desc) {
            if (usedProvider === 'firebase') {
                desc.innerText = `A real SMS text message with a 6-digit verification code was dispatched to ${displayPhone} via cellular network. Enter the code below:`;
            } else {
                desc.innerText = `We dispatched a 6-digit SMS verification code to ${displayPhone}. Enter the code below:`;
            }
        }

        const codeInput = document.getElementById('phone-verify-code-input');
        codeInput.value = "";
        codeInput.focus();

        playSfx('success');
        if (usedProvider === 'firebase') {
            window.showToast(`Real SMS code dispatched to ${displayPhone}! Check your text messages.`, "success");
        } else if (window.lastDemoHint) {
            window.showToast(`SMS Code dispatched! (For live carrier SMS, enable Phone in Firebase Console. Hint: ${window.lastDemoHint})`, "info");
        } else {
            window.showToast(`Verification code dispatched to ${displayPhone}!`, "success");
        }
    } catch(err) {
        playSfx('error');
        window.showToast(err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "📲 Send Verification Code";
    }
};

window.confirmPhoneVerificationCode = async function() {
    if (!currentUser || !pendingPhoneData) return;

    const code = document.getElementById('phone-verify-code-input').value.trim();
    const btn = document.getElementById('btn-confirm-phone-code');

    if (!code || code.length !== 6) {
        playSfx('error');
        window.showToast("Please enter the complete 6-digit verification code.", "error");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Verifying Code...";

    try {
        if (pendingPhoneData.usedProvider === 'firebase' && window.phoneConfirmationResult) {
            // Confirm real code via Firebase Phone Auth
            await window.phoneConfirmationResult.confirm(code);
        } else {
            // Confirm code via backend
            const res = await fetch('/api/sms/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: pendingPhoneData.fullNumber, code: code, uid: currentUser.uid })
            });
            const data = await res.json();

            if (!data.success || !data.verified) {
                throw new Error(data.error || "Incorrect verification code.");
            }
        }

        // Save officially verified phone number to Firestore
        await setDoc(doc(db, "users", currentUser.uid), {
            phone: pendingPhoneData.displayPhone,
            phoneE164: pendingPhoneData.fullNumber,
            phoneCountryCode: pendingPhoneData.countryCode,
            phoneNumberRaw: pendingPhoneData.rawNumber,
            phoneVerified: true,
            forwardCodesToPhone: pendingPhoneData.forwardCodes,
            smsAlertsEnabled: pendingPhoneData.smsAlerts,
            phoneLinkedAt: serverTimestamp()
        }, { merge: true });

        // Update UI
        document.getElementById('phone-step-2').style.display = 'none';
        document.getElementById('phone-linked-box').style.display = 'block';
        document.getElementById('linked-phone-number-display').innerText = pendingPhoneData.displayPhone;

        playSfx('success');
        window.showToast("Phone verified and linked successfully! SMS code forwarding is now active.", "success");
        pendingPhoneData = null;
        window.phoneConfirmationResult = null;
    } catch(err) {
        playSfx('error');
        window.showToast(err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "✓ Verify & Link Phone";
    }
};

window.cancelPhoneVerification = function() {
    pendingPhoneData = null;
    window.phoneConfirmationResult = null;
    document.getElementById('phone-step-2').style.display = 'none';
    document.getElementById('phone-step-1').style.display = 'block';
    playSfx('click');
};

window.unlinkPhoneNumber = async function() {
    if (!currentUser) return;
    if (!confirm("Are you sure you want to remove your phone number? SMS code forwarding will be disabled.")) return;

    try {
        if (currentUser.providerData && currentUser.providerData.some(p => p.providerId === 'phone')) {
            try {
                await unlink(currentUser, 'phone');
            } catch(e) {
                console.warn("Firebase phone unlink warning:", e.message);
            }
        }

        await updateDoc(doc(db, "users", currentUser.uid), {
            phone: null,
            phoneE164: null,
            phoneCountryCode: null,
            phoneNumberRaw: null,
            phoneVerified: false,
            forwardCodesToPhone: false,
            smsAlertsEnabled: false
        });

        document.getElementById('phone-number-input').value = "";
        document.getElementById('phone-linked-box').style.display = 'none';
        document.getElementById('phone-step-1').style.display = 'block';
        document.getElementById('phone-step-2').style.display = 'none';
        playSfx('click');
        window.showToast("Phone number unlinked.", "info");
    } catch(err) {
        playSfx('error');
        window.showToast("Failed to unlink phone: " + err.message, "error");
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
        const resetUrl = `${window.location.origin}/reset-password.html`;
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

// ── Discord Integration ──
window.generateDiscordLinkCode = async function() {
    if(!currentUser) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString(); 
    await setDoc(doc(db, "users", currentUser.uid), { linkCode: code }, { merge: true });
    const display = document.getElementById('discord-link-code-display');
    display.style.display = 'block'; 
    display.innerText = `DM the bot: !link ${code}`;
    playSfx('click');
    window.showToast("Link code generated! DM the CrimsonFlame bot on Discord.", "info");
};

window.unlinkDiscord = async function() {
    if(!currentUser) return;
    await updateDoc(doc(db, "users", currentUser.uid), { discordId: null, discordUsername: null, discordAvatar: null, linkCode: null });
    playSfx('click');
    window.showToast("Discord account unlinked.", "info");
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

// ── Auth State Listener & Realtime Sync ──
let userDocUnsub = null;

onAuthStateChanged(auth, user => {
    if (user && (user.emailVerified || user.providerData.some(p => p.providerId === 'google.com'))) {
        currentUser = user;
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('dashboard-container').style.display = 'block';

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

        // Form initial values
        const nameVal = user.displayName || user.email.split('@')[0];
        document.getElementById('display-name').value = user.displayName || "";
        document.getElementById('dashboard-pfp-preview').src = user.photoURL || DEFAULT_PFP;
        document.getElementById('preview-avatar').src = user.photoURL || DEFAULT_PFP;
        document.getElementById('sidebar-user-avatar').src = user.photoURL || DEFAULT_PFP;

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

        // Realtime Firestore synchronization
        if (userDocUnsub) userDocUnsub();
        userDocUnsub = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
            if(docSnap.exists()) {
                const data = docSnap.data();

                // Input fields
                if (data.username) document.getElementById('username-input').value = data.username;
                if (data.displayName) document.getElementById('display-name').value = data.displayName;
                if (data.statusText) document.getElementById('status-text-input').value = data.statusText;
                if (data.bio) document.getElementById('bio-input').value = data.bio;

                // Banner
                if (data.banner) {
                    currentBannerStyle = data.banner;
                    const pBanner = document.getElementById('preview-banner');
                    const bPreviewImg = document.getElementById('banner-preview-img');
                    const bBox = document.getElementById('banner-uploader-box');

                    if (data.banner.startsWith('http')) {
                        currentBannerIsImage = true;
                        if (pBanner) { pBanner.style.backgroundImage = `url('${data.banner}')`; pBanner.style.backgroundSize = "cover"; }
                        if (bPreviewImg) { bPreviewImg.src = data.banner; bPreviewImg.style.display = 'block'; }
                    } else {
                        currentBannerIsImage = false;
                        if (pBanner) { pBanner.style.background = data.banner; pBanner.style.backgroundImage = ""; }
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

                // Phone & SMS Forwarding Data
                const phoneLinkedBox = document.getElementById('phone-linked-box');
                const phoneStep1 = document.getElementById('phone-step-1');
                const phoneStep2 = document.getElementById('phone-step-2');
                const linkedPhoneDisplay = document.getElementById('linked-phone-number-display');

                if (data.phone && data.phoneVerified !== false) {
                    if (phoneLinkedBox) phoneLinkedBox.style.display = 'block';
                    if (phoneStep1) phoneStep1.style.display = 'none';
                    if (phoneStep2) phoneStep2.style.display = 'none';
                    if (linkedPhoneDisplay) linkedPhoneDisplay.innerText = data.phone;
                } else {
                    if (phoneLinkedBox) phoneLinkedBox.style.display = 'none';
                    if (phoneStep1) phoneStep1.style.display = 'block';
                    if (phoneStep2) phoneStep2.style.display = 'none';
                }

                if (data.phone) {
                    const phoneInput = document.getElementById('phone-number-input');
                    const countrySelect = document.getElementById('phone-country-code');
                    if (phoneInput && data.phoneNumberRaw) phoneInput.value = data.phoneNumberRaw;
                    if (countrySelect && data.phoneCountryCode) countrySelect.value = data.phoneCountryCode;
                    
                    const fwdEl = document.getElementById('pref-forward-codes');
                    if (fwdEl && data.forwardCodesToPhone !== undefined) fwdEl.checked = data.forwardCodesToPhone;
                    const smsEl = document.getElementById('pref-sms-alerts');
                    if (smsEl && data.smsAlertsEnabled !== undefined) smsEl.checked = data.smsAlertsEnabled;
                }

                // Role Verification (Assigned strictly in Firebase/Firestore: isStaff / isDev / role)
                const isStaff = data.isStaff === true || data.staff === true || data.role === 'staff' || data.role === 'admin';
                const isDev = data.isDev === true || data.dev === true || data.developer === true || data.isDeveloper === true || data.role === 'developer' || data.role === 'dev';
                const previewStaffBadge = document.getElementById('preview-staff-badge');
                const previewDevBadge = document.getElementById('preview-dev-badge');
                const sidebarRoleBadge = document.getElementById('sidebar-role-badge');

                if (previewStaffBadge) previewStaffBadge.style.display = isStaff ? 'inline-flex' : 'none';
                if (previewDevBadge) previewDevBadge.style.display = isDev ? 'inline-flex' : 'none';

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
                if(data.discordId) {
                    document.getElementById('discord-unlinked').style.display = 'none';
                    document.getElementById('discord-linked').style.display = 'flex';
                    document.getElementById('discord-username').innerText = `@${data.discordUsername}`;
                    document.getElementById('discord-avatar').src = data.discordAvatar || DEFAULT_PFP;
                    if (previewDiscordChip) previewDiscordChip.classList.add('active');
                    if (previewDiscordText) previewDiscordText.innerText = `Discord: @${data.discordUsername}`;
                } else {
                    document.getElementById('discord-unlinked').style.display = 'block';
                    document.getElementById('discord-linked').style.display = 'none';
                    if (previewDiscordChip) previewDiscordChip.classList.remove('active');
                    if (previewDiscordText) previewDiscordText.innerText = "Discord: Unlinked";
                }

                window.updateLivePreview();
            }
        });

        window.loadConnectedApps();
        window.updateLivePreview();
    } else {
        currentUser = null;
        document.getElementById('login-container').style.display = 'block';
        document.getElementById('dashboard-container').style.display = 'none';
        if (userDocUnsub) { userDocUnsub(); userDocUnsub = null; }
    }
});
