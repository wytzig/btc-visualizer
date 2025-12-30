const input = document.getElementById("input");
const canvas = document.getElementById("canvas");

const updateBtn = document.getElementById("updateBtn");

input.addEventListener("input", render);
updateBtn.addEventListener("click", render);
window.addEventListener("resize", render);

const importBtn = document.getElementById("importBtn");
const fileInput = document.getElementById("fileInput");

importBtn.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target.result);
            const transactions = json.transactions || [];

            // Calculate net balance changes
            // type "recv" adds to balance, type "sent" reduces balance
            const amounts = transactions
                .map(tx => {
                    const amount = Number(tx.amount);
                    if (tx.type === "sent") {
                        return -amount; // Deduct sent transactions
                    }
                    return amount; // Add received transactions
                })
                .filter(amount => amount !== 0);

            // Update textarea with amounts
            input.value = amounts.join("\n");
            render();

            fileInput.value = ''; // Reset file input
        } catch (err) {
            alert("Error parsing JSON file: " + err.message);
        }
    };

    reader.readAsText(file);
});


const clearBtn = document.getElementById("clearBtn");

clearBtn.addEventListener("click", () => {
    input.value = '';
    render();

});

function parseInput() {
    return input.value
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map((l, i) => {
            const btc = Number(l);
            const sats = btc * 100000000;
            return {
                label: `${btc} BTC`,
                value: sats
            };
        })
        .filter(d => Number.isFinite(d.value) && d.value > 0);
}

function updateTotal(data) {
    const totalSats = data.reduce((s, d) => s + d.value, 0);
    const totalBTC = totalSats / 100000000;
    document.getElementById("total").textContent = `${totalBTC.toFixed(8)} BTC`;
}

function computeLayout(data, width, height) {
    const rects = [];

    function squarify(items, x, y, w, h) {
        if (items.length === 0) return;
        if (items.length === 1) {
            rects.push({
                ...items[0],
                x,
                y,
                width: Math.max(1, w),
                height: Math.max(1, h)
            });
            return;
        }

        const total = items.reduce((s, d) => s + d.value, 0);
        const isHorizontal = w > h;

        // Split roughly in half by value
        let sum = 0;
        let splitIndex = 0;
        const halfTotal = total / 2;

        for (let i = 0; i < items.length; i++) {
            sum += items[i].value;
            if (sum >= halfTotal) {
                splitIndex = i + 1;
                break;
            }
        }

        const first = items.slice(0, splitIndex);
        const second = items.slice(splitIndex);
        const firstRatio = first.reduce((s, d) => s + d.value, 0) / total;

        if (isHorizontal) {
            const firstWidth = w * firstRatio;
            squarify(first, x, y, firstWidth, h);
            squarify(second, x + firstWidth, y, w - firstWidth, h);
        } else {
            const firstHeight = h * firstRatio;
            squarify(first, x, y, w, firstHeight);
            squarify(second, x, y + firstHeight, w, h - firstHeight);
        }
    }

    squarify(data, 0, 0, width, height);
    return rects;
}

const tooltip = document.getElementById("tooltip");
let activeNode = null;
let btcPriceEUR = null;
const currencySymbol = "€";

// Fetch BTC price
async function fetchBTCPrice() {
    try {
        const res = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur"
        );
        const data = await res.json();
        btcPriceEUR = data.bitcoin.eur;
    } catch (e) {
        console.warn("Failed to fetch BTC price", e);
    }
}
fetchBTCPrice();
setInterval(fetchBTCPrice, 5 * 60 * 1000);

// Move tooltip with mouse only if active AND not clicked/fixed
document.addEventListener("mousemove", (e) => {
    if (!activeNode || !tooltip) return;

    // Only move tooltip if the user didn't click to fix its position
    if (!activeNode.dataset.fixed) {
        let left = e.clientX + 12;
        let top = e.clientY + 12;

        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";

        const rect = tooltip.getBoundingClientRect();

        // Prevent tooltip from going offscreen
        if (rect.right > window.innerWidth) {
            tooltip.style.left = e.clientX - rect.width - 12 + "px";
        }
        if (rect.bottom > window.innerHeight) {
            tooltip.style.top = e.clientY - rect.height - 12 + "px";
        }
    }
});

// Click anywhere else hides tooltip
document.addEventListener("click", () => {
    activeNode = null;
    if (tooltip) tooltip.style.opacity = "0";
    document.querySelectorAll('.node').forEach(n => delete n.dataset.fixed);
});


// Set default values if empty
if (!input.value.trim()) {
    input.value = `0.12
0.035
0.008
0.42`;
}

// Now render the treemap
render();

function render() {
    canvas.innerHTML = "";
    const data = parseInput().sort((a, b) => b.value - a.value);
    updateTotal(data);
    if (!data.length) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const layout = computeLayout(data, width, height);

    for (const d of layout) {
        const el = document.createElement("div");
        el.className = "node";

        el.style.left = d.x + "px";
        el.style.top = d.y + "px";
        el.style.width = d.width + "px";
        el.style.height = d.height + "px";

        if (d.width > 50 && d.height > 12) {
            el.innerHTML = `
                <div class="label">
                    ${d.label} (${d.value.toLocaleString()} sats)
                </div>
            `;
        }

        el.addEventListener("click", (e) => {
            e.stopPropagation(); // prevent document click

            activeNode = el;
            activeNode.dataset.fixed = "true"; // mark as fixed, mousemove won't override

            const sats = d.value;
            const btc = sats / 100000000;

            let currencyLine = "Loading price...";
            if (btcPriceEUR) {
                const eurValue = btc * btcPriceEUR;
                currencyLine = `${currencySymbol}${(btc * btcPriceEUR).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}`;
            }

            if (tooltip) {
                tooltip.innerHTML = `
            <strong>${btc} BTC</strong><br>
            ${sats.toLocaleString()} sats<br>
            ${currencyLine}
        `;

                // Initial tooltip position
                let left = e.clientX + 12;
                let top = e.clientY + 12;

                // Get tooltip dimensions
                tooltip.style.opacity = "1"; // must show to measure
                const rect = tooltip.getBoundingClientRect();

                // Adjust if going off right edge
                if (left + rect.width > window.innerWidth) {
                    left = e.clientX - rect.width - 12;
                }

                // Adjust if going off bottom edge
                if (top + rect.height > window.innerHeight) {
                    top = e.clientY - rect.height - 12;
                }

                tooltip.style.left = left + "px";
                tooltip.style.top = top + "px";
            }
        });


        // Hide tooltip when mouse leaves the node
        el.addEventListener("mouseleave", () => {
            if (activeNode === el) {
                activeNode = null;
                tooltip.style.opacity = "0";
                delete el.dataset.fixed; // remove fixed flag
            }
        });

        canvas.appendChild(el);
    }
}