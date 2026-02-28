/* =====================
   CREATE CHARTS
===================== */

const tempCtx = document.getElementById('chart-temperature').getContext('2d');
const humCtx = document.getElementById('chart-humidity').getContext('2d');
const presCtx = document.getElementById('chart-pressure').getContext('2d');

const chartT = new Chart(tempCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Temperature °C',
            data: [],
            borderWidth: 2,
            fill: false,
            tension: 0.2
        }]
    },
    options: {
        animation: false,
        scales: {
            x: { display: true },
            y: { beginAtZero: false }
        }
    }
});

const chartH = new Chart(humCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Humidity %',
            data: [],
            borderWidth: 2,
            fill: false,
            tension: 0.2
        }]
    },
    options: { animation: false }
});

const chartP = new Chart(presCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Pressure hPa',
            data: [],
            borderWidth: 2,
            fill: false,
            tension: 0.2
        }]
    },
    options: { animation: false }
});


/* =====================
   UPDATE FUNCTIONS
===================== */

function addData(chart, value) {

    const time = new Date().toLocaleTimeString();

    chart.data.labels.push(time);
    chart.data.datasets[0].data.push(value);

    if (chart.data.labels.length > 40) {

        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }

    chart.update();
}


function updateTemperature() {

    fetch("/temperature")
        .then(res => res.text())
        .then(val => {

            document.getElementById("temperature-output").innerText = val;
            addData(chartT, parseFloat(val));

        });
}

function updateHumidity() {

    fetch("/humidity")
        .then(res => res.text())
        .then(val => {

            document.getElementById("humidity-output").innerText = val;
            addData(chartH, parseFloat(val));

        });
}

function updatePressure() {

    fetch("/pressure")
        .then(res => res.text())
        .then(val => {

            document.getElementById("pressure-output").innerText = val;
            addData(chartP, parseFloat(val));

        });
}

function updatePredict() {

    fetch("/predict")
        .then(res => res.text())
        .then(val => {

            document.getElementById("Predict").innerText = val;

        });
}

function animateValue(id, value)
{
  const el = document.getElementById(id);

  el.classList.add("updated");

  el.innerHTML = value;

  setTimeout(() =>
    el.classList.remove("updated"), 300);
}

/* =====================
   UPDATE LOOP
===================== */

setInterval(updateTemperature, 5000);
setInterval(updateHumidity, 5000);
setInterval(updatePressure, 5000);
setInterval(updatePredict, 5000);