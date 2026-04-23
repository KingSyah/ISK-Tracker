# EVE Online ISK Audit Dashboard

Financial audit dashboard for EVE Online — track your ISK income, expenses, and wallet activity with professional charts and detailed breakdowns.

---

## Features

- **KPI Overview** — Balance, Income, Expenses, Net Flow at a glance
- **EVE-style Donut Chart** — Income breakdown by category (like in-game wallet)
- **Balance History** — Area chart tracking ISK over time
- **Daily Net Flow** — Bar chart showing daily surplus/deficit
- **Category Analysis** — Per-category breakdown with progress bars
- **Category Detail View** — Click any category card to see all transactions within it, with summary stats (total, average, percentage)
- **Transaction Ledger** — Full table with search, filter, sort & pagination
- **Period Filter** — View All / 7D / 3D / 1D data
- **Dark & Light Theme** — Toggle with saved preference
- **PDF Export** — Multi-page report: Executive Summary, Breakdown with Category Table, Transaction Ledger
- **100% Client-Side** — No server, no data sent anywhere

---

## Quick Start

1. Open `index.html` in any modern browser
2. Click **Import** (icon) or paste your wallet data
3. Copy transaction data from **EVE Online > My Wallet > Journal/Transactions**
4. Paste and click **Import Data**

That's it. Your dashboard is ready.

---

## How to Copy Data from EVE Online

1. Open **My Wallet** in EVE Online
2. Go to **Transactions** or **Journal** tab
3. Select all rows (`Ctrl+A`)
4. Copy (`Ctrl+C`)
5. Paste into the import field in this dashboard

Data format (tab-separated):
```
2026.04.22 09:24	ESS Escrow Payment	36,275,280 ISK	8,101,442,384 ISK	Description...
```

---

## Project Structure

```
eve-audit/
├── index.html          Main page (HTML structure)
├── style.css           Styling (dark/light themes, responsive)
├── script.js           Logic (parsing, charts, table, PDF)
├── favicon.svg         ISK coin favicon (SVG)
├── favicon.png         Favicon fallback (PNG)
└── README-lame.md      Plain text version (no emoji, no badges)

```

No build step. No dependencies to install. Just open and use.

---

## PDF Export

The exported PDF contains:

| Page | Content |
|------|---------|
| 1 | Executive Summary — 4 KPI boxes with accent bars, Balance History chart |
| 2 | Breakdown — Income/Expense donuts, Category Summary table, Daily Net Flow chart |
| 3+ | Transaction Ledger — full paginated table with color-coded amounts |

All pages include consistent headers and page-number footers.

---

## Customization

### Add New Categories

Edit the `CATEGORY_MAP` object in `script.js`:

```js
const CATEGORY_MAP = {
    'Bounty Prizes': { icon: 'fas fa-skull-crossbones', color: '#10b981', type: 'income' },
    // Add more...
};
```

### Change Theme Colors

Edit CSS variables in `style.css`:

```css
:root {
    --accent: #3b82f6;
    --income: #10b981;
    --expense: #ef4444;
}
```

---

## Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 / CSS3 / Vanilla JS | Core app (no frameworks) |
| Chart.js 4 | Charts & visualizations |
| jsPDF + AutoTable | PDF export |
| Font Awesome 6 | Icons |
| Inter + JetBrains Mono | Typography |

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full version history.

### Latest: v2.3.0 (2026-04-23)

- Category detail transactions — click a category card to view all transactions
- PDF: Category Analysis page with summary table
- PDF: Consistent headers, footers, and improved layout
- PDF: Loading overlay replaces blocking alert

---

## License

MIT License — 2026 KingSyah

---

## Credits

- Built for EVE Online capsuleers
- Inspired by EVE Online's in-game wallet UI
- Charts powered by [Chart.js](https://www.chartjs.org/)
