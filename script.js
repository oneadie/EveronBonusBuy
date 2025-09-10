let participantId = 1;
let winnerId = 1;
let participants = [];
let winners = [];
let animationDuration = 3;
let isSingleMode = false;
let selectedSoFar = [];

const parseButton = document.getElementById('parse-participants');
const participantInput = document.getElementById('participant-input');
const limitInput = document.getElementById('winner-limit');
const startButton = document.getElementById('start-spin');
const spinOneButton = document.getElementById('spin-one');
const resetButtons = document.querySelectorAll('#reset-all');
const addEveronButton = document.getElementById('add-everon');
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

window.addEventListener('load', loadAppState);
parseButton.addEventListener('click', parseTelegramInput);
limitInput.addEventListener('input', saveAppState);
startButton.addEventListener('click', () => initiateMultiSelection(parseInt(limitInput.value)));
spinOneButton.addEventListener('click', initiateSingleMode);
resetButtons.forEach(button => button.addEventListener('click', resetApplication));
addEveronButton.addEventListener('click', () => addWinnerRow({ name: 'everon' }));
closeModal.addEventListener('click', () => {
    if (isSingleMode) {
        finishSingleMode && finishSingleMode();
    } else {
        multiModal.style.display = 'none';
        showWinnersSection();
    }
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
    row.cells[5].addEventListener('input', () => {
        calculateBonus(row);
        updateTotals();
        saveAppState();
    });
    row.querySelector('.remove-btn').addEventListener('click', () => {
        deleteWinner(row, person.name);
        updateTotals();
    });
    winners.push({ name: person.name, price });
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
    selectedSoFar = [];
    isSingleMode = false;
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

    selectedWinners.forEach((winner, index) => {
        const slotMachine = document.createElement('div');
        slotMachine.className = 'slot-machine';
        slotMachine.innerHTML = `
            <div class="reel-mask">
                <ul class="reel" id="reel-${index}"></ul>
            </div>
            <div class="highlight-frame">
                <div class="flapper"></div>
            </div>
            <div class="winner-announce">Победитель: <span id="winner-name-${index}">${winner.name}</span></div>
        `;
        reelsContainer.appendChild(slotMachine);

        const reel = slotMachine.querySelector(`#reel-${index}`);
        const reelItems = [...currentParticipants, ...currentParticipants, ...currentParticipants];
        reelItems.forEach(person => {
            const li = document.createElement('li');
            li.textContent = person.name;
            li.dataset.name = person.name;
            reel.appendChild(li);
        });

        const itemHeight = reel.children[0]?.offsetHeight || 80;
        const highlightFrame = slotMachine.querySelector('.highlight-frame');
        const highlightTop = parseFloat(getComputedStyle(highlightFrame).top);
        const totalHeight = reelItems.length * itemHeight;
        reel.style.height = `${totalHeight}px`;

        const len = currentParticipants.length;
        const ori = currentParticipants.findIndex(p => p.name === winner.name);
        const winnerIndex = len + ori;
        const winnerPosition = winnerIndex * itemHeight - highlightTop;

        const timingFunction = len <= 15
            ? 'cubic-bezier(0.5, 0, 0.1, 1)'
            : 'cubic-bezier(0.25, 0, 0.1, 1)';

        setTimeout(() => {
            reel.style.transition = `transform ${animationDuration}s ${timingFunction}`;
            reel.style.transform = `translateY(-${winnerPosition}px)`;
        }, 10);

        setTimeout(() => {
            const visibleItems = Array.from(reel.children);
            const frameCenter = highlightTop + itemHeight / 2;
            let closestItem = null;
            let minDistance = Infinity;

            visibleItems.forEach(item => {
                const itemRect = item.getBoundingClientRect();
                const itemCenter = itemRect.top + itemRect.height / 2;
                const distance = Math.abs(itemCenter - (slotMachine.getBoundingClientRect().top + frameCenter));
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

    selectedSoFar.forEach(s => {
        const row = tempTbody.insertRow();
        row.innerHTML = `
            <td><button class="remove-btn">✕</button></td>
            <td>${selectedSoFar.indexOf(s) + 1}</td>
            <td contenteditable="true">${s.name}</td>
            <td contenteditable="true">${s.price}</td>
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
            availableParticipants.push({ name: row.cells[2].textContent.trim() });
            selectedSoFar.splice(index, 1);
            row.remove();
            Array.from(tempTbody.rows).forEach((r, i) => r.cells[1].textContent = i + 1);
            saveAppState();
            if (selectedSoFar.length === 0 && availableParticipants.length === 0) {
                finishSingleMode();
            }
        });
    });

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
            <div class="reel-mask">
                <ul class="reel" id="reel-0"></ul>
            </div>
            <div class="highlight-frame">
                <div class="flapper"></div>
            </div>
            <div class="winner-announce">Победитель: <span id="winner-name-0"></span></div>
        `;
        reelsContainer.appendChild(slotMachine);

        const reel = slotMachine.querySelector('#reel-0');
        const reelItems = [...currentParticipants, ...currentParticipants, ...currentParticipants];
        reelItems.forEach(person => {
            const li = document.createElement('li');
            li.textContent = person.name;
            li.dataset.name = person.name;
            reel.appendChild(li);
        });

        const itemHeight = reel.children[0]?.offsetHeight || 80;
        const highlightFrame = slotMachine.querySelector('.highlight-frame');
        const highlightTop = parseFloat(getComputedStyle(highlightFrame).top);
        const totalHeight = reelItems.length * itemHeight;
        reel.style.height = `${totalHeight}px`;

        const len = currentParticipants.length;
        const ori = currentParticipants.findIndex(p => p.name === winner.name);
        const winnerIndex = len + ori;
        const winnerPosition = winnerIndex * itemHeight - highlightTop;

        const timingFunction = len <= 15
            ? 'cubic-bezier(0.5, 0, 0.1, 1)'
            : 'cubic-bezier(0.25, 0, 0.1, 1)';

        setTimeout(() => {
            reel.style.transition = `transform ${animationDuration}s ${timingFunction}`;
            reel.style.transform = `translateY(-${winnerPosition}px)`;
        }, 10);

        setTimeout(() => {
            const visibleItems = Array.from(reel.children);
            const frameCenter = highlightTop + itemHeight / 2;
            let closestItem = null;
            let minDistance = Infinity;

            visibleItems.forEach(item => {
                const itemRect = item.getBoundingClientRect();
                const itemCenter = itemRect.top + itemRect.height / 2;
                const distance = Math.abs(itemCenter - (slotMachine.getBoundingClientRect().top + frameCenter));
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
                    availableParticipants.push({ name: row.cells[2].textContent.trim() });
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
            } else {
                console.error(`Winner mismatch. Expected: ${winner.name}, Got: ${closestItem ? closestItem.dataset.name : 'none'}`);
            }
        }, animationDuration * 1000 + 300);
    }

    function finishSingleMode() {
        multiModal.style.display = 'none';
        buttonsContainer.remove();
        tempTable.remove();
        selectedSoFar.forEach(s => {
            Array.from(participantsTableBody.rows).forEach(row => {
                if (row.cells[1].textContent.trim() === s.name) row.remove();
            });
            addWinnerRow({ name: s.name }, s.price);
        });
        participantId = participantsTableBody.rows.length + 1;
        Array.from(participantsTableBody.rows).forEach((r, i) => r.cells[0].textContent = i + 1);
        selectedSoFar = [];
        isSingleMode = false;
        showWinnersSection();
        saveAppState();
    }

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
    const price = parseFloat(row.cells[3].innerText) || 0;
    const payout = parseFloat(row.cells[4].innerText) || 0;
    const x = price > 0 ? Math.round((payout / price) * 100) : 0;
    row.cells[5].innerText = x + 'x';

    let bonus = '';
    if (x >= 1100) bonus = '50$';
    else if (x >= 600 && x < 1100) bonus = '25$';
    else if (x >= 300 && x < 600) bonus = '15$';
    else if (x >= 200 && x < 300) bonus = '10$';
    else if (x >= 100 && x < 200) bonus = 'утешалка 3$';
    else bonus = 'gg';

    row.cells[6].innerText = bonus;
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

    let percent = totalSpent > 0 ? (totalReceived / totalSpent * 100).toFixed(2) : 0.00;
    const paybackSpan = document.getElementById('payback-percent');
    paybackSpan.textContent = percent + '%';
    paybackSpan.classList.remove('green', 'red');
    paybackSpan.classList.add(percent >= 100 ? 'green' : 'red');
}

function saveAppState() {
    const state = {
        participants: fetchParticipants(),
        winners,
        participantId,
        winnerId,
        limit: limitInput.value,
        additionalLimit: additionalLimitInput.value,
        winnersHtml: winnersTableBody.innerHTML,
        isSingleMode,
        selectedSoFar
    };
    localStorage.setItem('appState', JSON.stringify(state));
}

function loadAppState() {
    const state = JSON.parse(localStorage.getItem('appState'));
    if (!state) return;

    participantId = state.participantId || 1;
    winnerId = state.winnerId || 1;
    isSingleMode = state.isSingleMode || false;
    selectedSoFar = state.selectedSoFar || [];

    limitInput.value = state.limit || '10';
    additionalLimitInput.value = state.additionalLimit || '5';

    state.participants.forEach(p => addParticipantRow(p.name, true));
    participants = state.participants || [];

    winners = state.winners || [];
    winnersTableBody.innerHTML = state.winnersHtml || '';
    if (winners.length > 0) {
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
        row.cells[5].addEventListener('input', () => {
            calculateBonus(row);
            updateTotals();
            saveAppState();
        });
        const removeBtn = row.cells[0].querySelector('.remove-btn');
        if (removeBtn) removeBtn.addEventListener('click', () => {
            deleteWinner(removeBtn.parentElement.parentElement, row.cells[2].textContent);
            updateTotals();
        });
        row.cells[2].dataset.originalName = row.cells[2].textContent.trim();
    }

    if (isSingleMode) {
        initiateSingleMode();
    }

    updateTotals();
}
