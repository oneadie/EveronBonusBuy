let participantId = 1;
let winnerId = 1;
let participants = [];
let winners = [];
let animationDuration = 3; // Total animation duration
let isSingleMode = false;
let selectedSoFar = [];

const parseButton = document.getElementById('parse-participants');
const participantInput = document.getElementById('participant-input');
const limitInput = document.getElementById('winner-limit');
const startButton = document.getElementById('start-spin');
const spinOneButton = document.getElementById('spin-one');
const resetButtons = document.querySelectorAll('#reset-all');
const addEveronButton = document.getElementById('add-everon');
const bonusModeSelect = document.getElementById('bonus-mode-select');
const participantsTableBody = document.getElementById('participants-table').querySelector('tbody');
const winnersSection = document.getElementById('winners-section');
const winnersTableBody = document.getElementById('winners-table').querySelector('tbody');
const inputSection = document.getElementById('input-section');
const controlsSection = document.getElementById('controls');
const participantsSection = document.getElementById('participants-section');
const multiModal = document.getElementById('multi-modal');
const reelsContainer = document.getElementById('reels-container');
const closeModal = document.getElementById('close-modal');
const addMoreButton = document.getElementById('add-more');
const addMoreModal = document.getElementById('add-more-modal');
const closeAddModal = document.getElementById('close-add-modal');
const selectMoreButton = document.getElementById('select-more');
const additionalLimitInput = document.getElementById('additional-limit');
const totalSpentSpan = document.getElementById('total-spent');
const totalReceivedSpan = document.getElementById('total-received');
const paybackPercentSpan = document.getElementById('payback-percent');

window.addEventListener('load', loadAppState);
parseButton.addEventListener('click', parseTelegramInput);
limitInput.addEventListener('input', saveAppState);
startButton.addEventListener('click', () => initiateMultiSelection(parseInt(limitInput.value)));
spinOneButton.addEventListener('click', initiateSingleMode);
resetButtons.forEach(button => button.addEventListener('click', resetApplication));
addEveronButton.addEventListener('click', () => addWinnerRow({ name: 'everon' }));
bonusModeSelect.addEventListener('change', () => {
    updateAllBonuses();
    saveAppState();
});
addMoreButton.addEventListener('click', () => {
    addMoreModal.style.display = 'block';
});
closeAddModal.addEventListener('click', () => {
    addMoreModal.style.display = 'none';
});
selectMoreButton.addEventListener('click', () => {
    addMoreModal.style.display = 'none';
    initiateMultiSelection(parseInt(additionalLimitInput.value));
});
closeModal.addEventListener('click', () => {
    multiModal.style.display = 'none';
    document.body.style.overflow = ''; // Restore body scroll
    if (isSingleMode) {
        finishSingleMode && finishSingleMode();
    } else {
        showWinnersSection();
    }
});

function parseTelegramInput() {
    const input = participantInput.value.trim();
    if (!input) return;

    const lines = input.split('\n').map(line => line.trim()).filter(line => line);
    const parsedParticipants = [];
    const skippedLines = [];
    let currentEntry = [];

    lines.forEach((line, index) => {
        if (line.match(/^[^,]+,\s*\[\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}\]/)) {
            if (currentEntry.length > 0) {
                const name = currentEntry.join(' ').trim();
                if (name) {
                    parsedParticipants.push({ name });
                } else {
                    skippedLines.push({ line: name, reason: 'Empty after joining', index: index - 1 });
                }
                currentEntry = [];
            }
            skippedLines.push({ line, reason: 'Telegram username with timestamp', index });
            return;
        }

        currentEntry.push(line);
    });

    if (currentEntry.length > 0) {
        const name = currentEntry.join(' ').trim();
        if (name) {
            parsedParticipants.push({ name });
        } else {
            skippedLines.push({ line: name, reason: 'Empty after joining', index: lines.length - 1 });
        }
    }

    console.log('Parsed participants:', parsedParticipants);
    console.log('Skipped lines:', skippedLines);

    participants = [];
    participantsTableBody.innerHTML = '';
    participantId = 1;
    parsedParticipants.forEach(({ name }) => addParticipantRow(name));
    inputSection.style.display = 'none';
    controlsSection.style.display = 'block';
    participantsSection.style.display = 'block';
    participantInput.value = '';
    saveAppState();
}

function addParticipantRow(name = '', isLoading = false) {
    const row = participantsTableBody.insertRow();
    row.innerHTML = `
        <td>${participantId++}</td>
        <td contenteditable="true">${name}</td>
        <td class="action-buttons">
            <button class="remove-btn">✕</button>
        </td>
    `;
    if (!isLoading) {
        row.querySelector('td[contenteditable]').addEventListener('input', saveAppState);
        row.querySelector('.remove-btn').addEventListener('click', () => {
            row.remove();
            participantId = participantsTableBody.rows.length + 1;
            Array.from(participantsTableBody.rows).forEach((r, i) => r.cells[0].textContent = i + 1);
            saveAppState();
        });
        participants.push({ name });
    }
}

function fetchParticipants() {
    participants = [];
    Array.from(participantsTableBody.rows).forEach(row => {
        const name = row.cells[1].textContent.trim();
        if (name) participants.push({ name });
    });
    return participants;
}

function addWinnerRow(person, price = '') {
    const row = winnersTableBody.insertRow();
    row.innerHTML = `
        <td><button class="remove-btn">✕</button></td>
        <td>${winnerId++}</td>
        <td contenteditable="true">${person.name}</td>
        <td contenteditable="true">${price}</td>
        <td contenteditable="true"></td>
        <td></td>
        <td></td>
    `;
    row.cells[2].addEventListener('input', () => {
        const name = row.cells[2].textContent.trim();
        const index = winners.findIndex(w => w.name === person.name);
        if (index !== -1) {
            winners[index].name = name;
        }
        saveAppState();
    });
    row.cells[3].addEventListener('input', () => {
        calculateBonus(row);
        updateTotals();
        saveAppState();
    });
    row.cells[4].addEventListener('input', () => {
        calculateBonus(row);
        updateTotals();
        saveAppState();
    });
    row.querySelector('.remove-btn').addEventListener('click', () => {
        deleteWinner(row, person.name);
        updateTotals();
    });
    winners.push({ name: person.name, price });
    calculateBonus(row);
    updateTotals();
    saveAppState();
}

function deleteWinner(row, name) {
    row.remove();
    winners = winners.filter(w => w.name !== name);
    winnerId = winners.length + 1;
    Array.from(winnersTableBody.rows).forEach((r, i) => r.cells[1].textContent = i + 1);
    updateTotals();
    saveAppState();
}

function resetApplication() {
    localStorage.clear();
    window.location.reload();
}

function initiateMultiSelection(limit) {
    const currentParticipants = fetchParticipants();
    const availableParticipants = currentParticipants.filter(p => !winners.some(w => w.name === p.name));

    if (currentParticipants.length === 0) {
        alert('Добавьте участников!');
        return;
    }
    if (availableParticipants.length < limit) {
        alert(`Недостаточно доступных участников! Доступно ${availableParticipants.length}, нужно ${limit}.`);
        return;
    }

    const selectedWinners = [];
    for (let i = 0; i < limit && availableParticipants.length > 0; i++) {
        const winnerIndex = Math.floor(Math.random() * availableParticipants.length);
        selectedWinners.push(availableParticipants.splice(winnerIndex, 1)[0]);
    }

    reelsContainer.innerHTML = '';
    if (selectedWinners.length === 0) {
        alert('Не удалось выбрать победителей. Попробуйте снова.');
        return;
    }

    isSingleMode = false;
    multiModal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Disable body scroll when modal is open

    selectedWinners.forEach((winner, index) => {
        const slotMachine = document.createElement('div');
        slotMachine.className = 'slot-machine';
        slotMachine.innerHTML = `
            <div class="particle-bg">
                <div class="particle-1"></div>
                <div class="particle-2"></div>
            </div>
            <div class="reel-mask">
                <ul class="reel" id="reel-${index}"></ul>
            </div>
            <div class="flapper"></div>
            <div class="winner-announce">Победитель: <span id="winner-name-${index}">${winner.name}</span></div>
        `;
        reelsContainer.appendChild(slotMachine);

        const reel = slotMachine.querySelector(`#reel-${index}`);
        const numDuplicates = 5; // Reduced for shorter spin
        const reelItems = Array.from({length: numDuplicates}, () => [...currentParticipants]).flat();
        reelItems.forEach(person => {
            const li = document.createElement('li');
            li.textContent = person.name;
            li.dataset.name = person.name;
            reel.appendChild(li);
        });

        const itemHeight = 100; // 90px height + 10px gap
        const flapper = slotMachine.querySelector('.flapper');
        const flapperTop = parseFloat(getComputedStyle(flapper).top) || 200; // Center at 50%
        const totalHeight = reelItems.length * itemHeight;
        reel.style.height = `${totalHeight}px`;

        const len = currentParticipants.length;
        const ori = currentParticipants.findIndex(p => p.name === winner.name);
        const randomCopy = Math.floor(Math.random() * (numDuplicates - 2)) + 1; // 1 to 3 for variety
        const winnerIndex = randomCopy * len + ori;
        let winnerPosition = winnerIndex * itemHeight - (flapperTop - itemHeight / 2); // Base center alignment
        const randomOffset = (Math.random() * (itemHeight - 20)) - (itemHeight / 2 - 10); // Random within item, ±40px for 90px item
        winnerPosition += randomOffset;

        const timingFunction = 'cubic-bezier(0, 0, 0.2, 1)'; // Strong ease-out for fast start, slow end

        setTimeout(() => {
            reel.style.transition = `transform ${animationDuration}s ${timingFunction}`;
            reel.style.transform = `translateY(-${winnerPosition}px)`;
        }, 10);

        setTimeout(() => {
            const visibleItems = Array.from(reel.children);
            const frameCenter = flapperTop;
            let closestItem = null;
            let minDistance = Infinity;

            visibleItems.forEach(item => {
                const itemRect = item.getBoundingClientRect();
                const itemCenter = itemRect.top + itemRect.height / 2 - slotMachine.getBoundingClientRect().top;
                const distance = Math.abs(itemCenter - frameCenter);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestItem = item;
                }
            });

            if (closestItem && closestItem.dataset.name === winner.name) {
                closestItem.classList.add('winner');
                slotMachine.querySelector(`#winner-name-${index}`).textContent = winner.name;
            } else {
                console.error(`Winner mismatch for reel ${index}. Expected: ${winner.name}, Got: ${closestItem ? closestItem.dataset.name : 'none'}`);
            }
        }, animationDuration * 1000 + 300);
    });

    setTimeout(() => {
        multiModal.style.display = 'none';
        document.body.style.overflow = ''; // Restore body scroll
        selectedWinners.forEach(winner => {
            Array.from(participantsTableBody.rows).forEach(row => {
                if (row.cells[1].textContent.trim() === winner.name) row.remove();
            });
            addWinnerRow(winner);
        });
        participantId = participantsTableBody.rows.length + 1;
        Array.from(participantsTableBody.rows).forEach((r, i) => r.cells[0].textContent = i + 1);
        showWinnersSection();
    }, animationDuration * 1000 + 1000);
}

function initiateSingleMode() {
    const currentParticipants = fetchParticipants();
    let availableParticipants = currentParticipants.filter(p => !winners.some(w => w.name === p.name));

    if (currentParticipants.length === 0) {
        alert('Добавьте участников!');
        return;
    }
    if (availableParticipants.length === 0) {
        alert('Нет доступных участников!');
        return;
    }

    isSingleMode = true;
    multiModal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Disable body scroll when modal is open
    reelsContainer.innerHTML = '';

    const tempTable = document.createElement('table');
    tempTable.id = 'temp-winners-table';
    tempTable.innerHTML = `
        <thead>
            <tr>
                <th></th>
                <th>#</th>
                <th>Имя</th>
                <th>Цена бонуса</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tempTbody = tempTable.querySelector('tbody');

    const modalContent = multiModal.querySelector('.modal-content');
    modalContent.appendChild(tempTable);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.id = 'spin-buttons';
    buttonsContainer.style.display = 'none';
    buttonsContainer.style.justifyContent = 'center';
    buttonsContainer.style.gap = '20px';
    buttonsContainer.style.marginTop = '20px';
    buttonsContainer.style.flexDirection = 'row';

    const furtherBtn = createButton('Крутить дальше', spinSingle);
    const stopBtn = createButton('Стоп', finishSingleMode);

    buttonsContainer.appendChild(furtherBtn);
    buttonsContainer.appendChild(stopBtn);
    modalContent.appendChild(buttonsContainer);

    const state = JSON.parse(localStorage.getItem('appState'));
    if (state && state.selectedSoFar && state.isSingleMode) {
        selectedSoFar = state.selectedSoFar;
        selectedSoFar.forEach((winner, index) => {
            const row = tempTbody.insertRow();
            row.innerHTML = `
                <td><button class="remove-btn">✕</button></td>
                <td>${index + 1}</td>
                <td contenteditable="true">${winner.name}</td>
                <td contenteditable="true">${winner.price || ''}</td>
            `;
            row.cells[2].addEventListener('input', () => {
                const rowIndex = Array.from(tempTbody.rows).indexOf(row);
                selectedSoFar[rowIndex].name = row.cells[2].textContent.trim();
                saveAppState();
            });
            row.cells[3].addEventListener('input', () => {
                const rowIndex = Array.from(tempTbody.rows).indexOf(row);
                selectedSoFar[rowIndex].price = row.cells[3].textContent.trim();
                saveAppState();
            });
            row.querySelector('.remove-btn').addEventListener('click', () => {
                const rowIndex = Array.from(tempTbody.rows).indexOf(row);
                const removedName = row.cells[2].textContent.trim();
                // Remove from participants table
                Array.from(participantsTableBody.rows).forEach(row => {
                    if (row.cells[1].textContent.trim() === removedName) row.remove();
                });
                participantId = participantsTableBody.rows.length + 1;
                Array.from(participantsTableBody.rows).forEach((r, i) => r.cells[0].textContent = i + 1);
                selectedSoFar.splice(rowIndex, 1);
                row.remove();
                Array.from(tempTbody.rows).forEach((r, i) => r.cells[1].textContent = i + 1);
                saveAppState();
                if (selectedSoFar.length === 0 && availableParticipants.length === 0) {
                    finishSingleMode();
                }
            });
        });
        buttonsContainer.style.display = 'flex';
        if (availableParticipants.length === 0) {
            furtherBtn.style.display = 'none';
        }
    }

    spinSingle();

    function spinSingle() {
        if (availableParticipants.length === 0) {
            finishSingleMode();
            return;
        }

        const winnerIdx = Math.floor(Math.random() * availableParticipants.length);
        const winner = availableParticipants.splice(winnerIdx, 1)[0];

        reelsContainer.innerHTML = '';

        const slotMachine = document.createElement('div');
        slotMachine.className = 'slot-machine';
        slotMachine.innerHTML = `
            <div class="particle-bg">
                <div class="particle-1"></div>
                <div class="particle-2"></div>
            </div>
            <div class="reel-mask">
                <ul class="reel" id="reel-0"></ul>
            </div>
            <div class="flapper"></div>
            <div class="winner-announce">Победитель: <span id="winner-name-0"></span></div>
        `;
        reelsContainer.appendChild(slotMachine);

        const reel = slotMachine.querySelector('#reel-0');
        const numDuplicates = 5;
        const reelItems = Array.from({length: numDuplicates}, () => [...currentParticipants]).flat();
        reelItems.forEach(person => {
            const li = document.createElement('li');
            li.textContent = person.name;
            li.dataset.name = person.name;
            reel.appendChild(li);
        });

        const itemHeight = 100;
        const flapper = slotMachine.querySelector('.flapper');
        const flapperTop = parseFloat(getComputedStyle(flapper).top) || 200;
        const totalHeight = reelItems.length * itemHeight;
        reel.style.height = `${totalHeight}px`;

        const len = currentParticipants.length;
        const ori = currentParticipants.findIndex(p => p.name === winner.name);
        const randomCopy = Math.floor(Math.random() * (numDuplicates - 2)) + 1;
        const winnerIndex = randomCopy * len + ori;
        let winnerPosition = winnerIndex * itemHeight - (flapperTop - itemHeight / 2);
        const randomOffset = (Math.random() * (itemHeight - 20)) - (itemHeight / 2 - 10);
        winnerPosition += randomOffset;

        const timingFunction = 'cubic-bezier(0, 0, 0.2, 1)';

        setTimeout(() => {
            reel.style.transition = `transform ${animationDuration}s ${timingFunction}`;
            reel.style.transform = `translateY(-${winnerPosition}px)`;
        }, 10);

        setTimeout(() => {
            const visibleItems = Array.from(reel.children);
            const frameCenter = flapperTop;
            let closestItem = null;
            let minDistance = Infinity;

            visibleItems.forEach(item => {
                const itemRect = item.getBoundingClientRect();
                const itemCenter = itemRect.top + itemRect.height / 2 - slotMachine.getBoundingClientRect().top;
                const distance = Math.abs(itemCenter - frameCenter);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestItem = item;
                }
            });

            if (closestItem && closestItem.dataset.name === winner.name) {
                closestItem.classList.add('winner');
                document.getElementById('winner-name-0').textContent = winner.name;

                selectedSoFar.push({ name: winner.name, price: '' });

                const row = tempTbody.insertRow();
                row.innerHTML = `
                    <td><button class="remove-btn">✕</button></td>
                    <td>${selectedSoFar.length}</td>
                    <td contenteditable="true">${winner.name}</td>
                    <td contenteditable="true"></td>
                `;

                row.cells[2].addEventListener('input', () => {
                    const index = Array.from(tempTbody.rows).indexOf(row);
                    selectedSoFar[index].name = row.cells[2].textContent.trim();
                    saveAppState();
                });

                row.cells[3].addEventListener('input', () => {
                    const index = Array.from(tempTbody.rows).indexOf(row);
                    selectedSoFar[index].price = row.cells[3].textContent.trim();
                    saveAppState();
                });

                row.querySelector('.remove-btn').addEventListener('click', () => {
                    const index = Array.from(tempTbody.rows).indexOf(row);
                    const removedName = row.cells[2].textContent.trim();
                    // Remove from participants table
                    Array.from(participantsTableBody.rows).forEach(row => {
                        if (row.cells[1].textContent.trim() === removedName) row.remove();
                    });
                    participantId = participantsTableBody.rows.length + 1;
                    Array.from(participantsTableBody.rows).forEach((r, i) => r.cells[0].textContent = i + 1);
                    selectedSoFar.splice(index, 1);
                    row.remove();
                    Array.from(tempTbody.rows).forEach((r, i) => r.cells[1].textContent = i + 1);
                    saveAppState();
                    if (selectedSoFar.length === 0 && availableParticipants.length === 0) {
                        finishSingleMode();
                    }
                });

                buttonsContainer.style.display = 'flex';
                if (availableParticipants.length === 0) {
                    furtherBtn.style.display = 'none';
                }
                saveAppState();
            } else {
                console.error(`Winner mismatch. Expected: ${winner.name}, Got: ${closestItem ? closestItem.dataset.name : 'none'}`);
            }
        }, animationDuration * 1000 + 300);
    }

    function finishSingleMode() {
        multiModal.style.display = 'none';
        document.body.style.overflow = ''; // Restore body scroll
        buttonsContainer.remove();
        tempTable.remove();

        selectedSoFar.forEach(winner => {
            Array.from(participantsTableBody.rows).forEach(row => {
                if (row.cells[1].textContent.trim() === winner.name) row.remove();
            });
            addWinnerRow({ name: winner.name }, winner.price || '');
        });

        participantId = participantsTableBody.rows.length + 1;
        Array.from(participantsTableBody.rows).forEach((r, i) => r.cells[0].textContent = i + 1);
        selectedSoFar = [];
        isSingleMode = false;
        showWinnersSection();
        saveAppState();
    }

    closeModal.onclick = () => {
        multiModal.style.display = 'none';
        document.body.style.overflow = ''; // Restore body scroll
        buttonsContainer.remove();
        tempTable.remove();

        selectedSoFar.forEach(winner => {
            Array.from(participantsTableBody.rows).forEach(row => {
                if (row.cells[1].textContent.trim() === winner.name) row.remove();
            });
            addWinnerRow({ name: winner.name }, winner.price || '');
        });

        participantId = participantsTableBody.rows.length + 1;
        Array.from(participantsTableBody.rows).forEach((r, i) => r.cells[0].textContent = i + 1);
        selectedSoFar = [];
        isSingleMode = false;
        showWinnersSection();
        saveAppState();
    };

    function createButton(text, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.addEventListener('click', onClick);
        return btn;
    }
}

function showWinnersSection() {
    controlsSection.style.display = 'none';
    participantsSection.style.display = 'none';
    winnersSection.style.display = 'block';
}

function calculateBonus(row) {
    const mode = bonusModeSelect.value;
    const priceStr = row.cells[3].textContent.trim();
    const payoutStr = row.cells[4].textContent.trim();
    if (!priceStr || !payoutStr) {
        row.cells[5].innerText = '';
        row.cells[6].innerText = '';
        row.classList.remove('green-row');
        return;
    }
    const price = parseFloat(priceStr) || 0;
    const payout = parseFloat(payoutStr) || 0;
    if (price <= 0 || payout <= 0) {
        row.cells[5].innerText = '';
        row.cells[6].innerText = '';
        row.classList.remove('green-row');
        return;
    }
    const multi = payout / price;
    const x = Math.round(multi * 100);
    row.cells[5].innerText = x + 'x';

    if (mode === 'shuffle') {
        let bonus = '';
        if (x >= 1100) bonus = '50$';
        else if (x >= 600) bonus = '25$';
        else if (x >= 300) bonus = '15$';
        else if (x >= 200) bonus = '10$';
        else if (x >= 100) bonus = 'утешалка 3$';
        else bonus = 'gg';

        row.cells[6].innerText = bonus;

        if (bonus !== 'gg') {
            row.classList.add('green-row');
        } else {
            row.classList.remove('green-row');
        }
    } else {
        if (x < 200) {
            row.cells[6].innerText = 'gg';
            row.classList.remove('green-row');
        } else {
            const excess = payout;
            if (excess <= 0) {
                row.cells[6].innerText = 'gg';
                row.classList.remove('green-row');
            } else {
                const bonus = 0.1 * excess;
                row.cells[6].innerText = Math.round(bonus);
                row.classList.add('green-row');
            }
        }
    }
}

function updateAllBonuses() {
    Array.from(winnersTableBody.rows).forEach(row => {
        calculateBonus(row);
    });
    updateTotals();
}

function updateTotals() {
    let totalSpent = 0;
    let totalReceived = 0;

    Array.from(winnersTableBody.rows).forEach(row => {
        const price = parseFloat(row.cells[3].innerText) || 0;
        const payout = parseFloat(row.cells[4].innerText) || 0;
        totalSpent += price;
        totalReceived += payout;
    });

    totalSpentSpan.textContent = totalSpent.toFixed(2);
    totalReceivedSpan.textContent = totalReceived.toFixed(2);

    const paybackPercent = totalSpent > 0 ? ((totalReceived / totalSpent) * 100).toFixed(2) : 0;
    paybackPercentSpan.textContent = `${paybackPercent}%`;
    paybackPercentSpan.style.color = paybackPercent >= 100 ? 'green' : 'red';
}

function saveAppState() {
    const state = {
        participants: fetchParticipants(),
        winners,
        selectedSoFar,
        isSingleMode,
        participantId,
        winnerId,
        limit: limitInput.value,
        additionalLimit: additionalLimitInput.value,
        winnersHtml: winnersTableBody.innerHTML,
        mode: bonusModeSelect.value
    };
    localStorage.setItem('appState', JSON.stringify(state));
}

function loadAppState() {
    const state = JSON.parse(localStorage.getItem('appState'));
    if (!state) return;

    participantId = state.participantId || 1;
    winnerId = state.winnerId || 1;

    limitInput.value = state.limit || '10';
    additionalLimitInput.value = state.additionalLimit || '5';
    if (state.mode) {
        bonusModeSelect.value = state.mode;
    }

    state.participants.forEach(p => addParticipantRow(p.name, true));
    participants = state.participants || [];

    winners = state.winners || [];
    winnersTableBody.innerHTML = state.winnersHtml || '';

    if (state.isSingleMode && state.selectedSoFar && state.selectedSoFar.length > 0) {
        state.selectedSoFar.forEach(winner => {
            Array.from(participantsTableBody.rows).forEach(row => {
                if (row.cells[1].textContent.trim() === winner.name) row.remove();
            });
            addWinnerRow({ name: winner.name }, winner.price || '');
        });
        participantId = participantsTableBody.rows.length + 1;
        Array.from(participantsTableBody.rows).forEach((r, i) => r.cells[0].textContent = i + 1);
    }

    if (winners.length > 0 || (state.selectedSoFar && state.selectedSoFar.length > 0)) {
        winnersSection.style.display = 'block';
        controlsSection.style.display = 'none';
        participantsSection.style.display = 'none';
        inputSection.style.display = 'none';
    }

    const winnerRows = winnersTableBody.rows;
    for (let row of winnerRows) {
        row.cells[2].addEventListener('input', () => {
            const name = row.cells[2].textContent.trim();
            const oldName = winners.find(w => w.name === row.cells[2].dataset.originalName)?.name;
            const index = winners.findIndex(w => w.name === oldName);
            if (index !== -1) {
                winners[index].name = name;
                row.cells[2].dataset.originalName = name;
            }
            saveAppState();
        });
        row.cells[3].addEventListener('input', () => {
            calculateBonus(row);
            updateTotals();
            saveAppState();
        });
        row.cells[4].addEventListener('input', () => {
            calculateBonus(row);
            updateTotals();
            saveAppState();
        });
        const removeBtn = row.cells[0].querySelector('.remove-btn');
        if (removeBtn) removeBtn.addEventListener('click', () => {
            deleteWinner(row, row.cells[2].textContent);
            updateTotals();
        });
        row.cells[2].dataset.originalName = row.cells[2].textContent.trim();
    }
    updateAllBonuses();
}

