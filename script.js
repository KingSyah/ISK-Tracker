/* ========================================
   EVE Online ISK Audit — Professional JS
   ======================================== */

(function () {
    'use strict';

    // ── Category Mapping ──
    const CATEGORY_MAP = {
        'Bounty Prizes':            { icon: 'fas fa-skull-crossbones', color: '#10b981', type: 'income' },
        'ESS Escrow Payment':       { icon: 'fas fa-satellite-dish',   color: '#3b82f6', type: 'income' },
        'Player Donation':          { icon: 'fas fa-hand-holding-heart', color: '#8b5cf6', type: 'income' },
        'Corporation Account Withdrawal': { icon: 'fas fa-building',   color: '#a855f7', type: 'income' },
        'Market Transaction':       { icon: 'fas fa-store',            color: '#06b6d4', type: 'income' },
        'Daily Goal Reward':        { icon: 'fas fa-star',             color: '#f59e0b', type: 'income' },
        'Contract Reward Deposited':{ icon: 'fas fa-file-contract',    color: '#14b8a6', type: 'income' },

        'Bounty Prize Corporation Tax': { icon: 'fas fa-landmark',     color: '#ef4444', type: 'expense' },
        'Market Escrow':            { icon: 'fas fa-cart-shopping',    color: '#f97316', type: 'expense' },
        'Jump Bridge Fee':          { icon: 'fas fa-bridge',           color: '#6366f1', type: 'expense' },
        'Jump Clone Activation Fee':{ icon: 'fas fa-clone',            color: '#ec4899', type: 'expense' },
        'Jump Clone Installation Fee': { icon: 'fas fa-download',      color: '#d946ef', type: 'expense' },
        'Insurance':                { icon: 'fas fa-shield-halved',    color: '#f43f5e', type: 'expense' },
        'Transaction Tax':          { icon: 'fas fa-receipt',          color: '#fb923c', type: 'expense' },
        'Skill Purchase':           { icon: 'fas fa-graduation-cap',   color: '#a78bfa', type: 'expense' },
        'Contract Brokers Fee':     { icon: 'fas fa-handshake',        color: '#78716c', type: 'expense' },
    };

    function getCategory(desc) {
        for (const [key, val] of Object.entries(CATEGORY_MAP)) {
            if (desc.includes(key)) return { name: key, ...val };
        }
        return { name: desc, icon: 'fas fa-circle-question', color: '#64748b', type: 'unknown' };
    }

    // ── State ──
    let allTx = [];
    let filteredTx = [];
    let currentPage = 1;
    const PAGE_SIZE = 30;
    let sortCol = 'date';
    let sortDir = 'desc';
    let activePeriod = 'all';

    // ── DOM Refs ──
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    // ── Parse ISK amount ──
    function parseISK(s) {
        if (typeof s !== 'string') return 0;
        return parseInt(s.replace(/[,.\s]| ISK/g, ''), 10) || 0;
    }

    function formatISK(n) {
        if (n == null || isNaN(n)) return '0 ISK';
        const abs = Math.abs(n);
        const formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
        return (n < 0 ? '-' : '') + formatted + ' ISK';
    }

    function shortISK(n) {
        const abs = Math.abs(n);
        if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
        if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (abs >= 1e3) return (n / 1e3).toFixed(0) + 'K';
        return n.toString();
    }

    // ── Parse raw text ──
    function parseRawData(text) {
        const lines = text.replace(/\r/g, '').trim().split('\n');
        const txs = [];
        let detectedName = null;

        for (const line of lines) {
            if (!line.trim()) continue;
            const parts = line.split('\t');
            if (parts.length < 4) continue;

            const dt = parts[0].trim();
            const desc = parts[1].trim();
            const amtStr = parts[2].trim();
            const balStr = parts[3].trim();
            const memo = (parts[4] || '').trim();

            // Auto-detect character name from memo patterns
            if (!detectedName && memo) {
                // Pattern 1: "[r] Name Here got/was/has..."
                let m = memo.match(/\[r\]\s+([A-Z][a-zA-Z'.]+(?:\s+[a-zA-Z'.]+){1,4}?)\s+(?:got|was|has)/);
                // Pattern 2: "paid from Name Here to ..."
                if (!m) m = memo.match(/paid from\s+([A-Z][a-zA-Z'.]+(?:\s+[a-zA-Z'.]+){1,4}?)\s+to\s/);
                // Pattern 3: "to/from/by Name Here's account" or "to/from/by Name Here,"
                if (!m) m = memo.match(/(?:to|from|by)\s+([A-Z][a-zA-Z'.]+(?:\s+[a-zA-Z'.]+){1,4}?)('s|,|\s+(?:to|for|account|deposited))/);
                // Pattern 4: "authorized by: Name Here" at end of string
                if (!m) m = memo.match(/authorized by:\s+([A-Z][a-zA-Z'.]+(?:\s+[a-zA-Z'.]+){1,4}?)$/);
                // Pattern 5: "transferred funds to Name Here" at end of string
                if (!m) m = memo.match(/transferred funds to\s+([A-Z][a-zA-Z'.]+(?:\s+[a-zA-Z'.]+){1,4}?)$/);
                // Pattern 6: "by Name Here" at end of string (daily goals, etc.)
                if (!m) m = memo.match(/\bby\s+([A-Z][a-zA-Z'.]+(?:\s+[a-zA-Z'.]+){1,4}?)$/);
                // Pattern 7: "bought stuff from Name Here"
                if (!m) m = memo.match(/bought stuff from\s+([A-Z][a-zA-Z'.]+(?:\s+[a-zA-Z'.]+){1,4}?)$/);
                // Pattern 8: Name at very start of memo followed by action verb
                if (!m) m = memo.match(/^([A-Z][a-zA-Z'.]+(?:\s+[a-zA-Z'.]+){1,4}?)\s+(?:got|purchased|completed|deposited|paid)/);
                if (m) detectedName = (m[1] || m[0]).trim();
            }

            const date = new Date(dt.replace(/\./g, '-'));
            const amount = parseISK(amtStr);
            const balance = parseISK(balStr);

            if (isNaN(date.getTime())) continue;
            if (isNaN(amount) || amount === 0) continue;

            const cat = getCategory(desc);
            txs.push({ date, description: desc, amount, balance, memo, category: cat });
        }

        // Update character badge
        if (detectedName) {
            const nameEl = document.getElementById('charName');
            const corpEl = document.getElementById('charCorp');
            if (nameEl) nameEl.textContent = detectedName;
            if (corpEl) corpEl.textContent = 'Wallet Audit Active';
        }

        return txs;
    }

    // ── Load embedded clipboard data (disabled — users paste their own data) ──
    async function loadEmbeddedData() {
        // No auto-load. Users import their own data from EVE Online.
        return false;
    }

    function saveToStorage() {
        try {
            localStorage.setItem('isk_audit_data', JSON.stringify(allTx.map(t => ({
                d: t.date.toISOString(),
                desc: t.description,
                amt: t.amount,
                bal: t.balance,
                memo: t.memo
            }))));
        } catch (e) { /* quota exceeded */ }
    }

    function loadFromStorage() {
        try {
            const raw = localStorage.getItem('isk_audit_data');
            if (!raw) return false;
            const arr = JSON.parse(raw);
            if (!arr || !arr.length) return false;
            allTx = arr.map(r => {
                const desc = r.desc;
                const cat = getCategory(desc);
                return { date: new Date(r.d), description: desc, amount: r.amt, balance: r.bal, memo: r.memo, category: cat };
            });
            allTx.sort((a, b) => b.date - a.date);
            return true;
        } catch (e) { return false; }
    }

    // ── Period Filtering ──
    function getFilteredByPeriod() {
        if (activePeriod === 'all') return allTx;
        const now = new Date('2026-04-23T00:00:00'); // Use last date in data
        let cutoff;
        if (activePeriod === '1d') cutoff = new Date(now - 86400000);
        else if (activePeriod === '3d') cutoff = new Date(now - 3 * 86400000);
        else if (activePeriod === '7d') cutoff = new Date(now - 7 * 86400000);
        else return allTx;
        return allTx.filter(t => t.date >= cutoff);
    }

    // ── Dashboard Update ──
    function updateDashboard() {
        const data = getFilteredByPeriod();
        if (!data.length) {
            // Reset all KPIs
            $('#kpiBalance').textContent = '—';
            $('#kpiBalanceSub').textContent = '';
            $('#kpiIncome').textContent = '—';
            $('#kpiIncomeCount').textContent = '— transactions';
            $('#kpiExpense').textContent = '—';
            $('#kpiExpenseCount').textContent = '— transactions';
            $('#kpiNet').textContent = '—';
            $('#kpiNetSub').textContent = '—';

            // Destroy all charts
            if (chartBalance) { chartBalance.destroy(); chartBalance = null; }
            if (chartIncomePie) { chartIncomePie.destroy(); chartIncomePie = null; }
            if (chartExpensePie) { chartExpensePie.destroy(); chartExpensePie = null; }
            if (chartDailyNet) { chartDailyNet.destroy(); chartDailyNet = null; }
            if (chartEveDonut) { chartEveDonut.destroy(); chartEveDonut = null; }

            // Clear EVE overview
            $('#eveDonutAmount').textContent = '—';
            $('#eveIncomeVal').textContent = '—';
            $('#eveExpenseVal').textContent = '—';
            $('#eveLegend').innerHTML = '';

            // Clear category grid
            $('#categoryGrid').innerHTML = '';

            // Clear transaction table
            $('#txBody').innerHTML = '';
            filteredTx = [];
            $('#txCount').textContent = '0 transactions';
            $('#pagination').innerHTML = '';

            // Reset character badge
            var nameEl = document.getElementById('charName');
            var corpEl = document.getElementById('charCorp');
            if (nameEl) nameEl.textContent = 'ISK Audit Dashboard';
            if (corpEl) corpEl.textContent = 'Paste wallet data to begin';

            // Show import modal
            var importModal = document.getElementById('importModal');
            if (importModal) importModal.style.display = 'flex';

            return;
        }

        // KPIs
        const latestBalance = data[0].balance; // data is desc sorted
        let totalIncome = 0, totalExpense = 0, incomeCount = 0, expenseCount = 0;
        for (const t of data) {
            if (t.amount > 0) { totalIncome += t.amount; incomeCount++; }
            else { totalExpense += t.amount; expenseCount++; }
        }
        const net = totalIncome + totalExpense;

        $('#kpiBalance').textContent = shortISK(latestBalance);
        $('#kpiBalanceSub').textContent = formatISK(latestBalance);
        $('#kpiIncome').textContent = shortISK(totalIncome);
        $('#kpiIncomeCount').textContent = incomeCount + ' transactions';
        $('#kpiExpense').textContent = shortISK(Math.abs(totalExpense));
        $('#kpiExpenseCount').textContent = expenseCount + ' transactions';

        const netEl = $('#kpiNet');
        netEl.textContent = (net >= 0 ? '+' : '') + shortISK(net);
        netEl.className = 'kpi-value ' + (net >= 0 ? 'positive' : 'negative');
        const roi = totalIncome > 0 ? ((net / totalIncome) * 100).toFixed(1) : '0';
        $('#kpiNetSub').textContent = `ROI: ${roi}%`;

        renderCharts(data);
        renderEveOverview(data);
        renderCategories(data);
        renderTable();
    }

    // ── EVE-style Overview Donut ──
    let chartEveDonut;

    function renderEveOverview(data) {
        // Income breakdown by category
        const incomeCats = {};
        let totalIncome = 0, totalExpense = 0;
        for (const t of data) {
            if (t.amount > 0) {
                totalIncome += t.amount;
                const name = t.category.name;
                incomeCats[name] = (incomeCats[name] || 0) + t.amount;
            } else {
                totalExpense += t.amount;
            }
        }

        // Sort by amount desc
        const sorted = Object.entries(incomeCats).sort((a, b) => b[1] - a[1]);
        const labels = sorted.map(([k]) => k);
        const values = sorted.map(([, v]) => v);
        const colors = labels.map(l => CATEGORY_MAP[l]?.color || '#64748b');

        // Center text
        $('#eveDonutAmount').textContent = shortISK(totalIncome);
        $('#eveIncomeVal').textContent = '+' + formatISK(totalIncome);
        $('#eveExpenseVal').textContent = formatISK(totalExpense);

        // Legend
        const legendEl = $('#eveLegend');
        legendEl.innerHTML = '';
        for (let i = 0; i < labels.length; i++) {
            const pct = totalIncome > 0 ? (values[i] / totalIncome * 100).toFixed(1) : '0';
            const item = document.createElement('div');
            item.className = 'eve-legend-item';
            item.innerHTML = `
                <span class="eve-legend-color" style="background:${colors[i]}"></span>
                <span class="eve-legend-name">${labels[i]}</span>
                <span class="eve-legend-pct">${pct}%</span>
                <span class="eve-legend-amount">${shortISK(values[i])}</span>
            `;
            legendEl.appendChild(item);
        }

        // Donut chart
        if (chartEveDonut) chartEveDonut.destroy();
        chartEveDonut = new Chart($('#eveDonutChart'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 8,
                    borderRadius: 3,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(17,24,39,0.95)',
                        titleFont: { family: 'Inter', size: 12 },
                        bodyFont: { family: 'JetBrains Mono', size: 11 },
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: ctx => {
                                const pct = totalIncome > 0 ? (ctx.parsed / totalIncome * 100).toFixed(1) : '0';
                                return `${ctx.label}: ${formatISK(ctx.parsed)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // ── Charts ──
    let chartBalance, chartIncomePie, chartExpensePie, chartDailyNet;

    const chartDefaults = () => {
        const style = getComputedStyle(document.body);
        return {
            textColor: style.getPropertyValue('--text-secondary').trim(),
            gridColor: style.getPropertyValue('--border-light').trim(),
            cardBg: style.getPropertyValue('--bg-card').trim(),
        };
    };

    function renderCharts(data) {
        const { textColor, gridColor } = chartDefaults();

        const commonOpts = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(17,24,39,0.95)',
                    titleFont: { family: 'Inter', size: 12 },
                    bodyFont: { family: 'JetBrains Mono', size: 11 },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: true,
                }
            },
        };

        // ── Balance History (area chart) ──
        const ascData = [...data].reverse();
        if (chartBalance) chartBalance.destroy();
        chartBalance = new Chart($('#balanceChart'), {
            type: 'line',
            data: {
                labels: ascData.map(t => t.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                datasets: [{
                    data: ascData.map(t => t.balance),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.08)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHitRadius: 10,
                }]
            },
            options: {
                ...commonOpts,
                scales: {
                    x: {
                        ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: 10 },
                        grid: { color: gridColor, drawBorder: false },
                    },
                    y: {
                        ticks: {
                            color: textColor,
                            font: { family: 'JetBrains Mono', size: 10 },
                            callback: v => shortISK(v),
                        },
                        grid: { color: gridColor, drawBorder: false },
                    }
                },
                plugins: {
                    ...commonOpts.plugins,
                    tooltip: {
                        ...commonOpts.plugins.tooltip,
                        callbacks: {
                            label: ctx => 'Balance: ' + formatISK(ctx.parsed.y),
                        }
                    }
                }
            }
        });

        // ── Income Pie ──
        const incomeCats = {};
        for (const t of data) {
            if (t.amount > 0) {
                const name = t.category.name;
                incomeCats[name] = (incomeCats[name] || 0) + t.amount;
            }
        }
        const incLabels = Object.keys(incomeCats);
        const incValues = Object.values(incomeCats);
        const incColors = incLabels.map(l => CATEGORY_MAP[l]?.color || '#64748b');

        if (chartIncomePie) chartIncomePie.destroy();
        chartIncomePie = new Chart($('#incomePieChart'), {
            type: 'doughnut',
            data: {
                labels: incLabels,
                datasets: [{ data: incValues, backgroundColor: incColors, borderWidth: 0, hoverOffset: 6 }]
            },
            options: {
                ...commonOpts,
                cutout: '60%',
                plugins: {
                    ...commonOpts.plugins,
                    legend: { display: true, position: 'bottom', labels: { color: textColor, font: { size: 10 }, boxWidth: 10, padding: 8 } },
                    tooltip: {
                        ...commonOpts.plugins.tooltip,
                        callbacks: { label: ctx => ctx.label + ': ' + formatISK(ctx.parsed) }
                    }
                }
            }
        });

        // ── Expense Pie ──
        const expCats = {};
        for (const t of data) {
            if (t.amount < 0) {
                const name = t.category.name;
                expCats[name] = (expCats[name] || 0) + Math.abs(t.amount);
            }
        }
        const expLabels = Object.keys(expCats);
        const expValues = Object.values(expCats);
        const expColors = expLabels.map(l => CATEGORY_MAP[l]?.color || '#64748b');

        if (chartExpensePie) chartExpensePie.destroy();
        chartExpensePie = new Chart($('#expensePieChart'), {
            type: 'doughnut',
            data: {
                labels: expLabels,
                datasets: [{ data: expValues, backgroundColor: expColors, borderWidth: 0, hoverOffset: 6 }]
            },
            options: {
                ...commonOpts,
                cutout: '60%',
                plugins: {
                    ...commonOpts.plugins,
                    legend: { display: true, position: 'bottom', labels: { color: textColor, font: { size: 10 }, boxWidth: 10, padding: 8 } },
                    tooltip: {
                        ...commonOpts.plugins.tooltip,
                        callbacks: { label: ctx => ctx.label + ': ' + formatISK(ctx.parsed) }
                    }
                }
            }
        });

        // ── Daily Net Flow (bar chart) ──
        const dailyMap = {};
        for (const t of data) {
            const day = t.date.toISOString().split('T')[0];
            if (!dailyMap[day]) dailyMap[day] = 0;
            dailyMap[day] += t.amount;
        }
        const sortedDays = Object.keys(dailyMap).sort();
        const netValues = sortedDays.map(d => dailyMap[d]);

        if (chartDailyNet) chartDailyNet.destroy();
        chartDailyNet = new Chart($('#dailyNetChart'), {
            type: 'bar',
            data: {
                labels: sortedDays.map(d => {
                    const dt = new Date(d);
                    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }),
                datasets: [{
                    data: netValues,
                    backgroundColor: netValues.map(v => v >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)'),
                    borderRadius: 4,
                    borderSkipped: false,
                }]
            },
            options: {
                ...commonOpts,
                scales: {
                    x: {
                        ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: 10 },
                        grid: { display: false },
                    },
                    y: {
                        ticks: {
                            color: textColor,
                            font: { family: 'JetBrains Mono', size: 10 },
                            callback: v => shortISK(v),
                        },
                        grid: { color: gridColor, drawBorder: false },
                    }
                },
                plugins: {
                    ...commonOpts.plugins,
                    tooltip: {
                        ...commonOpts.plugins.tooltip,
                        callbacks: { label: ctx => 'Net: ' + formatISK(ctx.parsed.y) }
                    }
                }
            }
        });
    }

    // ── Category Cards ──
    function renderCategories(data) {
        const cats = {};
        for (const t of data) {
            const name = t.category.name;
            if (!cats[name]) cats[name] = { ...t.category, total: 0, count: 0 };
            cats[name].total += t.amount;
            cats[name].count++;
        }

        const sorted = Object.values(cats).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
        const maxAbs = Math.max(...sorted.map(c => Math.abs(c.total)), 1);

        const grid = $('#categoryGrid');
        grid.innerHTML = '';
        for (const c of sorted) {
            const isIncome = c.total >= 0;
            const pct = (Math.abs(c.total) / maxAbs * 100).toFixed(0);
            const card = document.createElement('div');
            card.className = 'cat-card';
            card.innerHTML = `
                <div class="cat-left">
                    <span class="cat-name"><i class="${c.icon}" style="color:${c.color};margin-right:6px;font-size:0.8rem"></i>${c.name}</span>
                    <span class="cat-count">${c.count} transactions</span>
                    <div class="cat-bar"><div class="cat-bar-fill ${isIncome ? 'income' : 'expense'}" style="width:${pct}%"></div></div>
                </div>
                <span class="cat-amount ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : ''}${shortISK(c.total)}</span>
            `;
            grid.appendChild(card);
        }
    }

    // ── Transaction Table ──
    function applyFilters() {
        const data = getFilteredByPeriod();
        const search = ($('#searchInput').value || '').toLowerCase();
        const typeF = $('#filterType').value;
        const catF = $('#filterCategory').value;

        filteredTx = data.filter(t => {
            if (search && !t.description.toLowerCase().includes(search) && !t.memo.toLowerCase().includes(search)) return false;
            if (typeF === 'income' && t.amount <= 0) return false;
            if (typeF === 'expense' && t.amount >= 0) return false;
            if (catF !== 'all' && t.category.name !== catF) return false;
            return true;
        });

        // Sort
        filteredTx.sort((a, b) => {
            let va, vb;
            if (sortCol === 'date') { va = a.date.getTime(); vb = b.date.getTime(); }
            else if (sortCol === 'amount') { va = a.amount; vb = b.amount; }
            else if (sortCol === 'category') { va = a.category.name; vb = b.category.name; }
            else { va = 0; vb = 0; }
            if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            return sortDir === 'asc' ? va - vb : vb - va;
        });

        currentPage = 1;
        renderTableBody();
    }

    function renderTableBody() {
        const tbody = $('#txBody');
        tbody.innerHTML = '';

        const start = (currentPage - 1) * PAGE_SIZE;
        const page = filteredTx.slice(start, start + PAGE_SIZE);

        for (const t of page) {
            const tr = document.createElement('tr');
            const amtClass = t.amount >= 0 ? 'tx-amount-positive' : 'tx-amount-negative';
            tr.innerHTML = `
                <td>${t.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${t.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                <td><span class="tx-category-badge"><i class="${t.category.icon}" style="color:${t.category.color}"></i>${t.category.name}</span></td>
                <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary);font-size:0.8rem" title="${t.memo}">${t.memo}</td>
                <td class="num-col ${amtClass}">${t.amount >= 0 ? '+' : ''}${formatISK(t.amount)}</td>
                <td class="num-col" style="color:var(--text-muted)">${formatISK(t.balance)}</td>
            `;
            tbody.appendChild(tr);
        }

        // Count
        $('#txCount').textContent = `${filteredTx.length} transactions (page ${currentPage} of ${Math.ceil(filteredTx.length / PAGE_SIZE) || 1})`;

        // Pagination
        const totalPages = Math.ceil(filteredTx.length / PAGE_SIZE);
        const pag = $('#pagination');
        pag.innerHTML = '';

        const addPageBtn = (label, pg, disabled = false, active = false) => {
            const btn = document.createElement('button');
            btn.className = 'page-btn' + (active ? ' active' : '');
            btn.textContent = label;
            btn.disabled = disabled;
            if (!disabled) btn.addEventListener('click', () => { currentPage = pg; renderTableBody(); });
            pag.appendChild(btn);
        };

        addPageBtn('‹', Math.max(1, currentPage - 1), currentPage === 1);
        const range = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) range.push(i);
            else if (range[range.length - 1] !== '...') range.push('...');
        }
        for (const r of range) {
            if (r === '...') {
                const span = document.createElement('span');
                span.textContent = '...';
                span.style.cssText = 'display:flex;align-items:center;color:var(--text-muted);padding:0 4px;font-size:0.8rem';
                pag.appendChild(span);
            } else {
                addPageBtn(r, r, false, r === currentPage);
            }
        }
        addPageBtn('›', Math.min(totalPages, currentPage + 1), currentPage === totalPages);
    }

    function renderTable() {
        applyFilters();
    }

    // ── Category filter dropdown ──
    function populateCategoryFilter() {
        const select = $('#filterCategory');
        const cats = new Set(allTx.map(t => t.category.name));
        select.innerHTML = '<option value="all">All Categories</option>';
        for (const c of [...cats].sort()) {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            select.appendChild(opt);
        }
    }

    // ── PDF Export ──
    // ── Helper: add chart image with correct aspect ratio ──
    function addChartImage(doc, chart, x, y, maxW, maxH) {
        if (!chart) return y;
        const imgData = chart.toBase64Image('image/png', 1.0);
        // Get chart canvas aspect ratio
        const canvas = chart.canvas;
        const ratio = canvas.width / canvas.height;
        let w = maxW;
        let h = w / ratio;
        if (h > maxH) { h = maxH; w = h * ratio; }
        doc.addImage(imgData, 'PNG', x, y, w, h);
        return y + h;
    }

    async function exportPDF() {
        const data = getFilteredByPeriod();
        if (!data.length) { alert('No data to export.'); return; }

        alert('Generating PDF… This may take a moment.');

        // Temporarily show analysis tab so charts render properly
        var analysisPanel = document.querySelector('.tab-panel.tab-analysis');
        var overviewPanel = document.querySelector('.tab-panel.tab-overview');
        var wasAnalysisActive = analysisPanel && analysisPanel.classList.contains('active');
        if (!wasAnalysisActive && analysisPanel) {
            analysisPanel.classList.add('active');
            // Resize charts to render in now-visible container
            if (chartBalance) chartBalance.resize();
            if (chartIncomePie) chartIncomePie.resize();
            if (chartExpensePie) chartExpensePie.resize();
            if (chartDailyNet) chartDailyNet.resize();
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pw = doc.internal.pageSize.getWidth();
            const ph = doc.internal.pageSize.getHeight();
            const margin = 12;
            const contentW = pw - margin * 2;

            // ── PAGE 1: Header + Summary + Balance Chart ──

            // Header bar
            doc.setFillColor(26, 31, 46);
            doc.rect(0, 0, pw, 18, 'F');
            doc.setTextColor(232, 236, 244);
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('EVE Online ISK Audit Report', margin, 12);
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated: ${new Date().toLocaleString()}`, pw - margin, 12, { align: 'right' });

            // Summary boxes
            let totalIncome = 0, totalExpense = 0;
            for (const t of data) {
                if (t.amount > 0) totalIncome += t.amount;
                else totalExpense += t.amount;
            }
            const net = totalIncome + totalExpense;
            const latestBalance = data[0].balance;

            const boxY = 22;
            const boxH = 14;
            const boxW = (contentW - 6) / 4;
            const summaries = [
                { label: 'Current Balance', value: formatISK(latestBalance), color: [59, 130, 246] },
                { label: 'Total Income', value: '+' + formatISK(totalIncome), color: [16, 185, 129] },
                { label: 'Total Expenses', value: formatISK(totalExpense), color: [239, 68, 68] },
                { label: 'Net Flow', value: (net >= 0 ? '+' : '') + formatISK(net), color: net >= 0 ? [16, 185, 129] : [239, 68, 68] },
            ];

            summaries.forEach((s, i) => {
                const bx = margin + i * (boxW + 2);
                doc.setFillColor(245, 247, 250);
                doc.roundedRect(bx, boxY, boxW, boxH, 2, 2, 'F');
                doc.setFontSize(7);
                doc.setTextColor(107, 114, 128);
                doc.text(s.label, bx + 3, boxY + 5);
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(...s.color);
                doc.text(s.value, bx + 3, boxY + 11);
                doc.setFont(undefined, 'normal');
            });

            // Balance history chart (full width)
            const chartY = boxY + boxH + 5;
            const chartMaxH = ph - chartY - margin - 5;
            addChartImage(doc, chartBalance, margin, chartY, contentW, chartMaxH);

            // ── PAGE 2: Donut charts + Daily Net ──
            doc.addPage();

            // Header bar
            doc.setFillColor(26, 31, 46);
            doc.rect(0, 0, pw, 14, 'F');
            doc.setTextColor(232, 236, 244);
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Income & Expense Breakdown', margin, 10);

            const rowY = 18;
            const halfW = (contentW - 8) / 2;

            // Income donut (left) — square
            if (chartIncomePie) {
                doc.setFontSize(9);
                doc.setTextColor(16, 185, 129);
                doc.setFont(undefined, 'bold');
                doc.text('Income by Category', margin, rowY);
                doc.setFont(undefined, 'normal');
                addChartImage(doc, chartIncomePie, margin, rowY + 2, halfW, 70);
            }

            // Expense donut (right) — square
            if (chartExpensePie) {
                doc.setFontSize(9);
                doc.setTextColor(239, 68, 68);
                doc.setFont(undefined, 'bold');
                doc.text('Expenses by Category', margin + halfW + 8, rowY);
                doc.setFont(undefined, 'normal');
                addChartImage(doc, chartExpensePie, margin + halfW + 8, rowY + 2, halfW, 70);
            }

            // Daily net flow (full width below donuts)
            const dailyY = rowY + 78;
            if (chartDailyNet) {
                doc.setFontSize(9);
                doc.setTextColor(107, 114, 128);
                doc.setFont(undefined, 'bold');
                doc.text('Daily Net Flow', margin, dailyY);
                doc.setFont(undefined, 'normal');
                addChartImage(doc, chartDailyNet, margin, dailyY + 2, contentW, 60);
            }

            // ── PAGE 3+: Transaction table ──
            doc.addPage();

            // Header
            doc.setFillColor(26, 31, 46);
            doc.rect(0, 0, pw, 14, 'F');
            doc.setTextColor(232, 236, 244);
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Transaction Ledger', margin, 10);

            const tableBody = data.map(t => [
                t.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                t.category.name,
                t.description,
                (t.amount >= 0 ? '+' : '') + formatISK(t.amount),
                formatISK(t.balance),
            ]);

            doc.autoTable({
                head: [['Date', 'Category', 'Description', 'Amount', 'Balance']],
                body: tableBody,
                startY: 18,
                margin: { left: margin, right: margin },
                styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak', textColor: [55, 65, 81] },
                headStyles: { fillColor: [26, 31, 46], textColor: [232, 236, 244], fontStyle: 'bold', fontSize: 7 },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 22 },
                    1: { cellWidth: 35 },
                    2: { cellWidth: 'auto' },
                    3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
                    4: { cellWidth: 35, halign: 'right' },
                },
                didParseCell: (data) => {
                    // Color amount column
                    if (data.section === 'body' && data.column.index === 3) {
                        const raw = data.cell.raw;
                        if (raw.startsWith('+')) data.cell.styles.textColor = [16, 185, 129];
                        else data.cell.styles.textColor = [239, 68, 68];
                    }
                },
                didDrawPage: (data) => {
                    // Footer
                    doc.setFontSize(7);
                    doc.setTextColor(150);
                    doc.text(
                        `ISK Audit Report — Page ${doc.internal.getNumberOfPages()}`,
                        pw / 2, ph - 5, { align: 'center' }
                    );
                }
            });

            doc.save(`ISK_Audit_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error('PDF error:', err);
            alert('Failed to generate PDF. Check console for details.');
        }

        // Restore tab state — go back to overview if analysis was not originally active
        if (!wasAnalysisActive && analysisPanel) {
            analysisPanel.classList.remove('active');
            if (overviewPanel) overviewPanel.classList.add('active');
            document.querySelectorAll('.eve-tab').forEach(function(t) { t.classList.remove('active'); });
            var overviewTab = document.querySelector('.eve-tab[data-tab="overview"]');
            if (overviewTab) overviewTab.classList.add('active');
        }
    }

    // ── Theme ──
    function toggleTheme() {
        const body = document.body;
        const isLight = body.classList.toggle('light');
        localStorage.setItem('isk_theme', isLight ? 'light' : 'dark');
        const icon = $('#themeToggle i');
        icon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
        // Re-render charts for color update
        updateDashboard();
    }

    function applyTheme() {
        const saved = localStorage.getItem('isk_theme');
        if (saved === 'light') {
            document.body.classList.add('light');
            $('#themeToggle i').className = 'fas fa-sun';
        }
    }

    // ── Data Restore Notice ──
    function showDataNotice(count) {
        // Remove existing notice if any
        var existing = document.getElementById('dataNotice');
        if (existing) existing.remove();

        var notice = document.createElement('div');
        notice.id = 'dataNotice';
        notice.style.cssText = 'position:relative;z-index:50;display:flex;align-items:center;justify-content:center;gap:0.75rem;padding:0.6rem 1rem;background:linear-gradient(135deg,#1e3a5f,#1a2744);border-bottom:1px solid rgba(59,130,246,0.3);font-size:0.85rem;color:#e8ecf4;flex-wrap:wrap;text-align:center;';
        notice.innerHTML = '<i class="fas fa-database" style="color:#3b82f6"></i>' +
            '<span>Data sebelumnya ditemukan: <strong>' + count + ' transaksi</strong></span>' +
            '<button id="noticeContinue" style="padding:0.3rem 0.8rem;border-radius:6px;border:1px solid #3b82f6;background:transparent;color:#3b82f6;cursor:pointer;font-family:var(--font-sans);font-size:0.8rem;font-weight:500;transition:all 0.2s">Lanjutkan</button>' +
            '<button id="noticeClear" style="padding:0.3rem 0.8rem;border-radius:6px;border:1px solid #ef4444;background:transparent;color:#ef4444;cursor:pointer;font-family:var(--font-sans);font-size:0.8rem;font-weight:500;transition:all 0.2s">Hapus Data</button>';

        // Insert after topbar
        var topbar = document.querySelector('.topbar');
        if (topbar && topbar.nextSibling) {
            topbar.parentNode.insertBefore(notice, topbar.nextSibling);
        } else {
            document.body.prepend(notice);
        }

        document.getElementById('noticeContinue').addEventListener('click', function() {
            notice.remove();
        });

        document.getElementById('noticeClear').addEventListener('click', function() {
            if (confirm('Hapus semua data transaksi? Tindakan ini tidak dapat dibatalkan.')) {
                allTx = [];
                localStorage.removeItem('isk_audit_data');
                populateCategoryFilter();
                updateDashboard();
                notice.remove();
            }
        });
    }

    // ── Event Listeners ──
    function init() {
        applyTheme();

        // Load data
        const hasStorage = loadFromStorage();
        if (!hasStorage) {
            populateCategoryFilter();
            updateDashboard();
            var importModal = document.getElementById('importModal');
            if (importModal) importModal.style.display = 'flex';
        } else {
            populateCategoryFilter();
            updateDashboard();
            showDataNotice(allTx.length);
        }

        // Helper to safely bind events
        function bind(id, event, handler) {
            var el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
        }
        function bindAll(selector, event, handler) {
            document.querySelectorAll(selector).forEach(function(el) {
                el.addEventListener(event, handler);
            });
        }

        // Theme toggle
        bind('themeToggle', 'click', toggleTheme);

        // Period buttons
        bindAll('.period-btn', 'click', function() {
            document.querySelectorAll('.period-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            activePeriod = this.dataset.period;
            updateDashboard();
        });

        // Search & filters
        bind('searchInput', 'input', function() { currentPage = 1; applyFilters(); });
        bind('filterType', 'change', function() { currentPage = 1; applyFilters(); });
        bind('filterCategory', 'change', function() { currentPage = 1; applyFilters(); });

        // Sort
        bindAll('.sortable', 'click', function() {
            var col = this.dataset.sort;
            if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            else { sortCol = col; sortDir = 'desc'; }
            applyFilters();
        });

        // PDF
        bind('pdfBtn', 'click', exportPDF);

        // Import button — open modal
        bind('importBtn', 'click', function() {
            var modal = document.getElementById('importModal');
            if (modal) modal.style.display = 'flex';
        });

        // Import confirm button — process data
        bind('importConfirmBtn', 'click', function() {
            var textarea = document.getElementById('importTextarea');
            if (!textarea) return;
            var raw = textarea.value;
            if (!raw.trim()) { alert('Please paste your wallet data first.'); return; }

            var newTx = parseRawData(raw);

            // Debug: show parse result if nothing found
            if (!newTx.length) {
                var sampleLines = raw.trim().split('\n').slice(0, 3);
                var debug = 'No valid transactions found.\n\n';
                debug += 'Lines detected: ' + raw.trim().split('\n').length + '\n';
                debug += 'First line parts: ' + raw.trim().split('\n')[0].split('\t').length + '\n\n';
                debug += 'Sample:\n' + sampleLines.map(function(l) { return l.substring(0, 80); }).join('\n');
                alert(debug);
                return;
            }

            // Merge & deduplicate
            allTx.push.apply(allTx, newTx);
            var seen = {};
            var unique = [];
            for (var i = 0; i < allTx.length; i++) {
                var t = allTx[i];
                var key = t.date.getTime() + '|' + t.amount + '|' + t.balance;
                if (!seen[key]) { seen[key] = true; unique.push(t); }
            }
            allTx = unique.sort(function(a, b) { return b.date - a.date; });
            saveToStorage();

            // Close modal & refresh
            document.getElementById('importModal').style.display = 'none';
            textarea.value = '';
            populateCategoryFilter();
            updateDashboard();

            // Remove data notice if visible
            var notice = document.getElementById('dataNotice');
            if (notice) notice.remove();

            alert(newTx.length + ' transactions imported successfully.');
        });

        // Reset button
        bind('resetDataBtn', 'click', function() {
            if (confirm('Clear all transaction data? This cannot be undone.')) {
                allTx = [];
                localStorage.removeItem('isk_audit_data');
                populateCategoryFilter();
                updateDashboard();
                var notice = document.getElementById('dataNotice');
                if (notice) notice.remove();
            }
        });

        // EVE tabs — functional tab switching
        bindAll('.eve-tab', 'click', function() {
            var tabName = this.dataset.tab;
            document.querySelectorAll('.eve-tab').forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
            var panel = document.querySelector('.tab-panel.tab-' + tabName);
            if (panel) panel.classList.add('active');
            // Resize charts when analysis tab becomes visible
            if (tabName === 'analysis') {
                if (chartBalance) chartBalance.resize();
                if (chartIncomePie) chartIncomePie.resize();
                if (chartExpensePie) chartExpensePie.resize();
                if (chartDailyNet) chartDailyNet.resize();
            }
            if (tabName === 'overview') {
                if (chartEveDonut) chartEveDonut.resize();
            }
        });

        // Copyright year
        var copyrightEl = document.getElementById('copyright-text');
        if (copyrightEl) copyrightEl.textContent = '\u00A9 ' + new Date().getFullYear() + ' KingSyah';
    }

    // Ensure init runs exactly once
    var initialized = false;
    function safeInit() {
        if (initialized) return;
        initialized = true;
        init();
    }

    document.addEventListener('DOMContentLoaded', safeInit);
    if (document.readyState !== 'loading') safeInit();
})();
