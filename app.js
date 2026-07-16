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
        console.log("✓ FLIXO: Firebase Connected (Firestore + Auth).");
        
        // Handle Redirect Login (for browsers that block popups like Edge or LINE app)
        auth.getRedirectResult().then(result => {
            if (result && result.user) {
                const user = result.user;
                // Auto login user since they just came back from Google
                handleUserSessionInit(user.email, user.displayName, user.photoURL);
            }
        }).catch(err => {
            console.error("Redirect login error:", err);
            alert('❌ เกิดข้อผิดพลาดตอนกลับมาจาก Google: ' + err.message);
        });

    } catch (err) {
        console.error("❌ FLIXO: Firebase initialization failed:", err);
    }
} else {
    console.log("ℹ FLIXO: Running in Local Simulator Mode.");
}

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
        name: 'เธเธธเธ“เธกเธฒเธเธต เธกเธตเธเธฒเธข',
        phone: '0819981092',
        kycStatus: 'verified',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=manee'
    },
    {
        id: '884-902',
        name: 'เธเธธเธ“เธชเธกเธจเธฑเธเธ”เธดเน เธฃเธฑเธเธ”เธต',
        phone: '0892238849',
        kycStatus: 'unverified',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=somsak'
    },
    {
        id: '204-188',
        name: 'เธเธธเธ“เธงเธดเธเธฑเธข เนเธเธเธฅเนเธฒ',
        phone: '0851212041',
        kycStatus: 'verified',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=wichai'
    },
    // Admin Master Account
    {
        id: '000-001',
        name: 'FLIXO Administrator',
        email: 'tawannatv@gmail.com',
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
        game: '๐ฎ',
        gadget: '๐“ฑ',
        shirt: '๐‘•'
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
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span style="font-weight: 500;">กำลังเปลี่ยนหน้าต่างไป Google...</span>';
        btn.disabled = true;

        const provider = new firebase.auth.GoogleAuthProvider();
        
        // Use signInWithRedirect for bulletproof mobile and strict browser support
        auth.signInWithRedirect(provider).catch(err => {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            alert('❌ เกิดข้อผิดพลาด: ' + err.message);
        });
    } else {
        alert("❌ Firebase ยังไม่ถูกตั้งค่า หรือเชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบ Config");
    }
}

function loginWithMockEmail() {
    const input = document.getElementById('mock-login-email');
    const email = input.value.trim().toLowerCase();
    
    if (!email || !email.includes('@')) {
        alert('เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธญเธตเน€เธกเธฅเธเธณเธฅเธญเธเนเธซเนเธ–เธนเธเธ•เนเธญเธ');
        return;
    }

    if (email === 'tawannatv@gmail.com') {
        showToast('๐”“ [Admin Bypass]: เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเนเธญเธ”เธกเธดเธเนเธเนเธซเธกเธ”เธเธณเธฅเธญเธ', 'success');
    }
    
    // Use email prefix as display name if we don't have one
    const displayName = email.split('@')[0];
    
    if (isFirebaseEnabled && auth) {
        // In a real scenario, we shouldn't allow mock login if Firebase is enabled, 
        // but for testing purposes we allow it to bypass Google Auth.
        handleUserSessionInit(email, displayName, null);
    } else {
        fallbackLocalLogin(email, displayName, null);
    }
}

function handleUserSessionInit(email, displayName, photoURL) {
    if (!email) email = 'unknown@flixo.com';
    const cleanEmail = email.toLowerCase();
    
    if (isFirebaseEnabled) {
        db.collection('users').where('email', '==', cleanEmail).get()
            .then(querySnapshot => {
                let user;
                if (querySnapshot.empty) {
                    // Check if it's the Admin specific email
                    if (cleanEmail === 'tawannatv@gmail.com') {
                        user = {
                            id: '000-001',
                            name: 'FLIXO Administrator',
                            email: cleanEmail,
                            kycStatus: 'verified', // Admin auto verified
                            avatar: photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=admin`
                        };
                    } else {
                        // Create new user profile in Firestore
                        const part1 = Math.floor(100 + Math.random() * 900).toString();
                        const part2 = Math.floor(100 + Math.random() * 900).toString();
                        const id = `${part1}-${part2}`;
                        
                        user = {
                            id: id,
                            name: displayName || `User ${id}`,
                            email: cleanEmail,
                            kycStatus: 'unverified',
                            avatar: photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`
                        };
                    }
                    
                    db.collection('users').doc(user.id).set(user)
                        .then(() => { enterMainApp(user); });
                } else {
                    user = querySnapshot.docs[0].data();
                    // Force admin verified
                    if (cleanEmail === 'tawannatv@gmail.com') {
                        user.kycStatus = 'verified';
                        // Update photo URL if available
                        if (photoURL && user.avatar.includes('dicebear')) {
                            user.avatar = photoURL;
                            db.collection('users').doc(user.id).update({ avatar: photoURL });
                        }
                    }
                    enterMainApp(user);
                }
            })
            .catch(err => {
                console.error("Firestore error:", err);
                alert("เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”เนเธเธเธฒเธฃเน€เธเธทเนเธญเธกเธ•เนเธญเธเธฒเธเธเนเธญเธกเธนเธฅ เน€เธฃเธดเนเธกเธ•เนเธเธฃเธฐเธเธเนเธเธ Local simulation");
                fallbackLocalLogin(cleanEmail, displayName, photoURL);
            });
    } else {
        fallbackLocalLogin(cleanEmail, displayName, photoURL);
    }
}

function fallbackLocalLogin(email, displayName, photoURL) {
    let user = MOCK_USERS.find(u => u.email === email);
    if (!user) {
        const id = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
        user = {
            id: id,
            name: displayName || `User ${id}`,
            email: email,
            kycStatus: 'unverified',
            avatar: photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`
        };
        MOCK_USERS.push(user);
    }
    // Force verified for admin in fallback too
    if (user.email === 'tawannatv@gmail.com') {
        user.kycStatus = 'verified';
    }
    enterMainApp(user);
}


function enterMainApp(user) {
    state.loggedInUser = user;
    state.loginStep = 'app';
    
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
    
    // Switch view
    changeAppTab('dashboard');
    
    // Initialize Real-time Database Listeners if available
    initRealtimeListeners();
    
    updateViews();
    
    // Show smooth toast instead of disruptive alert
    showToast(`โ“ เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเธชเธณเน€เธฃเนเธ! ID: ${user.id}`, 'success');
}

function logout() {
    if (confirm('เธเธธเธ“เธ•เนเธญเธเธเธฒเธฃเธญเธญเธเธเธฒเธเธฃเธฐเธเธเธซเธฃเธทเธญเนเธกเน?')) {
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
        alert('เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธฃเธซเธฑเธชเธชเธกเธฒเธเธดเธ ID เธเธนเนเธเนเธฒเนเธเธฃเธนเธเนเธเธ XXX-XXX');
        return;
    }
    
    if (input === state.loggedInUser.id) {
        alert('เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เน€เธเธดเธ”เธ”เธตเธฅเธเธฑเธเธ•เธฑเธงเน€เธญเธเนเธ”เน');
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
                    else alert('เนเธกเนเธเธเธเธนเนเนเธเนเธฃเธซเธฑเธชเธเธตเนเนเธเธเธฒเธเธเนเธญเธกเธนเธฅเธเธฅเธฒเธงเธ”เน');
                }
            })
            .catch(err => {
                console.error("Search error:", err);
            });
    } else {
        const user = MOCK_USERS.find(u => u.id === input || u.email === input);
        if (user) showSearchResult(user);
        else alert('เนเธกเนเธเธเธฃเธซเธฑเธชเธเธนเนเนเธเนเธเธณเธฅเธญเธเธเธตเนเนเธเธฃเธฐเธเธ');
    }
}

function showSearchResult(user) {
    state.searchResult = user;
    
    document.getElementById('result-user-avatar').src = user.avatar;
    document.getElementById('result-user-name').innerText = user.name;
    document.getElementById('result-user-id-text').innerText = `ID: ${user.id} (${user.email})`;
    
    const kycBadge = document.getElementById('result-user-kyc');
    if (user.kycStatus === 'verified') {
        kycBadge.className = 'badge badge-outline status-green';
        kycBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> เธขเธทเธเธขเธฑเธ e-KYC เนเธฅเนเธง';
    } else {
        kycBadge.className = 'badge badge-outline status-red';
        kycBadge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> เธขเธฑเธเนเธกเนเธขเธทเธเธขเธฑเธ e-KYC';
    }
    
    document.getElementById('search-result-card').style.display = 'block';
}

function initiateDeal(role) {
    const partner = state.searchResult;
    if (!partner) return;
    
    // MANDATORY KYC VERIFICATION: Everyone must verify KYC except Admins (0830158022 or 0831058022)
    const isAdmin = state.loggedInUser.email === 'tawannatv@gmail.com';
    if (!isAdmin && state.loggedInUser.kycStatus !== 'verified') {
        alert('เธฃเธฐเน€เธเธตเธขเธเธเธงเธฒเธกเธเธฅเธญเธ”เธ เธฑเธข: เธชเธกเธฒเธเธดเธเธ—เธฑเนเธงเนเธเธ—เธธเธเธเธเธ•เนเธญเธเธเนเธฒเธเธเธฒเธฃเธขเธทเธเธขเธฑเธเธ•เธฑเธงเธ•เธ (e-KYC) เนเธซเนเธชเธณเน€เธฃเนเธเธเนเธญเธเน€เธฃเธดเนเธกเธ”เธตเธฅเธเธทเนเธญเธเธฒเธขเนเธเธฃเธฐเธเธ FLIXO');
        openKycModal();
        return;
    }
    
    const buyerName = role === 'buyer' ? state.loggedInUser.name : partner.name;
    const buyerId = role === 'buyer' ? state.loggedInUser.id : partner.id;
    const sellerName = role === 'seller' ? state.loggedInUser.name : partner.name;
    const sellerId = role === 'seller' ? state.loggedInUser.id : partner.id;
    
    const topic = `เธ”เธตเธฅเธเธทเนเธญเธเธฒเธขเธฃเธฐเธซเธงเนเธฒเธเธเธนเนเธเธฒเธข ${sellerName} เนเธฅเธฐเธเธนเนเธเธทเนเธญ ${buyerName}`;
    
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
                    escrowMoneyState: 'เธขเธฑเธเนเธกเนเธกเธตเธเธฒเธฃเธเธณเธฃเธฐเน€เธเธดเธ',
                    hasDispute: false,
                    dispute: null
                };
                
                db.collection('rooms').add(newDoc)
                    .then(docRef => {
                        state.activeRoomId = docRef.id;
                        docRef.collection('messages').add({
                            sender: 'system',
                            text: `เธชเธฑเธเธเธฒเธ”เธตเธฅเธเธทเนเธญเธเธฒเธขเธเธฅเธฒเธเนเธฅเธฐเธซเนเธญเธเนเธเธ—เธเธธเนเธกเธเธฃเธญเธเนเธ”เธข FLIXO เธ–เธนเธเธชเธฃเนเธฒเธเธเธถเนเธเธชเธณเน€เธฃเนเธ`,
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
            escrowMoneyState: 'เธขเธฑเธเนเธกเนเธกเธตเธเธฒเธฃเนเธญเธเน€เธเธดเธเธเธฑเธเน€เธเนเธ',
            hasDispute: false,
            dispute: null,
            activeRole: role,
            messages: [
                { sender: 'system', text: `เธชเธฑเธเธเธฒเธ”เธตเธฅเธ–เธนเธเธฃเธดเน€เธฃเธดเนเธกเนเธ”เธขเธเธนเนเนเธเนเธ—เธฑเนเธเธชเธญเธเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง`, timestamp: getFormattedTime(), clientTimestamp: Date.now(), isSystem: true }
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
                    text: 'เธชเธงเธฑเธชเธ”เธตเธเธฃเธฑเธ เธเธฅเนเธญเธขเธ”เธตเธฅเธเธธเนเธกเธเธฃเธญเธเนเธ”เธขเธเธฑเธเธเธตเธ•เธฑเธงเธเธฅเธฒเธเธเธญเธ FLIXO เธเธฅเธญเธ”เธ เธฑเธขเนเธเนเธเธญเธ เน€เธ”เธตเนเธขเธงเธเธกเธญเธญเธเนเธเน€เธชเธเธญเธฃเธฒเธเธฒเนเธซเนเธเธฐเธเธฃเธฑเธ',
                    timestamp: getFormattedTime(),
                    clientTimestamp: Date.now() + 10
                });
                updateViews();
            }, 1000);
        }
    }
    
    document.getElementById('search-user-id').value = '';
    document.getElementById('search-result-card').style.display = 'none';
    state.searchResult = null;
}

// ==========================================================================
// Unified Core Navigation & Tab Router
// ==========================================================================

function changeAppTab(tab) {
    // SECURITY ACCESS CONTROL: Only phone 0830158022 or 0831058022 can access admin tab (Frontend protection)
    if (tab === 'admin') {
        const isAdmin = state.loggedInUser && (state.loggedInUser.email === 'tawannatv@gmail.com');
        if (!isAdmin) {
            alert('โ [เธเธงเธฒเธกเธเธฅเธญเธ”เธ เธฑเธข FLIXO]: เธเธเธดเน€เธชเธเธเธฒเธฃเน€เธเนเธฒเธ–เธถเธ! เธเธฑเธเธเธตเธเธญเธเธเธธเธ“เนเธกเนเธกเธตเธชเธดเธ—เธเธดเนเน€เธเนเธฒเนเธเนเธเธฒเธเธฃเธฐเธเธเธเธนเนเธ”เธนเนเธฅเธฃเธฐเธเธ (Admin Only)');
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
    
    const isAdmin = state.loggedInUser && (state.loggedInUser.email === 'tawannatv@gmail.com');
    
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
    const dashboardKycBtn = document.getElementById('btn-kyc-dashboard-trigger');
    
    if (state.loggedInUser.kycStatus === 'verified') {
        kycBadge.className = 'badge badge-outline status-green';
        kycBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> เธขเธทเธเธขเธฑเธ e-KYC เนเธฅเนเธง';
        dashboardKycBox.className = 'profile-kyc-status-text text-center mt-10 verified status-green';
        dashboardKycBox.innerHTML = '<i class="fa-solid fa-circle-check"></i> เธขเธทเธเธขเธฑเธเธ•เธฑเธงเธ•เธเธชเธณเน€เธฃเนเธเนเธฅเนเธง (เธกเธตเธชเธดเธ—เธเธดเนเธ—เธณเธชเธฑเธเธเธฒเนเธเธฃเธฐเธเธ)';
        dashboardKycBtn.style.display = 'none';
    } else if (state.loggedInUser.kycStatus === 'pending') {
        kycBadge.className = 'badge badge-outline text-warning';
        kycBadge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> เธฃเธญเธ”เธณเน€เธเธดเธเธเธฒเธฃ';
        dashboardKycBox.className = 'profile-kyc-status-text text-center mt-10 text-warning';
        dashboardKycBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> เน€เธญเธเธชเธฒเธฃเธเธณเธฅเธฑเธเธฃเธญเธ•เธฃเธงเธเธชเธญเธเนเธ”เธขเธเธนเนเธ”เธนเนเธฅเธฃเธฐเธเธ';
        dashboardKycBtn.style.display = 'none';
    } else if (state.loggedInUser.kycStatus === 'failed') {
        kycBadge.className = 'badge badge-outline status-red';
        kycBadge.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> เธขเธทเนเธเธ•เธฃเธงเธเนเธกเนเธเนเธฒเธ';
        dashboardKycBox.className = 'profile-kyc-status-text text-center mt-10 status-red';
        dashboardKycBox.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> เธ•เธฃเธงเธเธชเธญเธเธฅเนเธกเน€เธซเธฅเธง เธเธฃเธธเธ“เธฒเธขเธทเนเธเน€เธญเธเธชเธฒเธฃเธญเธตเธเธเธฃเธฑเนเธ';
        dashboardKycBtn.style.display = 'block';
    } else {
        kycBadge.className = 'badge badge-outline';
        kycBadge.innerHTML = '<i class="fa-solid fa-circle-xmark status-red"></i> เธขเธฑเธเนเธกเนเนเธ”เนเธขเธทเธเธขเธฑเธ e-KYC';
        dashboardKycBox.className = 'profile-kyc-status-text text-center mt-10';
        dashboardKycBox.innerHTML = 'เธขเธฑเธเนเธกเนเนเธ”เนเธขเธทเธเธขเธฑเธเธ•เธฑเธงเธ•เธ';
        dashboardKycBtn.style.display = 'block';
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
        listDiv.innerHTML = `<div class="text-center text-muted p-10 font-12">${state.showArchived ? 'เนเธกเนเธกเธตเธ”เธตเธฅเธ—เธตเนเน€เธเนเธเนเธงเน' : 'เนเธกเนเธกเธตเธ”เธตเธฅเธเธทเนเธญเธเธฒเธขเธ—เธตเนเธเธณเธฅเธฑเธเธ”เธณเน€เธเธดเธเธเธฒเธฃ'}</div>`;
        return;
    }
    
    let html = '';
    visibleRooms.forEach(room => {
        const isBuyer = room.buyerId === state.loggedInUser.id;
        const partnerName = isBuyer ? room.sellerName : room.buyerName;
        const isPinned = state.pinnedRooms.includes(room.id);
        const isArchived = state.archivedRooms.includes(room.id);
        
        let statusBadge = '';
        if (room.escrowStatus === 'held') statusBadge = '<span class="chat-item-badge held">เธเธฑเธเน€เธเนเธเน€เธเธดเธ</span>';
        else if (room.escrowStatus === 'released') statusBadge = '<span class="chat-item-badge released">เนเธญเธเน€เธเธดเธเนเธฅเนเธง</span>';
        else if (room.escrowStatus === 'suspended') statusBadge = '<span class="chat-item-badge suspended">เธฃเธฐเธเธฑเธเธ”เธตเธฅ</span>';
        
        const isActive = state.activeRoomId === room.id ? 'active' : '';
        const roleIndicator = isBuyer ? '<span class="badge badge-outline font-9">เธเธนเนเธเธทเนเธญ</span>' : '<span class="badge badge-outline font-9">เธเธนเนเธเธฒเธข</span>';
        const pinIcon = isPinned ? '<i class="fa-solid fa-thumbtack pin-icon" title="เธเธฑเธเธซเธกเธธเธ”เธญเธขเธนเน"></i>' : '';
        const isClosed = state.closedRooms.includes(room.id) || room.status === 'closed';
        const nickname = getNickname(room.id);
        const displayName = nickname ? `<span class="nickname-label">${nickname}</span>` : `${partnerName} ${roleIndicator}`;
        const closedBadge = isClosed ? '<span class="chat-item-badge" style="background:rgba(20,184,166,0.15);color:#14b8a6;border:1px solid rgba(20,184,166,0.3);">โ…เน€เธชเธฃเนเธเธชเธดเนเธ</span>' : statusBadge;
        
        html += `
            <div class="chat-item ${isActive}" id="chat-item-${room.id}" onclick="selectRoom('${room.id}')">
                <div class="chat-item-header">
                    <span class="chat-item-title">${pinIcon}${displayName}</span>
                    <div style="display:flex;align-items:center;gap:5px;flex-shrink:0" onclick="event.stopPropagation()">
                        ${closedBadge}
                        <button class="btn-deal-menu" onclick="openDealMenu(event,'${room.id}')" title="เธ•เธฑเธงเน€เธฅเธทเธญเธ">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                    </div>
                </div>
                ${nickname ? `<div class="chat-item-subnote">${partnerName} ${roleIndicator}</div>` : ''}
                <div class="chat-item-preview">${isClosed ? 'โ… เธ”เธตเธฅเน€เธชเธฃเนเธเธชเธดเนเธเนเธฅเนเธง' : 'เธเธฅเธดเธเน€เธเธทเนเธญเน€เธเนเธฒเธชเธนเนเธซเนเธญเธเน€เธเธฃเธเธฒเธชเธฑเธเธเธฒเธเธทเนเธญเธเธฒเธข'}</div>
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
        <div class="deal-menu-item" onclick="setRoomNickname('${roomId}')">
            <i class="fa-solid fa-tag"></i> เธ•เธฑเนเธเธเธทเนเธญเธญเนเธฒเธเธญเธดเธเธซเนเธญเธเธเธตเน
        </div>
        <div class="deal-menu-item" onclick="togglePinRoom('${roomId}')">
            <i class="fa-solid fa-thumbtack"></i> ${isPinned ? 'เธขเธเน€เธฅเธดเธเธเธฑเธเธซเธกเธธเธ”' : 'เธเธฑเธเธซเธกเธธเธ”เธ”เธตเธฅเธเธตเน'}
        </div>
        ${!isClosed ? `<div class="deal-menu-item deal-menu-archive" onclick="toggleArchiveRoom('${roomId}')">
            <i class="fa-solid fa-box-archive"></i> ${isArchived ? 'เธเธณเธ”เธตเธฅเธเธฅเธฑเธเธกเธฒ' : 'เน€เธเนเธเธ”เธตเธฅเธเธตเน'}
        </div>` : ''}
        <div class="deal-menu-sep"></div>
        ${canClose && !isClosed ? `<div class="deal-menu-item deal-menu-close" onclick="closeDeal('${roomId}')">
            <i class="fa-solid fa-flag-checkered"></i> เธเธดเธ”เธ”เธตเธฅเธเธตเน
        </div>` : ''}
        ${!canClose && !isClosed ? `<div class="deal-menu-item deal-menu-disabled" title="เธเธดเธ”เนเธ”เนเน€เธกเธทเนเธญเนเธญเธเน€เธเธดเธเน€เธชเธฃเนเธเนเธฅเนเธงเน€เธ—เนเธฒเธเธฑเนเธ">
            <i class="fa-solid fa-lock"></i> เธเธดเธ”เธ”เธตเธฅ (เธขเธฑเธเนเธกเนเนเธ”เน)
        </div>` : ''}
        ${isClosed ? `<div class="deal-menu-item deal-menu-disabled">
            <i class="fa-solid fa-circle-check"></i> เธ”เธตเธฅเธเธตเนเธเธดเธ”เนเธฅเนเธง
        </div>` : ''}
        <div class="deal-menu-sep"></div>
        <div class="deal-menu-item" style="color:var(--danger);" onclick="deleteRoom('${roomId}')">
            <i class="fa-solid fa-trash"></i> เธฅเธเนเธเธ—เธ”เธตเธฅเธเธตเน
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
        showToast('โ เธเธดเธ”เนเธ”เนเน€เธเธตเธขเธเน€เธกเธทเนเธญเนเธญเธเน€เธเธดเธเน€เธชเธฃเนเธเนเธฅเนเธง', 'error');
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
        text: 'โ… เธ”เธตเธฅเธเธตเนเน€เธชเธฃเนเธเธชเธดเนเธเนเธฅเนเธง เธเธญเธเธเธธเธ“เธ—เธตเนเนเธเนเธเธฃเธดเธเธฒเธฃ FLIXO Escrow',
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
    showToast('โ… เธเธดเธ”เธ”เธตเธฅเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง เธเธฃเธฐเธงเธฑเธ•เธดเนเธเธ—เธขเธฑเธเธเธเธญเธขเธนเน', 'success');
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
    const name = prompt('เธ•เธฑเนเธเธเธทเนเธญเธญเนเธฒเธเธญเธดเธเธชเธณเธซเธฃเธฑเธเธซเนเธญเธเธเธตเน (เน€เธเธเธฒเธฐเธเธธเธ“เธ—เธตเนเน€เธซเนเธ):', current);
    if (name === null) return;
    try {
        const uid = state.loggedInUser.id;
        const key = 'flixo_nicknames';
        const all = JSON.parse(localStorage.getItem(key) || '{}');
        if (!all[uid]) all[uid] = {};
        if (name.trim() === '') {
            delete all[uid][roomId];
            showToast('เธฅเธเธเธทเนเธญเธญเนเธฒเธเธญเธดเธเนเธฅเนเธง', 'success');
        } else {
            all[uid][roomId] = name.trim().slice(0, 30);
            showToast(`เธ•เธฑเนเธเธเธทเนเธญ โ€${name.trim()}โ€ เน€เธฃเธตเธขเธเธฃเนเธญเธข`, 'success');
        }
        localStorage.setItem(key, JSON.stringify(all));
        renderDealsSidebar();
    } catch(e) { showToast('เธเธฑเธเธ—เธถเธเธเธทเนเธญเนเธกเนเธชเธณเน€เธฃเนเธ', 'error'); }
}

function togglePinRoom(roomId) {
    document.querySelectorAll('.deal-context-menu').forEach(m => m.remove());
    const idx = state.pinnedRooms.indexOf(roomId);
    if (idx > -1) {
        state.pinnedRooms.splice(idx, 1);
        showToast('เธขเธเน€เธฅเธดเธเธเธฑเธเธซเธกเธธเธ”เนเธฅเนเธง', 'success');
    } else {
        state.pinnedRooms.push(roomId);
        showToast('เธเธฑเธเธซเธกเธธเธ”เธ”เธตเธฅเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง โ”', 'success');
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
        showToast('เธเธณเธ”เธตเธฅเธเธฅเธฑเธเธกเธฒเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง โ” เธชเธฒเธกเธฒเธฃเธ–เธชเนเธเธเนเธญเธเธงเธฒเธกเนเธ”เนเธ•เธฒเธกเธเธเธ•เธด', 'success');
    } else {
        state.archivedRooms.push(roomId);
        if (state.activeRoomId === roomId) state.activeRoomId = null;
        renderDealsSidebar();
        updateViews();
        showToast('เน€เธเนเธเธ”เธตเธฅเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง (เธเธฃเธฐเธงเธฑเธ•เธดเนเธเธ—เธขเธฑเธเธเธเธญเธขเธนเน)', 'success');
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
        showToast(`โ เธชเนเธเนเธเนเธเน€เธ•เธทเธญเธเนเธ”เนเธชเธนเธเธชเธธเธ” 3 เธเธฃเธฑเนเธเนเธฅเนเธง เธฃเธญ ${waitSec < 60 ? waitSec + ' เธงเธดเธเธฒเธ—เธต' : waitMin + ' เธเธฒเธ—เธต'}`, 'error');
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
        text: '๐”” เธเธดเนเธ! เนเธเนเธเน€เธ•เธทเธญเธเธญเธตเธเธเนเธฒเธขเธงเนเธฒเธญเธขเธนเนเนเธเธซเนเธญเธ เนเธเธฃเธ”เธ•เธญเธเธเธฅเธฑเธเธ”เนเธงเธข!',
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
    
    showToast(`เธชเนเธเธชเธฑเธเธเธฒเธ“เนเธฅเนเธง! เน€เธซเธฅเธทเธญเธญเธตเธ ${remaining} เธเธฃเธฑเนเธเนเธ 2 เธเธฒเธ—เธต`, 'success');
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
        chatTitle.innerText = 'เน€เธฅเธทเธญเธเธ”เธตเธฅเธซเนเธญเธเนเธเธ—เน€เธเธทเนเธญเธ•เธฃเธงเธเธชเธญเธ';
        chatSubtitle.innerText = '-';
        badgeContainer.innerHTML = '';
        chatMessages.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-comments"></i>
                <p>เน€เธฅเธทเธญเธเธ”เธตเธฅเธซเนเธญเธเนเธเธ—เธเธฅเธฒเธเธ”เนเธฒเธเธเนเธฒเธข เน€เธเธทเนเธญเธ•เธฃเธงเธเธชเธญเธเนเธฅเธฐเนเธเธ—เน€เธเธฃเธเธฒเธเธทเนเธญเธเธฒเธขเธเธฑเธเน€เธเนเธเน€เธเธดเธ</p>
            </div>
        `;
        return;
    }
    
    inputArea.style.display = 'flex';
    detailsPanel.style.display = 'block';
    
    const isClosed = state.closedRooms.includes(activeRoom.id) || activeRoom.status === 'closed';
    const bellBtn = document.getElementById('btn-bell-notify');
    const chatInput = document.getElementById('active-chat-input');
    const sendBtn = inputArea.querySelector('.btn-primary');
    if (isClosed) {
        if (chatInput) { chatInput.disabled = true; chatInput.placeholder = 'เธ”เธตเธฅเธเธตเนเธเธดเธ”เนเธฅเนเธง เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธชเนเธเธเนเธญเธเธงเธฒเธกเนเธ”เน'; }
        if (sendBtn) sendBtn.disabled = true;
        if (bellBtn) bellBtn.disabled = true;
    } else {
        if (chatInput) { chatInput.disabled = false; chatInput.placeholder = 'เธเธดเธกเธเนเธเนเธญเธเธงเธฒเธกเน€เธเธฃเธเธฒ...'; }
        if (sendBtn) sendBtn.disabled = false;
        if (bellBtn) bellBtn.disabled = false;
    }
    
    const isBuyer = activeRoom.buyerId === state.loggedInUser.id;
    const partnerName = isBuyer ? activeRoom.sellerName : activeRoom.buyerName;
    
    chatTitle.innerHTML = `<i class="fa-regular fa-comments"></i> เน€เธเธฃเธเธฒเธเธฑเธ ${partnerName} (${isBuyer ? 'เธเธธเธ“เธเธทเธญ: เธเธนเนเธเธทเนเธญ' : 'เธเธธเธ“เธเธทเธญ: เธเธนเนเธเธฒเธข'})`;
    chatSubtitle.innerText = activeRoom.topic;
    
    let escrowBadgeHtml = '';
    if (activeRoom.escrowStatus === 'held') {
        escrowBadgeHtml = '<span class="badge badge-success"><i class="fa-solid fa-vault"></i> เน€เธเธดเธเธเธฑเธเน€เธเนเธเนเธเธฃเธฐเธเธเธเธฅเธฒเธ (Hold)</span>';
    } else if (activeRoom.escrowStatus === 'released') {
        escrowBadgeHtml = '<span class="badge badge-success bg-teal"><i class="fa-solid fa-check"></i> เธ”เธตเธฅเน€เธชเธฃเนเธเธชเธกเธเธนเธฃเธ“เน (Released)</span>';
    } else if (activeRoom.escrowStatus === 'suspended') {
        escrowBadgeHtml = '<span class="badge bg-red"><i class="fa-solid fa-triangle-exclamation"></i> เธฃเธฐเธเธฑเธเน€เธเธดเธ/เธเนเธญเธเธดเธเธฒเธ— (Suspended)</span>';
    } else {
        escrowBadgeHtml = '<span class="badge badge-outline">เธขเธฑเธเนเธกเนเน€เธฃเธดเนเธกเธเธณเธฃเธฐเน€เธเธดเธ</span>';
    }
    badgeContainer.innerHTML = escrowBadgeHtml;
    
    // Render Right side Action panel
    const rightPanelTitle = document.getElementById('right-panel-title');
    const buyerPanel = document.getElementById('role-buyer-control');
    const sellerPanel = document.getElementById('role-seller-control');
    
    if (isBuyer) {
        rightPanelTitle.innerHTML = '<i class="fa-solid fa-vault"></i> เธเธฑเธเธเธตเธ•เธฑเธงเธเธฅเธฒเธเธเธฑเธเน€เธเนเธเน€เธเธดเธ (Escrow)';
        sellerPanel.style.display = 'none';
        buyerPanel.style.display = 'block';
        
        const statusText = document.getElementById('user-escrow-status-text');
        const escrowPrice = document.getElementById('user-escrow-price');
        const moneyState = document.getElementById('user-escrow-money-state');
        const actionContainer = document.getElementById('user-escrow-actions');
        const infoCard = document.getElementById('user-escrow-info-card');
        
        escrowPrice.innerText = `เธฟ${activeRoom.escrowAmount.toLocaleString()}`;
        
        if (activeRoom.escrowStatus === 'none') {
            statusText.innerText = 'เธขเธฑเธเนเธกเนเธกเธตเธเธธเธฃเธเธฃเธฃเธก';
            infoCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center';
            moneyState.innerText = 'เนเธกเนเธกเธตเน€เธเธดเธเธเธณเธฃเธฐเธเธฑเธเน€เธเนเธ';
            actionContainer.innerHTML = `<p class="text-muted font-11 text-center">เธฃเธญเธเธนเนเธเธฒเธขเธชเธฃเนเธฒเธเธฃเธฒเธขเธเธฒเธฃเนเธเน€เธชเธเธญเธฃเธฒเธเธฒเนเธเธซเนเธญเธเนเธเธ— เน€เธเธทเนเธญเน€เธเธดเธ”เธซเธเนเธฒเธ•เนเธฒเธเธเนเธฒเธขเน€เธเธดเธ</p>`;
        } else {
            if (activeRoom.escrowStatus === 'held') {
                statusText.innerText = 'เธเธฑเธเน€เธเนเธเนเธเธฃเธฐเธเธ (Hold)';
                infoCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center held';
                moneyState.innerText = 'เธเธฑเธเธขเธญเธ”เน€เธเธดเธเธเธฅเธฒเธเนเธฅเนเธง เธฃเธญเธฃเธฑเธเนเธฅเธฐเน€เธเนเธเธชเธดเธ—เธเธดเนเธชเธดเธเธเนเธฒ';
                actionContainer.innerHTML = `
                    <button class="btn-success btn-block" onclick="confirmEscrowReceipt('${activeRoom.id}')">
                        <i class="fa-solid fa-circle-check"></i> เธ•เธฃเธงเธเธเธญเธเธเธฃเธเนเธฅเนเธง & เธเธฅเนเธญเธขเน€เธเธดเธเนเธญเธ
                    </button>
                    <button class="btn-danger btn-block" onclick="triggerOpenDisputeModal('${activeRoom.id}')">
                        <i class="fa-solid fa-triangle-exclamation"></i> เนเธเนเธเนเธ”เธเนเธเธ/เน€เธเธดเธ”เธเนเธญเธเธดเธเธฒเธ—
                    </button>
                `;
            } else if (activeRoom.escrowStatus === 'released') {
                statusText.innerText = 'เนเธญเธเธเนเธฒเธขเนเธฅเนเธง (Released)';
                infoCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center released';
                moneyState.innerText = 'เนเธญเธเน€เธเธดเธเน€เธเนเธฒเธเธฑเธเธเธตเธเธนเนเธเธฒเธขเธชเธณเน€เธฃเนเธ';
                actionContainer.innerHTML = `<div class="alert-box alert-success text-center">เธ”เธตเธฅเธชเธฑเธเธเธฒเน€เธชเธฃเนเธเธชเธกเธเธนเธฃเธ“เนเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง</div>`;
            } else if (activeRoom.escrowStatus === 'suspended') {
                statusText.innerText = 'เธฃเธฐเธเธฑเธเธเธงเธฒเธกเน€เธชเธตเธขเธซเธฒเธข (Suspended)';
                infoCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center suspended';
                moneyState.innerText = 'เธฅเนเธญเธเน€เธเธดเธเธเธฅเธฒเธเธเธฑเนเธงเธเธฃเธฒเธง เธญเธขเธนเนเธฃเธฐเธซเธงเนเธฒเธเธ•เธฃเธงเธเธชเธญเธเธเธขเธฒเธ';
                actionContainer.innerHTML = `<div class="alert-box alert-warning">เธ”เธตเธฅเธเธตเนเธเนเธฒเธเธชเนเธเธ•เธฃเธงเธเนเธ”เธข AI & เธเธนเนเธ”เธนเนเธฅเธเธฑเธ”เธเธฃเธญเธ</div>`;
            }
        }
    } else {
        rightPanelTitle.innerHTML = '<i class="fa-solid fa-cart-plus"></i> เน€เธเธฃเธทเนเธญเธเธกเธทเธญเธ•เธฐเธเธฃเนเธฒเธเนเธญเน€เธชเธเธญ';
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
            sellerEscrowPrice.innerText = `เธฟ${activeRoom.escrowAmount.toLocaleString()}`;
            
            if (activeRoom.escrowStatus === 'held') {
                sellerStatusText.innerText = 'เธเธฑเธเน€เธเนเธเนเธเธฃเธฐเธเธ (Hold)';
                sellerEscrowCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center held';
                sellerMoneyState.innerText = 'เธเธนเนเธเธทเนเธญเธเธณเธฃเธฐเน€เธเธดเธเน€เธเนเธฒเธชเนเธงเธเธเธฅเธฒเธเนเธฅเนเธง';
                sellerActionContainer.innerHTML = `
                    <button class="btn-danger btn-block mt-10" onclick="triggerOpenDisputeModal('${activeRoom.id}')">
                        <i class="fa-solid fa-triangle-exclamation"></i> เนเธเนเธเนเธ”เธเนเธเธ/เน€เธเธดเธ”เธเนเธญเธเธดเธเธฒเธ—
                    </button>
                `;
            } else if (activeRoom.escrowStatus === 'released') {
                sellerStatusText.innerText = 'เนเธญเธเธเนเธฒเธขเนเธฅเนเธง (Released)';
                sellerEscrowCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center released';
                sellerMoneyState.innerText = 'เธเธนเนเธเธทเนเธญเธ•เธฃเธงเธเธชเธญเธเนเธฅเธฐเธขเธทเธเธขเธฑเธเธฃเธฑเธเธชเธดเธเธเนเธฒเนเธฅเนเธง';
                sellerActionContainer.innerHTML = `<div class="alert-box alert-success text-center">เธฃเธฐเธเธเธเธฐเธ—เธณเธเธฒเธฃเนเธญเธเน€เธเนเธฒเธเธฑเธเธเธตเธเธญเธเธเธธเธ“เธ เธฒเธขเนเธ 1 เธเธก.</div>`;
            } else if (activeRoom.escrowStatus === 'suspended') {
                sellerStatusText.innerText = 'เธฃเธฐเธเธฑเธเธเธงเธฒเธกเน€เธชเธตเธขเธซเธฒเธข (Suspended)';
                sellerEscrowCard.querySelector('.escrow-status-bar').className = 'escrow-status-bar text-center suspended';
                sellerMoneyState.innerText = 'เธฅเนเธญเธเน€เธเธดเธเธเธฅเธฒเธเธเธฑเนเธงเธเธฃเธฒเธง เธญเธขเธนเนเธฃเธฐเธซเธงเนเธฒเธเธ•เธฃเธงเธเธชเธญเธเธเธขเธฒเธ';
                sellerActionContainer.innerHTML = `<div class="alert-box alert-warning">เธกเธตเธเนเธญเธเธดเธเธฒเธ—เน€เธเธดเธ”เธเธถเนเธ เธฃเธญเธเธฒเธฃเธเธดเธเธฒเธฃเธ“เธฒเธเธฒเธ AI/Admin</div>`;
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
            const imgChar = MOCK_PHOTOS.product[prop.imageType] || '๐“ฆ';
            
            let btnActionHtml = '';
            if (isBuyer) {
                if (activeRoom.escrowStatus === 'none') {
                    const msgTs = msg.clientTimestamp;
                    btnActionHtml = `
                        <div class="proposal-payment-guide">
                            <p class="font-10 text-muted mb-5"><i class="fa-solid fa-circle-info"></i> เธเธ”เน€เธเธดเธ” QR เธเธฑเธเธเธตเธเธฅเธฒเธเนเธฅเนเธงเธขเธทเธเธขเธฑเธเธเธฒเธฃเนเธญเธเน€เธเธดเธ</p>
                            ${!prop.rejected ? `
                            <button class="btn-success btn-block" onclick="openPaymentQR('${activeRoom.id}', ${prop.price})">
                                <i class="fa-solid fa-qrcode"></i> เน€เธเธดเธ” QR เนเธชเธเธเธเธณเธฃเธฐ (PromptPay)
                            </button>
                            <button class="btn-danger btn-block mt-5" onclick="rejectProposal('${activeRoom.id}', ${msgTs})">
                                <i class="fa-solid fa-xmark"></i> เธเธเธดเน€เธชเธเธเนเธญเน€เธชเธเธญเธเธตเน
                            </button>
                            ` : `<div class="alert-box alert-warning mt-5" style="justify-content:center;flex-direction:column;text-align:center;gap:4px;">
                                <i class="fa-solid fa-ban" style="font-size:18px;color:var(--danger);"></i>
                                <strong style="color:var(--danger);">เธขเธเน€เธฅเธดเธเธเนเธญเน€เธชเธเธญเธเธตเนเนเธฅเนเธง</strong>
                                <span class="font-11 text-muted">เธฃเธญเธเธนเนเธเธฒเธขเธชเนเธเธเนเธญเน€เธชเธเธญเธฃเธฒเธเธฒเนเธซเธกเน</span>
                            </div>`}
                        </div>
                    `;
                } else if (activeRoom.escrowStatus === 'held') {
                    btnActionHtml = `
                        <div class="alert-box alert-info text-center font-10">
                            <i class="fa-solid fa-vault"></i> เน€เธเธดเธเธ–เธนเธเธเธฑเธเนเธเธฃเธฐเธเธเนเธฅเนเธง เธ•เธฃเธงเธเธชเธญเธเธชเธดเธ—เธเธดเนเธชเธฑเธเธเธฒเธเธฑเธเธเธนเนเธเนเธฒเนเธ”เนเน€เธฅเธข
                        </div>
                    `;
                } else if (activeRoom.escrowStatus === 'released') {
                    btnActionHtml = `
                        <div class="alert-box alert-success text-center bg-teal text-white">
                            <i class="fa-solid fa-circle-check"></i> เธ”เธตเธฅเน€เธชเธฃเนเธเธชเธกเธเธนเธฃเธ“เน เนเธญเธเน€เธเธดเธเธญเธญเธเนเธฅเนเธง
                        </div>
                    `;
                } else if (activeRoom.escrowStatus === 'suspended') {
                    btnActionHtml = `
                        <div class="alert-box alert-danger text-center bg-red text-white">
                            <i class="fa-solid fa-triangle-exclamation"></i> เน€เธเธดเธเธเธฑเธเน€เธเนเธเธ–เธนเธเนเธเนเธฃเธฐเธเธฑเธ (เธเนเธญเธเธดเธเธฒเธ—)
                        </div>
                    `;
                }
            } else {
                btnActionHtml = `
                    <div class="alert-box alert-info text-center">
                        <i class="fa-solid fa-store"></i> เนเธเน€เธชเธเธญเธฃเธฒเธเธฒเธเธญเธเธเธธเธ“เธชเนเธเธญเธญเธเนเธเนเธฅเนเธง
                    </div>
                `;
            }
            
            messagesHtml += `
                <div class="msg-row ${msg.sender === state.loggedInUser.id ? 'buyer' : 'seller'}">
                    <div class="cart-proposal">
                        <div class="proposal-banner">
                            <i class="fa-solid fa-cart-shopping"></i> เนเธเน€เธชเธเธญเธชเธฑเธเธเธฒเธเธทเนเธญเธเธฒเธข (FLIXO Escrow)
                        </div>
                        <div class="proposal-item-box">
                            <div class="proposal-img">${imgChar}</div>
                            <div class="proposal-info">
                                <h4>${prop.name}</h4>
                                <p>${prop.desc}</p>
                                <div class="proposal-price-tag">เธฟ${prop.price.toLocaleString()}</div>
                            </div>
                        </div>
                        <div class="proposal-footer">
                            <button class="btn-secondary btn-sm mb-5" style="width:100%" onclick="showProposalDetail(decodeURIComponent('${encodeURIComponent(JSON.stringify({name:prop.name,price:prop.price,category:prop.category,desc:prop.desc,imageBase64:prop.imageBase64}))  }'))"><i class="fa-solid fa-eye"></i> เธ”เธนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธชเธดเธเธเนเธฒ</button>
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
}

function sendDealMessage() {
    const input = document.getElementById('active-chat-input');
    const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
    
    if (!activeRoom || !input.value.trim()) return;
    
    const text = input.value.trim();
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
    
    if (text.toLowerCase().includes('เธเนเธงเธข') || text.toLowerCase().includes('เธเธญเธ—') || text.includes('bot')) {
        simulateChatbotResponse(room, 'เธฃเธฐเธเธเธเนเธญเธเธเธฑเธเธ เธฑเธขเธเธญเธ FLIXO เธขเธดเธเธ”เธตเธ•เนเธญเธเธฃเธฑเธ! เน€เธกเธทเนเธญเธเธนเนเธเธทเนเธญเนเธญเธเน€เธเธดเธเธเธฑเธเน€เธเนเธเธชเธณเน€เธฃเนเธ เธฃเธฐเธเธเธเธฐเธฅเนเธญเธเน€เธเธดเธเนเธฅเธฐเธเธฑเธเน€เธเนเธเนเธงเนเธ—เธตเนเธ•เธฑเธงเธเธฅเธฒเธเธเธเธเธงเนเธฒเธเธธเธ“เธเธฐเธเธ”เธเธฅเนเธญเธขเน€เธเธดเธเนเธซเนเธเธนเนเธเธฒเธข เธเธฃเธธเธ“เธฒเธ•เธฃเธงเธเธชเธญเธเธชเธดเธ—เธเธดเนเธญเธขเนเธฒเธเธฅเธฐเน€เธญเธตเธขเธ”เธเนเธญเธเธเธ”เธขเธทเธเธขเธฑเธเธเธฅเนเธญเธขเน€เธเธดเธเธเธฐเธเธฃเธฑเธ');
        return;
    }
    
    if (isBuyer) {
        if (text.includes('เน€เธ—เนเธฒเนเธซเธฃเน') || text.includes('เธฃเธฒเธเธฒ')) {
            room.messages.push({
                sender: partnerId,
                text: 'เธชเน€เธเธเธเธตเนเธเธกเธเธญเธฃเธฒเธเธฒเธ”เธตเธฅเน€เธเนเธ•เน เธ—เธตเน 3,500 เธเธฒเธ—เธเธฃเธฑเธ เธเธฅเธญเธ”เธ เธฑเธขเธเนเธฒเธเธ•เธฑเธงเธเธฅเธฒเธเธเธญเธ FLIXO เน€เธ”เธตเนเธขเธงเธเธกเธเธ”เธชเธฃเนเธฒเธเธเนเธญเน€เธชเธเธญเธชเนเธเนเธเนเธเธ—เนเธซเนเธเธฐเธเธฃเธฑเธ',
                timestamp: getFormattedTime(),
                clientTimestamp: Date.now()
            });
            updateViews();
        } else if (text.includes('เนเธญเธเนเธฅเนเธง') || text.includes('เธเนเธฒเธขเนเธฅเนเธง')) {
            room.messages.push({
                sender: partnerId,
                text: 'เธเธญเธเธเธธเธ“เธ—เธตเนเนเธงเนเนเธเนเธเน FLIXO เธเธฃเธฑเธ! เธฃเธฐเธเธเนเธเนเธเธเธฑเธเธขเธญเธ”เนเธฅเนเธง เธเนเธญเธกเธนเธฅเนเธญเธ”เธตเธเธญเธเธเธกเธเธทเธญ: flixo_pro_game@gmail.com / Pass: Flix8899201 เธเธฃเธฑเธ เธฅเธญเธเน€เธเนเธฒเธฃเธฐเธเธเนเธเธขเธทเธเธขเธฑเธเธ•เธฑเธงเธ•เธเน€เธเนเธเธชเธเธดเธเนเธ”เนเน€เธฅเธข',
                timestamp: getFormattedTime(),
                clientTimestamp: Date.now()
            });
            updateViews();
        }
    } else {
        if (text.includes('เธฃเธซเธฑเธช') || text.includes('เธชเนเธเธกเธญเธ') || text.includes('เธเนเธญเธกเธนเธฅ')) {
            room.messages.push({
                sender: partnerId,
                text: 'เธเธณเธฅเธฑเธเน€เธเนเธเธเธฑเธเธเธตเน€เธกเธฅเนเธฅเธฐเธเนเธญเธกเธนเธฅเนเธญเธ”เธตเธญเธขเธนเนเธเธฐเธเธฃเธฑเธ เธฃเธเธเธงเธเธญเธขเนเธฒเน€เธเธดเนเธเธ—เธดเนเธเนเธเธ—เนเธเนเธซเธ',
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
        text: `๐ค– [AI FLIXO Chatbot]: ${text}`,
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
        showToast('โ เน€เธเธเธฒเธฐเธเธนเนเธเธฒเธขเน€เธ—เนเธฒเธเธฑเนเธเธ—เธตเนเธชเธฒเธกเธฒเธฃเธ–เธชเธฃเนเธฒเธเนเธเน€เธชเธเธญเธฃเธฒเธเธฒเนเธ”เน', 'error');
        return;
    }
    
    // MANDATORY KYC VERIFICATION: Everyone must verify KYC except Admins (0830158022 or 0831058022)
    const isAdmin = state.loggedInUser.email === 'tawannatv@gmail.com';
    if (!isAdmin && state.loggedInUser.kycStatus !== 'verified') {
        alert('เธฃเธฐเน€เธเธตเธขเธเธเธงเธฒเธกเธเธฅเธญเธ”เธ เธฑเธข: เธชเธกเธฒเธเธดเธเธ—เธฑเนเธงเนเธเธ—เธธเธเธเธเธ•เนเธญเธเธเนเธฒเธเธเธฒเธฃเธขเธทเธเธขเธฑเธเธ•เธฑเธงเธ•เธ (e-KYC) เนเธซเนเธชเธณเน€เธฃเนเธเธเนเธญเธเน€เธฃเธดเนเธกเธชเนเธเนเธเธเนเธญเน€เธชเธเธญเธเธฒเธขเนเธเธฃเธฐเธเธ FLIXO');
        openKycModal();
        return;
    }
    
    const name = document.getElementById('prop-name').value;
    const price = parseFloat(document.getElementById('prop-price').value.replace(/,/g, ''));
    const type = document.getElementById('prop-type').value;
    const category = document.getElementById('prop-category') ? document.getElementById('prop-category').value : 'other';
    const imageBase64 = window.propImageBase64 || null;
    const desc = document.getElementById('prop-desc').value;
    
    if (!name || isNaN(price) || price <= 0) {
        showToast('โ เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเธทเนเธญเธชเธดเธเธเนเธฒเนเธฅเธฐเธฃเธฒเธเธฒเนเธซเนเธ–เธนเธเธ•เนเธญเธ', 'error');
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
            text: `เธเธนเนเธเธฒเธขเธญเธญเธเธชเธฑเธเธเธฒเนเธเธ•เธเธฅเธเธฃเธฒเธเธฒเน€เธชเธเธญ เธฟ${price.toLocaleString()} เธเธนเนเธเธทเนเธญเธชเธฒเธกเธฒเธฃเธ–เนเธชเธเธเธเธฃเนเธญเธกเน€เธเธขเนเธเนเธฒเธขเน€เธเธดเธเธเธฑเธเน€เธเนเธเนเธ”เนเธ—เธฑเธเธ—เธต`,
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
            text: `เธเธนเนเธเธฒเธขเธญเธญเธเธเนเธญเน€เธชเธเธญเธเธทเนเธญเธเธฒเธขเธกเธนเธฅเธเนเธฒ เธฟ${price.toLocaleString()} เธเธนเนเธเธทเนเธญเธชเธฒเธกเธฒเธฃเธ–เธเธ”เน€เธเธดเธ” QR เธเธณเธฃเธฐเน€เธเธดเธ เน€เธเธทเนเธญเธเธฑเธเน€เธเนเธเธงเธเน€เธเธดเธเนเธ”เนเธ—เธฑเธเธ—เธต`,
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
    const isAdmin = state.loggedInUser.email === 'tawannatv@gmail.com';
    if (!isAdmin && state.loggedInUser.kycStatus !== 'verified') {
        alert('เธฃเธฐเน€เธเธตเธขเธเธเธงเธฒเธกเธเธฅเธญเธ”เธ เธฑเธข: เธเธธเธ“เธ•เนเธญเธเธขเธทเธเธขเธฑเธเธ•เธฑเธงเธ•เธ e-KYC เนเธซเนเธชเธณเน€เธฃเนเธเธเนเธญเธเธ”เธณเน€เธเธดเธเธเธฑเนเธเธ•เธญเธเธเธณเธฃเธฐเน€เธเธดเธ');
        openKycModal();
        return;
    }
    
    document.getElementById('qr-pay-amount').innerText = `เธฟ${amount.toLocaleString()}`;
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
            escrowMoneyState: 'เธเธฑเธเน€เธเธดเธเน€เธเนเธฒเธเธฃเธฐเน€เธเนเธฒเธเธฑเธเธเธตเธ•เธฑเธงเธเธฅเธฒเธเธชเธณเน€เธฃเนเธ'
        });
        db.collection('rooms').doc(activeRoom.id).collection('messages').add({
            sender: 'system',
            text: `เธขเธญเธ”เน€เธเธดเธเธเธณเธเธงเธ เธฟ${activeRoom.escrowAmount.toLocaleString()} เธ–เธนเธเนเธชเธเธเธเธณเธฃเธฐเนเธฅเธฐเธ•เธฃเธงเธเธเนเธฒเธ API เน€เธเนเธฒเธเธฑเธเน€เธเนเธเนเธ vault เน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง ( Hold )`,
            timestamp: getFormattedTime(),
            clientTimestamp: Date.now(),
            serverTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
            isSystem: true,
            escrowState: 'held'
        });
    } else {
        // Local Fallback
        activeRoom.escrowStatus = 'held';
        activeRoom.escrowMoneyState = 'เธเธฑเธเธขเธญเธ”เน€เธเธดเธเธเธฅเธฒเธเธฃเธฐเธเธเธชเธณเน€เธฃเนเธ';
        activeRoom.messages.push({
            sender: 'system',
            text: `เธขเธญเธ”เน€เธเธดเธเธเธณเธเธงเธ เธฟ${activeRoom.escrowAmount.toLocaleString()} เธ–เธนเธเนเธชเธเธเธเธณเธฃเธฐเนเธฅเธฐเธ•เธฃเธงเธเธเนเธฒเธ API เน€เธเนเธฒเธเธฑเธเน€เธเนเธเนเธ vault เน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง ( Hold )`,
            timestamp: getFormattedTime(),
            clientTimestamp: Date.now(),
            isSystem: true,
            escrowState: 'held'
        });
        updateViews();
    }
    alert('เนเธญเธเธเธณเธฅเธญเธเธเนเธฒเธเธฃเธฐเธเธเธชเธณเน€เธฃเนเธ! เธเธฃเธฑเธเธเธฃเธฐเนเธชเน€เธเธดเธเธเธฑเธเน€เธเนเธเน€เธเนเธ Hold เนเธฅเนเธง');
}

function confirmEscrowReceipt(roomId) {
    const activeRoom = state.rooms.find(r => r.id === roomId);
    if (!activeRoom) return;
    
    if (confirm('เธเธธเธ“เนเธเนเนเธเธงเนเธฒเนเธ”เนเธฃเธฑเธเธเธญเธเธเธฃเธเธ–เนเธงเธเนเธฅเนเธง? เธซเธฅเธฑเธเธเธฒเธเธเธ”เธขเธญเธกเธฃเธฑเธ เธฃเธฐเธเธเธเธฐเธเธฅเนเธญเธขเนเธญเธเน€เธเธดเธเนเธซเนเธเธฑเนเธเธเธนเนเธเธฒเธขเธ—เธฑเธเธ—เธตเนเธฅเธฐเนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธ”เธถเธเธเธทเธเนเธ”เน')) {
        if (isFirebaseEnabled) {
            db.collection('rooms').doc(activeRoom.id).update({
                escrowStatus: 'released',
                escrowMoneyState: 'เธเธฅเนเธญเธขเธขเธญเธ”เธเธณเธฃเธฐเธชเธณเน€เธฃเนเธ'
            });
            db.collection('rooms').doc(activeRoom.id).collection('messages').add({
                sender: 'system',
                text: `เธเธนเนเธเธทเนเธญเธเธ”เธขเธญเธกเธฃเธฑเธเธชเธฑเธเธเธฒ เธขเนเธฒเธขเธขเธญเธ” เธฟ${activeRoom.escrowAmount.toLocaleString()} เน€เธเนเธฒเธเธฃเธฐเน€เธเนเธฒเธเธนเนเธเธฒเธขเน€เธฃเธตเธขเธเธฃเนเธญเธข`,
                timestamp: getFormattedTime(),
                clientTimestamp: Date.now(),
                serverTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                isSystem: true,
                escrowState: 'released'
            });
        } else {
            activeRoom.escrowStatus = 'released';
            activeRoom.escrowMoneyState = 'เธเธฅเนเธญเธขเนเธญเธเธชเธดเธ—เธเธดเนเธขเธญเธ”เน€เธเธดเธเธชเธณเน€เธฃเนเธ';
            activeRoom.messages.push({
                sender: 'system',
                text: `เธเธนเนเธเธทเนเธญเธเธ”เธขเธทเธเธขเธฑเธเธเธฑเธ”เธชเนเธเธเธฃเธเธ–เนเธงเธ เนเธญเธเน€เธเธดเธเธเนเธฒเธ”เธตเธฅ เธฟ${activeRoom.escrowAmount.toLocaleString()} เน€เธเนเธฒเธเธฑเธเธเธตเธเธนเนเธเธฒเธขเธชเธณเน€เธฃเนเธ`,
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
    const isAdmin = state.loggedInUser.email === 'tawannatv@gmail.com';
    if (!isAdmin && state.loggedInUser.kycStatus !== 'verified') {
        alert('เธเธนเนเธเธทเนเธญเธ•เนเธญเธเธขเธทเธเธขเธฑเธเธ•เธฑเธงเธ•เธ (e-KYC) เธชเธณเน€เธฃเนเธเธเนเธญเธเธชเธฃเนเธฒเธเธ•เธฑเนเธงเธเธดเธเธฒเธ—เธฃเนเธญเธเน€เธฃเธตเธขเธ');
        openKycModal();
        return;
    }
    document.getElementById('modal-dispute').style.display = 'flex';
}

function submitDispute() {
    try {
        const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
        if (!activeRoom) {
            alert('เนเธกเนเธเธเธซเนเธญเธเธ”เธตเธฅเธ—เธตเนเธเธณเธฅเธฑเธเธ—เธณเธฃเธฒเธขเธเธฒเธฃ');
            return;
        }
        
        const category = document.getElementById('dispute-category').value;
        const reason = document.getElementById('dispute-reason').value;
        
        if (!reason.trim()) {
            alert('เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เน€เธซเธ•เธธเธเธฅเธเนเธญเธเธดเธเธฒเธ—');
            return;
        }
        
        // MANDATORY REAL EVIDENCE UPLOAD
        if (!disputeEvidenceBase64) {
            alert('เธเธงเธฒเธกเธเธฅเธญเธ”เธ เธฑเธขเธเธญเธเธฃเธฐเธเธ: เธเธฃเธธเธ“เธฒเธญเธฑเธเนเธซเธฅเธ”เธฃเธนเธเธ เธฒเธเธซเธฅเธฑเธเธเธฒเธเธเธฒเธฃเธ—เธธเธเธฃเธดเธ•เธญเธขเนเธฒเธเธเนเธญเธข 1 เธฃเธนเธ เน€เธเธทเนเธญเธเธฃเธฐเธเธญเธเธชเธณเธเธงเธเธฃเนเธญเธเน€เธฃเธตเธขเธ');
            return;
        }
        
        // Simulate Typhoon AI Classification safely
        const messagesPool = isFirebaseEnabled ? state.activeRoomMessages : activeRoom.messages;
        const aiAnalysis = runAiDisputeClassification(messagesPool, reason, activeRoom.escrowAmount, category);
        const reporterRole = activeRoom.buyerId === state.loggedInUser.id ? 'เธเธนเนเธเธทเนเธญ' : 'เธเธนเนเธเธฒเธข';
        
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
            showToast('โณ เธเธณเธฅเธฑเธเธชเนเธเน€เธฃเธทเนเธญเธเนเธฅเธฐเธงเธดเน€เธเธฃเธฒเธฐเธซเนเธเธ”เธตเนเธ”เธข AI...', 'info');
            db.collection('disputes').add(disputeData)
                .then(docRef => {
                    db.collection('rooms').doc(activeRoom.id).update({
                        escrowStatus: 'suspended',
                        escrowMoneyState: 'เธฃเธฐเธเธฑเธเธงเธเน€เธเธดเธเธเธฅเธฒเธเธเธฑเนเธงเธเธฃเธฒเธง (เธเนเธญเธฃเนเธญเธเน€เธฃเธตเธขเธเนเธญเธ”เธกเธดเธ)',
                        hasDispute: true
                    });
                    
                    db.collection('rooms').doc(activeRoom.id).collection('messages').add({
                        sender: 'system',
                        text: `โ ๏ธ เน€เธเธดเธ”เธ•เธฑเนเธงเธเนเธญเธเธดเธเธฒเธ— #${docRef.id.slice(0, 5)} เนเธ”เธข${reporterRole} [เธฃเนเธญเธเน€เธฃเธตเธขเธ: ${getCategoryLabel(category)}] เธฅเนเธญเธเธขเธญเธ”เนเธญเธเธเธฑเนเธงเธเธฃเธฒเธงเนเธฅเธฐเธชเนเธเธเธฃเธฐเธงเธฑเธ•เธดเธงเธดเน€เธเธฃเธฒเธฐเธซเนเนเธ”เธข Typhoon AI`,
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
                    
                    alert('เธชเนเธเน€เธฃเธทเนเธญเธเธฃเนเธญเธเน€เธฃเธตเธขเธเธชเธณเน€เธฃเนเธ เธเธดเธ”เธเธฑเนเธเธขเธญเธ”เนเธญเธเธเธฑเนเธงเธเธฃเธฒเธงเนเธฅเธฐเธชเนเธเธ•เธฑเนเธงเน€เธเนเธฒเธฃเธฐเธเธเนเธญเธ”เธกเธดเธเนเธฅเนเธง');
                })
                .catch(err => {
                    console.error("Firebase dispute upload error:", err);
                    alert("โ เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”เนเธเธเธฒเธฃเธชเนเธเธเนเธญเธกเธนเธฅ: " + err.message + "\nเธเธฃเธธเธ“เธฒเธฅเธญเธเนเธซเธกเนเธญเธตเธเธเธฃเธฑเนเธ");
                });
        } else {
            // Local fallback path
            const disputeId = state.disputes.length + 1;
            const ticket = {
                id: disputeId,
                ...disputeData
            };
            state.disputes.push(ticket);
            
            activeRoom.escrowStatus = 'suspended';
            activeRoom.escrowMoneyState = 'เธฃเธฐเธเธฑเธเธเธฑเธเธเธตเธ”เธตเธฅ (เธเนเธญเธฃเนเธญเธเน€เธฃเธตเธขเธเธเธดเธเธฒเธ—)';
            activeRoom.hasDispute = true;
            activeRoom.dispute = ticket;
            
            activeRoom.messages.push({
                sender: 'system',
                text: `โ ๏ธ เน€เธเธดเธ”เธ•เธฑเนเธงเธเนเธญเธเธดเธเธฒเธ— #${disputeId} เนเธ”เธข${reporterRole} [เธเธฑเธเธซเธฒ: ${getCategoryLabel(category)}] เธฅเนเธญเธเธขเธญเธ”เนเธญเธเธเธฑเนเธงเธเธฃเธฒเธงเนเธฅเธฐเธชเนเธเธเธฃเธฐเธงเธฑเธ•เธดเธงเธดเน€เธเธฃเธฒเธฐเธซเนเนเธ”เธข Typhoon AI`,
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
            
            alert('เธชเนเธเน€เธฃเธทเนเธญเธเธฃเนเธญเธเน€เธฃเธตเธขเธเธชเธณเน€เธฃเนเธ เธเธดเธ”เธเธฑเนเธเธขเธญเธ”เนเธญเธเธเธฑเนเธงเธเธฃเธฒเธงเนเธฅเธฐเธชเนเธเธ•เธฑเนเธงเน€เธเนเธฒเธฃเธฐเธเธเนเธญเธ”เธกเธดเธเนเธฅเนเธง');
        }
    } catch (e) {
        console.error("Error in submitDispute:", e);
        alert("โ เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”เธ—เธฒเธเน€เธ—เธเธเธดเธ: " + e.message);
    }
}

function getCategoryLabel(cat) {
    const labels = {
        scam: 'เนเธ”เธเนเธเธ/เธเธฅเนเธญเธเธซเธเธต',
        mismatch: 'เธชเธดเธเธเนเธฒเนเธกเนเธ•เธฃเธเธเธ',
        damaged: 'เธเธณเธฃเธธเธ”เน€เธชเธตเธขเธซเธฒเธข',
        unauthorized: 'เธเธฑเธเธเธตเนเธ”เธเธ”เธถเธเธชเธดเธ—เธเธดเนเธเธทเธ'
    };
    return labels[cat] || cat;
}

async function runAiDisputeClassification(chatLogs, reason, amount, category) {
    try {
        const logs = chatLogs || [];
        const logTexts = logs.map(m => {
            if (!m) return '';
            if (m.text && !m.isSystem) return m.text;
            if (m.proposal && m.proposal.name) return `[เธชเนเธเธเนเธญเน€เธชเธเธญเธชเธดเธเธเนเธฒ: ${m.proposal.name} เธฃเธฒเธเธฒ ${m.proposal.price} เธเธฒเธ—]`;
            return '';
        }).filter(t => t.length > 0);
        
        const chatHistoryStr = logTexts.join('\n');
        
        const prompt = `
เธเธธเธ“เธเธทเธญเธเธนเนเธเธดเธเธฒเธเธฉเธฒเนเธฅเธฐเธเธนเนเนเธเธฅเนเน€เธเธฅเธตเนเธขเนเธเธฃเธฐเธเธ Escrow เธเธฒเธฃเธเธทเนเธญเธเธฒเธขเธญเธญเธเนเธฅเธเน (เธเธทเนเธญเนเธเธฅเธ•เธเธญเธฃเนเธก Flixo)
เธซเธเนเธฒเธ—เธตเนเธเธญเธเธเธธเธ“เธเธทเธญเธเธฒเธฃเธญเนเธฒเธ "เธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเนเธเธ—" เธฃเธฐเธซเธงเนเธฒเธเธเธนเนเธเธทเนเธญเนเธฅเธฐเธเธนเนเธเธฒเธข เนเธฅเธฐ "เน€เธซเธ•เธธเธเธฅเธ—เธตเนเธฃเนเธญเธเน€เธฃเธตเธขเธ" เน€เธเธทเนเธญเธเธฑเธ”เธซเธกเธงเธ”เธซเธกเธนเนเนเธฅเธฐเนเธเธฐเธเธณเนเธเธงเธ—เธฒเธเนเธเนเนเธเนเธซเนเนเธญเธ”เธกเธดเธเธเธดเธเธฒเธฃเธ“เธฒ

เธเนเธญเธกเธนเธฅเธเธ”เธต:
- เธซเธกเธงเธ”เธซเธกเธนเนเธ—เธตเนเธเธนเนเนเธเนเน€เธฅเธทเธญเธ: ${category}
- เธขเธญเธ”เน€เธเธดเธเธเธฑเธเน€เธเนเธ (Escrow Amount): ${amount} เธเธฒเธ—
- เธเนเธญเธเธงเธฒเธกเธฃเนเธญเธเน€เธฃเธตเธขเธ: "${reason}"
- เธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเนเธเธ—:
${chatHistoryStr ? chatHistoryStr : '(เนเธกเนเธกเธตเธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเนเธเธ—)'}

เธเธฃเธธเธ“เธฒเธงเธดเน€เธเธฃเธฒเธฐเธซเนเนเธฅเธฐเธ•เธญเธเธเธฅเธฑเธเธกเธฒเน€เธเนเธ JSON FORMAT เน€เธ—เนเธฒเธเธฑเนเธ เนเธ”เธขเธกเธตเนเธเธฃเธเธชเธฃเนเธฒเธเธ”เธฑเธเธเธตเน:
{
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "verdict": "REFUND_BUYER" | "RELEASE_SELLER" | "MANUAL_REVIEW",
  "confidence": "เน€เธเธญเธฃเนเน€เธเนเธเธ•เนเธเธงเธฒเธกเธกเธฑเนเธเนเธ เน€เธเนเธ 95%",
  "summary": "เธเธณเธเธฃเธฃเธขเธฒเธขเธชเธฃเธธเธเน€เธซเธ•เธธเธเธฒเธฃเธ“เนเนเธฅเธฐเธเธณเนเธเธฐเธเธณเธชเธฑเนเธเน (เธ เธฒเธฉเธฒเนเธ—เธข เนเธกเนเน€เธเธดเธ 3 เธเธฃเธฃเธ—เธฑเธ”)",
  "classifications": {
    "problem": "เธเธฃเธฐเน€เธ เธ—เธเธฑเธเธซเธฒ เน€เธเนเธ เธซเธฅเธญเธเธฅเธงเธ, เธชเธดเธเธเนเธฒเนเธกเนเธ•เธฃเธเธเธ, เธเธญเธเธนเนเธเธทเธเธเธฑเธเธเธต",
    "goods": "เธเธฃเธฐเน€เธ เธ—เธชเธดเธเธเนเธฒ เน€เธเนเธ เธชเธดเธเธเนเธฒเธ”เธดเธเธดเธ—เธฑเธฅ, เธชเธดเธเธเนเธฒเธเธฒเธขเธ เธฒเธ",
    "tier": "เธฃเธฐเธ”เธฑเธเธเธงเธฒเธกเน€เธชเธตเธขเธซเธฒเธข เน€เธเนเธ Medium (1k-10k THB)"
  }
}
เธซเธฒเธเนเธกเนเธกเธตเธเธฃเธฐเธงเธฑเธ•เธดเนเธเธ— เธซเธฃเธทเธญเธเนเธญเธกเธนเธฅเนเธกเนเธเธฑเธ”เน€เธเธ เนเธซเนเธ•เธฑเนเธ priority เน€เธเนเธ MANUAL_REVIEW เนเธฅเธฐ confidence เธ•เนเธณเน
เธ•เธญเธเธเธฅเธฑเธเน€เธเนเธ JSON เธเธฃเธดเธชเธธเธ—เธเธดเน (เธซเนเธฒเธกเธกเธต Markdown \`\`\`json เธเธฃเธญเธ)`;

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
            summary: aiResult.summary || 'เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธชเธฃเธธเธเธเนเธญเธกเธนเธฅเนเธ”เน',
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
            summary: 'เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”เนเธเธเธฒเธฃเน€เธเธทเนเธญเธกเธ•เนเธญ Typhoon AI: ' + err.message,
            classifications: { problem: 'API Error', goods: 'Unknown', tier: 'Unknown' }
        };
    }
}

// e-KYC Uploads
function openKycModal() {
    document.getElementById('kyc-id-card-filename').innerText = 'เนเธกเนเนเธ”เนเน€เธฅเธทเธญเธเนเธเธฅเน';
    document.getElementById('kyc-selfie-filename').innerText = 'เนเธกเนเนเธ”เนเน€เธฅเธทเธญเธเนเธเธฅเน';
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
        alert('เธเธฃเธธเธ“เธฒเธเธณเธฅเธญเธเน€เธฅเธทเธญเธเน€เธญเธเธชเธฒเธฃเธซเธฅเธฑเธเธเธฒเธเธ—เธฑเนเธ 2 เธเนเธญเธ');
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
                aiConfidence: '35% (เธเธงเธฒเธกเน€เธเนเธฒเธเธฑเธเนเธ”เนเนเธเธซเธเนเธฒเธ•เนเธณ)',
                status: 'pending'
            };
            
            if (isFirebaseEnabled) {
                db.collection('kycQueue').add(kycSubmission);
            } else {
                state.kycQueue.push({ id: state.kycQueue.length + 1, ...kycSubmission });
            }
            alert('โ [e-KYC AI]: เธชเนเธเธเนเธกเนเธเนเธฒเธเน€เธเธ“เธ‘เนเธชเนเธเธเธณเธเธญเธเธญเธเธ—เนเธฒเธเน€เธเนเธฒเธเธดเธง เนเธญเธ”เธกเธดเธเธ•เธฃเธงเธเธชเธญเธเธ”เนเธงเธขเธ•เธเน€เธญเธเนเธฅเนเธง');
        } else {
            state.loggedInUser.kycStatus = 'verified';
            if (isFirebaseEnabled) {
                db.collection('users').doc(state.loggedInUser.id).update({ kycStatus: 'verified' });
            } else {
                const dbUser = MOCK_USERS.find(u => u.id === state.loggedInUser.id);
                if (dbUser) dbUser.kycStatus = 'verified';
            }
            alert('โ“ [e-KYC AI]: เธขเธทเธเธขเธฑเธเธ•เธฑเธงเธ•เธเธชเธณเน€เธฃเนเธ! เธเธฅเธ”เธฅเนเธญเธเน€เธเธฃเธทเนเธญเธเธกเธทเธญเธ”เธตเธฅเธเธทเนเธญเธเธฒเธขเธ—เธฑเนเธเธซเธกเธ”');
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
    document.getElementById('admin-stat-users').innerText = isFirebaseEnabled ? 'เน€เธเธทเนเธญเธกเธ•เนเธญเธญเธญเธเนเธฅเธเน' : MOCK_USERS.length;
    
    // Stat 2: Escrow Locked
    let totalEscrow = 0;
    state.rooms.forEach(r => {
        if (r.escrowStatus === 'held' || r.escrowStatus === 'suspended') {
            totalEscrow += r.escrowAmount;
        }
    });
    document.getElementById('admin-stat-escrow').innerText = `เธฟ${totalEscrow.toLocaleString()}`;
    
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
        kycHtml = `<tr><td colspan="5" class="text-center text-muted">เนเธกเนเธกเธตเธเธณเธเธญเธขเธทเธเธขเธฑเธเธ•เธฑเธงเธ•เธเธ—เธตเนเธฃเธญเธเธดเธงเธ•เธฃเธงเธเธชเธญเธ</td></tr>`;
    } else {
        pendingKycQueueList.forEach(k => {
            kycHtml += `
                <tr>
                    <td><strong>${k.user.name}</strong><br><span class="text-muted font-10">ID: ${k.user.id}</span></td>
                    <td>เธ”เธตเธฅเธเธทเนเธญเธเธฒเธขเธ—เธฑเนเธงเนเธ</td>
                    <td>
                        <div class="mini-doc-preview">
                            <a href="${k.idCardImg}" target="_blank" class="doc-thumb"><i class="fa-solid fa-address-card"></i></a>
                            <a href="${k.selfieImg}" target="_blank" class="doc-thumb"><i class="fa-solid fa-camera"></i></a>
                        </div>
                    </td>
                    <td><span class="badge status-red"><i class="fa-solid fa-triangle-exclamation"></i> ${k.aiConfidence}</span></td>
                    <td>
                        <button class="btn-success btn-sm" onclick="adminResolveKyc('${k.id}', true)">เธญเธเธธเธกเธฑเธ•เธด</button>
                        <button class="btn-danger btn-sm" onclick="adminResolveKyc('${k.id}', false)">เธเธเธดเน€เธชเธ</button>
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
        disputeHtml = `<tr><td colspan="6" class="text-center text-muted">${state.showArchivedDisputes ? 'เนเธกเนเธกเธตเธ•เธฑเนเธงเธ—เธตเนเน€เธเนเธเนเธงเน' : 'เนเธกเนเธกเธตเธ•เธฑเนเธงเธเนเธญเธเธดเธเธฒเธ—'}</td></tr>`;
    } else {
        filteredDisputes.forEach(d => {
            const activeRoom = state.rooms.find(r => r.id === d.roomId);
            const topic = activeRoom ? activeRoom.topic : 'เธ”เธตเธฅเธเธทเนเธญเธเธฒเธขเธ—เธฑเนเธงเนเธ';
            const isSelected = state.activeDisputeId === d.id ? 'style="background: rgba(255, 122, 89, 0.1);"' : '';
            
            let statusLabel = '';
            if (d.status === 'suspended') statusLabel = '<span class="badge bg-red">เธฃเธฐเธเธฑเธเน€เธเธดเธเธเธฑเนเธงเธเธฃเธฒเธง</span>';
            else if (d.status === 'resolved_refunded') statusLabel = '<span class="badge text-muted">เธเธทเธเน€เธเธดเธเธเธนเนเธเธทเนเธญเนเธฅเนเธง</span>';
            else if (d.status === 'resolved_released') statusLabel = '<span class="badge status-green">เธเธฅเนเธญเธขเธขเธญเธ”เธเธนเนเธเธฒเธขเนเธฅเนเธง</span>';
            
            let priorityBadge = '';
            if (d.aiPriority === 'HIGH') priorityBadge = '<span class="badge bg-red animate-pulse">HIGH</span>';
            else if (d.aiPriority === 'MEDIUM') priorityBadge = '<span class="badge text-warning">MEDIUM</span>';
            else priorityBadge = '<span class="badge text-muted">LOW</span>';
            
            disputeHtml += `
                <tr ${isSelected} onclick="adminSelectDispute('${d.id}')" class="cursor-pointer">
                    <td><strong>เธ”เธตเธฅ #${d.roomId.slice ? d.roomId.slice(0,5) : d.roomId}</strong><br><span class="text-muted font-10">${topic.substring(0, 25)}...</span></td>
                    <td>${d.buyerName}</td>
                    <td><strong>เธฟ${d.amount.toLocaleString()}</strong></td>
                    <td>${priorityBadge}</td>
                    <td>${statusLabel}</td>
                    <td style="display:flex;gap:4px;">
                        <button class="btn-primary btn-sm" onclick="adminSelectDispute('${d.id}')">เธงเธดเน€เธเธฃเธฒเธฐเธซเน AI</button>
                        <button class="btn-secondary btn-sm" onclick="toggleArchiveDispute('${d.id}')" title="${(state.archivedDisputes||[]).includes(d.id) ? 'เธเธณเธเธฅเธฑเธเธกเธฒ' : 'เน€เธเนเธเธ•เธฑเนเธงเธเธตเน'}"><i class="fa-solid fa-${(state.archivedDisputes||[]).includes(d.id) ? 'inbox' : 'box-archive'}"></i></button>
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
    alert(`เนเธญเธ”เธกเธดเธเธ•เธฑเธ”เธชเธดเธเธเธฅเธ•เธฃเธงเธ e-KYC: ${approve ? 'เธญเธเธธเธกเธฑเธ•เธดเธเนเธฒเธ' : 'เธเธเธดเน€เธชเธเธเธณเธเธญ'}`);
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
                <p>เน€เธฅเธทเธญเธเธ•เธฑเนเธงเธเนเธญเธเธดเธเธฒเธ—เนเธเธฃเธฒเธขเธเธฒเธฃเธ”เนเธฒเธเธเนเธฒเธข เน€เธเธทเนเธญเนเธซเนเธเธฑเธเธเธฒเธเธฃเธฐเธ”เธดเธฉเธเนเธชเธเธฑเธ”เนเธฅเธฐเธงเธดเน€เธเธฃเธฒเธฐเธซเนเธเนเธญเธกเธนเธฅเธซเธฅเธฑเธเธเธฒเธเนเธเธ—</p>
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
        const senderName = activeRoom && m.sender === activeRoom.buyerId ? 'เธเธนเนเธเธทเนเธญ' : 'เธเธนเนเธเธฒเธข';
        const highlight = m.text.includes('เนเธเธ') || m.text.includes('เธเธฅเนเธญเธ') || m.text.includes('เธฃเธซเธฑเธช') || m.text.includes('เนเธกเนเธ•เธญเธ');
        logsHtml += `
            <div class="excerpt-row ${highlight ? 'highlighted' : ''}">
                <strong>[${senderName}]:</strong> ${m.text}
            </div>
        `;
    });
    
    const isRefund = ticket.aiVerdict === 'REFUND_BUYER';
    const verdictClass = isRefund ? 'verdict-refund' : 'verdict-release';
    const verdictText = isRefund ? 'เธญเธเธธเธกเธฑเธ•เธดเธเธทเธเน€เธเธดเธเธเธนเนเธเธทเนเธญ (Refund Buyer)' : 'เธญเธเธธเธกเธฑเธ•เธดเธเนเธฒเธขเน€เธเธดเธเธเธนเนเธเธฒเธข (Release to Seller)';
    
    let actionsHtml = '';
    if (ticket.status === 'suspended') {
        actionsHtml = `
            <div class="form-row mt-15">
                <button class="btn-danger col-6" onclick="adminResolveDispute('${ticket.id}', 'refund')">
                    <i class="fa-solid fa-undo"></i> เธ•เธฑเธ”เธชเธดเธเธเธทเธเน€เธเธดเธเธเธนเนเธเธทเนเธญ
                </button>
                <button class="btn-success col-6" onclick="adminResolveDispute('${ticket.id}', 'release')">
                    <i class="fa-solid fa-check"></i> เธ•เธฑเธ”เธชเธดเธเธเธฅเนเธญเธขเธขเธญเธ”เธเธนเนเธเธฒเธข
                </button>
            </div>
        `;
    } else {
        const label = ticket.status === 'resolved_refunded' ? 'เธเธทเธเน€เธเธดเธเธเธนเนเธเธทเนเธญเน€เธชเธฃเนเธเธชเธดเนเธ' : 'เธเนเธฒเธขเน€เธเธดเธเธเธนเนเธเธฒเธขเน€เธชเธฃเนเธเธชเธดเนเธ';
        actionsHtml = `
            <div class="alert-box alert-info text-center mt-10">
                <i class="fa-solid fa-lock"></i> เธเธณเธ•เธฑเธ”เธชเธดเธเธชเธดเนเธเธชเธธเธ”: ${label}
            </div>
        `;
    }
    
    const imgUrl = ticket.evidenceImg || MOCK_PHOTOS.evidence[ticket.evidence] || MOCK_PHOTOS.evidence['empty-box'];
    
    card.innerHTML = `
        <div class="ai-details-grid">
            <div class="ai-alert-box">
                <i class="fa-solid fa-microchip"></i>
                <span><strong>เธเธฑเธเธเธฒเธเธฃเธฐเธ”เธดเธฉเธเนเธงเธดเน€เธเธฃเธฒเธฐเธซเนเธเนเธญเธ•เธเธฅเธ:</strong> Typhoon LLM เธเธฑเธ”เธฅเธณเธ”เธฑเธเธเธงเธฒเธกเธชเธณเธเธฑเธเธเธฑเธ”เนเธขเธเธเธฃเธฐเธงเธฑเธ•เธด</span>
            </div>
            
            <div class="form-group">
                <label>เธเธฒเธฃเธเธฑเธ”เธซเธกเธงเธ”เธซเธกเธนเน 3 เธกเธดเธ•เธด (AI Classification)</label>
                <div class="ai-classification-badges">
                    <span class="ai-badge dimension-problem"><i class="fa-solid fa-triangle-exclamation"></i> เธเธฑเธเธซเธฒ: ${ticket.classifications.problem}</span>
                    <span class="ai-badge dimension-goods"><i class="fa-solid fa-box"></i> เธชเธดเธเธเนเธฒ: ${ticket.classifications.goods}</span>
                    <span class="ai-badge dimension-tier"><i class="fa-solid fa-tag"></i> เธฃเธฒเธเธฒ: ${ticket.classifications.tier}</span>
                </div>
            </div>
            
            <div class="ai-analysis-block">
                <h4><i class="fa-solid fa-quote-left"></i> เธชเธฃเธธเธเธเนเธญเธฃเนเธญเธเน€เธฃเธตเธขเธเธเธนเนเธฃเนเธญเธ</h4>
                <p>"${ticket.reason}"</p>
            </div>
            
            <div class="ai-analysis-block">
                <h4><i class="fa-regular fa-comments"></i> เธเธ—เธชเธเธ—เธเธฒเธชเธณเธเธฑเธ</h4>
                <div class="ai-chat-logs-excerpt">${logsHtml || 'เนเธกเนเธกเธตเธเธฃเธฐเธงเธฑเธ•เธดเนเธเธ—เน€เธเธฃเธเธฒ'}</div>
            </div>
            
            <div class="ai-verdict-box ${verdictClass}">
                <span class="ai-verdict-title"><i class="fa-solid fa-gavel"></i> เนเธเธฐเธเธณเนเธ”เธข Typhoon LLM</span>
                <div class="ai-verdict-verdict">${verdictText}</div>
                <span class="ai-verdict-confidence">เธเธงเธฒเธกเธเนเธฒเน€เธเธทเนเธญเธ–เธทเธญ: ${ticket.confidence}</span>
            </div>
            
            <div class="form-group">
                <label>เธซเธฅเธฑเธเธเธฒเธเนเธเธ (เธญเธฑเธเนเธซเธฅเธ”เธเธฃเธดเธ)</label>
                <img src="${imgUrl}" style="max-width: 100%; border-radius: var(--radius-sm); border: 1px solid var(--border-glass); max-height: 220px; object-fit: contain; background: rgba(0,0,0,0.25); padding: 5px; margin-top: 5px;">
            </div>
            
            <div class="border-top-glass mt-10">
                <label class="form-group-label font-11 text-muted"><strong>เธเธณเธ•เธฑเธ”เธชเธดเธเธเธนเนเธ”เธนเนเธฅเธฃเธฐเธเธ:</strong></label>
                ${actionsHtml}
            </div>
        </div>
    `;
}

function adminResolveDispute(disputeId, verdict) {
    const ticket = state.disputes.find(d => d.id === disputeId);
    if (!ticket) return;
    
    if (confirm('เธขเธทเธเธขเธฑเธเธเธณเธ•เธฑเธ”เธชเธดเธเธเธฒเธฃเธเนเธฒเธขเน€เธเธดเธเธเธตเนเธซเธฃเธทเธญเนเธกเน?')) {
        if (isFirebaseEnabled) {
            db.collection('disputes').doc(disputeId).update({
                status: verdict === 'refund' ? 'resolved_refunded' : 'resolved_released'
            });
            db.collection('rooms').doc(ticket.roomId).update({
                escrowStatus: 'released',
                escrowMoneyState: verdict === 'refund' ? 'เนเธญเธ”เธกเธดเธเธขเธเน€เธฅเธดเธเธ”เธตเธฅเนเธฅเธฐเธเธทเธเน€เธเธดเธเธเธนเนเธเธทเนเธญ' : 'เนเธญเธ”เธกเธดเธเธเธดเธ”เธเธฒเธฃเธฃเธฐเธเธฑเธเนเธฅเธฐเธเธฅเนเธญเธขเน€เธเธดเธเนเธญเธเธเธนเนเธเธฒเธข'
            });
            db.collection('rooms').doc(ticket.roomId).collection('messages').add({
                sender: 'system',
                text: `โ–๏ธ [เธเธณเธ•เธฑเธ”เธชเธดเธเนเธญเธ”เธกเธดเธ]: เธชเธดเนเธเธชเธธเธ”เธเนเธญเธเธดเธเธฒเธ— เธ—เธณเธเธฒเธฃเนเธญเธเธขเนเธฒเธขเธขเธญเธ”เน€เธเธดเธเธเธณเธเธงเธ เธฟ${ticket.amount.toLocaleString()} ${verdict === 'refund' ? 'เธเธทเธเธเธนเนเธเธทเนเธญ' : 'เน€เธเนเธฒเธเธนเนเธเธฒเธข'} เน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง`,
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
                activeRoom.escrowMoneyState = 'เนเธญเธ”เธกเธดเธเธชเธฑเนเธเธขเธเน€เธฅเธดเธเธ”เธตเธฅเนเธฅเธฐเธเธทเธเน€เธเธดเธเธเธนเนเธเธทเนเธญเธชเธณเน€เธฃเนเธ';
                activeRoom.messages.push({
                    sender: 'system',
                    text: `โ–๏ธ [เธเธณเธ•เธฑเธ”เธชเธดเธเนเธญเธ”เธกเธดเธ]: เธเนเธญเธเธดเธเธฒเธ—เนเธ”เนเธฃเธฑเธเธญเธเธธเธกเธฑเธ•เธด เธเธทเธเน€เธเธดเธ เธฟ${activeRoom.escrowAmount.toLocaleString()} เนเธเนเธเธนเนเธเธทเนเธญเน€เธฃเธตเธขเธเธฃเนเธญเธข`,
                    timestamp: getFormattedTime(),
                    clientTimestamp: Date.now(),
                    isSystem: true,
                    escrowState: 'released'
                });
            } else {
                ticket.status = 'resolved_released';
                activeRoom.escrowStatus = 'released';
                activeRoom.escrowMoneyState = 'เนเธญเธ”เธกเธดเธเธชเธฑเนเธเธเธฅเนเธญเธขเน€เธเธดเธเธ”เธตเธฅเนเธซเนเธเธนเนเธเธฒเธขเธชเธณเน€เธฃเนเธ';
                activeRoom.messages.push({
                    sender: 'system',
                    text: `โ–๏ธ [เธเธณเธ•เธฑเธ”เธชเธดเธเนเธญเธ”เธกเธดเธ]: เธเนเธญเธเธดเธเธฒเธ—เธ–เธนเธเธเธเธดเน€เธชเธ เธเธฅเนเธญเธขเน€เธเธดเธ เธฟ${activeRoom.escrowAmount.toLocaleString()} เนเธเนเธเธนเนเธเธฒเธขเน€เธฃเธตเธขเธเธฃเนเธญเธข`,
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
    if (confirm('เธเธธเธ“เธ•เนเธญเธเธเธฒเธฃเธฅเนเธฒเธเธเนเธญเธกเธนเธฅเธฃเธฐเธเธเธเธณเธฅเธญเธเธเธฅเธฑเธเธชเธนเนเธเนเธฒเน€เธฃเธดเนเธกเธ•เนเธเธซเธฃเธทเธญเนเธกเน? (เธซเธฒเธเน€เธเธทเนเธญเธกเธ•เนเธญ Firebase เธเนเธญเธกเธนเธฅเธเธเธเธฅเธฒเธงเธ”เนเธเธฐเนเธกเนเธ–เธนเธเธฅเธ)')) {
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
        alert('เธฃเธตเน€เธเนเธ•เธฃเธฐเธเธเธเธณเธฅเธญเธเธเธฑเนเธเน€เธเธฃเธทเนเธญเธเธเธญเธเธเธธเธ“เธชเธณเน€เธฃเนเธ');
    }
}

function formatPriceInput(el) {
    let raw = el.value.replace(/[^0-9]/g, '');
    el.value = raw ? parseInt(raw, 10).toLocaleString('th-TH') : '';
}

function handleProductImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('โ เนเธเธฅเนเนเธซเธเนเน€เธเธดเธ 5MB', 'error'); return; }
    
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
    counter.textContent = words.length + ' เธเธณ';
    counter.style.color = words.length >= 10 ? '#22c55e' : '#ef4444';
}

function getCategoryEmoji(cat) {
    const map = { game:'๐ฎ', gadget:'๐“ฑ', fashion:'๐‘•', shoes:'๐‘', collectible:'๐', book:'๐“', electronics:'๐”', beauty:'๐’', sport:'โฝ', vehicle:'๐—', digital:'๐’ป', other:'๐“ฆ' };
    return map[cat] || '๐“ฆ';
}

function showProposalDetail(propJson) {
    try {
        const prop = JSON.parse(propJson);
        const categoryLabels = {
            game:'๐ฎ เนเธญเธ”เธตเน€เธเธก', gadget:'๐“ฑ เธญเธธเธเธเธฃเธ“เนเนเธญเธ—เธต', fashion:'๐‘• เน€เธชเธทเนเธญเธเนเธฒ',
            shoes:'๐‘ เธฃเธญเธเน€เธ—เนเธฒ', collectible:'๐ เธเธญเธเธชเธฐเธชเธก', book:'๐“ เธซเธเธฑเธเธชเธทเธญ',
            electronics:'๐” เน€เธเธฃเธทเนเธญเธเนเธเนเนเธเธเนเธฒ', beauty:'๐’ เน€เธเธฃเธทเนเธญเธเธชเธณเธญเธฒเธ',
            sport:'โฝ เธเธตเธฌเธฒ', vehicle:'๐— เธฃเธ–เธขเธเธ•เน', digital:'๐’ป เธ”เธดเธเธดเธ—เธฑเธฅ', other:'๐“ฆ เธญเธทเนเธเน'
        };
        const catLabel = categoryLabels[prop.category] || prop.category || 'เธชเธดเธเธเนเธฒเธ—เธฑเนเธงเนเธ';
        const imgHtml = prop.imageBase64 
            ? `<img src="${prop.imageBase64}" alt="product" style="max-width:100%;max-height:260px;border-radius:12px;object-fit:contain;margin-bottom:15px;display:block;margin-left:auto;margin-right:auto;">`
            : `<div style="font-size:72px;text-align:center;padding:20px;">${getCategoryEmoji(prop.category)}</div>`;
        document.getElementById('modal-product-detail-body').innerHTML = `
            <div>${imgHtml}</div>
            <h3 style="margin-bottom:8px;font-size:18px;">${prop.name}</h3>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:15px;">
                <span style="padding:4px 10px;border-radius:20px;background:var(--surface-2,#f0f4f8);font-size:12px;">${catLabel}</span>
                <span style="padding:4px 12px;border-radius:20px;background:var(--accent,#4a90b8);color:#fff;font-size:13px;font-weight:700;">เธฟ${Number(prop.price).toLocaleString()}</span>
            </div>
            <p style="white-space:pre-wrap;line-height:1.8;color:#666;font-size:14px;">${prop.desc || 'เนเธกเนเธกเธตเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เน€เธเธดเนเธกเน€เธ•เธดเธก'}</p>
        `;
        document.getElementById('modal-product-detail').style.display = 'flex';
    } catch(e) { console.error(e); }
}

function submitBankAccount() {
    const bank = document.getElementById('bank-name-select').value;
    const num = document.getElementById('bank-account-number').value.trim();
    const name = document.getElementById('bank-account-name').value.trim();
    if (!num || !name) { showToast('โ เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเนเธญเธกเธนเธฅเนเธซเนเธเธฃเธ', 'error'); return; }
    state.loggedInUser.bankInfo = { bank, accountNumber: num, accountName: name };
    if (isFirebaseEnabled && db) {
        db.collection('users').doc(state.loggedInUser.id).update({ bankInfo: state.loggedInUser.bankInfo });
    }
    closeModal('modal-bank-account');
    updateBankInfoDisplay();
    showToast('โ… เธเธฑเธเธ—เธถเธเธเนเธญเธกเธนเธฅเธเธเธฒเธเธฒเธฃเน€เธฃเธตเธขเธเธฃเนเธญเธข', 'success');
}

function updateBankInfoDisplay() {
    const bi = state.loggedInUser && state.loggedInUser.bankInfo;
    const box = document.getElementById('dashboard-bank-info');
    const detail = document.getElementById('bank-info-display');
    if (bi && box && detail) {
        box.style.display = 'block';
        detail.innerHTML = `<i class="fa-solid fa-building-columns"></i> <strong>${bi.bank}</strong> | ${bi.accountNumber} | ${bi.accountName}`;
    } else if (box) {
        box.style.display = 'none';
    }
}

function submitTrackingNumber() {
    const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
    if (!activeRoom) return;
    const carrier = document.getElementById('tracking-carrier').value;
    const number = document.getElementById('tracking-number').value.trim();
    if (!number) { showToast('โ เธเธฃเธธเธ“เธฒเธเธฃเธญเธเน€เธฅเธเธเธฑเธชเธ”เธธ', 'error'); return; }
    const carrierLabels = { flash:'Flash Express', jt:'J&T Express', thpost:'เนเธเธฃเธฉเธ“เธตเธขเนเนเธ—เธข', kerry:'Kerry Express', dhl:'DHL', scg:'SCG Express', digital:'เธชเนเธเธกเธญเธเธ”เธดเธเธดเธ—เธฑเธฅ' };
    const carrierName = carrierLabels[carrier] || carrier;
    const trackMsg = { sender: 'system', text: `๐“ฆ เธเธนเนเธเธฒเธขเนเธเนเธเธเธฑเธ”เธชเนเธเธเธฑเธชเธ”เธธเนเธฅเนเธง | เธเธเธชเนเธ: ${carrierName} | เน€เธฅเธเธเธฑเธชเธ”เธธ: ${number}`, timestamp: getFormattedTime(), clientTimestamp: Date.now(), isSystem: true };
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
    showToast('๐“ฆ เนเธเนเธเน€เธฅเธเธเธฑเธชเธ”เธธเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง', 'success');
}

function toggleArchiveDispute(disputeId) {
    if (!state.archivedDisputes) state.archivedDisputes = [];
    const idx = state.archivedDisputes.indexOf(disputeId);
    if (idx > -1) { state.archivedDisputes.splice(idx, 1); showToast('เธเธณเธ•เธฑเนเธงเธเธฅเธฑเธเธกเธฒเนเธฅเนเธง', 'success'); }
    else { state.archivedDisputes.push(disputeId); showToast('เน€เธเนเธเธ•เธฑเนเธงเน€เธฃเธตเธขเธเธฃเนเธญเธข', 'success'); }
    renderAdminPanel();
}

function toggleArchivedDisputes() {
    state.showArchivedDisputes = !state.showArchivedDisputes;
    const label = document.getElementById('dispute-archive-btn-label');
    if (label) label.textContent = state.showArchivedDisputes ? 'เธ”เธนเธ—เธตเนเธขเธฑเธเน€เธเธดเธ”เธญเธขเธนเน' : 'เธ”เธนเธ—เธตเนเน€เธเนเธเนเธฅเนเธง';
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
        text: 'โ เธเธนเนเธเธทเนเธญเธขเธเน€เธฅเธดเธเธเนเธญเน€เธชเธเธญเธฃเธฒเธเธฒเธเธตเนเนเธฅเนเธง เธเธฃเธธเธ“เธฒเน€เธเธฃเธเธฒเนเธฅเธฐเธชเนเธเธเนเธญเน€เธชเธเธญเนเธซเธกเน', 
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
    showToast('โ… เธขเธเน€เธฅเธดเธเธเนเธญเน€เธชเธเธญเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง', 'success');
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
    if (confirm('เธเธธเธ“เธ•เนเธญเธเธเธฒเธฃเธฅเธเธเนเธญเธเนเธเธ—เนเธฅเธฐเธ”เธตเธฅเธเธตเนเนเธเธเธ–เธฒเธงเธฃเนเธเนเธซเธฃเธทเธญเนเธกเน?\n\nโ ๏ธ เธเธณเน€เธ•เธทเธญเธ: เธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเธชเธเธ—เธเธฒ เธฃเธนเธเธ เธฒเธ เนเธฅเธฐเธเธงเธฒเธกเน€เธเธฅเธทเนเธญเธเนเธซเธง Escrow เธ—เธฑเนเธเธซเธกเธ”เธเธฐเธ–เธนเธเธฅเธเธญเธญเธเธเธฒเธเธเธฒเธเธเนเธญเธกเธนเธฅเธญเธขเนเธฒเธเธ–เธฒเธงเธฃเนเธ”เธขเนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธเธนเนเธเธทเธเนเธ”เน')) {
        
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
            showToast('โณ เธเธณเธฅเธฑเธเธฅเธเธเนเธญเธกเธนเธฅเนเธเธ—เธ–เธฒเธงเธฃ...', 'info');
            
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
                    showToast('๐—‘ เธฅเธเธเนเธญเธกเธนเธฅเธ”เธตเธฅเธ–เธฒเธงเธฃเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง', 'success');
                    renderDealsSidebar();
                    updateViews();
                })
                .catch(err => {
                    console.error("Error deleting room from Firestore:", err);
                    showToast('โ เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธฅเธเธเนเธญเธกเธนเธฅเนเธเน€เธเธดเธฃเนเธเน€เธงเธญเธฃเนเนเธ”เน', 'error');
                });
        } else {
            // Local fallback
            state.rooms = state.rooms.filter(r => r.id !== roomId);
            state.disputes = state.disputes.filter(d => d.roomId !== roomId);
            
            showToast('๐—‘ เธฅเธเธเนเธญเธกเธนเธฅเธ”เธตเธฅเธเธณเธฅเธญเธเธ–เธฒเธงเธฃเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง', 'success');
            renderDealsSidebar();
            updateViews();
        }
    }
}



