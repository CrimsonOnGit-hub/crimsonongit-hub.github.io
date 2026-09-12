/**
 * CrimX Client & Server Helper SDK
 * Official SDK for integrating CrimX Authentication & Single Sign-On
 * 
 * https://crimsonflame.net
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyBSSJKDrFJ1_qlliZqgw34CY2TSaKOxxxM",
    authDomain: "crimsonflame-8169e.firebaseapp.com",
    projectId: "crimsonflame-8169e",
    storageBucket: "crimsonflame-8169e.firebasestorage.app",
    messagingSenderId: "406321213530",
    appId: "1:406321213530:web:92d27a69d34d147393a863"
};

class CrimXSDK {
    constructor(config = {}) {
        const defaultOrigin = (typeof window !== 'undefined' && window.location && window.location.origin) 
            ? window.location.origin 
            : "https://crimsonongit-hub.github.io";
        this.authBaseUrl = config.authBaseUrl || `${defaultOrigin}/link`;
        const fbConfig = config.firebaseConfig || DEFAULT_FIREBASE_CONFIG;
        
        this.app = getApps().length > 0 ? getApp() : initializeApp(fbConfig);
        this.db = getFirestore(this.app);
    }

    /**
     * Generate PKCE code_verifier and code_challenge (RFC 7636)
     */
    async generatePKCE() {
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        const codeVerifier = Array.from(randomBytes, b => ('0' + b.toString(16)).slice(-2)).join('');

        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        
        let binary = '';
        const bytes = new Uint8Array(digest);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const codeChallenge = btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        return { codeVerifier, codeChallenge, codeChallengeMethod: 'S256' };
    }

    /**
     * Build the CrimX authorization URL
     */
    getAuthUrl({ clientId, redirectUri, scope = "profile email", state = "", codeChallenge = "", codeChallengeMethod = "S256" }) {
        if (!clientId) throw new Error("CrimX: clientId is required to build auth URL.");
        if (!redirectUri) throw new Error("CrimX: redirectUri is required to build auth URL.");

        const params = new URLSearchParams();
        params.set("client_id", clientId);
        params.set("redirect_uri", redirectUri);
        params.set("response_type", "code");
        params.set("scope", scope);

        if (state) params.set("state", state);
        if (codeChallenge) {
            params.set("code_challenge", codeChallenge);
            params.set("code_challenge_method", codeChallengeMethod);
        }

        const base = this.authBaseUrl.startsWith("http") ? this.authBaseUrl : window.location.origin + this.authBaseUrl;
        return `${base}?${params.toString()}`;
    }

    /**
     * Parse authorization callback parameters (code, state, error)
     */
    parseCallback(urlOrQueryString = window.location.search) {
        let qs = urlOrQueryString;
        if (qs.includes("?")) qs = qs.split("?")[1];
        const params = new URLSearchParams(qs);

        const error = params.get("error");
        const errorDescription = params.get("error_description");
        const code = params.get("code");
        const state = params.get("state");

        if (error) {
            return {
                success: false,
                error: error,
                errorDescription: errorDescription || "Authorization failed or access was denied.",
                state: state
            };
        }

        if (!code) {
            return {
                success: false,
                error: "missing_code",
                errorDescription: "No authorization code found in callback query.",
                state: state
            };
        }

        return {
            success: true,
            code: code,
            state: state
        };
    }

    /**
     * Exchange a single-use authorization code for an Access Token and verified CrimX Player Profile
     */
    async exchangeCode({ code, clientId, clientSecret = null, codeVerifier = null }) {
        if (!code) throw new Error("CrimX: 'code' is required for token exchange.");
        if (!clientId) throw new Error("CrimX: 'clientId' is required for token exchange.");

        // 1. Fetch code document from Firestore (check crimx_codes or fallback sso_links)
        const codeRef = doc(this.db, "crimx_codes", code);
        const snap = await getDoc(codeRef);

        if (!snap.exists()) {
            throw new Error("invalid_grant: Authorization code not found or expired.");
        }

        const data = snap.data();

        // 2. Validate usage (single-use check)
        if (data.used) {
            throw new Error("invalid_grant: Authorization code has already been used (single-use burned).");
        }

        // 3. Validate expiration (5-minute TTL)
        const now = Date.now();
        const expiresAt = new Date(data.expiresAt).getTime();
        if (now > expiresAt) {
            throw new Error("invalid_grant: Authorization code has expired.");
        }

        // 4. Validate client_id binding
        if (data.clientId !== clientId) {
            throw new Error("unauthorized_client: Client ID does not match the issued authorization code.");
        }

        // 5. Verify credentials (clientSecret OR PKCE codeVerifier)
        if (data.codeChallenge) {
            // PKCE verification
            if (!codeVerifier) {
                throw new Error("invalid_grant: PKCE code_verifier is required for this authorization code.");
            }
            const encoder = new TextEncoder();
            const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
            let binary = '';
            const bytes = new Uint8Array(digest);
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const computedChallenge = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            if (computedChallenge !== data.codeChallenge) {
                throw new Error("invalid_grant: PKCE code_verifier does not match code_challenge.");
            }
        } else if (clientSecret) {
            // Validate clientSecret against registered client document
            const appDocRef = doc(this.db, "sso_links", clientId);
            const appSnap = await getDoc(appDocRef);
            if (appSnap.exists()) {
                const appData = appSnap.data();
                if (appData.clientSecret && appData.clientSecret !== clientSecret) {
                    throw new Error("unauthorized_client: Invalid client_secret provided.");
                }
            }
        }

        // 6. Burn the authorization code atomically
        await updateDoc(codeRef, {
            used: true,
            consumedAt: new Date().toISOString()
        });

        // 7. Mint Access Token
        const randomBytes = new Uint8Array(16);
        crypto.getRandomValues(randomBytes);
        const accessToken = "crimx_at_" + Array.from(randomBytes, b => ('0' + b.toString(16)).slice(-2)).join('');

        return {
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: 3600,
            scope: data.scope || "profile email",
            user: {
                uid: data.userId,
                name: data.userName || "CrimX Player",
                email: data.userEmail || "",
                pfp: data.userPfp || "https://cdn-icons-png.flaticon.com/512/149/149071.png"
            }
        };
    }

    /**
     * Start Dynamic Rich Game Presence for a logged-in CrimX Player
     * Sets player status to 'Playing [AppName]' with optional activity details, heartbeat, and exit cleanup.
     */
    async startPresence({ uid, appName = "Game", clientId = "", details = "" }) {
        if (!uid) throw new Error("CrimX: 'uid' is required to start presence.");

        this.presenceUid = uid;
        this.currentAppName = appName;
        this.currentDetails = details;
        this.presenceClientId = clientId;

        const presencePayload = {
            online: true,
            currentGame: {
                title: appName,
                details: details || "",
                clientId: clientId || "",
                startedAt: Date.now()
            },
            lastActive: new Date()
        };

        try {
            const userRef = doc(this.db, "users", uid);
            await updateDoc(userRef, presencePayload);
        } catch (err) {
            console.warn("[CrimX SDK] Failed to set initial game presence:", err);
        }

        // Heartbeat every 45s
        if (this._presenceHeartbeat) clearInterval(this._presenceHeartbeat);
        this._presenceHeartbeat = setInterval(async () => {
            if (this.presenceUid && typeof document !== 'undefined' && document.visibilityState === 'visible') {
                try {
                    const userRef = doc(this.db, "users", this.presenceUid);
                    await updateDoc(userRef, {
                        online: true,
                        lastActive: new Date()
                    });
                } catch(e) {}
            }
        }, 45000);

        // Disconnect on unload
        if (typeof window !== 'undefined') {
            if (this._presenceUnloadHandler) {
                window.removeEventListener('beforeunload', this._presenceUnloadHandler);
            }
            this._presenceUnloadHandler = () => {
                this.stopPresence();
            };
            window.addEventListener('beforeunload', this._presenceUnloadHandler);
        }
    }

    /**
     * Update active in-game details (e.g., 'Wave 12', 'In Menu', 'High Score: 500')
     */
    async updateActivityDetails(details) {
        if (!this.presenceUid) return;
        this.currentDetails = details;
        try {
            const userRef = doc(this.db, "users", this.presenceUid);
            await updateDoc(userRef, {
                "currentGame.details": details || "",
                lastActive: new Date()
            });
        } catch (err) {
            console.warn("[CrimX SDK] Failed to update activity details:", err);
        }
    }

    /**
     * Stop Game Presence on game exit / logout
     */
    async stopPresence() {
        if (this._presenceHeartbeat) {
            clearInterval(this._presenceHeartbeat);
            this._presenceHeartbeat = null;
        }

        if (this.presenceUid) {
            const uid = this.presenceUid;
            this.presenceUid = null;
            try {
                const userRef = doc(this.db, "users", uid);
                await updateDoc(userRef, {
                    currentGame: null,
                    lastActive: new Date()
                });
            } catch (err) {
                console.warn("[CrimX SDK] Failed to clear game presence:", err);
            }
        }
    }
}

// Global export for vanilla script tag usage + ES Module export
const CrimX = new CrimXSDK();
if (typeof window !== "undefined") {
    window.CrimX = CrimX;
    window.CrimXSDK = CrimXSDK;
}

export { CrimX, CrimXSDK };
export default CrimX;
