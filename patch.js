const fs = require('fs');

let content = fs.readFileSync('app.js', 'utf8').replace(/\r\n/g, '\n');

const target1 = `function sendDealMessage() {
    const input = document.getElementById('active-chat-input');
    const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
    
    if (!activeRoom || !input.value.trim()) return;
    
    const text = input.value.trim();
    input.value = '';`.replace(/\r\n/g, '\n');

const replacement1 = `async function sendDealMessage() {
    const input = document.getElementById('active-chat-input');
    const sendBtn = document.querySelector('.chat-input-area button.btn-primary');
    const activeRoom = state.rooms.find(r => r.id === state.activeRoomId);
    
    if (!activeRoom || !input.value.trim()) return;
    
    const userId = state.loggedInUser.id;
    const banKey = \`flixo_chat_banned_until_\${userId}\`;
    const bannedUntil = parseInt(localStorage.getItem(banKey) || '0');
    
    if (Date.now() < bannedUntil) {
        const minutesLeft = Math.ceil((bannedUntil - Date.now()) / 60000);
        showToast(\`🚫 คุณถูกระงับการแชทชั่วคราว เหลือเวลาอีก \${minutesLeft} นาที\`, 'error');
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
    input.value = '';`.replace(/\r\n/g, '\n');

const target2 = `    inputArea.style.display = 'flex';
    detailsPanel.style.display = 'block';
    
    const isClosed = state.closedRooms.includes(activeRoom.id) || activeRoom.status === 'closed';`.replace(/\r\n/g, '\n');

const replacement2 = `    inputArea.style.display = 'flex';
    detailsPanel.style.display = 'block';
    
    // Check ban status
    const banKey = \`flixo_chat_banned_until_\${state.loggedInUser.id}\`;
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
    
    const isClosed = state.closedRooms.includes(activeRoom.id) || activeRoom.status === 'closed';`.replace(/\r\n/g, '\n');

if (content.includes(target1) && content.includes(target2)) {
    content = content.replace(target1, replacement1);
    content = content.replace(target2, replacement2);
    fs.writeFileSync('app.js', content, 'utf8');
    console.log('Successfully patched app.js');
} else {
    console.log('Failed to find targets in app.js');
    if (!content.includes(target1)) console.log('Target 1 not found');
    if (!content.includes(target2)) console.log('Target 2 not found');
}
