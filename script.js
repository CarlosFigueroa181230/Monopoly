import { resolveOpenInvestment } from './investmentEngine.js';

// FORMATTING M$
const formatMoney = (amount) => {
    return 'M$ ' + amount.toLocaleString('en-US');
};

// --- CLASSES ---

class Player {
    constructor(name, initialBalance) {
        this.id = 'P' + Math.random().toString(36).substring(2, 6).toUpperCase();
        this.name = name;
        this.balance = initialBalance;
        this.investments = [];
    }

    get investedBalance() {
        return this.investments.reduce((sum, inv) => sum + inv.amount, 0);
    }
}

class Transaction {
    constructor(type, from, to, amount, reason = '') {
        this.id = 'TX' + Date.now();
        this.timestamp = new Date();
        this.type = type; // 'transfer', 'bank-in', 'bank-out', 'invest', 'invest-return', 'system'
        this.from = from; // playerId or 'BANK'
        this.to = to; // playerId or 'BANK'
        this.amount = amount;
        this.reason = reason;
        this.isRevertible = ['transfer', 'bank-in', 'bank-out'].includes(type);
    }
}

class Investment {
    constructor(playerId, amount, type, durationTurns) {
        this.id = 'INV' + Date.now();
        this.playerId = playerId;
        this.amount = amount;
        this.type = type; // 'closed', 'open'
        this.durationTurns = durationTurns;
        this.turnsLeft = durationTurns;
    }

    resolve() {
        if (this.type === 'closed') {
            const rate = 0.10 * this.durationTurns;
            return {
                finalAmount: Math.floor(this.amount * (1 + rate)),
                path: null
            };
        } else {
            return resolveOpenInvestment(this.amount, this.durationTurns);
        }
    }
}

class BankManager {
    constructor() {
        this.players = new Map();
        this.history = [];
        this.investments = [];

        // Carga inicial (Opcional, pero se resetea al recargar)
        console.log("Banco Central Monopoly Iniciado");
    }

    addPlayer(name, balance) {
        const p = new Player(name, balance);
        this.players.set(p.id, p);
        return p;
    }

    getPlayer(id) {
        return this.players.get(id);
    }

    // Transactions
    executeTx(type, fromId, toId, amount, reason = '') {
        amount = parseInt(amount, 10);
        if (isNaN(amount) || amount <= 0) throw new Error("Cantidad inválida");

        if (type === 'transfer') {
            if (fromId === toId) throw new Error("No puedes transferirte a ti mismo.");
            const fromP = this.getPlayer(fromId);
            const toP = this.getPlayer(toId);
            if (fromP.balance < amount) throw new Error(`Saldo insuficiente en la cuenta de ${fromP.name}.`);

            fromP.balance -= amount;
            toP.balance += amount;

        } else if (type === 'bank-in') {
            const fromP = this.getPlayer(fromId);
            if (fromP.balance < amount) throw new Error(`Saldo insuficiente en la cuenta de ${fromP.name}.`);
            fromP.balance -= amount;

        } else if (type === 'bank-out') {
            const toP = this.getPlayer(toId);
            toP.balance += amount;
        }

        const tx = new Transaction(type, fromId, toId, amount, reason);
        this.history.unshift(tx);
        return tx;
    }

    undoLastRevertible() {
        const txIndex = this.history.findIndex(t => t.isRevertible);
        if (txIndex === -1) throw new Error("No hay transacciones para deshacer.");

        const tx = this.history[txIndex];

        // Reverse balances
        if (tx.type === 'transfer') {
            const pFrom = this.getPlayer(tx.from);
            const pTo = this.getPlayer(tx.to);
            if (pTo.balance < tx.amount) throw new Error(`No se puede deshacer. ${pTo.name} ya no tiene el saldo que recibió.`);
            pTo.balance -= tx.amount;
            pFrom.balance += tx.amount;

        } else if (tx.type === 'bank-in') {
            const pFrom = this.getPlayer(tx.from);
            pFrom.balance += tx.amount;

        } else if (tx.type === 'bank-out') {
            const pTo = this.getPlayer(tx.to);
            if (pTo.balance < tx.amount) throw new Error(`No se puede deshacer. ${pTo.name} gastó el dinero recibido.`);
            pTo.balance -= tx.amount;
        }

        // Remove from history
        this.history.splice(txIndex, 1);

        // Add log
        const undoTx = new Transaction('system', 'SYS', 'SYS', 0, `Deshecha transacción por M$ ${tx.amount.toLocaleString('en-US')}`);
        undoTx.isRevertible = false;
        this.history.unshift(undoTx);
    }

    invest(playerId, amount, type, turns) {
        amount = parseInt(amount, 10);
        turns = parseInt(turns, 10);
        if (isNaN(amount) || amount <= 0) throw new Error("Cantidad inválida");
        if (isNaN(turns) || turns <= 0) throw new Error("Número de turnos inválido");

        const p = this.getPlayer(playerId);
        if (p.balance < amount) throw new Error(`Saldo insuficiente para invertir M$ ${amount.toLocaleString('en-US')}.`);

        p.balance -= amount; // Freeze money
        const inv = new Investment(playerId, amount, type, turns);
        p.investments.push(inv);
        this.investments.push(inv);

        const typeName = type === 'closed' ? 'Cerrada' : 'Abierta';
        const tx = new Transaction('invest', playerId, 'BANK', amount, `Inversión ${typeName} por ${turns} turnos`);
        tx.isRevertible = false;
        this.history.unshift(tx);
    }

    advanceTurn() {
        let events = [];
        // Decrement turns
        for (let i = this.investments.length - 1; i >= 0; i--) {
            const inv = this.investments[i];
            inv.turnsLeft -= 1;

            if (inv.turnsLeft <= 0) {
                // Resolve
                const p = this.getPlayer(inv.playerId);
                const result = inv.resolve();
                const finalAmount = result.finalAmount;
                p.balance += finalAmount;

                const profit = finalAmount - inv.amount;
                const resultText = profit >= 0 ? `Ganancia: +M$${profit.toLocaleString('en-US')}` : `Pérdida: M$${profit.toLocaleString('en-US')}`;

                const tx = new Transaction('invest-return', 'BANK', p.id, finalAmount, `Retorno Inversión: ${resultText}`);
                tx.isRevertible = false;
                this.history.unshift(tx);
                events.push({
                    playerId: p.id,
                    txt: `Inversión resuelta. ${resultText}`,
                    path: result.path,
                    initial: inv.amount,
                    final: finalAmount
                });

                // Remove from lists
                p.investments = p.investments.filter(item => item.id !== inv.id);
                this.investments.splice(i, 1);
            }
        }
        return events;
    }
}

// --- UI CONTROLLER ---

const bank = new BankManager();

// DOM Elements
const playersGrid = document.getElementById('players-grid');
const historyList = document.getElementById('history-list');
const btnUndo = document.getElementById('btn-undo');

const modals = {
    addPlayer: document.getElementById('modal-add-player'),
    transaction: document.getElementById('modal-transaction'),
    investment: document.getElementById('modal-investment')
};

// Update UI
function render() {
    // 1. Render Players
    playersGrid.innerHTML = '';
    const playersArray = Array.from(bank.players.values());

    if (playersArray.length === 0) {
        playersGrid.innerHTML = '<p class="empty-state">No hay jugadores activos. Crea uno para empezar.</p>';
    }

    playersArray.forEach(p => {
        const card = document.createElement('div');
        card.className = 'player-card glass-panel';

        const invAmount = p.investedBalance;

        card.innerHTML = `
            <div class="player-header">
                <span class="player-name">${p.name}</span>
                <span class="player-id">#${p.id}</span>
            </div>
            <div class="balance-group">
                <span class="balance-label">Saldo Disponible</span>
                <span class="balance-amount ${p.balance > 0 ? 'positive' : ''}">${formatMoney(p.balance)}</span>
            </div>
            ${invAmount > 0 ? `
            <div class="balance-group" style="margin-top:10px;">
                <span class="balance-label">Total Congelado (Invertido)</span>
                <span class="balance-amount frozen">🔒 ${formatMoney(invAmount)}</span>
            </div>
            ` : ''}
        `;
        playersGrid.appendChild(card);
    });

    // 2. Render History
    historyList.innerHTML = '';
    if (bank.history.length === 0) {
        historyList.innerHTML = '<li class="history-item empty">Historial vacío.</li>';
    } else {
        bank.history.forEach(tx => {
            const li = document.createElement('li');
            li.className = `history-item ${tx.type}`;

            const timeStr = tx.timestamp.toLocaleTimeString();
            let desc = '';

            if (tx.type === 'transfer') {
                const pF = bank.getPlayer(tx.from);
                const pT = bank.getPlayer(tx.to);
                desc = `${pF?.name || tx.from} ➔ ${pT?.name || tx.to}`;
            } else if (tx.type === 'bank-in') {
                desc = `${bank.getPlayer(tx.from)?.name} pagó al Banco`;
            } else if (tx.type === 'bank-out') {
                desc = `Banco pagó a ${bank.getPlayer(tx.to)?.name}`;
            } else if (tx.type === 'system') {
                desc = tx.reason;
            } else {
                // Invest / Invest return
                desc = `${bank.getPlayer(tx.from || tx.to)?.name || ''} - ${tx.reason}`;
            }

            li.innerHTML = `
                <span class="tx-time">${timeStr}</span>
                <div style="display:flex; justify-content:space-between;">
                    <span>${desc}</span>
                    <span class="tx-amount ${tx.type === 'bank-in' || tx.type === 'invest' ? 'text-red' : (tx.type === 'system' ? '' : 'text-green')}">
                        ${tx.amount > 0 ? formatMoney(tx.amount) : ''}
                    </span>
                </div>
            `;
            historyList.appendChild(li);
        });
    }

    // 3. Update Undo Button (Only true if there is at least one revertible and it is the FIRST found revertible)
    const hasRevertible = bank.history.some(tx => tx.isRevertible);
    btnUndo.disabled = !hasRevertible;
}

// Show/Hide Modals
document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
    });
});
function showModal(id) {
    modals[id].classList.remove('hidden');
}
function hideModal(id) {
    modals[id].classList.add('hidden');
}

// Modals Populators
function populateSelects(selectElements) {
    const players = Array.from(bank.players.values());
    selectElements.forEach(select => {
        if (!select) return;
        select.innerHTML = '';
        players.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (${formatMoney(p.balance)})`;
            select.appendChild(opt);
        });
    });
}

// --- EVENT LISTENERS ---

// Add Player
document.getElementById('btn-add-player').addEventListener('click', () => showModal('addPlayer'));
document.getElementById('form-add-player').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('input-player-name').value;
    const bal = document.getElementById('input-player-balance').value;
    bank.addPlayer(name, parseInt(bal, 10));
    e.target.reset();
    hideModal('addPlayer');
    render();
});

// Dataphone Actions setup
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        const playersCount = bank.players.size;

        if (playersCount === 0) {
            alert("Primero debes crear jugadores.");
            return;
        }

        if (action === 'invest') {
            populateSelects([document.getElementById('select-inv-player')]);
            showModal('investment');
            return;
        }

        // Transactions
        const txTypeInput = document.getElementById('tx-type');
        const titleEl = document.getElementById('transaction-title');
        const fgFrom = document.getElementById('fg-from');
        const fgTo = document.getElementById('fg-to');

        const selFrom = document.getElementById('select-tx-from');
        const selTo = document.getElementById('select-tx-to');

        txTypeInput.value = action;
        document.getElementById('input-tx-amount').value = '';

        if (action === 'transfer') {
            if (playersCount < 2) {
                alert("Necesitas al menos 2 jugadores para realizar una transferencia entre ellos.");
                return;
            }
            titleEl.textContent = '🔁 Transferir';
            fgFrom.style.display = 'block';
            fgTo.style.display = 'block';
            populateSelects([selFrom, selTo]);
            selFrom.required = true;
            selTo.required = true;

        } else if (action === 'pay-bank') {
            titleEl.textContent = '🏦 Pagar al Banco';
            fgFrom.style.display = 'block';
            fgTo.style.display = 'none';
            populateSelects([selFrom]);
            selFrom.required = true;
            selTo.required = false;

        } else if (action === 'receive-bank') {
            titleEl.textContent = '💰 Recibir del Banco';
            fgFrom.style.display = 'none';
            fgTo.style.display = 'block';
            populateSelects([selTo]);
            selFrom.required = false;
            selTo.required = true;
        }

        showModal('transaction');
    });
});

// Submit Transaction
document.getElementById('form-transaction').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('tx-type').value;
    const fromId = document.getElementById('select-tx-from').value;
    const toId = document.getElementById('select-tx-to').value;
    const amount = document.getElementById('input-tx-amount').value;

    try {
        bank.executeTx(type, type === 'receive-bank' ? 'BANK' : fromId, type === 'pay-bank' ? 'BANK' : toId, amount);
        hideModal('transaction');
        render();
    } catch (err) {
        alert(err.message);
    }
});

// Investment Type Description changes
document.getElementById('select-inv-type').addEventListener('change', (e) => {
    const desc = document.getElementById('inv-desc');
    if (e.target.value === 'closed') {
        desc.className = "help-text text-green";
        desc.textContent = "🟢 SEGURO: Rentabilidad fija de +10% del capital por cada turno. Crecimiento lineal y predecible.";
    } else {
        desc.className = "help-text text-red";
        desc.textContent = "🔴 VARIABLE: El capital fluctúa cada turno entre -10% y +30%. El resultado final se calcula promediando la trayectoria usando la regla del trapecio.";
    }
});

// Submit Investment
document.getElementById('form-investment').addEventListener('submit', (e) => {
    e.preventDefault();
    const pId = document.getElementById('select-inv-player').value;
    const type = document.getElementById('select-inv-type').value;
    const amount = document.getElementById('input-inv-amount').value;
    const turns = document.getElementById('input-inv-turns').value;

    try {
        bank.invest(pId, amount, type, turns);
        e.target.reset();
        hideModal('investment');

        // Reset description text color and string just in case
        document.getElementById('inv-desc').className = "help-text text-green";
        document.getElementById('inv-desc').textContent = "🟢 SEGURO: Gana una rentabilidad fija equivalente a +10% del capital por cada turno invertido.";

        render();
    } catch (err) {
        alert(err.message);
    }
});

// Advance Turn
document.getElementById('btn-next-turn').addEventListener('click', () => {
    if (bank.players.size === 0) {
        alert("Agrega jugadores para empezar a jugar y turnarse.");
        return;
    }

    // Animate button
    const btn = document.getElementById('btn-next-turn');
    btn.classList.add('shake');
    setTimeout(() => btn.classList.remove('shake'), 300);

    const events = bank.advanceTurn();
    if (events.length > 0) {
        showInvestmentResults(events);
    }
    render();
});

// Undo
btnUndo.addEventListener('click', () => {
    try {
        bank.undoLastRevertible();
        render();
    } catch (err) {
        alert(err.message);
    }
});

function showInvestmentResults(events) {
    let html = `
    <div class="modal" id="results-modal">
        <div class="modal-content glass-panel">
            <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            <h2>📊 Resultados de Inversión</h2>
    `;

    events.forEach((e, i) => {
        html += `
            <div>
                <p><strong>${bank.getPlayer(e.playerId).name}</strong>: ${e.txt}</p>
                ${e.path ? `<canvas id="chart-${i}" width="300" height="150"></canvas>` : ''}
            </div>
        `;
    });

    html += `</div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    events.forEach((e, i) => {
        if (!e.path) return;
        drawChart(`chart-${i}`, e.path, e.initial, e.final);
    });
}

function drawChart(canvasId, data, initial, realFinal) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');

    const max = Math.max(...data);
    const min = Math.min(...data);

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const getX = i => (i / (data.length - 1)) * w;
    const getY = val => h - ((val - min) / (max - min)) * h;

    // =========================
    // 🔷 TRAPECIOS LIMPIOS + %
    // =========================
    for (let i = 0; i < data.length - 1; i++) {
        const x1 = getX(i);
        const x2 = getX(i + 1);

        const y1 = getY(data[i]);
        const y2 = getY(data[i + 1]);

        const isUp = data[i + 1] >= data[i];

        // Relleno
        ctx.fillStyle = isUp ? "rgba(0,255,0,0.2)" : "rgba(255,0,0,0.2)";

        ctx.beginPath();
        ctx.moveTo(x1, h);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, h);
        ctx.closePath();
        ctx.fill();

        // Borde
        ctx.strokeStyle = isUp ? "rgba(0,255,0,0.6)" : "rgba(255,0,0,0.6)";
        ctx.stroke();

        // Línea superior
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.stroke();

        // 📊 % cambio (ÚNICO DATO)
        const pct = ((data[i + 1] - data[i]) / data[i]) * 100;

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        ctx.fillStyle = "white";
        ctx.font = "10px Outfit";
        ctx.fillText(`${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`, midX - 10, midY);
    }

    // =========================
    // 📈 LÍNEA PRINCIPAL
    // =========================
    ctx.beginPath();
    data.forEach((val, i) => {
        const x = getX(i);
        const y = getY(val);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = data[data.length - 1] >= initial ? "lime" : "red";
    ctx.lineWidth = 2;
    ctx.stroke();

    // =========================
    // 📏 EJE X (TURNOS)
    // =========================
    const turns = data.length - 1;

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px Outfit";

    for (let i = 0; i < data.length; i++) {
        const x = getX(i);

        // evitar saturación: mostrar solo algunos
        if (turns <= 10 || i % Math.ceil(turns / 8) === 0 || i === turns) {
            ctx.fillText(i, x - 3, h + 12);
        }
    }

    // Label eje
    ctx.font = "11px Outfit";
    ctx.fillText("Turnos", w / 2 - 20, h + 25);

    // =========================
    // 📏 LÍNEA BASE INICIAL
    // =========================
    const baseY = getY(initial);

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(w, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // =========================
    // 🎯 INFO RESUMIDA
    // =========================
    const change = ((realFinal - initial) / initial) * 100;

    ctx.fillStyle = "white";
    ctx.font = "12px Outfit";

    ctx.fillText(`Inicio: ${Math.floor(initial)}`, 10, 15);
    ctx.fillText(`Final: ${Math.floor(final)}`, 10, 30);
    ctx.fillText(`Total: ${change.toFixed(1)}%`, 10, 45);
}



// Initial Render
render();
