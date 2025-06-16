document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const themeToggle = document.getElementById('theme-toggle');
    const dataInput = document.getElementById('data-input');
    const processDataBtn = document.getElementById('process-data-btn');
    const resetBtn = document.getElementById('resetBtn');
    const addDataBtn = document.getElementById('addDataBtn');

    const totalIncomeEl = document.getElementById('total-income');
    const totalExpenseEl = document.getElementById('total-expense');
    const finalBalanceEl = document.getElementById('final-balance');

    const viewDetailsBtn = document.getElementById('view-details-btn');
    const printPdfBtn = document.getElementById('print-pdf-btn');
    const modal = document.getElementById('details-modal');
    const closeBtn = document.querySelector('.close-btn');
    const transactionTableBody = document.querySelector('#transaction-table tbody');
    const currentYearEl = document.getElementById('current-year');

    // --- Chart instances ---
    let dailyFlowChart, proportionChart, balanceHistoryChart;

    // --- App State ---
    let allTransactions = [];

    // --- Functions ---

    // Theme Manager
    const applyTheme = (theme) => {
        document.body.classList.remove('light-mode', 'dark-mode');
        document.body.classList.add(theme);
        localStorage.setItem('theme', theme);
    };

    const toggleTheme = () => {
        const currentTheme = localStorage.getItem('theme') || 'light-mode';
        const newTheme = currentTheme === 'light-mode' ? 'dark-mode' : 'light-mode';
        applyTheme(newTheme);
    };

    // Data Parsing and Processing
    const parseISK = (iskString) => {
        if (typeof iskString !== 'string') return 0;
        return parseInt(iskString.replace(/[,.]| ISK/g, ''), 10);
    };

    const formatISK = (amount) => {
        if (isNaN(amount)) return '0 ISK';
        return `${Math.round(amount).toLocaleString('de-DE')} ISK`;
    };

    const parseData = (text) => {
        const lines = text.trim().split('\n');
        const transactions = lines.map(line => {
            const parts = line.split('\t');
            if (parts.length < 5) return null;

            const [dateTime, description, amountStr, balanceStr, memo] = parts;
            const date = new Date(dateTime.replace(/\./g, '-'));
            const amount = parseISK(amountStr);
            const balance = parseISK(balanceStr);

            if (isNaN(date.getTime()) || isNaN(amount) || isNaN(balance)) return null;

            return { date, description, amount, balance, memo };
        }).filter(t => t !== null);

        return transactions;
    };

    const processTransactions = () => {
        const newData = dataInput.value;
        if (!newData.trim()) {
            alert('Silakan paste data transaksi Anda.');
            return;
        }

        const newTransactions = parseData(newData);
        if (newTransactions.length === 0) {
            alert('Format data tidak valid atau tidak ada data yang bisa diproses.');
            return;
        }

        allTransactions.push(...newTransactions);
        const uniqueTransactions = Array.from(new Map(allTransactions.map(t => [t.date + t.memo, t])).values());
        allTransactions = uniqueTransactions.sort((a, b) => a.date - b.date);

        localStorage.setItem('transactions', JSON.stringify(allTransactions));
        updateDashboard();
        dataInput.value = '';
        alert(`${newTransactions.length} transaksi berhasil diproses dan ditambahkan.`);
    };

    const updateDashboard = () => {
        if (allTransactions.length === 0) {
            resetUI();
            return;
        };

        let totalIncome = 0;
        let totalExpense = 0;
        const dailyData = {};

        allTransactions.forEach(t => {
            if (t.amount > 0) totalIncome += t.amount;
            else totalExpense += t.amount;

            const day = t.date.toISOString().split('T')[0];
            if (!dailyData[day]) {
                dailyData[day] = { income: 0, expense: 0 };
            }
            if (t.amount > 0) dailyData[day].income += t.amount;
            else dailyData[day].expense += t.amount;
        });

        const finalBalance = allTransactions.length > 0 ? allTransactions[allTransactions.length - 1].balance : 0;

        totalIncomeEl.textContent = formatISK(totalIncome);
        totalExpenseEl.textContent = formatISK(totalExpense);
        finalBalanceEl.textContent = formatISK(finalBalance);

        renderCharts(dailyData, totalIncome, totalExpense, allTransactions);
        populateTransactionTable();
    };

    const resetUI = () => {
        totalIncomeEl.textContent = '0 ISK';
        totalExpenseEl.textContent = '0 ISK';
        finalBalanceEl.textContent = '0 ISK';
        transactionTableBody.innerHTML = '';

        [dailyFlowChart, proportionChart, balanceHistoryChart].forEach(chart => {
            if (chart) chart.destroy();
        });
        dailyFlowChart = null;
        proportionChart = null;
        balanceHistoryChart = null;

        renderCharts({}, 0, 0, []);
    };

    const resetApp = () => {
        if (confirm('Apakah Anda yakin ingin mereset semua data? Aksi ini tidak dapat dibatalkan.')) {
            allTransactions = [];
            localStorage.removeItem('transactions');
            dataInput.value = '';
            resetUI();
            alert('Aplikasi telah direset.');
        }
    };

    // Chart Rendering
    const renderCharts = (dailyData, totalIncome, totalExpense, transactions) => {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const textColor = isDarkMode ? '#f0f4f8' : '#102a43';
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: textColor } }
            },
            scales: {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: { ticks: { color: textColor }, grid: { color: gridColor } }
            }
        };

        const sortedDays = Object.keys(dailyData).sort((a, b) => new Date(b) - new Date(a)).slice(0, 7).reverse();
        const dailyLabels = sortedDays.map(day => new Date(day).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));

        if (dailyFlowChart) dailyFlowChart.destroy();
        dailyFlowChart = new Chart(document.getElementById('dailyFlowChart'), {
            type: 'bar',
            data: {
                labels: dailyLabels,
                datasets: [
                    { label: 'Pendapatan', data: sortedDays.map(d => dailyData[d].income), backgroundColor: '#10b981' },
                    { label: 'Pengeluaran', data: sortedDays.map(d => Math.abs(dailyData[d].expense)), backgroundColor: '#ef4444' }
                ]
            },
            options: chartOptions
        });

        if (proportionChart) proportionChart.destroy();
        proportionChart = new Chart(document.getElementById('proportionChart'), {
            type: 'doughnut',
            data: {
                labels: ['Pendapatan', 'Pengeluaran'],
                datasets: [{
                    data: [totalIncome, Math.abs(totalExpense)],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderColor: isDarkMode ? '#1f364d' : '#ffffff',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: textColor } } }
            }
        });

        if (balanceHistoryChart) balanceHistoryChart.destroy();
        const balanceLabels = transactions.map(t => t.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
        const balanceData = transactions.map(t => t.balance);

        balanceHistoryChart = new Chart(document.getElementById('balanceHistoryChart'), {
            type: 'line',
            data: {
                labels: balanceLabels,
                datasets: [{
                    label: 'Saldo',
                    data: balanceData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: transactions.length < 50 ? 3 : 0
                }]
            },
            options: { ...chartOptions, scales: { ...chartOptions.scales, x: { ...chartOptions.scales.x, display: transactions.length < 50 } } }
        });
    };

    const populateTransactionTable = () => {
        transactionTableBody.innerHTML = '';
        const reversedTransactions = [...allTransactions].reverse();
        reversedTransactions.forEach(t => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${t.date.toLocaleString('id-ID')}</td>
                <td>${t.description}</td>
                <td style="color: ${t.amount > 0 ? 'var(--income-color)' : 'var(--expense-color)'}">${formatISK(t.amount)}</td>
                <td>${formatISK(t.balance)}</td>
                <td>${t.memo}</td>
            `;
            transactionTableBody.appendChild(row);
        });
    };

    // Modal Logic
    const openModal = () => modal.style.display = 'block';
    const closeModal = () => modal.style.display = 'none';

    // PDF Generation
    const printPDF = async () => {
        if (allTransactions.length === 0) {
            alert("Tidak ada data untuk dicetak.");
            return;
        }

        alert("Mempersiapkan PDF... Ini mungkin memakan waktu beberapa saat.");

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            // --- 1. Prepare and capture the top section (header, summary, charts) ---
            const pdfLayout = document.getElementById('pdf-layout');

            document.getElementById('pdf-generation-date').textContent = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'long' });
            const pdfSummary = document.getElementById('pdf-summary');
            pdfSummary.innerHTML = `
                <div class="pdf-summary-item">
                    <h3>Total Pendapatan</h3>
                    <p style="color: #10b981;">${totalIncomeEl.textContent}</p>
                </div>
                <div class="pdf-summary-item">
                    <h3>Total Pengeluaran</h3>
                    <p style="color: #ef4444;">${totalExpenseEl.textContent}</p>
                </div>
                <div class="pdf-summary-item">
                    <h3>Saldo Akhir</h3>
                    <p>${finalBalanceEl.textContent}</p>
                </div>`;

            if (dailyFlowChart) document.getElementById('pdf-daily-flow-chart').src = dailyFlowChart.toBase64Image('image/png', 1.0);
            if (proportionChart) document.getElementById('pdf-proportion-chart').src = proportionChart.toBase64Image('image/png', 1.0);
            if (balanceHistoryChart) document.getElementById('pdf-balance-history-chart').src = balanceHistoryChart.toBase64Image('image/png', 1.0);

            pdfLayout.style.display = 'block';

            const canvas = await html2canvas(pdfLayout, { scale: 2, useCORS: true });
            
            pdfLayout.style.display = 'none';

            const imgData = canvas.toDataURL('image/png');
            const pdfWidth = doc.internal.pageSize.getWidth();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / canvasHeight;
            const imgHeight = (pdfWidth - 10) / ratio;

            doc.addImage(imgData, 'PNG', 5, 5, pdfWidth - 10, imgHeight);

            // --- 2. Add the table using jspdf-autotable ---
            const tableHead = [['Tanggal', 'Deskripsi', 'Jumlah', 'Saldo', 'Memo']];
            const tableBody = allTransactions.map(t => [
                t.date.toLocaleString('id-ID', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}),
                t.description,
                formatISK(t.amount),
                formatISK(t.balance),
                t.memo
            ]);

            doc.autoTable({
                head: tableHead,
                body: tableBody,
                startY: imgHeight + 10,
                margin: { left: 5, right: 5 },
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: 1.5,
                    overflow: 'linebreak'
                },
                headStyles: {
                    fillColor: [44, 62, 80],
                    textColor: 255,
                    fontStyle: 'bold'
                },
                didDrawPage: (data) => {
                    const pageCount = doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.text(
                        `Laporan ISK Tracker - KingSyah | Halaman ${pageCount}`,
                        data.settings.margin.left,
                        doc.internal.pageSize.getHeight() - 5
                    );
                }
            });

            // --- 3. Save the PDF ---
            doc.save(`Laporan_ISK_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error("Gagal membuat PDF:", error);
            alert("Terjadi kesalahan saat membuat PDF. Silakan periksa konsol browser untuk detail (F12).");
            const pdfLayout = document.getElementById('pdf-layout');
            if (pdfLayout) {
                pdfLayout.style.display = 'none';
            }
        }
    };

    const setCurrentYear = () => {
        if (currentYearEl) {
            currentYearEl.textContent = new Date().getFullYear();
        }
    };

    // --- Event Listeners ---
    themeToggle.addEventListener('click', () => {
        toggleTheme();
        updateDashboard();
    });

    processDataBtn.addEventListener('click', processTransactions);
    resetBtn.addEventListener('click', resetApp);

    addDataBtn.addEventListener('click', () => {
        dataInput.value = '';
        document.getElementById('input-card').scrollIntoView({ behavior: 'smooth' });
    });

    viewDetailsBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            closeModal();
        }
    });

    printPdfBtn.addEventListener('click', printPDF);

    // --- Initial Load ---
    const savedTheme = localStorage.getItem('theme') || 'dark-mode';
    applyTheme(savedTheme);

    const savedTransactions = JSON.parse(localStorage.getItem('transactions'));
    if (savedTransactions && savedTransactions.length > 0) {
        allTransactions = savedTransactions.map(t => ({ ...t, date: new Date(t.date) }));
        updateDashboard();
    } else {
        renderCharts({}, 0, 0, []);
    }
    setCurrentYear();
});
