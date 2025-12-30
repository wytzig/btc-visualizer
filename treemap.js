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
      
      // Extract amounts from transactions
      const amounts = transactions
        .map(tx => tx.amount)
        .filter(amount => amount && Number(amount) > 0);
      
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

function render() {
    canvas.innerHTML = "";

    const data = parseInput()
        .sort((a, b) => b.value - a.value);

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

        if (d.width > 80 && d.height > 24) {
            el.innerHTML = `
        <div class="label">
          ${d.label}<br>
          ${d.value.toLocaleString()} sats
        </div>
      `;
        }

        canvas.appendChild(el);
    }
}

render();
