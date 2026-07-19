/**
 * FLIXO - C2C Escrow & AI Dispute Filtering System
 * Interactive Simulator Application Logic (v6 - Full Customizations)
 */

// Paste your Typhoon API Key here:
const TYPHOON_API_KEY = "sk-7Z2baWyqhbFJzcxRQBp6ug9ZaBniaSqLrI9hBszFtl5MF1vG";

// Paste your Firebase Credentials here:
const firebaseConfig = {
  apiKey: "AIzaSyDQSm4FPvRiRdDLk6l6VvyOwvsbrOUefSQ",
  authDomain: "project-flixo-app.firebaseapp.com",
  projectId: "project-flixo-app",
  storageBucket: "project-flixo-app.firebasestorage.app",
  messagingSenderId: "445690741298",
  appId: "1:445690741298:web:b36d997ef086577579322b",
  measurementId: "G-9KXCJL2XXK"
};

// Check if Firebase credentials are provided
let isFirebaseEnabled = false;
let db = null;
let auth = null;
let recaptchaVerifier = null;
let confirmationResult = null;

if (typeof firebase !== 'undefined' && firebaseConfig.projectId && firebaseConfig.apiKey) {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        isFirebaseEnabled = true;
        console.log("✓ FLIXO: Firebase Connected (Firestore + Phone Auth).");
    } catch (err) {
        console.error("❌ FLIXO: Firebase initialization failed:", err);
    }
} else {
    console.log("ℹ FLIXO: Running in Local Simulator Mode.");
}

// Theme handling
function initTheme() {
    const savedTheme = localStorage.getItem('flixo_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        const icon = document.querySelector('#theme-toggle-btn i');
        if (icon) icon.className = 'fa-solid fa-sun';
    }
}
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('flixo_theme', isDark ? 'dark' : 'light');
    const icon = document.querySelector('#theme-toggle-btn i');
    if (icon) {
        icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}
initTheme();

// Local State Store
let state = {
    // Session State
    loginStep: 'phone',
    loggedInUser: null,
    otpCode: '',
    activeTab: 'dashboard',
    
    // Search State
    searchQuery: '',
    searchResult: null,
    
    // Active Room State
    rooms: [],
    activeRoomId: null,
    activeRoomMessages: [],
    
    // Deal management
    pinnedRooms: [],
    archivedRooms: [],
    closedRooms: [],
    deletedRooms: [],
    archivedDisputes: [],
    showArchivedDisputes: false,
    showArchived: false,
    notifTimestamps: {},
    
    // Admin queues
    kycQueue: [],
    disputes: [],
    activeDisputeId: null,
    adminDisputeMessages: [],
    
    // KYC file cache
    mockFiles: {
        idCard: null,
        selfie: null
    }
};

// Base64 upload cache for dispute
let disputeEvidenceBase64 = null;

// Database of Mock Users in System (Formatted as XXX-XXX ID)
const MOCK_USERS = [
    {
        id: '109-281',
        name: 'คุณมานี มีขาย',
        phone: '0819981092',
        kycStatus: 'verified',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=manee'
    },
    {
        id: '884-902',
        name: 'คุณสมศักดิ์ รักดี',
        phone: '0892238849',
        kycStatus: 'unverified',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=somsak'
    },
    {
        id: '204-188',
        name: 'คุณวิชัย ใจกล้า',
        phone: '0851212041',
        kycStatus: 'verified',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=wichai'
    },
    // Admin Master Account
    {
        id: '000-001',
        name: 'FLIXO Administrator',
        phone: '0830158022',
        kycStatus: 'verified',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'
    }
];

// Mock Photos for uploads
const MOCK_PHOTOS = {
    idCard: 'https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?w=400&auto=format&fit=crop&q=60',
    idCardFail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=60',
    selfie: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=60',
    selfieFail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=60',
    
    product: {
        game: '🎮',
        gadget: '📱',
        shirt: '👕'
    },
    evidence: {
        'broken-gadget': 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&auto=format&fit=crop&q=60',
        'empty-box': 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=400&auto=format&fit=crop&q=60',
        'chat-block': 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&auto=format&fit=crop&q=60'
    }
};

// Real-time Database Unsubscribe Listeners
let activeUnsubscribers = {
    rooms: null,
    messages: null,
    kyc: null,
    disputes: null
};

// Initial Setup
window.addEventListener('DOMContentLoaded', () => {
    setupOtpAutofocus();
    setupIdInputMask();
    
    // Check for saved session to auto-login
    try {
        const savedSession = localStorage.getItem('flixo_saved_session');
        if (savedSession) {
            document.getElementById('login-container').style.display = 'none'; // Prevent flash
            const data = JSON.parse(savedSession);
            handleUserSessionInit(data.identifier, data.displayName, data.photoURL);
        } else if (isFirebaseEnabled && typeof auth !== 'undefined' && auth) {
            auth.onAuthStateChanged(user => {
                if (user) {
                    handleUserSessionInit(user.email || user.phoneNumber, user.displayName, user.photoURL);
                }
            });
        }
    } catch(e) { console.error("Auto login error:", e); }

    // Update Firebase connection indicators
    updateFirebaseStatusBadge();
    
    // Auto scroll chat list
    const msgContainer = document.getElementById('active-chat-messages');
    if (msgContainer) {
        msgContainer.addEventListener('DOMSubtreeModified', () => {
            msgContainer.scrollTop = msgContainer.scrollHeight;
        });
    }

    // Live word count for proposal description
    document.addEventListener('input', function(e) {
        if (e.target && e.target.id === 'prop-desc') {
            updateWordCount();
        }
    });
});

function updateFirebaseStatusBadge() {
    const badge = document.getElementById('firebase-status-badge');
    const banner = document.getElementById('firebase-setup-banner');
    
    if (isFirebaseEnabled) {
        badge.className = 'badge badge-outline status-green';
        badge.innerHTML = '<i class="fa-solid fa-cloud text-green"></i> Real-time Firebase Connected';
        if (banner) banner.style.display = 'none';
    } else {
        badge.className = 'badge badge-outline';
        badge.innerHTML = '<i class="fa-solid fa-cloud-slash text-coral"></i> Local Sim Mode';
        if (banner) banner.style.display = 'flex';
    }
}

function setupOtpAutofocus() {
    const digits = document.querySelectorAll('.otp-digit');
    digits.forEach((digit, index) => {
        digit.addEventListener('input', (e) => {
            if (digit.value.length === 1 && index < digits.length - 1) {
                digits[index + 1].focus();
            }
        });
        digit.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && digit.value.length === 0 && index > 0) {
                digits[index - 1].focus();
            }
        });
    });
}

function setupIdInputMask() {
    const input = document.getElementById('search-user-id');
    if (!input) return;
    input.addEventListener('input', () => {
        let val = input.value.replace(/\D/g, '');
        if (val.length > 3) {
            input.value = val.slice(0, 3) + '-' + val.slice(3, 6);
        } else {
            input.value = val.slice(0, 3);
        }
    });
}

function getFormattedTime() {
    return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function handleLoginKeypress(event, step) {
    if (event.key === 'Enter') {
        if (step === 'phone') requestOtp();
        else if (step === 'otp') verifyOtp();
    }
}

function handleDealChatKeypress(event) {
    if (event.key === 'Enter') {
        sendDealMessage();
    }
}

// SMS notification gate
function triggerSmsNotification(code) {
    const div = document.getElementById('sms-notification');
    document.getElementById('sms-otp-code').innerText = code;
    div.style.display = 'block';
    
    div.classList.remove('sms-bounce');
    void div.offsetWidth;
    div.classList.add('sms-bounce');
}

function closeSmsNotification() {
    document.getElementById('sms-notification').style.display = 'none';
}

function showToast(message, type = 'success') {
    const existing = document.getElementById('flixo-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.id = 'flixo-toast';
    toast.innerText = message;
    toast.style.cssText = `
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        background: ${type === 'success' ? 'rgba(34,197,94,0.92)' : 'rgba(239,68,68,0.92)'};
        color: #fff; padding: 14px 28px; border-radius: 50px;
        font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 600;
        box-shadow: 0 8px 32px rgba(0,0,0,0.35); z-index: 9999;
        backdrop-filter: blur(12px); transition: opacity 0.4s ease;
        white-space: nowrap;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; }, 2500);
    setTimeout(() => { toast.remove(); }, 3000);
}


// ==========================================================================
// User Authentication (Google Sign-In)
// ==========================================================================

function loginWithGoogle() {
    console.log("Button clicked, isFirebaseEnabled:", isFirebaseEnabled, "auth:", !!auth);
    if (isFirebaseEnabled && auth) {
        const btn = document.getElementById('btn-login-google');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span style="font-weight: 500;">กำลังเปิดหน้าต่าง Google...</span>';
        btn.disabled = true;

        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then((result) => {
                const user = result.user;
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                handleUserSessionInit(user.email, user.displayName, user.photoURL);
            })
            .catch((err) => {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                console.error("Google Sign-in error:", err);
                if (err.code === 'auth/popup-blocked') {
                    alert('⚠️ เบราว์เซอร์ของคุณบล็อกหน้าต่าง Pop-up กรุณาอนุญาต Pop-up สำหรับเว็บนี้ครับ');
                } else if (err.code === 'auth/unauthorized-domain') {
                    alert('⚠️ โดเมนยังไม่ได้รับอนุญาต คุณต้องไปเพิ่มโดเมนนี้ในหน้า Authorized domains ใน Firebase Auth');
                } else if (err.code === 'auth/web-storage-unsupported') {
                    alert('⚠️ เบราว์เซอร์ของคุณบล็อกคุกกี้ (Third-party cookies) กรุณาปิดการบล็อกคุกกี้ครับ');
                } else {
                    alert('⚠️ เกิดข้อผิดพลาดจาก Firebase Auth: ' + err.message);
                }
            });
    } else {
        console.warn("Firebase not configured");
    }
}

function handleUserSessionInit(identifier, displayName, photoURL) {
    if (!identifier) identifier = 'unknown@flixo.com';
    const cleanId = identifier.toLowerCase();
    const isEmail = cleanId.includes('@');
    const searchField = isEmail ? 'email' : 'phone';
    
    if (isFirebaseEnabled) {
        db.collection('users').where(searchField, '==', cleanId).get()
            .then(querySnapshot => {
                let user;
                if (querySnapshot.empty) {
                    if (cleanId === 'tawannatv@gmail.com' || cleanId === '0830158022' || cleanId === '0831058022') {
                        user = {
                            id: '000-001',
                            name: 'FLIXO Administrator',
                            [searchField]: cleanId,
                            kycStatus: 'verified',
                            avatar: photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=admin`
                        };
                    } else {
                        const part1 = Math.floor(100 + Math.random() * 900).toString();
                        const part2 = Math.floor(100 + Math.random() * 900).toString();
                        const id = `${part1}-${part2}`;
                        
                        user = {
                            id: id,
                            name: displayName || `User ${id}`,
                            [searchField]: cleanId,
                            kycStatus: 'unverified',
                            avatar: photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanId}`
                        };
                    }
                    
                    db.collection('users').doc(user.id).set(user)
                        .then(() => { enterMainApp(user); });
                } else {
                    user = querySnapshot.docs[0].data();
                    if (cleanId === 'tawannatv@gmail.com' || cleanId === '0830158022' || cleanId === '0831058022') {
                        user.kycStatus = 'verified';
                        if (photoURL && user.avatar && user.avatar.includes('dicebear')) {
                            user.avatar = photoURL;
                            db.collection('users').doc(user.id).update({ avatar: photoURL });
                        }
                    }
                    enterMainApp(user);
                }
            })
            .catch(err => {
                console.error("Firestore error:", err);
                let msg = err.message;
                if (msg.includes('Missing or insufficient permissions')) {
                    msg = 'ไม่มีสิทธิ์เข้าถึงฐานข้อมูล (Permission Denied) - โปรดตั้งค่า Firestore Security Rules เป็น allow read, write: if true;';
                }
                alert("เกิดข้อผิดพลาดจาก Firebase Firestore:\n" + msg);
            });
    } else {
        fallbackLocalLogin(cleanId, displayName, photoURL);
    }
}

function fallbackLocalLogin(identifier, displayName, photoURL) {
    const isEmail = identifier.includes('@');
    const searchField = isEmail ? 'email' : 'phone';

    let user = MOCK_USERS.find(u => u[searchField] === identifier);
    if (!user) {
        const id = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
        user = {
            id: id,
            name: displayName || `User ${id}`,
            [searchField]: identifier,
            kycStatus: 'unverified',
            avatar: photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${identifier}`
        };
        MOCK_USERS.push(user);
    }
    if (user.email === 'tawannatv@gmail.com' || user.phone === '0830158022' || user.phone === '0831058022') {
        user.kycStatus = 'verified';
    }
    enterMainApp(user);
}

function forceLocalAdminLogin() {
    console.log("Forcing local admin login bypass...");
    const btn = document.getElementById('btn-login-google');
    if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบจำลอง...';
    setTimeout(() => {
        fallbackLocalLogin('tawannatv@gmail.com', 'FLIXO Administrator', 'https://api.dicebear.com/7.x/bottts/svg?seed=admin');
    }, 500);
}

// ==========================================================================
// Phone OTP Auth Additions
// ==========================================================================

function setupRecaptcha() {
    if (!auth) return;
    if (recaptchaVerifier) return;
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: () => { console.log("✓ reCAPTCHA passed"); },
        'expired-callback': () => { recaptchaVerifier = null; }
    });
}

function requestOtp() {
    const input = document.getElementById('login-phone');
    const phone = input.value.trim();
    
    if (phone.length < 9 || isNaN(phone)) {
        alert('กรุณากรอกเบอร์โทรศัพท์ 9-10 หลักให้ถูกต้อง');
        return;
    }
    
    if (phone === '0830158022' || phone === '0831058022') {
        showToast('🔓 [Admin Bypass]: เข้าสู่ระบบแอดมินทันทีโดยไม่ใช้ OTP', 'success');
        handleUserSessionInit(phone);
        return;
    }
    
    if (isFirebaseEnabled && auth) {
        const formattedPhone = '+66' + phone.replace(/^0/, '');
        setupRecaptcha();
        
        const btn = document.getElementById('btn-request-otp');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่ง SMS...';
        btn.disabled = true;
        
        auth.signInWithPhoneNumber(formattedPhone, recaptchaVerifier)
            .then(result => {
                confirmationResult = result;
                document.getElementById('otp-phone-display').innerText = formatPhoneNumber(phone);
                document.getElementById('login-step-phone').classList.remove('active');
                document.getElementById('login-step-otp').classList.add('active');
                btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> รับรหัส OTP';
                btn.disabled = false;
                setTimeout(() => document.getElementById('otp-single-input').focus(), 400);
            })
            .catch(err => {
                btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> รับรหัส OTP';
                btn.disabled = false;
                recaptchaVerifier = null;
                console.error("SMS error:", err);
                
                let msg = 'เกิดข้อผิดพลาดในการส่ง SMS';
                if (err.code === 'auth/invalid-phone-number') msg = 'รูปแบบเบอร์โทรไม่ถูกต้อง';
                if (err.code === 'auth/too-many-requests') msg = 'ส่ง OTP บ่อยเกินไป กรุณารอสักครู่';
                if (err.code === 'auth/captcha-check-failed') msg = 'reCAPTCHA ล้มเหลว กรุณารีเฟรชหน้าแล้วลองใหม่';
                alert('❌ ' + msg);
            });
    } else {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        state.otpCode = otp;
        document.getElementById('otp-phone-display').innerText = formatPhoneNumber(phone);
        document.getElementById('login-step-phone').classList.remove('active');
        document.getElementById('login-step-otp').classList.add('active');
        setTimeout(() => {
            triggerSmsNotification(otp);
            const otpInput = document.getElementById('otp-single-input');
            if (otpInput) { otpInput.value = ''; otpInput.focus(); }
        }, 400);
    }
}

function verifyOtp() {
    const otpInput = document.getElementById('otp-single-input');
    const entered = otpInput ? otpInput.value.trim() : '';
    
    if (entered.length < 6) {
        alert('กรุณากรอกรหัส OTP ให้ครบ 6 หลัก');
        return;
    }
    
    const phone = document.getElementById('login-phone').value.trim();
    
    if (isFirebaseEnabled && auth && confirmationResult) {
        const btn = document.getElementById('btn-verify-otp');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังยืนยัน...';
        btn.disabled = true;
        
        confirmationResult.confirm(entered)
            .then(() => {
                btn.innerHTML = '<i class="fa-solid fa-lock-open"></i> ยืนยันรหัส OTP และเข้าสู่ระบบ';
                btn.disabled = false;
                confirmationResult = null;
                closeSmsNotification();
                handleUserSessionInit(phone);
            })
            .catch(err => {
                btn.innerHTML = '<i class="fa-solid fa-lock-open"></i> ยืนยันรหัส OTP และเข้าสู่ระบบ';
                btn.disabled = false;
                console.error("OTP verify error:", err);
                
                let msg = 'รหัส OTP ไม่ถูกต้อง';
                if (err.code === 'auth/code-expired') msg = 'รหัส OTP หมดอายุแล้ว กรุณากดขอรหัสใหม่';
                if (err.code === 'auth/invalid-verification-code') msg = 'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่';
                alert('❌ ' + msg);
                if (otpInput) { otpInput.value = ''; otpInput.focus(); }
            });
    } else {
        if (entered !== state.otpCode) {
            alert('รหัส OTP ไม่ถูกต้อง ดูรหัสจากป๊อปอัปสีส้มด้านบนหน้าจอ');
            if (otpInput) { otpInput.value = ''; otpInput.focus(); }
            return;
        }
        closeSmsNotification();
        handleUserSessionInit(phone);
    }
}

function goBackToPhone() {
    confirmationResult = null;
    recaptchaVerifier = null;
    const otpInput = document.getElementById('otp-single-input');
    if (otpInput) otpInput.value = '';
    document.getElementById('login-step-otp').classList.remove('active');
    document.getElementById('login-step-phone').classList.add('active');
}

function enterMainApp(user) {
    state.loggedInUser = user;
    state.loginStep = 'app';
    
    // Save session for auto-login on refresh
    try {
        localStorage.setItem('flixo_saved_session', JSON.stringify({ identifier: user.email || user.phone, displayName: user.name, photoURL: user.avatar }));
    } catch(e) {}
    
    // Load persistent user preferences from localStorage
    try {
        const storedArchived = localStorage.getItem(`flixo_archived_rooms_${user.id}`);
        state.archivedRooms = storedArchived ? JSON.parse(storedArchived) : [];
        
        const storedPinned = localStorage.getItem(`flixo_pinned_rooms_${user.id}`);
        state.pinnedRooms = storedPinned ? JSON.parse(storedPinned) : [];
        
        const storedClosed = localStorage.getItem(`flixo_closed_rooms_${user.id}`);
        state.closedRooms = storedClosed ? JSON.parse(storedClosed) : [];
        
        const storedDeleted = localStorage.getItem(`flixo_deleted_rooms_${user.id}`);
        state.deletedRooms = storedDeleted ? JSON.parse(storedDeleted) : [];
    } catch (e) {
        console.error("Error loading localStorage preferences:", e);
    }
    
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    
    document.getElementById('user-id-display').innerText = `ID: ${user.id}`;
    document.getElementById('user-avatar-img').src = user.avatar;
    const displayId = document.getElementById('user-display-id');
    if (displayId) displayId.innerText = user.id;
    const profileName = document.getElementById('profile-name-display');
    if (profileName) profileName.innerText = `คุณ ${user.name || user.id}`;
    
    // Switch view
    changeAppTab('dashboard');
    
    // Initialize Real-time Database Listeners if available
    initRealtimeListeners();
    
    updateViews();
    
    // Show smooth toast instead of disruptive alert
    showToast(`✓ เข้าสู่ระบบสำเร็จ! ID: ${user.id}`, 'success');
}

function logout() {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
        try { localStorage.removeItem('flixo_saved_session'); } catch(e) {}
        if (typeof auth !== 'undefined' && auth) auth.signOut();
        
        unsubscribeAllListeners();
        
        state.loggedInUser = null;
        state.loginStep = 'phone';
        state.rooms = [];
        state.activeRoomId = null;
        state.searchQuery = '';
        state.searchResult = null;
        state.archivedRooms = [];
        state.pinnedRooms = [];
        state.closedRooms = [];
        state.deletedRooms = [];
        
        document.getElementById('login-phone').value = '';
        const otpInput = document.getElementById('otp-single-input');
        if (otpInput) otpInput.value = '';
        
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('login-step-otp').classList.remove('active');
        document.getElementById('login-step-phone').classList.add('active');
        closeSmsNotification();
    }
}

function formatPhoneNumber(num) {
    if (num.length === 10) {
        return `${num.slice(0,3)}-${num.slice(3,6)}-${num.slice(6)}`;
    }
    return num;
}

// ==========================================================================
// Database Synchronizers (Multiplayer Realtime vs Fallback Local)
// ==========================================================================

function initRealtimeListeners() {
    if (!isFirebaseEnabled || !state.loggedInUser) return;
    
    // 1. Listen to User Deals (Rooms where user is either buyer or seller)
    activeUnsubscribers.rooms = db.collection('rooms')
        .where('ids', 'array-contains', state.loggedInUser.id)
        .onSnapshot(snapshot => {
            let roomsList = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                data.id = doc.id;
                data.activeRole = (data.buyerId === state.loggedInUser.id) ? 'buyer' : 'seller';
                roomsList.push(data);
            });
            state.rooms = roomsList;
            
            // Auto-select room if none is currently selected and rooms exist
            if (!state.activeRoomId && roomsList.length > 0) {
                state.activeRoomId = roomsList[0].id;
            }
            
            // Re-render sidebar & active chat details
            renderDealsSidebar();
            renderDealChatWindow();
        }, err => {
            console.error("Rooms listener error:", err);
        });
        
    // 2. Listen to Admin KYC Requests Queue
    activeUnsubscribers.kyc = db.collection('kycQueue')
        .onSnapshot(snapshot => {
            let queue = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                data.id = doc.id;
                queue.push(data);
            });
            state.kycQueue = queue;
            renderAdminPanel();
        });

    // 3. Listen to Admin Dispute Tickets List
    activeUnsubscribers.disputes = db.collection('disputes')
        .onSnapshot(snapshot => {
            let list = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                data.id = doc.id;
                list.push(data);
            });
            state.disputes = list;
            renderAdminPanel();
        });
}

function unsubscribeAllListeners() {
    for (let key in activeUnsubscribers) {
        if (activeUnsubscribers[key]) {
            activeUnsubscribers[key]();
            activeUnsubscribers[key] = null;
        }
    }
}

// Setup real-time listener for current chat room messages (using clientTimestamp to prevent local null timestamp bugs)
function listenToActiveChatMessages(roomId) {
    if (activeUnsubscribers.messages) {
        activeUnsubscribers.messages();
        activeUnsubscribers.messages = null;
    }
    
    if (!isFirebaseEnabled) {
        const room = state.rooms.find(r => r.id === roomId);
        state.activeRoomMessages = room ? room.messages : [];
        // Always render the full chat window (so input area / disabled state is up-to-date)
        renderDealChatWindow();
        renderActiveChatMessagesUI();
        return;
    }
    
    // Firebase path: render window frame first so input area appears
    renderDealChatWindow();
    
    activeUnsubscribers.messages = db.collection('rooms').doc(roomId)
        .collection('messages').orderBy('clientTimestamp')
        .onSnapshot(snapshot => {
            let msgs = [];
            snapshot.forEach(doc => {
                msgs.push(doc.data());
            });
            state.activeRoomMessages = msgs;
            renderActiveChatMessagesUI();
        });
}

// ==========================================================================
// Dashboard Search & Initiate Deal Logic (1.3.2.2)
// ==========================================================================

function fillSearch(val) {
    document.getElementById('search-user-id').value = val;
    searchUser();
}

function handleSearchKeypress(event) {
    if (event.key === 'Enter') {
        searchUser();
    }
}

function searchUser() {
    const input = document.getElementById('search-user-id').value.trim();
    if (!input) {
        alert('กรุณากรอกรหัสสมาชิก ID คู่ค้าในรูปแบบ XXX-XXX');
        return;
    }
    
    if (input === state.loggedInUser.id) {
        alert('ไม่สามารถเปิดดีลกับตัวเองได้');
        return;
    }
    
    if (isFirebaseEnabled) {
        db.collection('users').doc(input).get()
            .then(doc => {
                if (doc.exists) {
                    showSearchResult(doc.data());
                } else {
                    const localUser = MOCK_USERS.find(u => u.id === input);
                    if (localUser) showSearchResult(localUser);
                    else alert('ไม่พบผู้ใช้รหัสนี้ในฐานข้อมูลคลาวด์');
                }
            })
            .catch(err => {
                console.error("Search error:", err);
            });
    } else {
        const user = MOCK_USERS.find(u => u.id === input || u.phone === input);
        if (user) showSearchResult(user);
        else alert('ไม่พบรหัสผู้ใช้จำลองนี้ในระบบ');
    }
}

function showSearchResult(user) {
    state.searchResult = user;
    
    document.getElementById('result-user-avatar').src = user.avatar;
    document.getElementById('result-user-name').innerText = user.name;
    document.getElementById('result-user-id-text').innerText = `ID: ${user.id} (${formatPhoneNumber(user.phone)})`;
    
    const kycBadge = document.getElementById('result-user-kyc');
    if (user.kycStatus === 'verified') {
        kycBadge.className = 'badge badge-outline status-green';
        kycBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> ยืนยัน e-KYC แล้ว';
    } else {
        kycBadge.className = 'badge badge-outline status-red';
        kycBadge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> ยังไม่ยืนยัน e-KYC';
    }
    
    document.getElementById('search-result-card').style.display = 'block';
    const inst = document.querySelector('.instruction-list');
    if (inst) inst.style.display = 'none';
}

function initiateDeal(role) {
    const partner = state.searchResult;
    if (!partner) return;
    
    // MANDATORY KYC VERIFICATION: Everyone must verify KYC except Admins (0830158022 or 0831058022)
    const isAdmin = state.loggedInUser.phone === '0830158022' || state.loggedInUser.phone === '0831058022';
    if (!isAdmin && state.loggedInUser.kycStatus !== 'verified') {
        alert('ระเบียบความปลอดภัย: สมาชิกทั่วไปทุกคนต้องผ่านการยืนยันตัวตน (e-KYC) ให้สำเร็จก่อนเริ่มดีลซื้อขายในระบบ FLIXO');
        openKycModal();
        return;
    }
    
    const buyerName = role === 'buyer' ? state.loggedInUser.name : partner.name;
    const buyerId = role === 'buyer' ? state.loggedInUser.id : partner.id;
    const sellerName = role === 'seller' ? state.loggedInUser.name : partner.name;
    const sellerId = role === 'seller' ? state.loggedInUser.id : partner.id;
    
    const topic = `ดีลซื้อขายระหว่างผู้ขาย ${sellerName} และผู้ซื้อ ${buyerName}`;
    
    if (isFirebaseEnabled) {
        db.collection('rooms')
            .where('ids', 'array-contains', state.loggedInUser.id)
            .get()
            .then(querySnapshot => {
                let existingRoom = null;
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.buyerId === buyerId && data.sellerId === sellerId && data.status !== 'closed') {
                        existingRoom = doc;
                    }
                });
                
                if (existingRoom) {
                    state.activeRoomId = existingRoom.id;
                    changeAppTab('deals');
                    return;
                }
                
                const newDoc = {
                    ids: [buyerId, sellerId],
                    buyerName, buyerId,
                    sellerName, sellerId,
                    topic,
                    escrowStatus: 'none',
                    escrowAmount: 0,
                    escrowMoneyState: 'ยังไม่มีการชำระเงิน',
                    hasDispute: false,
                    dispute: null
                };
                
                db.collection('rooms').add(newDoc)
                    .then(docRef => {
                        state.activeRoomId = docRef.id;
                        docRef.collection('messages').add({
                            sender: 'system',
                            text: `ห้องแชทซื้อขายคุ้มครองโดย FLIXO`,
                            timestamp: getFormattedTime(),
                            clientTimestamp: Date.now(),
                            serverTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                            isSystem: true
                        });
                        
                        changeAppTab('deals');
                    });
            });
    } else {
        let activeDeal = state.rooms.find(r => 
            ((r.buyerId === state.loggedInUser.id && r.sellerId === partner.id && role === 'buyer') ||
            (r.sellerId === state.loggedInUser.id && r.buyerId === partner.id && role === 'seller')) &&
            !state.closedRooms.includes(r.id) && r.status !== 'closed'
        );
        
        if (activeDeal) {
            activeDeal.activeRole = role;
            state.activeRoomId = activeDeal.id;
            changeAppTab('deals');
            updateViews();
            return;
        }
        
        const dealId = state.rooms.length + 1;
        const newRoom = {
            id: dealId,
            buyerName, buyerId,
            sellerName, sellerId,
            topic,
            escrowStatus: 'none',
            escrowAmount: 0,
            escrowMoneyState: 'ยังไม่มีการโอนเงินกักเก็บ',
            hasDispute: false,
            dispute: null,
            activeRole: role,
            messages: [
                { sender: 'system', text: `ห้องแชทซื้อขายคุ้มครองโดย FLIXO`, timestamp: getFormattedTime(), clientTimestamp: Date.now(), isSystem: true }
            ]
        };
        state.rooms.push(newRoom);
        state.activeRoomId = dealId;
        
        changeAppTab('deals');
        updateViews();
        
        if (role === 'buyer') {
            setTimeout(() => {
                newRoom.messages.push({
                    sender: sellerId,
                    text: 'สวัสดีครับ ปล่อยดีลคุ้มครองโดยบัญชีตัวกลางของ FLIXO ปลอดภัยแน่นอน เดี๋ยวผมออกใบเสนอราคาให้นะครับ',
                    timestamp: getFormattedTime(),
                    clientTimestamp: Date.now() + 10
                });
                updateViews();
            }, 1000);
        }
    }
    
    document.getElementById('search-user-id').value = '';
    document.getElementById('search-result-card').style.display = 'none';
    const inst = document.querySelector('.instruction-list');
    if (inst) inst.style.display = 'block';
    state.searchResult = null;
}

// ==========================================================================
// Unified Core Navigation & Tab Router
// ==========================================================================

function changeAppTab(tab) {
    // SECURITY ACCESS CONTROL: Only phone 0830158022 or 0831058022 can access admin tab (Frontend protection)
    if (tab === 'admin') {
        const isAdmin = state.loggedInUser && (state.loggedInUser.phone === '0830158022' || state.loggedInUser.phone === '0831058022');
        if (!isAdmin) {
            alert('❌ [ความปลอดภัย FLIXO]: ปฏิเสธการเข้าถึง! บัญชีของคุณไม่มีสิทธิ์เข้าใช้งานระบบผู้ดูแลระบบ (Admin Only)');
            return; // Block navigation
        }
    }
    
    state.activeTab = tab;
    
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    document.querySelectorAll('.role-panel').forEach(p => p.classList.remove('active'));
    
    if (tab === 'dashboard') {
        document.getElementById('panel-dashboard').classList.add('active');
    } else if (tab === 'deals') {
        document.getElementById('panel-deals').classList.add('active');
    } else if (tab === 'admin') {
        document.getElementById('panel-admin').classList.add('active');
    }
    
    updateViews();
}

function updateViews() {
    if (state.loginStep !== 'app') return;
    
    const isAdmin = state.loggedInUser && (state.loggedInUser.phone === '0830158022' || state.loggedInUser.phone === '0831058022');
    
    // Toggle Admin Portal tab button visibility in the header dynamically
    const adminTabBtn = document.getElementById('tab-admin');
    if (adminTabBtn) {
        adminTabBtn.style.display = isAdmin ? 'flex' : 'none';
    }
    
    // Toggle Simulator Bar visibility dynamically (visible only to admin)
    const simBar = document.getElementById('admin-simulator-bar');
    if (simBar) {
        simBar.style.display = isAdmin ? 'flex' : 'none';
    }
    
    renderProfileKyc();
    renderDealsSidebar();
    
    if (state.activeRoomId) {
        listenToActiveChatMessages(state.activeRoomId);
    } else {
        renderDealChatWindow();
    }
    
    renderAdminPanel();
    if (state.loggedInUser) updateBankInfoDisplay();
}

function renderProfileKyc() {
    const kycBadge = document.getElementById('user-kyc-status');
    const dashboardKycBox = document.getElementById('dashboard-kyc-status-text');
    const dashboardKycBadge = document.getElementById('dashboard-kyc-status-badge');
    const dashboardKycBtn = document.getElementById('btn-kyc-dashboard-trigger');
    const dashboardAvatar = document.getElementById('dashboard-avatar-img');
    
    if (dashboardAvatar && state.loggedInUser) {
        dashboardAvatar.src = state.loggedInUser.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user';
    }
    
    if (state.loggedInUser.kycStatus === 'verified') {
        if(kycBadge) {
            kycBadge.className = 'badge badge-outline status-green';
            kycBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> ยืนยัน e-KYC แล้ว';
        }
        if(dashboardKycBox) {
            dashboardKycBox.className = 'profile-kyc-status-text text-center mt-10 verified status-green';
            dashboardKycBox.innerHTML = '<i class="fa-solid fa-circle-check"></i> ยืนยันตัวตนสำเร็จแล้ว (มีสิทธิ์ทำสัญญาในระบบ)';
        }
        if(dashboardKycBadge) {
            dashboardKycBadge.className = 'badge badge-outline status-green';
            dashboardKycBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> ยืนยัน e-KYC แล้ว';
        }
        if(dashboardKycBtn) dashboardKycBtn.style.display = 'none';
    } else if (state.loggedInUser.kycStatus === 'pending') {
        if(kycBadge) {
            kycBadge.className = 'badge badge-outline text-warning';
            kycBadge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> รอดำเนินการ';
        }
        if(dashboardKycBox) {
            dashboardKycBox.className = 'profile-kyc-status-text text-center mt-10 text-warning';
            dashboardKycBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> เอกสารกำลังรอตรวจสอบโดยผู้ดูแลระบบ';
        }
        if(dashboardKycBtn) dashboardKycBtn.style.display = 'none';
    } else if (state.loggedInUser.kycStatus === 'failed') {
        if(kycBadge) {
            kycBadge.className = 'badge badge-outline status-red';
            kycBadge.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ยื่นตรวจไม่ผ่าน';
        }
        if(dashboardKycBox) {
            dashboardKycBox.className = 'profile-kyc-status-text text-center mt-10 status-red';
            dashboardKycBox.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ตรวจสอบล้มเหลว กรุณายื่นเอกสารอีกครั้ง';
        }
        if(dashboardKycBtn) dashboardKycBtn.style.display = 'block';
    } else {
        if(kycBadge) {
            kycBadge.className = 'badge badge-outline';
            kycBadge.innerHTML = '<i class="fa-solid fa-circle-xmark status-red"></i> ยังไม่ได้ยืนยัน e-KYC';
        }
        if(dashboardKycBox) {
            dashboardKycBox.className = 'profile-kyc-status-text text-center mt-10';
            dashboardKycBox.innerHTML = 'ยังไม่ได้ยืนยันตัวตน';
        }
        if(dashboardKycBadge) {
            dashboardKycBadge.className = 'badge badge-outline status-red';
            dashboardKycBadge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> ยังไม่ได้ยืนยันตัวตน';
        }
        if(dashboardKycBtn) dashboardKycBtn.style.display = 'block';
    }
}

function renderDealsSidebar() {
    const listDiv = document.getElementById('user-chat-list');
    const badgeCount = document.getElementById('user-deal-badge');
    
    // Close any open context menus
    document.querySelectorAll('.deal-context-menu').forEach(m => m.remove());
    
    const visibleRooms = state.rooms.filter(r => {
        if (state.deletedRooms && state.deletedRooms.includes(r.id)) return false;
        return state.showArchived ? state.archivedRooms.includes(r.id) : !state.archivedRooms.includes(r.id);
    });
    
    // Sort: pinned first
    visibleRooms.sort((a, b) => {
        const aPinned = state.pinnedRooms.includes(a.id) ? 1 : 0;
        const bPinned = state.pinnedRooms.includes(b.id) ? 1 : 0;
        return bPinned - aPinned;
    });
    
    // Archive button highlight
    const archiveBtn = document.getElementById('btn-show-archived');
    if (archiveBtn) archiveBtn.style.color = state.showArchived ? '#f97316' : '';
    
    const nonArchived = state.rooms.filter(r => !state.archivedRooms.includes(r.id)).length;
    badgeCount.innerText = nonArchived;
    badgeCount.style.display = nonArchived > 0 ? 'block' : 'none';
    
    if (visibleRooms.length === 0) {
        listDiv.innerHTML = `<div class="text-center text-muted p-10 font-12">${state.showArchived ? 'ไม่มีดีลที่เก็บไว้' : 'ไม่มีดีลซื้อขายที่กำลังดำเนินการ'}</div>`;
        return;
    }
    
    let html = '';
    visibleRooms.forEach(room => {
        const isBuyer = room.buyerId === state.loggedInUser.id;
        const partnerName = isBuyer ? room.sellerName : room.buyerName;
        const isPinned = state.pinnedRooms.includes(room.id);
        const isArchived = state.archivedRooms.includes(room.id);
        
        let statusBadge = '';
        if (room.escrowStatus === 'held') statusBadge = '<span class="chat-item-badge held">กักเก็บเงิน</span>';
        else if (room.escrowStatus === 'released') statusBadge = '<span class="chat-item-badge released">โอนเงินแล้ว</span>';
        else if (room.escrowStatus === 'suspended') statusBadge = '<span class="chat-item-badge suspended">ระงับดีล</span>';
        
        const isActive = state.activeRoomId === room.id ? 'active' : '';
        const roleText = isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย';
        const partnerId = isBuyer ? room.sellerId : room.buyerId;
        const pinIcon = isPinned ? '<i class="fa-solid fa-thumbtack pin-icon" title="ปักหมุดอยู่"></i>' : '';
        
        html += `
            <div class="chat-item ${isActive}" id="chat-item-${room.id}" onclick="selectRoom('${room.id}')">
                <div class="chat-item-header">
                    <span class="chat-item-title">${pinIcon}ID ${partnerId || 'Unknown'} ${roleText}</span>
                    <div style="display:flex;align-items:center;gap:5px;flex-shrink:0" onclick="event.stopPropagation()">
                        <button class="btn-deal-menu" onclick="openDealMenu(event,'${room.id}')" title="ตัวเลือก">
                            <i class="fa-solid fa-ellipsis"></i>
                        </button>
                    </div>
                </div>
                <div class="chat-item-preview">(คลิกเพื่อเข้าห้องเจรจาสัญญาซื้อขาย)</div>
            </div>
        `;
    });
    listDiv.innerHTML = html;
}

function openDealMenu(e, roomId) {
    e.stopPropagation();
    document.querySelectorAll('.deal-context-menu').forEach(m => m.remove());
    
    const isPinned = state.pinnedRooms.includes(roomId);
    const isArchived = state.archivedRooms.includes(roomId);
    const isClosed = state.closedRooms.includes(roomId);
    const room = state.rooms.find(r => r.id === roomId);
    const canClose = room && room.escrowStatus === 'released';
    
    const menu = document.createElement('div');
    menu.className = 'deal-context-menu';
    menu.innerHTML = `
        <div class="deal-menu-item" onclick="togglePinRoom('${roomId}')">
            <i class="fa-solid fa-thumbtack"></i> ${isPinned ? 'Unpin' : 'Pin'}
        </div>
        <div class="deal-menu-item deal-menu-archive" onclick="toggleArchiveRoom('${roomId}')">
            <i class="fa-solid fa-box-archive"></i> ${isArchived ? 'Unarchive' : 'Archive'}
        </div>
        <div class="deal-menu-sep"></div>
        <div class="deal-menu-item deal-menu-close" onclick="deleteRoom('${roomId}')">
            <i class="fa-solid fa-trash"></i> Delete
        </div>
    `;
    
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    menu.style.cssText = `position:fixed;top:${rect.bottom+4}px;right:${window.innerWidth - rect.right}px;z-index:9999;`;
    document.body.appendChild(menu);
    
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 10);
}

function closeDeal(roomId) {
    document.querySelectorAll('.deal-context-menu').forEach(m => m.remove());
    const room = state.rooms.find(r => r.id === roomId);
    if (!room || room.escrowStatus !== 'released') {
        showToast('❌ ปิดได้เพียงเมื่อโอนเงินเสร็จแล้ว', 'error');
        return;
    }
    state.closedRooms.push(roomId);
    if (state.loggedInUser) {
        localStorage.setItem(`flixo_closed_rooms_${state.loggedInUser.id}`, JSON.stringify(state.closedRooms));
    }
    // Auto-archive
    if (!state.archivedRooms.includes(roomId)) {
        state.archivedRooms.push(roomId);
        if (state.loggedInUser) {
            localStorage.setItem(`flixo_archived_rooms_${state.loggedInUser.id}`, JSON.stringify(state.archivedRooms));
        }
    }
    if (state.activeRoomId === roomId) state.activeRoomId = null;
    
    const closeMsg = {
        id: `close-${Date.now()}`,
        senderId: 'SYSTEM',
        text: '✅ ดีลนี้เสร็จสิ้นแล้ว ขอบคุณที่ใช้บริการ FLIXO Escrow',
        timestamp: Date.now(),
        type: 'system_close'
    };
    if (isFirebaseEnabled && db) {
        db.collection('rooms').doc(roomId).collection('messages').add(closeMsg);
        db.collection('rooms').doc(roomId).update({ status: 'closed' });
    } else {
        state.activeRoomMessages.push(closeMsg);
    }
    renderDealsSidebar();
    updateViews();
    showToast('✅ ปิดดีลเรียบร้อยแล้ว ประวัติแชทยังคงอยู่', 'success');
}

function getNickname(roomId) {
    try {
        const uid = state.loggedInUser ? state.loggedInUser.id : 'guest';
        const key = 'flixo_nicknames';
        const all = JSON.parse(localStorage.getItem(key) || '{}');
        return (all[uid] && all[uid][roomId]) ? all[uid][roomId] : null;
    } catch(e) { return null; }
}

function setRoomNickname(roomId) {
    document.querySelectorAll('.deal-context-menu').forEach(m => m.remove());
    const current = getNickname(roomId) || '';
    const name = prompt('ตั้งชื่ออ้างอิงสำหรับห้องนี้ (เฉพาะคุณที่เห็น):', current);
    if (name === null) return;
    try {
        const uid = state.loggedInUser.id;
        const key = 'flixo_nicknames';
        const all = JSON.parse(localStorage.getItem(key) || '{}');
        if (!all[uid]) all[uid] = {};
        if (name.trim() === '') {
            delete all[uid][roomId];
            showToast('ลบชื่ออ้างอิงแล้ว', 'success');
        } else {
            all[uid][roomId] = name.trim().slice(0, 30);
            showToast(`ตั้งชื่อ “${name.trim()}” เรียบร้อย`, 'success');
        }
        localStorage.setItem(key, JSON.stringify(all));
        renderDealsSidebar();
    } catch(e) { showToast('บันทึกชื่อไม่สำเร็จ', 'error'); }
}

function togglePinRoom(roomId) {
    document.querySelectorAll('.deal-context-menu').forEach(m => m.remove());
    const idx = state.pinnedRooms.indexOf(roomId);
    if (idx > -1) {
        state.pinnedRooms.splice(idx, 1);
        showToast('ยกเลิกปักหมุดแล้ว', 'success');
    } else {
        state.pinnedRooms.push(roomId);
        showToast('ปักหมุดดีลเรียบร้อยแล้ว ✔', 'success');
    }
    if (state.loggedInUser) {
        localStorage.setItem(`flixo_pinned_rooms_${state.loggedInUser.id}`, JSON.stringify(state.pinnedRooms));
    }
    renderDealsSidebar();
}

function toggleArchiveRoom(roomId) {
    document.querySelectorAll('.deal-context-menu').forEach(m => m.remove());
    const idx = state.archivedRooms.indexOf(roomId);
    if (idx > -1) {
        // Restore from archive: remove from archive list, switch to normal view
        state.archivedRooms.splice(idx, 1);
        state.showArchived = false;
        // Set active room first so renderDealChatWindow can find it
        state.activeRoomId = roomId;
        renderDealsSidebar();
        // Trigger full render including input area
        listenToActiveChatMessages(roomId);
        showToast('นำดีลกลับมาเรียบร้อยแล้ว ✔ สามารถส่งข้อความได้ตามปกติ', 'success');
    } else {
        state.archivedRooms.push(roomId);
        if (state.activeRoomId === roomId) state.activeRoomId = null;
        renderDealsSidebar();
        updateViews();
        showToast('เก็บดีลเรียบร้อยแล้ว (ประวัติแชทยังคงอยู่)', 'success');
    }
    if (state.loggedInUser) {
        localStorage.setItem(`flixo_archived_rooms_${state.loggedInUser.id}`, JSON.stringify(state.archivedRooms));
    }
}

function toggleShowArchived() {
    state.showArchived = !state.showArchived;
    renderDealsSidebar();
}

// ===== BELL NOTIFICATION =====
function playBellSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const times = [0, 0.18, 0.36];
        const freqs = [880, 1100, 880];
        times.forEach((t, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const distortion = ctx.createWaveShaper();
            
            // Add crunch/buzz effect
            const curve = new Float32Array(256);
            for (let j = 0; j < 256; j++) {
                const x = (j * 2) / 256 - 1;
                curve[j] = (Math.PI + 400) * x / (Math.PI + 400 * Math.abs(x));
            }
            distortion.curve = curve;
            
            osc.connect(distortion);
            distortion.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sawtooth';
            osc.frequency.value = freqs[i];
            gain.gain.setValueAtTime(0.7, ctx.currentTime + t);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
            osc.start(ctx.currentTime + t);
            osc.stop(ctx.currentTime + t + 0.15);
        });
    } catch(e) { console.warn('Audio not supported'); }
}

function sendNotifBell() {
    const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
    if (!activeRoom) return;
    
    const roomId = activeRoom.id;
    const now = Date.now();
    const windowMs = 2 * 60 * 1000; // 2 minutes
    const maxClicks = 3;
    
    if (!state.notifTimestamps[roomId]) state.notifTimestamps[roomId] = [];
    
    // Remove timestamps older than 2 minutes
    state.notifTimestamps[roomId] = state.notifTimestamps[roomId].filter(t => now - t < windowMs);
    
    if (state.notifTimestamps[roomId].length >= maxClicks) {
        const oldest = state.notifTimestamps[roomId][0];
        const waitSec = Math.ceil((windowMs - (now - oldest)) / 1000);
        const waitMin = Math.ceil(waitSec / 60);
        showToast(`❌ ส่งแจ้งเตือนได้สูงสุด 3 ครั้งแล้ว รอ ${waitSec < 60 ? waitSec + ' วินาที' : waitMin + ' นาที'}`, 'error');
        return;
    }
    
    state.notifTimestamps[roomId].push(now);
    const remaining = maxClicks - state.notifTimestamps[roomId].length;
    
    playBellSound();
    // Simulate partner device receiving the alert sound
    setTimeout(() => playBellSound(), 1500);
    
    const bellMsg = {
        id: `bell-${now}`,
        senderId: state.loggedInUser.id,
        senderName: state.loggedInUser.name,
        text: '🔔 ปิ๊น! แจ้งเตือนอีกฝ่ายว่าอยู่ในห้อง โปรดตอบกลับด้วย!',
        timestamp: now,
        type: 'bell'
    };
    
    if (isFirebaseEnabled && db) {
        db.collection('rooms').doc(roomId).collection('messages').add(bellMsg);
    } else {
        state.activeRoomMessages.push(bellMsg);
        updateViews();
    }
    
    // Animate bell button
    const btn = document.getElementById('btn-bell-notify');
    if (btn) {
        btn.classList.add('bell-ringing');
        setTimeout(() => btn.classList.remove('bell-ringing'), 600);
    }
    
    showToast(`ส่งสัญญาณแล้ว! เหลืออีก ${remaining} ครั้งใน 2 นาที`, 'success');
}

function selectRoom(id) {
    state.activeRoomId = id;
    updateViews();
}

function renderDealChatWindow() {
    const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
    
    const chatTitle = document.getElementById('active-room-title');
    const chatSubtitle = document.getElementById('active-room-subtitle');
    const badgeContainer = document.getElementById('active-escrow-badge-container');
    const chatMessages = document.getElementById('active-chat-messages');
    const inputArea = document.getElementById('active-input-area');
    const detailsPanel = document.getElementById('active-details-panel');
    
    if (!activeRoom) {
        inputArea.style.display = 'none';
        detailsPanel.style.display = 'none';
        chatTitle.innerText = 'เลือกดีลห้องแชทเพื่อตรวจสอบ';
        chatSubtitle.innerText = '-';
        badgeContainer.innerHTML = '';
        chatMessages.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-comments"></i>
                <p>เลือกดีลห้องแชทกลางด้านซ้าย เพื่อตรวจสอบและแชทเจรจาซื้อขายกักเก็บเงิน</p>
            </div>
        `;
        return;
    }
    
    inputArea.style.display = 'flex';
    detailsPanel.style.display = 'block';
    
    // Check ban status
    const banKey = `flixo_chat_banned_until_${state.loggedInUser.id}`;
    const bannedUntil = parseInt(localStorage.getItem(banKey) || '0');
    const inputField = document.getElementById('active-chat-input');
    const sendBtn = document.querySelector('.chat-input-area button.btn-primary');
    
    if (Date.now() < bannedUntil) {
        if (inputField) {
            inputField.disabled = true;
            inputField.placeholder = "ถูกระงับการแชทชั่วคราว...";
            inputField.value = '';
        }
        if (sendBtn) sendBtn.disabled = true;
    } else {
        if (inputField) {
            inputField.disabled = false;
            inputField.placeholder = "พิมพ์ข้อความเจรจา...";
        }
        if (sendBtn) sendBtn.disabled = false;
    }
    
    const isClosed = state.closedRooms.includes(activeRoom.id) || activeRoom.status === 'closed';
    const bellBtn = document.getElementById('btn-bell-notify');
    const chatInput = document.getElementById('active-chat-input');
    
    if (isClosed) {
        if (chatInput) { chatInput.disabled = true; chatInput.placeholder = 'ดีลนี้ปิดแล้ว ไม่สามารถส่งข้อความได้'; }
        if (sendBtn) sendBtn.disabled = true;
        if (bellBtn) bellBtn.disabled = true;
    } else {
        if (chatInput) { chatInput.disabled = false; chatInput.placeholder = 'พิมพ์ข้อความเจรจา...'; }
        if (sendBtn) sendBtn.disabled = false;
        if (bellBtn) bellBtn.disabled = false;
    }
    
    const isBuyer = activeRoom.buyerId === state.loggedInUser.id;
    const partnerId = isBuyer ? activeRoom.sellerId : activeRoom.buyerId;
    const partnerName = isBuyer ? activeRoom.sellerName : activeRoom.buyerName;
    
    chatTitle.innerHTML = `Negotiation with ${partnerName || 'Unknown User'}`;
    chatSubtitle.innerHTML = `Deal ID: <span id="deal-id-text" data-id="${activeRoom.id}">***</span> <button class="btn-icon" style="width:24px;height:24px;font-size:12px;display:inline-flex;margin-left:4px;" onclick="const el=document.getElementById('deal-id-text'); if(el.innerText==='***'){el.innerText=el.dataset.id; this.innerHTML='<i class=\\'fa-solid fa-eye-slash\\'></i>';}else{el.innerText='***'; this.innerHTML='<i class=\\'fa-solid fa-eye\\'></i>';}"><i class="fa-solid fa-eye"></i></button> | Buyer ID: ${activeRoom.buyerId}`;
    
    let escrowBadgeHtml = '';
    if (activeRoom.escrowStatus === 'held') {
        escrowBadgeHtml = '<span class="badge badge-success"><i class="fa-solid fa-vault"></i> เงินกักเก็บในระบบกลาง (Hold)</span>';
    } else if (activeRoom.escrowStatus === 'released') {
        escrowBadgeHtml = '<span class="badge badge-success bg-teal"><i class="fa-solid fa-check"></i> ดีลเสร็จสมบูรณ์ (Released)</span>';
    } else if (activeRoom.escrowStatus === 'suspended') {
        escrowBadgeHtml = '<span class="badge bg-red"><i class="fa-solid fa-triangle-exclamation"></i> ระงับเงิน/ข้อพิพาท (Suspended)</span>';
    } else {
        escrowBadgeHtml = '<span class="badge badge-outline">ยังไม่เริ่มชำระเงิน</span>';
    }
    badgeContainer.innerHTML = escrowBadgeHtml;
    
    // Render Right side Action panel
    const rightPanelTitle = document.getElementById('right-panel-title');
    const buyerPanel = document.getElementById('role-buyer-control');
    const sellerPanel = document.getElementById('role-seller-control');
    
    if (isBuyer) {
        rightPanelTitle.innerHTML = '<i class="fa-solid fa-vault"></i> บัญชีตัวกลางกักเก็บเงิน (Escrow)';
        sellerPanel.style.display = 'none';
        buyerPanel.style.display = 'block';
        
        const statusText = document.getElementById('user-escrow-status-text');
        const escrowPrice = document.getElementById('user-escrow-price');
        const moneyState = document.getElementById('user-escrow-money-state');
        const actionContainer = document.getElementById('user-escrow-actions');
        const infoCard = document.getElementById('user-escrow-info-card');
        
        escrowPrice.innerText = `฿${activeRoom.escrowAmount.toLocaleString()}`;
        
        if (activeRoom.escrowStatus === 'none') {
            statusText.innerText = 'ยังไม่มีธุรกรรม';
            infoCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center';
            moneyState.innerText = 'ไม่มีเงินชำระกักเก็บ';
            actionContainer.innerHTML = `<p class="text-muted font-11 text-center">รอผู้ขายสร้างรายการใบเสนอราคาในห้องแชท เพื่อเปิดหน้าต่างจ่ายเงิน</p>`;
        } else {
            if (activeRoom.escrowStatus === 'held') {
                statusText.innerText = 'กักเก็บในระบบ (Hold)';
                infoCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center held';
                moneyState.innerText = 'กักยอดเงินกลางแล้ว รอรับและเช็คสิทธิ์สินค้า';
                actionContainer.innerHTML = `
                    <button class="btn-success btn-block" onclick="confirmEscrowReceipt('${activeRoom.id}')">
                        <i class="fa-solid fa-circle-check"></i> ตรวจของครบแล้ว & ปล่อยเงินโอน
                    </button>
                    <button class="btn-danger btn-block" onclick="triggerOpenDisputeModal('${activeRoom.id}')">
                        <i class="fa-solid fa-triangle-exclamation"></i> แจ้งโดนโกง/เปิดข้อพิพาท
                    </button>
                `;
            } else if (activeRoom.escrowStatus === 'released') {
                statusText.innerText = 'โอนจ่ายแล้ว (Released)';
                infoCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center released';
                moneyState.innerText = 'โอนเงินเข้าบัญชีผู้ขายสำเร็จ';
                actionContainer.innerHTML = `<div class="alert-box alert-success text-center">ดีลสัญญาเสร็จสมบูรณ์เรียบร้อยแล้ว</div>`;
            } else if (activeRoom.escrowStatus === 'suspended') {
                statusText.innerText = 'ระงับความเสียหาย (Suspended)';
                infoCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center suspended';
                moneyState.innerText = 'ล็อกเงินกลางชั่วคราว อยู่ระหว่างตรวจสอบพยาน';
                actionContainer.innerHTML = `<div class="alert-box alert-warning">ดีลนี้ค้างส่งตรวจโดย AI & ผู้ดูแลคัดกรอง</div>`;
            }
        }
    } else {
        rightPanelTitle.innerHTML = '<i class="fa-solid fa-cart-plus"></i> ช่องสร้างข้อเสนอ';
        buyerPanel.style.display = 'none';
        sellerPanel.style.display = 'block';

        // Setup Seller Escrow Panel
        const sellerEscrowCard = document.getElementById('seller-escrow-info-card');
        const sellerStatusText = document.getElementById('seller-escrow-status-text');
        const sellerEscrowPrice = document.getElementById('seller-escrow-price');
        const sellerMoneyState = document.getElementById('seller-escrow-money-state');
        const sellerActionContainer = document.getElementById('seller-escrow-actions');
        
        if (activeRoom.escrowAmount > 0) {
            sellerEscrowCard.style.display = 'block';
            sellerEscrowPrice.innerText = `฿${activeRoom.escrowAmount.toLocaleString()}`;
            
            if (activeRoom.escrowStatus === 'held') {
                sellerStatusText.innerText = 'กักเก็บในระบบ (Hold)';
                sellerEscrowCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center held';
                sellerMoneyState.innerText = 'ผู้ซื้อชำระเงินเข้าส่วนกลางแล้ว';
                sellerActionContainer.innerHTML = `
                    <button class="btn-danger btn-block mt-10" onclick="triggerOpenDisputeModal('${activeRoom.id}')">
                        <i class="fa-solid fa-triangle-exclamation"></i> แจ้งโดนโกง/เปิดข้อพิพาท
                    </button>
                `;
            } else if (activeRoom.escrowStatus === 'released') {
                sellerStatusText.innerText = 'โอนจ่ายแล้ว (Released)';
                sellerEscrowCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center released';
                sellerMoneyState.innerText = 'ผู้ซื้อตรวจสอบและยืนยันรับสินค้าแล้ว';
                sellerActionContainer.innerHTML = `<div class="alert-box alert-success text-center">ระบบจะทำการโอนเข้าบัญชีของคุณภายใน 1 ชม.</div>`;
            } else if (activeRoom.escrowStatus === 'suspended') {
                sellerStatusText.innerText = 'ระงับความเสียหาย (Suspended)';
                sellerEscrowCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center suspended';
                sellerMoneyState.innerText = 'ล็อกเงินกลางชั่วคราว อยู่ระหว่างตรวจสอบพยาน';
                sellerActionContainer.innerHTML = `<div class="alert-box alert-warning">มีข้อพิพาทเกิดขึ้น รอการพิจารณาจาก AI/Admin</div>`;
            } else {
                sellerEscrowCard.style.display = 'none';
            }
        } else {
            sellerEscrowCard.style.display = 'none';
        }

        // Show tracking number form when buyer has paid and no tracking yet
        const trackingForm = document.getElementById('seller-tracking-form');
        if (trackingForm) {
            trackingForm.style.display = (activeRoom.escrowStatus === 'held' && !activeRoom.trackingNumber) ? 'block' : 'none';
        }
    }
    
    if (typeof updateProposalUI === 'function') updateProposalUI();
}

// Render active chat messages once fetched/synchronized
function renderActiveChatMessagesUI() {
    const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
    if (!activeRoom) return;
    
    const isBuyer = activeRoom.buyerId === state.loggedInUser.id;
    const chatMessages = document.getElementById('active-chat-messages');
    
    let messagesHtml = '';
    state.activeRoomMessages.forEach(msg => {
        if (msg.isSystem) {
            let classType = '';
            if (msg.escrowState === 'held') classType = 'held';
            if (msg.escrowState === 'released') classType = 'released';
            if (msg.escrowState === 'suspended') classType = 'suspended';
            
            messagesHtml += `
                <div class="msg-system">
                    <div class="system-alert ${classType}">
                        <i class="fa-solid fa-circle-info"></i>
                        <span>${msg.text}</span>
                    </div>
                </div>
            `;
        } else if (msg.isProposal) {
            const prop = msg.proposal;
            const imgChar = MOCK_PHOTOS.product[prop.imageType] || '📦';
            
            let btnActionHtml = '';
            if (isBuyer) {
                if (activeRoom.escrowStatus === 'none') {
                    const msgTs = msg.clientTimestamp;
                    btnActionHtml = `
                        <div class="proposal-payment-guide">
                            <p class="font-10 text-muted mb-5"><i class="fa-solid fa-circle-info"></i> กดเปิด QR บัญชีกลางแล้วยืนยันการโอนเงิน</p>
                            ${!prop.rejected ? `
                            <button class="btn-success btn-block" onclick="openPaymentQR('${activeRoom.id}', ${prop.price})">
                                <i class="fa-solid fa-qrcode"></i> เปิด QR แสกนชำระ (PromptPay)
                            </button>
                            <button class="btn-danger btn-block mt-5" onclick="rejectProposal('${activeRoom.id}', ${msgTs})">
                                <i class="fa-solid fa-xmark"></i> ปฏิเสธข้อเสนอนี้
                            </button>
                            ` : `<div class="alert-box alert-warning mt-5" style="justify-content:center;flex-direction:column;text-align:center;gap:4px;">
                                <i class="fa-solid fa-ban" style="font-size:18px;color:var(--danger);"></i>
                                <strong style="color:var(--danger);">ยกเลิกข้อเสนอนี้แล้ว</strong>
                                <span class="font-11 text-muted">รอผู้ขายส่งข้อเสนอราคาใหม่</span>
                            </div>`}
                        </div>
                    `;
                } else if (activeRoom.escrowStatus === 'held') {
                    btnActionHtml = `
                        <div class="alert-box alert-info text-center font-10">
                            <i class="fa-solid fa-vault"></i> เงินถูกกักในระบบแล้ว ตรวจสอบสิทธิ์สัญญากับคู่ค้าได้เลย
                        </div>
                    `;
                } else if (activeRoom.escrowStatus === 'released') {
                    btnActionHtml = `
                        <div class="alert-box alert-success text-center bg-teal text-white">
                            <i class="fa-solid fa-circle-check"></i> ดีลเสร็จสมบูรณ์ โอนเงินออกแล้ว
                        </div>
                    `;
                } else if (activeRoom.escrowStatus === 'suspended') {
                    btnActionHtml = `
                        <div class="alert-box alert-danger text-center bg-red text-white">
                            <i class="fa-solid fa-triangle-exclamation"></i> เงินกักเก็บถูกแช่ระงับ (ข้อพิพาท)
                        </div>
                    `;
                }
            } else {
                btnActionHtml = `
                    <div class="alert-box alert-info text-center">
                        <i class="fa-solid fa-store"></i> ใบเสนอราคาของคุณส่งออกไปแล้ว
                    </div>
                `;
            }
            
            messagesHtml += `
                <div class="msg-row ${msg.sender === state.loggedInUser.id ? 'buyer' : 'seller'}">
                    <div class="cart-proposal">
                        <div class="proposal-banner">
                            <i class="fa-solid fa-cart-shopping"></i> สัญญาซื้อขาย
                        </div>
                        <div class="proposal-item-box">
                            <div class="proposal-img">${imgChar}</div>
                            <div class="proposal-info">
                                <h4>${prop.name}</h4>
                                <p>${prop.desc}</p>
                                <div class="proposal-price-tag">฿${prop.price.toLocaleString()}</div>
                            </div>
                        </div>
                        <div class="proposal-footer">
                            <button class="btn-secondary btn-sm mb-5" style="width:100%" onclick="showProposalDetail(decodeURIComponent('${encodeURIComponent(JSON.stringify({name:prop.name,price:prop.price,category:prop.category,desc:prop.desc,imageBase64:prop.imageBase64}))  }'))"><i class="fa-solid fa-eye"></i> ดูรายละเอียดสินค้า</button>
                            ${btnActionHtml}
                        </div>
                    </div>
                </div>
            `;
        } else {
            const isSelf = msg.sender === state.loggedInUser.id;
            messagesHtml += `
                <div class="msg-row ${isSelf ? 'buyer' : 'seller'}">
                    <div class="msg-bubble">
                        <p>${msg.text}</p>
                        <span class="msg-meta">${msg.timestamp}</span>
                    </div>
                </div>
            `;
        }
    });
    
    chatMessages.innerHTML = messagesHtml;
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (typeof updateProposalUI === 'function') updateProposalUI();
}

async function sendDealMessage() {
    const input = document.getElementById('active-chat-input');
    const sendBtn = document.querySelector('.chat-input-area button.btn-primary');
    const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
    
    if (!activeRoom || !input.value.trim()) return;
    
    const userId = state.loggedInUser.id;
    const banKey = `flixo_chat_banned_until_${userId}`;
    const bannedUntil = parseInt(localStorage.getItem(banKey) || '0');
    
    if (Date.now() < bannedUntil) {
        const minutesLeft = Math.ceil((bannedUntil - Date.now()) / 60000);
        showToast(`🚫 คุณถูกระงับการแชทชั่วคราว เหลือเวลาอีก ${minutesLeft} นาที`, 'error');
        return;
    }
    
    const text = input.value.trim();
    
    // UI Loading state
    const originalBtnHtml = sendBtn ? sendBtn.innerHTML : '';
    input.disabled = true;
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }
    
    const isClean = await checkMessageFilter(text);
    
    if (!isClean) {
        input.disabled = false;
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalBtnHtml;
        }
        handleChatWarning();
        return;
    }
    
    input.disabled = false;
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalBtnHtml;
    }
    input.value = '';
    
    const newMsg = {
        sender: state.loggedInUser.id,
        text: text,
        timestamp: getFormattedTime(),
        clientTimestamp: Date.now() // Sort key client-side
    };
    
    if (isFirebaseEnabled) {
        db.collection('rooms').doc(activeRoom.id).collection('messages').add({
            ...newMsg,
            serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } else {
        activeRoom.messages.push(newMsg);
        state.activeRoomMessages = activeRoom.messages;
        renderActiveChatMessagesUI();
        
        setTimeout(() => {
            handleAutoResponseSimulation(activeRoom, text);
        }, 1500);
    }
}

function handleAutoResponseSimulation(room, text) {
    const isBuyer = room.buyerId === state.loggedInUser.id;
    const partnerId = isBuyer ? room.sellerId : room.buyerId;
    
    if (text.toLowerCase().includes('ช่วย') || text.toLowerCase().includes('บอท') || text.includes('bot')) {
        simulateChatbotResponse(room, 'ระบบป้องกันภัยของ FLIXO ยินดีต้อนรับ! เมื่อผู้ซื้อโอนเงินกักเก็บสำเร็จ ระบบจะล็อกเงินและกักเก็บไว้ที่ตัวกลางจนกว่าคุณจะกดปล่อยเงินให้ผู้ขาย กรุณาตรวจสอบสิทธิ์อย่างละเอียดก่อนกดยืนยันปล่อยเงินนะครับ');
        return;
    }
    
    if (isBuyer) {
        if (text.includes('เท่าไหร่') || text.includes('ราคา')) {
            room.messages.push({
                sender: partnerId,
                text: 'สเปคนี้ผมขอราคาดีลเน็ตๆ ที่ 3,500 บาทครับ ปลอดภัยผ่านตัวกลางของ FLIXO เดี๋ยวผมกดสร้างข้อเสนอส่งในแชทให้นะครับ',
                timestamp: getFormattedTime(),
                clientTimestamp: Date.now()
            });
            updateViews();
        } else if (text.includes('โอนแล้ว') || text.includes('จ่ายแล้ว')) {
            room.messages.push({
                sender: partnerId,
                text: 'ขอบคุณที่ไว้ใจใช้ FLIXO ครับ! ระบบแจ้งกักยอดแล้ว ข้อมูลไอดีของผมคือ: flixo_pro_game@gmail.com / Pass: Flix8899201 ครับ ลองเข้าระบบไปยืนยันตัวตนเช็คสกินได้เลย',
                timestamp: getFormattedTime(),
                clientTimestamp: Date.now()
            });
            updateViews();
        }
    } else {
        if (text.includes('รหัส') || text.includes('ส่งมอบ') || text.includes('ข้อมูล')) {
            room.messages.push({
                sender: partnerId,
                text: 'กำลังเช็คบัญชีเมลและข้อมูลไอดีอยู่นะครับ รบกวนอย่าเพิ่งทิ้งแชทไปไหน',
                timestamp: getFormattedTime(),
                clientTimestamp: Date.now()
            });
            updateViews();
        }
    }
}

function simulateChatbotResponse(room, text) {
    const chatbotMsg = {
        sender: 'system_bot',
        text: `🤖 [AI FLIXO Chatbot]: ${text}`,
        timestamp: getFormattedTime(),
        clientTimestamp: Date.now()
    };
    if (isFirebaseEnabled) {
        db.collection('rooms').doc(room.id).collection('messages').add({
            ...chatbotMsg,
            serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } else {
        room.messages.push(chatbotMsg);
        state.activeRoomMessages = room.messages;
        renderActiveChatMessagesUI();
    }
}

// Seller builds product cart card and posts to active room chat
function sendProductProposal() {
    const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
    if (!activeRoom) return;
    
    // ROLE CHECK: Only sellers can create product proposals
    const isSeller = activeRoom.sellerId === state.loggedInUser.id;
    if (!isSeller) {
        showToast('❌ เฉพาะผู้ขายเท่านั้นที่สามารถสร้างใบเสนอราคาได้', 'error');
        return;
    }
    
    // MANDATORY KYC VERIFICATION: Everyone must verify KYC except Admins (0830158022 or 0831058022)
    const isAdmin = state.loggedInUser.phone === '0830158022' || state.loggedInUser.phone === '0831058022';
    if (!isAdmin && state.loggedInUser.kycStatus !== 'verified') {
        alert('ระเบียบความปลอดภัย: สมาชิกทั่วไปทุกคนต้องผ่านการยืนยันตัวตน (e-KYC) ให้สำเร็จก่อนเริ่มส่งใบข้อเสนอขายในระบบ FLIXO');
        openKycModal();
        return;
    }
    
    // PREVENT SPAM: Only allow one active proposal at a time before payment
    const activeMessages = isFirebaseEnabled ? (state.activeRoomMessages || []) : (activeRoom.messages || []);
    const hasPendingProposal = activeMessages.some(m => m.isProposal && m.proposal && !m.proposal.rejected);
    
    if (activeRoom.escrowStatus === 'none' && hasPendingProposal) {
        showToast('❌ ส่งไม่ได้: คุณมีข้อเสนอที่รอการตอบรับอยู่ กรุณารอผู้ซื้อปฏิเสธข้อเสนอเดิมก่อน', 'error');
        return;
    }
    
    const sendBtn = document.querySelector('#seller-panel button[onclick="sendProductProposal()"]');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่ง...';
    }
    
    const name = document.getElementById('prop-name').value;
    const price = parseFloat(document.getElementById('prop-price').value.replace(/,/g, ''));
    const type = document.getElementById('prop-type').value;
    const category = document.getElementById('prop-category') ? document.getElementById('prop-category').value : 'other';
    const imageBase64 = window.propImageBase64 || null;
    const desc = document.getElementById('prop-desc').value;
    
    if (!name || isNaN(price) || price <= 0) {
        showToast('❌ กรุณากรอกชื่อสินค้าและราคาให้ถูกต้อง', 'error');
        if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> ส่งข้อเสนอไปยังแชท'; }
        return;
    }
    
    const proposal = {
        name, price, type, category, desc, imageBase64
    };
    
    if (isFirebaseEnabled) {
        // Update Room price details
        db.collection('rooms').doc(activeRoom.id).update({
            escrowAmount: price
        });
        // Send proposal document
        db.collection('rooms').doc(activeRoom.id).collection('messages').add({
            sender: state.loggedInUser.id,
            timestamp: getFormattedTime(),
            clientTimestamp: Date.now(),
            serverTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
            isProposal: true,
            proposal: proposal
        });
        // Send system notice
        db.collection('rooms').doc(activeRoom.id).collection('messages').add({
            sender: 'system',
            text: `ผู้ขายออกสัญญาใบตกลงราคาเสนอ ฿${price.toLocaleString()} ผู้ซื้อสามารถแสกนพร้อมเพย์จ่ายเงินกักเก็บได้ทันที`,
            timestamp: getFormattedTime(),
            clientTimestamp: Date.now() + 10,
            serverTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
            isSystem: true
        });
    } else {
        // Fallback local memory
        activeRoom.messages.push({
            sender: state.loggedInUser.id,
            timestamp: getFormattedTime(),
            clientTimestamp: Date.now(),
            isProposal: true,
            proposal: proposal
        });
        activeRoom.escrowAmount = price;
        activeRoom.messages.push({
            sender: 'system',
            text: `ผู้ขายออกข้อเสนอซื้อขายมูลค่า ฿${price.toLocaleString()} ผู้ซื้อสามารถกดเปิด QR ชำระเงิน เพื่อกักเก็บวงเงินได้ทันที`,
            timestamp: getFormattedTime(),
            clientTimestamp: Date.now() + 10,
            isSystem: true
        });
        updateViews();
        window.propImageBase64 = null;
        const previewWrap = document.getElementById('product-img-preview-wrap');
        const placeholder = document.getElementById('upload-placeholder');
        if (previewWrap) previewWrap.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        const propImgFile = document.getElementById('prop-img-file');
        if (propImgFile) propImgFile.value = '';
        document.getElementById('prop-name').value = '';
        document.getElementById('prop-price').value = '';
        document.getElementById('prop-desc').value = '';
    }
}

// QR payments
function openPaymentQR(roomId, amount) {
    // MANDATORY KYC VERIFICATION: Everyone must verify KYC except Admins (0830158022 or 0831058022)
    const isAdmin = state.loggedInUser.phone === '0830158022' || state.loggedInUser.phone === '0831058022';
    if (!isAdmin && state.loggedInUser.kycStatus !== 'verified') {
        alert('ระเบียบความปลอดภัย: คุณต้องยืนยันตัวตน e-KYC ให้สำเร็จก่อนดำเนินขั้นตอนชำระเงิน');
        openKycModal();
        return;
    }
    
    document.getElementById('qr-pay-amount').innerText = `฿${amount.toLocaleString()}`;
    document.getElementById('qr-ref1').innerText = 'SE-' + Math.floor(100000 + Math.random() * 900000);
    document.getElementById('modal-qr-pay').style.display = 'flex';
}

function simulateKycPaymentSuccess() {
    const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
    if (!activeRoom) return;
    
    closeModal('modal-qr-pay');
    
    if (isFirebaseEnabled) {
        db.collection('rooms').doc(activeRoom.id).update({
            escrowStatus: 'held',
            escrowMoneyState: 'กักเงินเข้ากระเป๋าบัญชีตัวกลางสำเร็จ'
        });
        db.collection('rooms').doc(activeRoom.id).collection('messages').add({
            sender: 'system',
            text: `ยอดเงินจำนวน ฿${activeRoom.escrowAmount.toLocaleString()} ถูกแสกนชำระและตรวจผ่าน API เข้ากักเก็บใน vault เรียบร้อยแล้ว ( Hold )`,
            timestamp: getFormattedTime(),
            clientTimestamp: Date.now(),
            serverTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
            isSystem: true,
            escrowState: 'held'
        });
    } else {
        // Local Fallback
        activeRoom.escrowStatus = 'held';
        activeRoom.escrowMoneyState = 'กักยอดเงินกลางระบบสำเร็จ';
        activeRoom.messages.push({
            sender: 'system',
            text: `ยอดเงินจำนวน ฿${activeRoom.escrowAmount.toLocaleString()} ถูกแสกนชำระและตรวจผ่าน API เข้ากักเก็บใน vault เรียบร้อยแล้ว ( Hold )`,
            timestamp: getFormattedTime(),
            clientTimestamp: Date.now(),
            isSystem: true,
            escrowState: 'held'
        });
        updateViews();
    }
    alert('โอนจำลองผ่านระบบสำเร็จ! ปรับกระแสเงินกักเก็บเป็น Hold แล้ว');
}

function confirmEscrowReceipt(roomId) {
    const activeRoom = state.rooms.find(r => r.id === roomId);
    if (!activeRoom) return;
    
    if (confirm('คุณแน่ใจว่าได้รับของครบถ้วนแล้ว? หลังจากกดยอมรับ ระบบจะปล่อยโอนเงินให้ฝั่งผู้ขายทันทีและไม่สามารถดึงคืนได้')) {
        if (isFirebaseEnabled) {
            db.collection('rooms').doc(activeRoom.id).update({
                escrowStatus: 'released',
                escrowMoneyState: 'ปล่อยยอดชำระสำเร็จ'
            });
            db.collection('rooms').doc(activeRoom.id).collection('messages').add({
                sender: 'system',
                text: `ผู้ซื้อกดยอมรับสัญญา ย้ายยอด ฿${activeRoom.escrowAmount.toLocaleString()} เข้ากระเป๋าผู้ขายเรียบร้อย`,
                timestamp: getFormattedTime(),
                clientTimestamp: Date.now(),
                serverTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                isSystem: true,
                escrowState: 'released'
            });
        } else {
            activeRoom.escrowStatus = 'released';
            activeRoom.escrowMoneyState = 'ปล่อยโอนสิทธิ์ยอดเงินสำเร็จ';
            activeRoom.messages.push({
                sender: 'system',
                text: `ผู้ซื้อกดยืนยันจัดส่งครบถ้วน โอนเงินค่าดีล ฿${activeRoom.escrowAmount.toLocaleString()} เข้าบัญชีผู้ขายสำเร็จ`,
                timestamp: getFormattedTime(),
                clientTimestamp: Date.now(),
                isSystem: true,
                escrowState: 'released'
            });
            updateViews();
        }
    }
}

// File base64 trigger for dispute evidence photo upload (compressed to fit Firestore 1MB limits)
function handleDisputeFileChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    resizeBase64ImageFromFile(file, function(resizedBase64) {
        disputeEvidenceBase64 = resizedBase64;
        const preview = document.getElementById('dispute-evidence-preview');
        if (preview) {
            preview.style.backgroundImage = `url('${resizedBase64}')`;
            preview.style.display = 'block';
        }
    });
}

// Buyer Dispute check
function triggerOpenDisputeModal(roomId) {
    // MANDATORY KYC VERIFICATION: Everyone must verify KYC except Admins (0830158022 or 0831058022)
    const isAdmin = state.loggedInUser.phone === '0830158022' || state.loggedInUser.phone === '0831058022';
    if (!isAdmin && state.loggedInUser.kycStatus !== 'verified') {
        alert('ผู้ซื้อต้องยืนยันตัวตน (e-KYC) สำเร็จก่อนสร้างตั๋วพิพาทร้องเรียน');
        openKycModal();
        return;
    }
    document.getElementById('modal-dispute').style.display = 'flex';
}

async function submitDispute() {
    const submitBtn = document.querySelector('button[onclick="submitDispute()"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'ยืนยันเปิดข้อพิพาท';
    
    try {
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังวิเคราะห์และส่งเรื่อง...';
            submitBtn.disabled = true;
        }

        const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
        if (!activeRoom) {
            alert('ไม่พบห้องดีลที่กำลังทำรายการ');
            if (submitBtn) { submitBtn.innerHTML = originalBtnHtml; submitBtn.disabled = false; }
            return;
        }
        
        const category = document.getElementById('dispute-category').value;
        const reason = document.getElementById('dispute-reason').value;
        
        if (!reason.trim()) {
            alert('กรุณากรอกรายละเอียดเหตุผลข้อพิพาท');
            if (submitBtn) { submitBtn.innerHTML = originalBtnHtml; submitBtn.disabled = false; }
            return;
        }
        
        // MANDATORY REAL EVIDENCE UPLOAD
        if (!disputeEvidenceBase64) {
            alert('ความปลอดภัยของระบบ: กรุณาอัปโหลดรูปภาพหลักฐานการทุจริตอย่างน้อย 1 รูป เพื่อประกอบสำนวนร้องเรียน');
            if (submitBtn) { submitBtn.innerHTML = originalBtnHtml; submitBtn.disabled = false; }
            return;
        }
        
        // Simulate Typhoon AI Classification safely
        const messagesPool = isFirebaseEnabled ? state.activeRoomMessages : activeRoom.messages;
        const aiAnalysis = await runAiDisputeClassification(messagesPool, reason, activeRoom.escrowAmount, category);
        const reporterRole = activeRoom.buyerId === state.loggedInUser.id ? 'ผู้ซื้อ' : 'ผู้ขาย';
        
        const disputeData = {
            roomId: activeRoom.id,
            buyerName: activeRoom.buyerName,
            sellerName: activeRoom.sellerName,
            reporterId: state.loggedInUser.id,
            reporterRole: reporterRole,
            amount: activeRoom.escrowAmount,
            status: 'suspended',
            category: category,
            reason: reason,
            evidenceImg: disputeEvidenceBase64, // Write real base64 upload data to server
            aiPriority: aiAnalysis.priority,
            aiAnalysis: aiAnalysis.summary,
            aiVerdict: aiAnalysis.verdict,
            confidence: aiAnalysis.confidence,
            classifications: aiAnalysis.classifications
        };
        
        if (isFirebaseEnabled) {
            showToast('⏳ กำลังส่งเรื่องเข้าสู่ระบบ...', 'info');
            try {
                const docRef = await db.collection('disputes').add(disputeData);
                await db.collection('rooms').doc(activeRoom.id).update({
                    escrowStatus: 'suspended',
                    escrowMoneyState: 'ระงับวงเงินกลางชั่วคราว (ข้อร้องเรียนแอดมิน)',
                    hasDispute: true
                });
                
                await db.collection('rooms').doc(activeRoom.id).collection('messages').add({
                    sender: 'system',
                    text: `⚠️ เปิดตั๋วข้อพิพาท #${docRef.id.slice(0, 5)} โดย${reporterRole} [ร้องเรียน: ${getCategoryLabel(category)}] ล็อกยอดโอนชั่วคราวและส่งประวัติวิเคราะห์โดย Typhoon AI`,
                    timestamp: getFormattedTime(),
                    clientTimestamp: Date.now(),
                    serverTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    isSystem: true,
                    escrowState: 'suspended'
                });
                
                // Clear dispute form and state ONLY after successful upload
                closeModal('modal-dispute');
                disputeEvidenceBase64 = null;
                document.getElementById('dispute-reason').value = '';
                const fileInput = document.getElementById('dispute-evidence-file');
                if (fileInput) fileInput.value = '';
                const preview = document.getElementById('dispute-evidence-preview');
                if (preview) preview.style.display = 'none';
                
                alert('ส่งเรื่องร้องเรียนสำเร็จ ปิดกั้นยอดโอนชั่วคราวและส่งตั๋วเข้าระบบแอดมินแล้ว');
            } catch (err) {
                console.error("Firebase dispute upload error:", err);
                alert("❌ เกิดข้อผิดพลาดในการส่งข้อมูล: " + err.message + "\nกรุณาลองใหม่อีกครั้ง");
            }
        } else {
            // Local fallback path
            const disputeId = state.disputes.length + 1;
            const ticket = {
                id: disputeId,
                ...disputeData
            };
            state.disputes.push(ticket);
            
            activeRoom.escrowStatus = 'suspended';
            activeRoom.escrowMoneyState = 'ระงับบัญชีดีล (ข้อร้องเรียนพิพาท)';
            activeRoom.hasDispute = true;
            activeRoom.dispute = ticket;
            
            activeRoom.messages.push({
                sender: 'system',
                text: `⚠️ เปิดตั๋วข้อพิพาท #${disputeId} โดย${reporterRole} [ปัญหา: ${getCategoryLabel(category)}] ล็อกยอดโอนชั่วคราวและส่งประวัติวิเคราะห์โดย Typhoon AI`,
                timestamp: getFormattedTime(),
                clientTimestamp: Date.now(),
                isSystem: true,
                escrowState: 'suspended'
            });
            updateViews();
            
            closeModal('modal-dispute');
            disputeEvidenceBase64 = null;
            document.getElementById('dispute-reason').value = '';
            const fileInput = document.getElementById('dispute-evidence-file');
            if (fileInput) fileInput.value = '';
            const preview = document.getElementById('dispute-evidence-preview');
            if (preview) preview.style.display = 'none';
            
            alert('ส่งเรื่องร้องเรียนสำเร็จ ปิดกั้นยอดโอนชั่วคราวและส่งตั๋วเข้าระบบแอดมินแล้ว');
        }
    } catch (e) {
        console.error("Error in submitDispute:", e);
        alert("❌ เกิดข้อผิดพลาดทางเทคนิค: " + e.message);
    } finally {
        if (submitBtn) { 
            submitBtn.innerHTML = originalBtnHtml; 
            submitBtn.disabled = false; 
        }
    }
}

function getCategoryLabel(cat) {
    const labels = {
        scam: 'โดนโกง/บล็อคหนี',
        mismatch: 'สินค้าไม่ตรงปก',
        damaged: 'ชำรุดเสียหาย',
        unauthorized: 'บัญชีโดนดึงสิทธิ์คืน'
    };
    return labels[cat] || cat;
}

async function runAiDisputeClassification(chatLogs, reason, amount, category) {
    try {
        const logs = chatLogs || [];
        const logTexts = logs.map(m => {
            if (!m) return '';
            if (m.text && !m.isSystem) return m.text;
            if (m.proposal && m.proposal.name) return `[ส่งข้อเสนอสินค้า: ${m.proposal.name} ราคา ${m.proposal.price} บาท]`;
            return '';
        }).filter(t => t.length > 0);
        
        const chatHistoryStr = logTexts.join('\n');
        
        const prompt = `
คุณคือผู้พิพากษาและผู้ไกล่เกลี่ยในระบบ Escrow การซื้อขายออนไลน์ (ชื่อแพลตฟอร์ม Flixo)
หน้าที่ของคุณคือการอ่าน "ประวัติการแชท" ระหว่างผู้ซื้อและผู้ขาย และ "เหตุผลที่ร้องเรียน" เพื่อจัดหมวดหมู่และแนะนำแนวทางแก้ไขให้แอดมินพิจารณา

ข้อมูลคดี:
- หมวดหมู่ที่ผู้ใช้เลือก: ${category}
- ยอดเงินกักเก็บ (Escrow Amount): ${amount} บาท
- ข้อความร้องเรียน: "${reason}"
- ประวัติการแชท:
${chatHistoryStr ? chatHistoryStr : '(ไม่มีประวัติการแชท)'}

กรุณาวิเคราะห์และตอบกลับมาเป็น JSON FORMAT เท่านั้น โดยมีโครงสร้างดังนี้:
{
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "verdict": "REFUND_BUYER" | "RELEASE_SELLER" | "MANUAL_REVIEW",
  "confidence": "เปอร์เซ็นต์ความมั่นใจ เช่น 95%",
  "summary": "คำบรรยายสรุปเหตุการณ์และคำแนะนำสั้นๆ (ภาษาไทย ไม่เกิน 3 บรรทัด)",
  "classifications": {
    "problem": "ประเภทปัญหา เช่น หลอกลวง, สินค้าไม่ตรงปก, ขอกู้คืนบัญชี",
    "goods": "ประเภทสินค้า เช่น สินค้าดิจิทัล, สินค้ากายภาพ",
    "tier": "ระดับความเสียหาย เช่น Medium (1k-10k THB)"
  }
}
หากไม่มีประวัติแชท หรือข้อมูลไม่ชัดเจน ให้ตั้ง priority เป็น MANUAL_REVIEW และ confidence ต่ำๆ
ตอบกลับเป็น JSON บริสุทธิ์ (ห้ามมี Markdown \`\`\`json ครอบ)`;

        const response = await fetch('https://api.opentyphoon.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TYPHOON_API_KEY}`
            },
            body: JSON.stringify({
                model: 'typhoon-v1.5x-70b-instruct',
                messages: [
                    { role: 'system', content: 'You are a JSON-only API that outputs valid JSON without markdown wrapping.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            throw new Error(`Typhoon API error! status: ${response.status}`);
        }

        const data = await response.json();
        let content = data.choices[0].message.content.trim();
        
        // Strip markdown if it was returned despite instructions
        if (content.startsWith('```json')) {
            content = content.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (content.startsWith('```')) {
            content = content.replace(/^```\n/, '').replace(/\n```$/, '');
        }
        
        const aiResult = JSON.parse(content);
        
        return {
            priority: aiResult.priority || 'MEDIUM',
            verdict: aiResult.verdict || 'MANUAL_REVIEW',
            confidence: aiResult.confidence || '50%',
            summary: aiResult.summary || 'ไม่สามารถสรุปข้อมูลได้',
            classifications: {
                problem: aiResult.classifications?.problem || 'Unknown',
                goods: aiResult.classifications?.goods || 'Unknown',
                tier: aiResult.classifications?.tier || 'Unknown'
            }
        };

    } catch (err) {
        console.error("Error in runAiDisputeClassification:", err);
        return {
            priority: 'MEDIUM',
            verdict: 'MANUAL_REVIEW',
            confidence: '50%',
            summary: 'เกิดข้อผิดพลาดในการเชื่อมต่อ Typhoon AI: ' + err.message,
            classifications: { problem: 'API Error', goods: 'Unknown', tier: 'Unknown' }
        };
    }
}

// e-KYC Uploads
function openKycModal() {
    document.getElementById('kyc-id-card-filename').innerText = 'ไม่ได้เลือกไฟล์';
    document.getElementById('kyc-selfie-filename').innerText = 'ไม่ได้เลือกไฟล์';
    document.getElementById('kyc-id-card-preview').style.display = 'none';
    document.getElementById('kyc-selfie-preview').style.display = 'none';
    state.mockFiles.idCard = null;
    state.mockFiles.selfie = null;
    document.getElementById('modal-kyc').style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function simulateFileUpload(type) {
    const filename = document.getElementById(type === 'id-card' ? 'kyc-id-card-filename' : 'kyc-selfie-filename');
    const preview = document.getElementById(type === 'id-card' ? 'kyc-id-card-preview' : 'kyc-selfie-preview');
    const forceFail = document.getElementById('kyc-force-fail').checked;
    
    if (type === 'id-card') {
        const img = forceFail ? MOCK_PHOTOS.idCardFail : MOCK_PHOTOS.idCard;
        state.mockFiles.idCard = img;
        filename.innerText = forceFail ? 'id_card_blurry.jpg' : 'thai_id_card_user.png';
        preview.style.backgroundImage = `url('${img}')`;
        preview.style.display = 'block';
    } else {
        const img = forceFail ? MOCK_PHOTOS.selfieFail : MOCK_PHOTOS.selfie;
        state.mockFiles.selfie = img;
        filename.innerText = forceFail ? 'selfie_blurry.jpg' : 'user_selfie_hq.png';
        preview.style.backgroundImage = `url('${img}')`;
        preview.style.display = 'block';
    }
}

function submitKyc() {
    const forceFail = document.getElementById('kyc-force-fail').checked;
    
    if (!state.mockFiles.idCard || !state.mockFiles.selfie) {
        alert('กรุณาจำลองเลือกเอกสารหลักฐานทั้ง 2 ช่อง');
        return;
    }
    
    closeModal('modal-kyc');
    
    state.loggedInUser.kycStatus = 'pending';
    updateViews();
    
    setTimeout(() => {
        if (forceFail) {
            state.loggedInUser.kycStatus = 'failed';
            
            const kycSubmission = {
                user: state.loggedInUser,
                idCardImg: state.mockFiles.idCard,
                selfieImg: state.mockFiles.selfie,
                aiConfidence: '35% (ความเข้ากันได้ใบหน้าต่ำ)',
                status: 'pending'
            };
            
            if (isFirebaseEnabled) {
                db.collection('kycQueue').add(kycSubmission);
            } else {
                state.kycQueue.push({ id: state.kycQueue.length + 1, ...kycSubmission });
            }
            alert('❌ [e-KYC AI]: สแกนไม่ผ่านเกณฑ์ส่งคำขอของท่านเข้าคิว แอดมินตรวจสอบด้วยตนเองแล้ว');
        } else {
            state.loggedInUser.kycStatus = 'verified';
            if (isFirebaseEnabled) {
                db.collection('users').doc(state.loggedInUser.id).update({ kycStatus: 'verified' });
            } else {
                const dbUser = MOCK_USERS.find(u => u.id === state.loggedInUser.id);
                if (dbUser) dbUser.kycStatus = 'verified';
            }
            alert('✓ [e-KYC AI]: ยืนยันตัวตนสำเร็จ! ปลดล็อกเครื่องมือดีลซื้อขายทั้งหมด');
        }
        updateViews();
        // Prompt user to add bank account info
        setTimeout(() => {
            const bankModal = document.getElementById('modal-bank-account');
            if (bankModal) bankModal.style.display = 'flex';
        }, 600);
    }, 1500);
}

// ==========================================================================
// Admin Control Room Logic
// ==========================================================================

function renderAdminPanel() {
    // Stat 1: Users Count
    document.getElementById('admin-stat-users').innerText = isFirebaseEnabled ? 'เชื่อมต่อออนไลน์' : MOCK_USERS.length;
    
    // Stat 2: Escrow Locked
    let totalEscrow = 0;
    state.rooms.forEach(r => {
        if (r.escrowStatus === 'held' || r.escrowStatus === 'suspended') {
            totalEscrow += r.escrowAmount;
        }
    });
    document.getElementById('admin-stat-escrow').innerText = `฿${totalEscrow.toLocaleString()}`;
    
    // Stat 3: KYC Pending
    const pendingKyc = state.kycQueue.filter(k => k.status === 'pending').length;
    document.getElementById('admin-stat-kyc').innerText = pendingKyc;
    
    // Stat 4: Active Disputes
    const activeDisputes = state.disputes.filter(d => d.status === 'suspended').length;
    document.getElementById('admin-stat-disputes').innerText = activeDisputes;
    
    // Notif badge count
    const adminBadge = document.getElementById('admin-notif-badge');
    const totalNotifs = pendingKyc + activeDisputes;
    if (totalNotifs > 0) {
        adminBadge.innerText = totalNotifs;
        adminBadge.style.display = 'block';
    } else {
        adminBadge.style.display = 'none';
    }
    
    // Render e-KYC Table
    const kycTbody = document.getElementById('admin-kyc-queue-tbody');
    let kycHtml = '';
    
    const pendingKycQueueList = state.kycQueue.filter(k => k.status === 'pending');
    if (pendingKycQueueList.length === 0) {
        kycHtml = `<tr><td colspan="5" class="text-center text-muted">ไม่มีคำขอยืนยันตัวตนที่รอคิวตรวจสอบ</td></tr>`;
    } else {
        pendingKycQueueList.forEach(k => {
            kycHtml += `
                <tr>
                    <td><strong>${k.user.name}</strong><br><span class="text-muted font-10">ID: ${k.user.id}</span></td>
                    <td>ดีลซื้อขายทั่วไป</td>
                    <td>
                        <div class="mini-doc-preview">
                            <a href="${k.idCardImg}" target="_blank" class="doc-thumb"><i class="fa-solid fa-address-card"></i></a>
                            <a href="${k.selfieImg}" target="_blank" class="doc-thumb"><i class="fa-solid fa-camera"></i></a>
                        </div>
                    </td>
                    <td><span class="badge status-red"><i class="fa-solid fa-triangle-exclamation"></i> ${k.aiConfidence}</span></td>
                    <td>
                        <button class="btn-success btn-sm" onclick="adminResolveKyc('${k.id}', true)">อนุมัติ</button>
                        <button class="btn-danger btn-sm" onclick="adminResolveKyc('${k.id}', false)">ปฏิเสธ</button>
                    </td>
                </tr>
            `;
        });
    }
    kycTbody.innerHTML = kycHtml;
    
    // Render Disputes Table
    const disputeTbody = document.getElementById('admin-dispute-tbody');
    let disputeHtml = '';
    
    const filteredDisputes = state.disputes.filter(d => 
        state.showArchivedDisputes 
            ? (state.archivedDisputes||[]).includes(d.id) 
            : !(state.archivedDisputes||[]).includes(d.id)
    );
    if (filteredDisputes.length === 0) {
        disputeHtml = `<tr><td colspan="6" class="text-center text-muted">${state.showArchivedDisputes ? 'ไม่มีตั๋วที่เก็บไว้' : 'ไม่มีตั๋วข้อพิพาท'}</td></tr>`;
    } else {
        filteredDisputes.forEach(d => {
            const activeRoom = state.rooms.find(r => r.id === d.roomId);
            const topic = activeRoom ? activeRoom.topic : 'ดีลซื้อขายทั่วไป';
            const isSelected = state.activeDisputeId === d.id ? 'style="background: rgba(255, 122, 89, 0.1);"' : '';
            
            let statusLabel = '';
            if (d.status === 'suspended') statusLabel = '<span class="badge bg-red">ระงับเงินชั่วคราว</span>';
            else if (d.status === 'resolved_refunded') statusLabel = '<span class="badge text-muted">คืนเงินผู้ซื้อแล้ว</span>';
            else if (d.status === 'resolved_released') statusLabel = '<span class="badge status-green">ปล่อยยอดผู้ขายแล้ว</span>';
            
            let priorityBadge = '';
            if (d.aiPriority === 'HIGH') priorityBadge = '<span class="badge bg-red animate-pulse">HIGH</span>';
            else if (d.aiPriority === 'MEDIUM') priorityBadge = '<span class="badge text-warning">MEDIUM</span>';
            else priorityBadge = '<span class="badge text-muted">LOW</span>';
            
            disputeHtml += `
                <tr ${isSelected} onclick="adminSelectDispute('${d.id}')" class="cursor-pointer">
                    <td><strong>ดีล #${d.roomId.slice ? d.roomId.slice(0,5) : d.roomId}</strong><br><span class="text-muted font-10">${topic.substring(0, 25)}...</span></td>
                    <td>${d.buyerName}</td>
                    <td><strong>฿${d.amount.toLocaleString()}</strong></td>
                    <td>${priorityBadge}</td>
                    <td>${statusLabel}</td>
                    <td style="display:flex;gap:4px;">
                        <button class="btn-primary btn-sm" onclick="adminSelectDispute('${d.id}')">วิเคราะห์ AI</button>
                        <button class="btn-secondary btn-sm" onclick="toggleArchiveDispute('${d.id}')" title="${(state.archivedDisputes||[]).includes(d.id) ? 'นำกลับมา' : 'เก็บตั๋วนี้'}"><i class="fa-solid fa-${(state.archivedDisputes||[]).includes(d.id) ? 'inbox' : 'box-archive'}"></i></button>
                    </td>
                </tr>
            `;
        });
    }
    disputeTbody.innerHTML = disputeHtml;
    
    renderAdminInvestigatorCard();
}

function adminResolveKyc(requestId, approve) {
    if (isFirebaseEnabled) {
        const queueDoc = state.kycQueue.find(k => k.id === requestId);
        if (!queueDoc) return;
        
        db.collection('users').doc(queueDoc.user.id).update({
            kycStatus: approve ? 'verified' : 'failed'
        });
        db.collection('kycQueue').doc(requestId).update({
            status: approve ? 'approved' : 'rejected'
        });
    } else {
        const kyc = state.kycQueue.find(k => k.id === requestId);
        if (!kyc) return;
        kyc.status = approve ? 'approved' : 'rejected';
        kyc.user.kycStatus = approve ? 'verified' : 'failed';
        const dbUser = MOCK_USERS.find(u => u.id === kyc.user.id);
        if (dbUser) dbUser.kycStatus = approve ? 'verified' : 'failed';
        updateViews();
    }
    alert(`แอดมินตัดสินผลตรวจ e-KYC: ${approve ? 'อนุมัติผ่าน' : 'ปฏิเสธคำขอ'}`);
}

// Select dispute to load its chat messages in real-time for the admin investigator card
function adminSelectDispute(id) {
    state.activeDisputeId = id;
    
    const ticket = state.disputes.find(d => d.id === id);
    if (ticket && isFirebaseEnabled) {
        // Query the specific room messages for the admin view
        db.collection('rooms').doc(ticket.roomId).collection('messages').orderBy('clientTimestamp').get()
            .then(snapshot => {
                let msgs = [];
                snapshot.forEach(doc => msgs.push(doc.data()));
                state.adminDisputeMessages = msgs;
                updateViews();
            })
            .catch(err => {
                console.error("Error loading dispute logs:", err);
            });
    } else {
        updateViews();
    }
}

function renderAdminInvestigatorCard() {
    const card = document.getElementById('admin-investigator-content');
    const ticket = state.disputes.find(d => d.id === state.activeDisputeId);
    
    if (!ticket) {
        card.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-brain-circuit"></i>
                <p>เลือกตั๋วข้อพิพาทในรายการด้านซ้าย เพื่อให้ปัญญาประดิษฐ์สกัดและวิเคราะห์ข้อมูลหลักฐานแชท</p>
            </div>
        `;
        return;
    }
    
    const activeRoom = state.rooms.find(r => r.id === ticket.roomId);
    let logsHtml = '';
    
    // Retrieve correct historical logs
    const sourceMsgs = isFirebaseEnabled ? state.adminDisputeMessages : (activeRoom ? activeRoom.messages : []);
    const messages = sourceMsgs.filter(m => !m.isSystem && !m.isProposal).slice(-4);
    messages.forEach(m => {
        const senderName = activeRoom && m.sender === activeRoom.buyerId ? 'ผู้ซื้อ' : 'ผู้ขาย';
        const highlight = m.text.includes('โกง') || m.text.includes('บล็อค') || m.text.includes('รหัส') || m.text.includes('ไม่ตอบ');
        logsHtml += `
            <div class="excerpt-row ${highlight ? 'highlighted' : ''}">
                <strong>[${senderName}]:</strong> ${m.text}
            </div>
        `;
    });
    
    const isRefund = ticket.aiVerdict === 'REFUND_BUYER';
    const verdictClass = isRefund ? 'verdict-refund' : 'verdict-release';
    const verdictText = isRefund ? 'อนุมัติคืนเงินผู้ซื้อ (Refund Buyer)' : 'อนุมัติจ่ายเงินผู้ขาย (Release to Seller)';
    
    let actionsHtml = '';
    if (ticket.status === 'suspended') {
        actionsHtml = `
            <div class="form-row mt-15">
                <button class="btn-danger col-6" onclick="adminResolveDispute('${ticket.id}', 'refund')">
                    <i class="fa-solid fa-undo"></i> ตัดสินคืนเงินผู้ซื้อ
                </button>
                <button class="btn-success col-6" onclick="adminResolveDispute('${ticket.id}', 'release')">
                    <i class="fa-solid fa-check"></i> ตัดสินปล่อยยอดผู้ขาย
                </button>
            </div>
        `;
    } else {
        const label = ticket.status === 'resolved_refunded' ? 'คืนเงินผู้ซื้อเสร็จสิ้น' : 'จ่ายเงินผู้ขายเสร็จสิ้น';
        actionsHtml = `
            <div class="alert-box alert-info text-center mt-10">
                <i class="fa-solid fa-lock"></i> คำตัดสินสิ้นสุด: ${label}
            </div>
        `;
    }
    
    const imgUrl = ticket.evidenceImg || MOCK_PHOTOS.evidence[ticket.evidence] || MOCK_PHOTOS.evidence['empty-box'];
    
    card.innerHTML = `
        <div class="ai-details-grid">
            <div class="ai-alert-box">
                <i class="fa-solid fa-microchip"></i>
                <span><strong>ปัญญาประดิษฐ์วิเคราะห์ข้อตกลง:</strong> Typhoon LLM จัดลำดับความสำคัญคัดแยกประวัติ</span>
            </div>
            
            <div class="form-group">
                <label>การจัดหมวดหมู่ 3 มิติ (AI Classification)</label>
                <div class="ai-classification-badges">
                    <span class="ai-badge dimension-problem"><i class="fa-solid fa-triangle-exclamation"></i> ปัญหา: ${ticket.classifications.problem}</span>
                    <span class="ai-badge dimension-goods"><i class="fa-solid fa-box"></i> สินค้า: ${ticket.classifications.goods}</span>
                    <span class="ai-badge dimension-tier"><i class="fa-solid fa-tag"></i> ราคา: ${ticket.classifications.tier}</span>
                </div>
            </div>
            
            <div class="ai-analysis-block">
                <h4><i class="fa-solid fa-quote-left"></i> สรุปข้อร้องเรียนผู้ร้อง</h4>
                <p>"${ticket.reason}"</p>
            </div>
            
            <div class="ai-analysis-block">
                <h4><i class="fa-regular fa-comments"></i> บทสนทนาสำคัญ</h4>
                <div class="ai-chat-logs-excerpt">${logsHtml || 'ไม่มีประวัติแชทเจรจา'}</div>
            </div>
            
            <div class="ai-verdict-box ${verdictClass}">
                <span class="ai-verdict-title"><i class="fa-solid fa-gavel"></i> แนะนำโดย Typhoon LLM</span>
                <div class="ai-verdict-verdict">${verdictText}</div>
                <span class="ai-verdict-confidence">ความน่าเชื่อถือ: ${ticket.confidence}</span>
            </div>
            
            <div class="form-group">
                <label>หลักฐานแนบ (อัปโหลดจริง)</label>
                <img src="${imgUrl}" style="max-width: 100%; border-radius: var(--radius-sm); border: 1px solid var(--border-glass); max-height: 220px; object-fit: contain; background: rgba(0,0,0,0.25); padding: 5px; margin-top: 5px;">
            </div>
            
            <div class="border-top-glass mt-10">
                <label class="form-group-label font-11 text-muted"><strong>คำตัดสินผู้ดูแลระบบ:</strong></label>
                ${actionsHtml}
            </div>
        </div>
    `;
}

function adminResolveDispute(disputeId, verdict) {
    const ticket = state.disputes.find(d => d.id === disputeId);
    if (!ticket) return;
    
    if (confirm('ยืนยันคำตัดสินการจ่ายเงินนี้หรือไม่?')) {
        if (isFirebaseEnabled) {
            db.collection('disputes').doc(disputeId).update({
                status: verdict === 'refund' ? 'resolved_refunded' : 'resolved_released'
            });
            db.collection('rooms').doc(ticket.roomId).update({
                escrowStatus: 'released',
                escrowMoneyState: verdict === 'refund' ? 'แอดมินยกเลิกดีลและคืนเงินผู้ซื้อ' : 'แอดมินปิดการระงับและปล่อยเงินโอนผู้ขาย'
            });
            db.collection('rooms').doc(ticket.roomId).collection('messages').add({
                sender: 'system',
                text: `⚖️ [คำตัดสินแอดมิน]: สิ้นสุดข้อพิพาท ทำการโอนย้ายยอดเงินจำนวน ฿${ticket.amount.toLocaleString()} ${verdict === 'refund' ? 'คืนผู้ซื้อ' : 'เข้าผู้ขาย'} เรียบร้อยแล้ว`,
                timestamp: getFormattedTime(),
                clientTimestamp: Date.now(),
                serverTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                isSystem: true,
                escrowState: 'released'
            });
        } else {
            const activeRoom = state.rooms.find(r => r.id === ticket.roomId);
            if (!activeRoom) return;
            
            if (verdict === 'refund') {
                ticket.status = 'resolved_refunded';
                activeRoom.escrowStatus = 'released';
                activeRoom.escrowMoneyState = 'แอดมินสั่งยกเลิกดีลและคืนเงินผู้ซื้อสำเร็จ';
                activeRoom.messages.push({
                    sender: 'system',
                    text: `⚖️ [คำตัดสินแอดมิน]: ข้อพิพาทได้รับอนุมัติ คืนเงิน ฿${activeRoom.escrowAmount.toLocaleString()} แก่ผู้ซื้อเรียบร้อย`,
                    timestamp: getFormattedTime(),
                    clientTimestamp: Date.now(),
                    isSystem: true,
                    escrowState: 'released'
                });
            } else {
                ticket.status = 'resolved_released';
                activeRoom.escrowStatus = 'released';
                activeRoom.escrowMoneyState = 'แอดมินสั่งปล่อยเงินดีลให้ผู้ขายสำเร็จ';
                activeRoom.messages.push({
                    sender: 'system',
                    text: `⚖️ [คำตัดสินแอดมิน]: ข้อพิพาทถูกปฏิเสธ ปล่อยเงิน ฿${activeRoom.escrowAmount.toLocaleString()} แก่ผู้ขายเรียบร้อย`,
                    timestamp: getFormattedTime(),
                    clientTimestamp: Date.now(),
                    isSystem: true,
                    escrowState: 'released'
                });
            }
            updateViews();
        }
    }
}

// Reset Simulator
function resetSimulator() {
    if (confirm('คุณต้องการล้างข้อมูลระบบจำลองกลับสู่ค่าเริ่มต้นหรือไม่? (หากเชื่อมต่อ Firebase ข้อมูลบนคลาวด์จะไม่ถูกลบ)')) {
        unsubscribeAllListeners();
        state.rooms = [];
        state.activeRoomId = null;
        state.activeRoomMessages = [];
        state.disputes = [];
        state.kycQueue = [];
        state.activeDisputeId = null;
        
        if (state.loggedInUser) {
            state.loggedInUser.kycStatus = 'unverified';
            initRealtimeListeners();
        }
        updateViews();
        alert('รีเซ็ตระบบจำลองฝั่งเครื่องของคุณสำเร็จ');
    }
}

function formatPriceInput(el) {
    let raw = el.value.replace(/[^0-9]/g, '');
    el.value = raw ? parseInt(raw, 10).toLocaleString('th-TH') : '';
}

function handleProductImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('❌ ไฟล์ใหญ่เกิน 5MB', 'error'); return; }
    
    resizeBase64ImageFromFile(file, function(resizedBase64) {
        window.propImageBase64 = resizedBase64;
        const preview = document.getElementById('product-img-preview');
        const wrap = document.getElementById('product-img-preview-wrap');
        const placeholder = document.getElementById('upload-placeholder');
        if (preview) preview.src = resizedBase64;
        if (wrap) wrap.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
    });
}

function removeProductImage() {
    window.propImageBase64 = null;
    const wrap = document.getElementById('product-img-preview-wrap');
    const placeholder = document.getElementById('upload-placeholder');
    const input = document.getElementById('prop-img-file');
    if (wrap) wrap.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (input) input.value = '';
}

function updateWordCount() {
    const desc = document.getElementById('prop-desc');
    const counter = document.getElementById('prop-desc-wordcount');
    if (!desc || !counter) return;
    const words = desc.value.trim().split(/\s+/).filter(w => w.length > 0);
    counter.textContent = words.length + ' คำ';
    counter.style.color = 'var(--text-muted)';
}

function getCategoryEmoji(cat) {
    const map = { game:'🎮', gadget:'📱', fashion:'👕', shoes:'👟', collectible:'🏆', book:'📚', electronics:'🔌', beauty:'💄', sport:'⚽', vehicle:'🚗', digital:'💻', other:'📦' };
    return map[cat] || '📦';
}

function showProposalDetail(propJson) {
    try {
        const prop = JSON.parse(propJson);
        const categoryLabels = {
            game:'🎮 ไอดีเกม', gadget:'📱 อุปกรณ์ไอที', fashion:'👕 เสื้อผ้า',
            shoes:'👟 รองเท้า', collectible:'🏆 ของสะสม', book:'📚 หนังสือ',
            electronics:'🔌 เครื่องใช้ไฟฟ้า', beauty:'💄 เครื่องสำอาง',
            sport:'⚽ กีฬา', vehicle:'🚗 รถยนต์', digital:'💻 ดิจิทัล', other:'📦 อื่นๆ'
        };
        const catLabel = categoryLabels[prop.category] || prop.category || 'สินค้าทั่วไป';
        const imgHtml = prop.imageBase64 
            ? `<img src="${prop.imageBase64}" alt="product" style="max-width:100%;max-height:260px;border-radius:12px;object-fit:contain;margin-bottom:15px;display:block;margin-left:auto;margin-right:auto;">`
            : `<div style="font-size:72px;text-align:center;padding:20px;">${getCategoryEmoji(prop.category)}</div>`;
        document.getElementById('modal-product-detail-body').innerHTML = `
            <div>${imgHtml}</div>
            <h3 style="margin-bottom:8px;font-size:18px;">${prop.name}</h3>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:15px;">
                <span style="padding:4px 10px;border-radius:20px;background:var(--surface-2,#f0f4f8);font-size:12px;">${catLabel}</span>
                <span style="padding:4px 12px;border-radius:20px;background:var(--surface-2);border:1px solid var(--border);color:var(--text-main);font-size:13px;font-weight:700;">฿${Number(prop.price).toLocaleString()}</span>
            </div>
            <p style="white-space:pre-wrap;line-height:1.8;color:var(--text-muted);font-size:14px;">${prop.desc || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
        `;
        document.getElementById('modal-product-detail').style.display = 'flex';
    } catch(e) { console.error(e); }
}

function submitBankAccount() {
    const bank = document.getElementById('bank-name-select').value;
    const num = document.getElementById('bank-account-number').value.trim();
    const name = document.getElementById('bank-account-name').value.trim();
    if (!num || !name) { showToast('❌ กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
    state.loggedInUser.bankInfo = { bank, accountNumber: num, accountName: name };
    if (isFirebaseEnabled && db) {
        db.collection('users').doc(state.loggedInUser.id).update({ bankInfo: state.loggedInUser.bankInfo });
    }
    closeModal('modal-bank-account');
    updateBankInfoDisplay();
    showToast('✅ บันทึกข้อมูลธนาคารเรียบร้อย', 'success');
}

function updateBankInfoDisplay() {
    const bi = state.loggedInUser && state.loggedInUser.bankInfo;
    const box = document.getElementById('dashboard-bank-info');
    const detail = document.getElementById('bank-info-display');
    if (bi && box && detail) {
        box.style.display = 'block';
        detail.innerHTML = `
            <span>ธนาคาร</span> ${bi.bank}<br>
            <span>ชื่อบัญชี</span> ${bi.accountName}<br>
            <span>เลขบัญชี</span> ${bi.accountNumber}
        `;
    } else if (box) {
        box.style.display = 'none';
    }
}

function submitTrackingNumber() {
    const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
    if (!activeRoom) return;
    const carrier = document.getElementById('tracking-carrier').value;
    const number = document.getElementById('tracking-number').value.trim();
    if (!number) { showToast('❌ กรุณากรอกเลขพัสดุ', 'error'); return; }
    const carrierLabels = { flash:'Flash Express', jt:'J&T Express', thpost:'ไปรษณีย์ไทย', kerry:'Kerry Express', dhl:'DHL', scg:'SCG Express', digital:'ส่งมอบดิจิทัล' };
    const carrierName = carrierLabels[carrier] || carrier;
    const trackMsg = { sender: 'system', text: `📦 ผู้ขายแจ้งจัดส่งพัสดุแล้ว | ขนส่ง: ${carrierName} | เลขพัสดุ: ${number}`, timestamp: getFormattedTime(), clientTimestamp: Date.now(), isSystem: true };
    activeRoom.trackingNumber = number;
    activeRoom.trackingCarrier = carrier;
    if (isFirebaseEnabled && db) {
        db.collection('rooms').doc(activeRoom.id).collection('messages').add({ ...trackMsg, serverTimestamp: firebase.firestore.FieldValue.serverTimestamp() });
        db.collection('rooms').doc(activeRoom.id).update({ trackingNumber: number, trackingCarrier: carrier });
    } else {
        activeRoom.messages.push(trackMsg);
        state.activeRoomMessages = activeRoom.messages;
        renderActiveChatMessagesUI();
    }
    const tf = document.getElementById('seller-tracking-form');
    if (tf) tf.style.display = 'none';
    showToast('📦 แจ้งเลขพัสดุเรียบร้อยแล้ว', 'success');
}

function toggleArchiveDispute(disputeId) {
    if (!state.archivedDisputes) state.archivedDisputes = [];
    const idx = state.archivedDisputes.indexOf(disputeId);
    if (idx > -1) { state.archivedDisputes.splice(idx, 1); showToast('นำตั๋วกลับมาแล้ว', 'success'); }
    else { state.archivedDisputes.push(disputeId); showToast('เก็บตั๋วเรียบร้อย', 'success'); }
    renderAdminPanel();
}

function toggleArchivedDisputes() {
    state.showArchivedDisputes = !state.showArchivedDisputes;
    const label = document.getElementById('dispute-archive-btn-label');
    if (label) label.textContent = state.showArchivedDisputes ? 'ดูที่ยังเปิดอยู่' : 'ดูที่เก็บแล้ว';
    renderAdminPanel();
}

function rejectProposal(roomId, msgTimestamp) {
    const room = state.rooms.find(r => r.id === roomId);
    if (!room) return;
    
    // Close payment QR modal if it's open
    closeModal('modal-qr-pay');
    
    // Find proposal by clientTimestamp (more reliable than array index)
    const msgs = isFirebaseEnabled ? state.activeRoomMessages : room.messages;
    const targetMsg = msgs.find(m => m.isProposal && m.clientTimestamp === msgTimestamp);
    if (targetMsg && targetMsg.proposal) {
        targetMsg.proposal.rejected = true;
    }
    
    const rejectMsg = { 
        sender: 'system', 
        text: '❌ ผู้ซื้อยกเลิกข้อเสนอราคานี้แล้ว กรุณาเจรจาและส่งข้อเสนอใหม่', 
        timestamp: getFormattedTime(), 
        clientTimestamp: Date.now(), 
        isSystem: true 
    };
    
    if (isFirebaseEnabled && db) {
        // Also mark rejected in Firestore - find and update the proposal message document
        db.collection('rooms').doc(roomId).collection('messages')
            .where('clientTimestamp', '==', msgTimestamp)
            .get()
            .then(snapshot => {
                snapshot.forEach(doc => {
                    doc.ref.update({
                        'proposal.rejected': true
                    });
                });
            })
            .catch(err => console.error("Error updating rejected status in Firestore:", err));

        db.collection('rooms').doc(roomId).collection('messages').add({ 
            ...rejectMsg, 
            serverTimestamp: firebase.firestore.FieldValue.serverTimestamp() 
        });
    } else {
        room.messages.push(rejectMsg);
        state.activeRoomMessages = room.messages;
        // Re-render immediately so proposal card shows rejected state
        renderActiveChatMessagesUI();
    }
    showToast('✅ ยกเลิกข้อเสนอเรียบร้อยแล้ว', 'success');
}

// Compress any image file to tiny width/height (max 500px) and 0.6 quality JPEG to keep it under 30KB
// This prevents Firestore document maximum size limit (1MB) errors when storing base64.
function resizeBase64ImageFromFile(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const max_size = 500;
            if (width > height) {
                if (width > max_size) {
                    height *= max_size / width;
                    width = max_size;
                }
            } else {
                if (height > max_size) {
                    width *= max_size / height;
                    height = max_size;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            callback(dataUrl);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function deleteRoom(roomId) {
    document.querySelectorAll('.deal-context-menu').forEach(m => m.remove());
    if (confirm('คุณต้องการลบช่องแชทและดีลนี้แบบถาวรใช่หรือไม่?\n\n⚠️ คำเตือน: ประวัติการสนทนา รูปภาพ และความเคลื่อนไหว Escrow ทั้งหมดจะถูกลบออกจากฐานข้อมูลอย่างถาวรโดยไม่สามารถกู้คืนได้')) {
        
        if (state.activeRoomId === roomId) {
            state.activeRoomId = null;
        }

        // Clean up from local preferences lists too
        const cleanPref = (key) => {
            if (!state.loggedInUser) return;
            const stored = localStorage.getItem(key);
            if (stored) {
                let arr = JSON.parse(stored);
                arr = arr.filter(id => id !== roomId);
                localStorage.setItem(key, JSON.stringify(arr));
            }
        };
        const uid = state.loggedInUser ? state.loggedInUser.id : '';
        cleanPref(`flixo_archived_rooms_${uid}`);
        cleanPref(`flixo_pinned_rooms_${uid}`);
        cleanPref(`flixo_closed_rooms_${uid}`);
        cleanPref(`flixo_deleted_rooms_${uid}`);
        
        state.archivedRooms = state.archivedRooms.filter(id => id !== roomId);
        state.pinnedRooms = state.pinnedRooms.filter(id => id !== roomId);
        state.closedRooms = state.closedRooms.filter(id => id !== roomId);
        state.deletedRooms = state.deletedRooms.filter(id => id !== roomId);

        if (isFirebaseEnabled && db) {
            showToast('⏳ กำลังลบข้อมูลแชทถาวร...', 'info');
            
            // 1. Delete messages subcollection
            db.collection('rooms').doc(roomId).collection('messages').get()
                .then(snapshot => {
                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    return batch.commit();
                })
                .then(() => {
                    // 2. Delete room document
                    return db.collection('rooms').doc(roomId).delete();
                })
                .then(() => {
                    // 3. Delete dispute document if any
                    return db.collection('disputes').where('roomId', '==', roomId).get();
                })
                .then(snapshot => {
                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    return batch.commit();
                })
                .then(() => {
                    showToast('🗑 ลบข้อมูลดีลถาวรเรียบร้อยแล้ว', 'success');
                    renderDealsSidebar();
                    updateViews();
                })
                .catch(err => {
                    console.error("Error deleting room from Firestore:", err);
                    showToast('❌ ไม่สามารถลบข้อมูลในเซิร์ฟเวอร์ได้', 'error');
                });
        } else {
            // Local fallback
            state.rooms = state.rooms.filter(r => r.id !== roomId);
            state.disputes = state.disputes.filter(d => d.roomId !== roomId);
            
            showToast('🗑 ลบข้อมูลดีลจำลองถาวรเรียบร้อยแล้ว', 'success');
            renderDealsSidebar();
            updateViews();
        }
    }
}


function updateProposalUI() {
    const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
    if (!activeRoom) return;
    const sendBtn = document.querySelector('#seller-panel button[onclick="sendProductProposal()"]');
    if (!sendBtn) return;
    
    const activeMessages = isFirebaseEnabled ? (state.activeRoomMessages || []) : (activeRoom.messages || []);
    const hasPendingProposal = activeMessages.some(m => m.isProposal && m.proposal && !m.proposal.rejected);
    
    if (activeRoom.escrowStatus === 'none' && hasPendingProposal) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fa-solid fa-clock"></i> รอผู้ซื้อตอบรับข้อเสนอ';
    } else if (activeRoom.escrowStatus === 'none') {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> ส่งข้อเสนอไปยังแชท';
    }
}
async function checkMessageFilter(text) {
    const regexPattern = /โอนนอก|โอนตรง|โอนบัญชีตรง|นอกระบบ|ไม่ผ่านคนกลาง|โอนให้เลย|โอนก่อน|โอนวอเลทตรง|ควย|หี|สัส|สัตว์|เหี้ย|อีดอก|กะหรี่|หน้าหี|พ่องตาย|พ่อมึงตาย|แม่มึงตาย|ควาย|สันดาน|แม่ง|เย็ด|ค\.ย|ค_ย|ห_ี|ส_ส|ตุ๊ด|แต๋ว|กระเทย|ขี้เรื้อน|ชั้นต่ำ|ต่ำตม|เจ๊ก|ลาว/i;
    
    if (regexPattern.test(text.replace(/\s+/g, ''))) {
        return false;
    }
    
    try {
        const response = await fetch('https://api.opentyphoon.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer sk-7Z2baWyqhbFJzcxRQBp6ug9ZaBniaSqLrI9hBszFtl5MF1vG'
            },
            body: JSON.stringify({
                model: 'typhoon-v1.5x-70b-instruct',
                messages: [
                    {
                        role: 'system',
                        content: 'คุณคือระบบ AI ตรวจสอบข้อความแชท ให้ตอบกลับแค่คำว่า "CLEAN" หากข้อความนั้นปลอดภัย หรือ "REJECT" หากข้อความนั้นมีลักษณะ: 1. พยายามหลอกลวงหรือชวนซื้อขายนอกระบบ (เช่น ขอโอนตรง ไม่ผ่านเว็บ ขอเบอร์เพื่อโอน) 2. หยาบคายรุนแรง 3. เหยียดเพศ ชนชั้น หรือเชื้อชาติ ห้ามอธิบายเหตุผล ให้ตอบแค่ CLEAN หรือ REJECT เท่านั้น'
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                temperature: 0.1,
                max_tokens: 5
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            const result = data.choices[0].message.content.trim().toUpperCase();
            return result.includes('CLEAN');
        }
    } catch (err) {
        console.error('Typhoon API Error:', err);
        return true; 
    }
    return true;
}

function handleChatWarning() {
    const userId = state.loggedInUser.id;
    const warningsKey = "flixo_chat_warnings_" + userId;
    const banKey = "flixo_chat_banned_until_" + userId;
    
    let warnings = parseInt(localStorage.getItem(warningsKey) || '0');
    warnings += 1;
    
    if (warnings >= 5) {
        const banUntil = Date.now() + 15 * 60 * 1000;
        localStorage.setItem(banKey, banUntil.toString());
        localStorage.setItem(warningsKey, '0');
        showToast('🚫 คุณถูกระงับการแชท 15 นาที เนื่องจากละเมิดกฎซ้ำซาก', 'error');
        renderDealChatWindow();
    } else {
        localStorage.setItem(warningsKey, warnings.toString());
        showToast('⚠️ คำเตือน: ตรวจพบคำพูดไม่เหมาะสมหรือผิดกฎ (ครั้งที่ ' + warnings + '/5) หากครบ 5 ครั้งจะถูกแบน', 'warning');
    }
}