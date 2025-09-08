let ws;
let chatroomId;
let connected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let channel = localStorage.getItem('streamer-channel') || 'everonn';
let minStickerSize = parseInt(localStorage.getItem('min-sticker-size')) || 20;
let maxStickerSize = parseInt(localStorage.getItem('max-sticker-size')) || 60;
let minSpeed = parseInt(localStorage.getItem('min-speed')) || 1500;
let maxSpeed = parseInt(localStorage.getItem('max-speed')) || 4000;
const processedMessageIds = new Set();
const container = document.getElementById('sticker-container');

window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isOBS = urlParams.has('obs');
    if (!isOBS) {
        document.getElementById('control-panel').style.display = 'flex';
        document.getElementById('streamer-channel').value = channel;
        document.getElementById('min-size').value = minStickerSize;
        document.getElementById('max-size').value = maxStickerSize;
        document.getElementById('min-speed').value = minSpeed;
        document.getElementById('max-speed').value = maxSpeed;
        updateSliderValues();
    }

    // Verify container size
    const rect = container.getBoundingClientRect();
    logDebug(`Container size: width=${rect.width}px, height=${rect.height}px, top=${rect.top}, left=${rect.left}`);
    if (rect.width < 1920 || rect.height < 1080) {
        logDebug('Warning: Container is not 1920x1080, forcing dimensions');
        container.style.setProperty('width', '1920px', 'important');
        container.style.setProperty('height', '1080px', 'important');
    }

    startChat();
};

function logDebug(message) {
    const debugLog = document.getElementById('debug-log');
    if (debugLog) {
        debugLog.innerHTML += `<p>${new Date().toLocaleTimeString()}: ${message}</p>`;
        debugLog.scrollTop = debugLog.scrollHeight;
    }
}

function updateSliderValues() {
    document.getElementById('min-size-value').textContent = document.getElementById('min-size').value;
    document.getElementById('max-size-value').textContent = document.getElementById('max-size').value;
    document.getElementById('min-speed-value').textContent = document.getElementById('min-speed').value;
    document.getElementById('max-speed-value').textContent = document.getElementById('max-speed').value;
}

async function startChat() {
    try {
        const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(channel)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Channel not found`);
        }
        const data = await response.json();
        chatroomId = data.chatroom?.id;
        if (!chatroomId) throw new Error('No chatroom ID found');
        logDebug(`Connected to channel ${channel}, chatroom ID: ${chatroomId}`);
        connectWebSocket();
    } catch (error) {
        logDebug(`Error starting chat: ${error.message}`);
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(startChat, 3000 * reconnectAttempts);
        }
    }
}

function connectWebSocket() {
    if (connected && ws && ws.readyState === WebSocket.OPEN) {
        return;
    }
    if (ws) {
        ws.close();
    }
    const appKey = '32cbd69e4b950bf97679';
    const wsUrl = `wss://ws-us2.pusher.com/app/${appKey}?protocol=7&client=js&version=8.4.0-rc2&flash=false`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        connected = true;
        reconnectAttempts = 0;
        const subscribeMsg = {
            event: 'pusher:subscribe',
            data: {
                auth: '',
                channel: `chatrooms.${chatroomId}.v2`
            }
        };
        ws.send(JSON.stringify(subscribeMsg));
        logDebug('WebSocket connected');
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'pusher_internal:subscription_succeeded') {
                logDebug('Subscribed to chatroom');
                return;
            }
            if (msg.event !== 'App\\Events\\ChatMessageEvent') return;

            let chatData;
            try {
                chatData = JSON.parse(msg.data);
            } catch (e) {
                logDebug(`Error parsing chat data: ${e.message}`);
                return;
            }

            const messageId = chatData.id;
            if (processedMessageIds.has(messageId)) return;
            processedMessageIds.add(messageId);

            const content = chatData.content || '';
            if (!content) return;

            const emotes = [...content.matchAll(/\[emote:\d+:([^\]]+)\]/g)].map(m => m[1]);
            emotes.forEach(name => {
                displaySticker(name);
                logDebug(`Displaying sticker: ${name}`);
            });
        } catch (error) {
            logDebug(`Error processing message: ${error.message}`);
        }
    };

    ws.onclose = () => {
        connected = false;
        logDebug('WebSocket closed, retrying...');
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(connectWebSocket, 3000 * reconnectAttempts);
        }
    };

    ws.onerror = () => {
        logDebug('WebSocket error');
    };
}

function displaySticker(name) {
    const img = new Image();
    img.className = 'sticker';
    let extensionIndex = 0;
    const extensions = ['gif', 'png', 'jpg'];

    const tryLoad = () => {
        if (extensionIndex >= extensions.length) {
            logDebug(`No valid image found for ${name}`);
            return;
        }
        img.src = `emojis/${name}.${extensions[extensionIndex]}`;
        extensionIndex++;
    };

    img.onload = () => {
        container.appendChild(img);
        const width = 1920;
        const height = 1080;
        const rect = container.getBoundingClientRect();
        logDebug(`Container rect: width=${rect.width}px, height=${rect.height}px`);
        if (rect.width < 1920 || rect.height < 1080) {
            logDebug('Warning: Container dimensions incorrect, using hardcoded 1920x1080');
            container.style.setProperty('width', '1920px', 'important');
            container.style.setProperty('height', '1080px', 'important');
        }

        const size = minStickerSize + Math.random() * (maxStickerSize - minStickerSize);
        let startX = Math.random() * (width - size);
        let startY = Math.random() * (height - size);

        if (isNaN(startX) || isNaN(startY) || startX < 0 || startY < 0) {
            startX = Math.random() * (1920 - size);
            startY = Math.random() * (1080 - size);
            logDebug(`Invalid start coordinates, using fallback: start(${startX.toFixed(2)},${startY.toFixed(2)})`);
        }

        img.style.position = 'absolute';
        img.style.left = `${startX}px`;
        img.style.top = `${startY}px`;
        img.style.width = `${size}px`;
        img.style.height = `${size}px`;

        let endX = Math.random() * (width - size);
        let endY = Math.random() * (height - size);

        let distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        let attempts = 0;
        while (distance < 300 && attempts < 10) {
            endX = Math.random() * (width - size);
            endY = Math.random() * (height - size);
            distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
            attempts++;
            logDebug(`Rerolled end position for ${name}: attempt ${attempts}, distance ${distance.toFixed(2)}px`);
        }

        if (distance < 300) {
            endX = startX + (startX < width / 2 ? 500 : -500);
            endY = startY + (startY < height / 2 ? 500 : -500);
            distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
            logDebug(`Fallback end position for ${name}: end(${endX.toFixed(2)},${endY.toFixed(2)})`);
        }

        const duration = minSpeed + Math.random() * (maxSpeed - minSpeed);
        const rotateSpeed = (Math.random() - 0.5) * 360;

        const startTime = performance.now();

        function animate(time) {
            const elapsed = time - startTime;
            const t = Math.min(elapsed / duration, 1);
            const x = startX + (endX - startX) * t;
            const y = startY + (endY - startY) * t;
            const scale = 1 + Math.sin(t * Math.PI) * 0.1;
            const rotate = t * rotateSpeed;
            const blur = t * 1;
            let opacity = 1;
            if (t > 0.6) {
                opacity = 1 - (t - 0.6) / 0.4;
            }

            img.style.left = `${x}px`;
            img.style.top = `${y}px`;
            img.style.transform = `scale(${scale}) rotate(${rotate}deg)`;
            img.style.filter = `blur(${blur}px)`;
            img.style.opacity = opacity;

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                img.remove();
                logDebug(`Sticker ${name} removed, container children: ${container.childElementCount}`);
            }
        }

        requestAnimationFrame(animate);
        logDebug(`Sticker ${name} animation started: start(${startX.toFixed(2)},${startY.toFixed(2)}) to end(${endX.toFixed(2)},${endY.toFixed(2)}), distance ${distance.toFixed(2)}px, duration ${duration}ms, size ${size}px`);
    };

    img.onerror = () => {
        tryLoad();
        logDebug(`Failed to load ${name}.${extensions[extensionIndex - 1]}`);
    };
    tryLoad();
}

function testSticker() {
    displaySticker('testSticker');
    logDebug('Test sticker triggered');
}

function generateOBSLink() {
    const url = `file://${window.location.pathname}?obs=1`;
    const input = document.getElementById('obs-url');
    input.value = url;
    input.select();
    navigator.clipboard.writeText(url).then(() => {
        alert('OBS URL copied to clipboard! Use this in OBS Browser Source to hide the control panel.');
        logDebug('OBS URL generated and copied');
    });
}

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('div').classList.add('scale-100');
    }, 10);
    updateSliderValues();
    logDebug('Settings modal opened');
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    modal.querySelector('div').classList.remove('scale-100');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
    logDebug('Settings modal closed');
}

function saveSettings() {
    const newChannel = document.getElementById('streamer-channel').value.trim();
    const newMinSize = parseInt(document.getElementById('min-size').value);
    const newMaxSize = parseInt(document.getElementById('max-size').value);
    const newMinSpeed = parseInt(document.getElementById('min-speed').value);
    const newMaxSpeed = parseInt(document.getElementById('max-speed').value);

    if (newMinSize >= newMaxSize) {
        alert('Max sticker size must be greater than min sticker size');
        logDebug('Invalid size settings: minSize >= maxSize');
        return;
    }
    if (newMinSpeed >= newMaxSpeed) {
        alert('Max speed must be greater than min speed');
        logDebug('Invalid speed settings: minSpeed >= maxSpeed');
        return;
    }

    if (newChannel) {
        channel = newChannel;
        localStorage.setItem('streamer-channel', channel);
        logDebug(`Channel updated to ${channel}`);
        reconnectAttempts = 0;
        startChat();
    }
    minStickerSize = newMinSize;
    maxStickerSize = newMaxSize;
    minSpeed = newMinSpeed;
    maxSpeed = newMaxSpeed;
    localStorage.setItem('min-sticker-size', minStickerSize);
    localStorage.setItem('max-sticker-size', maxStickerSize);
    localStorage.setItem('min-speed', minSpeed);
    localStorage.setItem('max-speed', maxSpeed);
    logDebug(`Settings saved: minSize=${minStickerSize}px, maxSize=${maxStickerSize}px, minSpeed=${minSpeed}ms, maxSpeed=${maxSpeed}ms`);
    closeSettingsModal();
}