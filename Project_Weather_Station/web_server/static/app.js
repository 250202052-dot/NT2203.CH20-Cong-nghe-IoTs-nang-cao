/* =====================================================
   GLOBAL CONFIG
===================================================== */

const PER_PAGE = 40;
let currentPage = 1;


/* =====================================================
   DOM CACHE
===================================================== */

const tempEl = document.getElementById("temp");
const humEl  = document.getElementById("hum");
const presEl = document.getElementById("pres");

const weatherNewsEl = document.getElementById("weatherNews");

/* =====================================================
   LABEL MAP
===================================================== */

const PREDICT_LABELS = {
    0: "🌫️ Sương mù lạnh",
    1: "🌧️ Mưa",
    2: "☀️ Nắng",
    3: "🔥 Nắng gắt",
    4: "🌤️ Nắng nhẹ"
};

/* =====================================================
   TAB SWITCH (CLEAN + LAZY LOAD)
===================================================== */

function showTab(index) {

    document.querySelectorAll(".tab").forEach((tab, i) =>
        tab.classList.toggle("active", i === index)
    );

    document.querySelectorAll(".tab-content").forEach((c, i) =>
        c.classList.toggle("active", i === index)
    );

    switch (index) {
        case 0:
            loadDashboard();
            loadDashboardTrend();
            break;

        case 1:
            loadRawDataTable(1);
            break;

        case 2:
            load12Hours();
            load7Days();
            break;

        case 3:
            loadServerUsage();
            loadDatabaseHealth();
            loadhwData();
            break;
    }
}


/* =====================================================
   DASHBOARD
===================================================== */

async function loadDashboard() {
    try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);

        const data = await res.json();

        tempEl.innerText = Number(data.temp).toFixed(1);
        humEl.innerText  = Number(data.humidity).toFixed(1);
        presEl.innerText = Number(data.pressure).toFixed(1);

        weatherNewsEl.innerHTML = `
            🌤️ Dữ liệu mới nhất<br>
            🕒 ${new Date(data.createdAt).toLocaleString("vi-VN")}
        `;
        loadDashboardCharts();
        

    } catch (err) {
        weatherNewsEl.innerText = "❌ Không lấy được dữ liệu";
    }
    // 🔥 Gọi advice ở đây
    const adviceRes = await fetch("/api/advice");
    const adviceData = await adviceRes.json();
    document.getElementById("ai-recommend").innerText = adviceData.advice;
}

/* =====================================================
   CHART INIT
===================================================== */

function createLineChart(el, label) {
    return new Chart(el, {
        type: "line",
        data: {
            labels: [],
            datasets: [{ label, data: [], tension: 0.4 }]
        }
    });
}

const tempChart = createLineChart(document.getElementById("tempChart"), "°C");
const humChart  = createLineChart(document.getElementById("humChart"), "%");
const presChart = createLineChart(document.getElementById("presChart"), "hPa");

/* =====================================================
   DASHBOARD CHART DATA
===================================================== */

function sortByTimeDesc(arr) {
    return arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function loadDashboardCharts() {
    try {
        const res = await fetch("/api/history");
        const json = await res.json();

        let arr = json.data || json;
        arr = sortByTimeDesc(arr);

        const latest = arr.slice(0, 30).reverse();

        const labels = latest.map(d =>
            new Date(d.createdAt).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit"
            })
        );

        tempChart.data.labels = labels;
        tempChart.data.datasets[0].data = latest.map(d => d.temp);
        tempChart.update();

        humChart.data.labels = labels;
        humChart.data.datasets[0].data = latest.map(d => d.humidity);
        humChart.update();

        presChart.data.labels = labels;
        presChart.data.datasets[0].data = latest.map(d => d.pressure);
        presChart.update();

    } catch (err) {
        console.error(err);
    }
}

/* =====================================================
   TREND
===================================================== */

function average(arr, key) {
    return arr.reduce((sum, item) => sum + Number(item[key]), 0) / arr.length;
}

function classifyTrend(value, thresholds) {
    const abs = Math.abs(value);

    if (abs < thresholds.small) return "Ổn định";
    if (abs < thresholds.medium) return value > 0 ? "Tăng nhẹ" : "Giảm nhẹ";
    if (abs < thresholds.strong) return value > 0 ? "Tăng vừa" : "Giảm vừa";
    return value > 0 ? "Tăng mạnh" : "Giảm mạnh";
}

function formatTrend(value, unit, thresholds) {
    const label = classifyTrend(value, thresholds);
    const sign = value > 0 ? "+" : "";
    const color =
        value > 0 ? "#e74c3c" :
        value < 0 ? "#3498db" :
        "#777";

    return `
        <span style="color:${color}">
            ${sign}${value.toFixed(1)}${unit} (${label})
        </span>
    `;
}

async function loadDashboardTrend() {
    const res = await fetch("/api/history");
    const json = await res.json();

    const data = json.data || json;
    if (!data || data.length < 6) return;

    const firstSlice = data.slice(0, 3);
    const lastSlice  = data.slice(-3);

    const tempTrend = average(lastSlice, "temp") - average(firstSlice, "temp");
    const humTrend  = average(lastSlice, "humidity") - average(firstSlice, "humidity");
    const presTrend = average(lastSlice, "pressure") - average(firstSlice, "pressure");

    // ===== Render numbers =====
    document.getElementById("trendTempText").innerHTML =
        `🌡️ ${formatTrend(tempTrend, "°C", {small:0.5, medium:1.5, strong:3})}`;

    document.getElementById("trendHumText").innerHTML =
        `💧 ${formatTrend(humTrend, "%", {small:2, medium:5, strong:10})}`;

    document.getElementById("trendPresText").innerHTML =
        `🔽 ${formatTrend(presTrend, " hPa", {small:0.5, medium:2, strong:4})}`;

    // ===== Smart Summary =====
    let summary = "🌤️ Thời tiết ổn định";

    if (presTrend < -1.5 && humTrend > 3) {
        summary = "🌧️ Áp suất giảm & độ ẩm tăng → Khả năng mưa cao";
    } 
    else if (tempTrend > 1.5 && humTrend < -3) {
        summary = "☀️ Trời nóng và khô dần";
    } 
    else if (tempTrend > 1.5 && humTrend > 3) {
        summary = "🔥 Trời nóng và oi bức";
    }
    else if (tempTrend < -1.5) {
        summary = "🌬️ Nhiệt độ giảm → Trời mát dần";
    }

    document.getElementById("trendSummary").innerText = summary;
}

/* =====================================================
   PAGINATION
===================================================== */

function renderPagination(total, perPage) {
    const totalPages = Math.ceil(total / perPage);
    const container = document.getElementById("pagination");
    if (!container) return;

    container.innerHTML = "";

    const maxAround = 2;

    function addBtn(p, label = p, active = false) {
        const btn = document.createElement("button");
        btn.textContent = label;
        if (active) btn.classList.add("active");
        btn.onclick = () => loadRawDataTable(p);
        container.appendChild(btn);
    }

    if (currentPage > 1) addBtn(currentPage - 1, "Prev");

    if (currentPage > maxAround + 1) {
        addBtn(1);
        if (currentPage > maxAround + 2) container.append(" ... ");
    }

    for (
        let i = Math.max(1, currentPage - maxAround);
        i <= Math.min(totalPages, currentPage + maxAround);
        i++
    ) {
        addBtn(i, i, i === currentPage);
    }

    if (currentPage < totalPages - maxAround) {
        if (currentPage < totalPages - maxAround - 1) container.append(" ... ");
        addBtn(totalPages);
    }

    if (currentPage < totalPages) addBtn(currentPage + 1, "Next");
}

/* =====================================================
   RAW TABLE
===================================================== */

async function loadRawDataTable(page = 1) {
    try {
        currentPage = page;

        const selectedDate = document.getElementById("rawDate")?.value;
        let url = `/api/history?page=${page}`;
        if (selectedDate) url += `&date=${selectedDate}`;

        const res = await fetch(url);
        const json = await res.json();

        const data = json.data || [];
        const total = json.total || data.length;

        renderPagination(total, PER_PAGE);

        const tbody = document.getElementById("rawDataTable");
        if (!tbody) return;

        tbody.innerHTML = "";

        data.forEach(d => {
            const tr = document.createElement("tr");
            console.log("Raw data item:", d);
            tr.innerHTML = `
                <td>${new Date(d.createdAt).toLocaleString("vi-VN")}</td>
                <td>${Number(d.temp).toFixed(2)}</td>
                <td>${Number(d.humidity).toFixed(2)}</td>
                <td>${Number(d.pressure).toFixed(2)}</td>
                <td>${PREDICT_LABELS[d.predict] ?? "🌥️ Dễ chịu"}</td>
            `;

            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Raw table error:", err);
    }
}


// 🔮 MAP NHÃN DỰ BÁO
const PREDICT_LABELS_download = {
    0: "Cold fog",
    1: "Rainy",
    2: "Sunny",
    3: "Blazing sun",
    4: "Lightly sunlit"
};

async function downloadRawCSV() {
    try {
        const res = await fetch("/api/download");
        let data = await res.json();

        if (!data || data.length === 0) {
            alert("Không có dữ liệu để tải");
            return;
        }

        // 📅 FILTER THEO NGÀY ĐANG CHỌN
        const selectedDate = document.getElementById("rawDate")?.value;
        if (selectedDate) {
            data = data.filter(d =>
                d.createdAt?.startsWith(selectedDate)
            );
        }

        if (data.length === 0) {
            alert("Không có dữ liệu cho ngày này");
            return;
        }

        // 🔽 SORT: CŨ → MỚI
        data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // 🧾 CSV HEADER
        let csv = "createdAt,temp,humidity,pressure,predict\n";

        data.forEach(d => {
            const label = PREDICT_LABELS_download[d.predict] ?? "Pleasantly cool";

            csv += `"${d.createdAt}",` +
                   `${Number(d.temp).toFixed(1)},` +
                   `${Number(d.humidity).toFixed(1)},` +
                   `${Number(d.pressure).toFixed(1)},` +
                   `"${label}"\n`;
        });

        // 📥 DOWNLOAD
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = selectedDate
            ? `raw_data_${selectedDate}.csv`
            : `raw_data_all.csv`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error(err);
        alert("Lỗi khi tải CSV");
    }
}

/* =====================================================
   FORECAST CARD
===================================================== */
async function load12Hours() {
    try {
        const res = await fetch("/api/forecast/12h");
        const json = await res.json();

        render12Hours(json.forecast);

    } catch (err) {
        console.error("12h forecast error:", err);
    }
}
async function load7Days() {
    try {
        const res = await fetch("/api/forecast/7d");
        const json = await res.json();

        render7Days(json.forecast);

    } catch (err) {
        console.error("7d forecast error:", err);
    }
}

function render12Hours(hourlyData) {
    const container = document.getElementById("forecast12Hours");
    container.innerHTML = "";

    const now = new Date();

    hourlyData.slice(0, 12).forEach((hour, index) => {

        // Tính giờ + index
        const date = new Date(now);
        date.setHours(now.getHours() + index + 1);

        const hourStr = date.getHours().toString().padStart(2, "0");

        const card = document.createElement("div");
        card.className = "hour-card";

        card.innerHTML = `
            <div class="hour-time">
                ${hourStr}h
            </div>

            <div class="hour-temp">
                ${Number(hour.temp).toFixed(1)}°C
            </div>

            <div class="hour-humidity">
                💧 ${Number(hour.humidity).toFixed(1)}%
            </div>

            <div class="hour-humidity">
                🔽 ${Number(hour.pressure).toFixed(2)} hPa
            </div>
        `;

        container.appendChild(card);
    });
}

function render7Days(hourlyData) {

    const container = document.getElementById("forecast7Days");
    container.innerHTML = "";

    if (!hourlyData || hourlyData.length === 0) return;

    // Group theo ngày
    const grouped = {};

    hourlyData.forEach(item => {
        const date = new Date(item.time).toISOString().split("T")[0];

        if (!grouped[date]) grouped[date] = [];

        grouped[date].push(item.temp);
    });

    Object.keys(grouped).slice(0, 7).forEach(date => {

        const temps = grouped[date];

        const min = Math.min(...temps);
        const max = Math.max(...temps);
        const avg = temps.reduce((a,b)=>a+b,0) / temps.length;

        container.innerHTML += `
            <div class="forecast-card">
                <div class="forecast-day">${date}</div>
                <div class="forecast-temp">${avg.toFixed(1)}°C</div>
                <div class="forecast-minmax">
                    ↓ ${min.toFixed(1)}° ↑ ${max.toFixed(1)}°
                </div>
            </div>
        `;
    });
}
/* =====================================================
   SENSOR CHECK
===================================================== */


function updateDateTime() {
    const now = new Date();
    document.getElementById("currentDate").innerText =
        "📅 " + now.toLocaleDateString("vi-VN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
}


/* ===============================
   SERVER USAGE
================================= */

async function loadServerUsage() {
    try {
        const res = await fetch("/api/server/flask-usage");
        const data = await res.json();

        // ===== CPU =====
        const cpuPercent = data.cpu_process || 0;
        document.getElementById("cpuUsage").innerText = cpuPercent + " %";
        document.getElementById("cpuBar").style.width = cpuPercent + "%";

        // ===== RAM =====
        const ramProcess = data.ram_process_mb || 0;
        const ramTotal = data.ram_total_mb || 1;
        const ramPercent = (ramProcess / ramTotal) * 100;

        document.getElementById("ramUsage").innerText =
            ramProcess + " MB / " + ramTotal + " MB";

        document.getElementById("ramBar").style.width =
            ramPercent.toFixed(1) + "%";

        // ===== Threads =====
        document.getElementById("threadCount").innerText =
            data.threads || 0;

    } catch (err) {
        console.error("Server usage error:", err);
    }
}

async function loadDatabaseHealth() {
    try {
        const response = await fetch("/api/health/db");
        const data = await response.json();

        document.getElementById("dbStatus").innerText = data.status;
        document.getElementById("dbLatency").innerText = data.latency_ms;
        document.getElementById("dbRecords").innerText = data.total_records;
        document.getElementById("dbLastInsert").innerText = data.last_insert;

        // Color latency
        const latencyEl = document.getElementById("dbLatency");

        if (data.latency_ms < 100) {
            latencyEl.style.color = "lime";
        } else if (data.latency_ms < 300) {
            latencyEl.style.color = "orange";
        } else {
            latencyEl.style.color = "red";
        }

    } catch (error) {
        console.error("DB health error:", error);
        document.getElementById("dbStatus").innerText = "Offline";
        document.getElementById("dbStatus").style.color = "red";
    }
}

async function loadhwData() {
    try {
        const res = await fetch("http://192.168.1.15:5000/api/device/list");
        const json = await res.json();
         
        const dev = Object.values(json)[0];
        console.log("Device list:", dev);
        if (!dev) {
            document.getElementById("esp32Status").innerText = " Offline";
            return;
        }
        const link = document.getElementById("espDashboardLink");
        link.href = `http://${dev.ip}:80`;
        const payload = dev.data;
        console.log("Device payload:", payload);
        const sensor = payload.sensor || {};
        const network = payload.network || {};
        const memory = payload.memory || {};
        const system = payload.system || {};

        /* ================= SYSTEM ================= */

        document.getElementById("esp32RSSI").innerText =
            network.rssi !== undefined
                ? network.rssi + " dBm"
                : "--";

        document.getElementById("esp32IP").innerText =
            dev.ip ?? "--";

        document.getElementById("esp32Heap").innerText =
            memory.free_heap !== undefined
                ? memory.free_heap + " bytes"
                : "--";

        document.getElementById("esp32Uptime").innerText =
            system.uptime !== undefined
                ? formatUptime(system.uptime)
                : "--";

        document.getElementById("esp32LastSeen").innerText =
            dev.last_seen
                ? new Date(dev.last_seen).toLocaleString()
                : "--";

        document.getElementById("esp32Cpu").innerText =
            system.cpu_mhz !== undefined
                ? system.cpu_mhz + " Mhz"
                : "--";

        document.getElementById("esp32Chip").innerText =
            system.chip_model !== undefined
                ? system.chip_model 
                : "--";

        /* ================= ONLINE STATUS ================= */

        const status = document.getElementById("esp32Status");

        if (dev.last_seen) {
            const lastSeen = new Date(dev.last_seen);
            const now = new Date();
            const diff = (now - lastSeen) / 1000;

            if (diff < 60) {
                status.innerText = " Online";
                status.className = "device-status online";
            } else {
                status.innerText = " Offline";
                status.className = "device-status offline";
            }
        } else {
            status.innerText = " Unknown";
        }


    } catch (err) {
        document.getElementById("esp32Status").innerText = "⚠ Error";
        console.log(err);
    }
}


/* ================= HELPER ================= */

function formatUptime(seconds) {
    seconds = Math.floor(seconds);

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    let result = "";

    if (days > 0) result += days + "d ";
    if (hours > 0) result += hours + "h ";

    result += minutes + "m";

    return result;
}



/* =====================================================
   INIT
===================================================== */

updateDateTime();

// Default tab = Dashboard
showTab(0);

// Auto refresh dashboard
setInterval(loadDashboard, 10000);
setInterval(loadDashboardTrend, 10000);
setInterval(loadServerUsage, 10000);
setInterval(loadDatabaseHealth, 10000);
setInterval(loadhwData, 10000);