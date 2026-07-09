
export function initDashboard(appState) {
    let trendsChart = null;
    let distributionChart = null;
    let confidenceChart = null;
    const kpiTotal = document.getElementById('kpi-total-detections');
    const kpiMost = document.getElementById('kpi-most-crop');
    const kpiAvg = document.getElementById('kpi-avg-confidence');
    const kpiCycles = document.getElementById('kpi-irrigation-cycles');
    const weatherLoading = document.getElementById('weather-loading');
    const weatherContent = document.getElementById('weather-content');
    const weatherLoc = document.getElementById('weather-location');
    const weatherTemp = document.getElementById('weather-temp');
    const weatherCond = document.getElementById('weather-condition');
    const weatherHum = document.getElementById('weather-humidity');
    const weatherWind = document.getElementById('weather-wind');
    const weatherIcon = document.getElementById('weather-main-icon');
    const advRiskPill = document.getElementById('advisor-risk-pill');
    const advRiskText = document.getElementById('advisor-risk-text');
    const advNarrative = document.getElementById('advisor-narrative-text');
    const advTipsList = document.getElementById('advisor-tips-list');

    initCharts();
    loadAnalyticsData();
    loadWeatherData();

    appState.refreshAnalytics = () => {
        loadAnalyticsData();
    };

    window.addEventListener('resize', () => {
        if (trendsChart) trendsChart.resize();
        if (distributionChart) distributionChart.resize();
        if (confidenceChart) confidenceChart.resize();
    });

    window.addEventListener('themeChanged', () => {
        if (trendsChart) trendsChart.dispose();
        if (distributionChart) distributionChart.dispose();
        if (confidenceChart) confidenceChart.dispose();
        initCharts();
        loadAnalyticsData();
    });

    const weatherCodes = {
        0: { desc: 'Clear sky', icon: 'sun' },
        1: { desc: 'Mainly clear', icon: 'cloud-sun' },
        2: { desc: 'Partly cloudy', icon: 'cloud-sun' },
        3: { desc: 'Overcast', icon: 'cloud' },
        45: { desc: 'Foggy', icon: 'cloud' },
        48: { desc: 'Depositing rime fog', icon: 'cloud' },
        51: { desc: 'Light drizzle', icon: 'cloud-drizzle' },
        53: { desc: 'Moderate drizzle', icon: 'cloud-drizzle' },
        55: { desc: 'Dense drizzle', icon: 'cloud-drizzle' },
        61: { desc: 'Slight rain', icon: 'cloud-rain' },
        63: { desc: 'Moderate rain', icon: 'cloud-rain' },
        65: { desc: 'Heavy rain', icon: 'cloud-rain' },
        80: { desc: 'Light rain showers', icon: 'cloud-rain' },
        81: { desc: 'Moderate rain showers', icon: 'cloud-rain' },
        82: { desc: 'Violent rain showers', icon: 'cloud-lightning' },
        95: { desc: 'Thunderstorm', icon: 'cloud-lightning' }
    };

    function initCharts() {
        const isDark = document.body.classList.contains('dark');
        const textColor = isDark ? '#fafafa' : '#09090b';
        const borderColor = isDark ? '#1e1e24' : '#e4e4e7';
        const trendsDom = document.getElementById('chart-trends');
        const distDom = document.getElementById('chart-distribution');
        const confDom = document.getElementById('chart-confidence');
        if (trendsDom) {
            trendsChart = echarts.init(trendsDom, isDark ? 'dark' : null, { backgroundColor: 'transparent' });
        }
        if (distDom) {
            distributionChart = echarts.init(distDom, isDark ? 'dark' : null, { backgroundColor: 'transparent' });
        }
        if (confDom) {
            confidenceChart = echarts.init(confDom, isDark ? 'dark' : null, { backgroundColor: 'transparent' });
        }
    }

    function loadAnalyticsData() {
        fetch('/api/analytics')
            .then(res => res.json())
            .then(data => {
                kpiTotal.textContent = data.kpis.total_detections || 0;
                kpiMost.textContent = data.kpis.most_detected_crop || 'None';
                kpiAvg.textContent = `${data.kpis.avg_confidence || 0}%`;
                kpiCycles.textContent = data.kpis.irrigation_triggers || 0;
                renderTrendsChart(data.trend_data);
                renderDistributionChart(data.disease_distribution);
                renderConfidenceChart(data.recent_detections);
            })
            .catch(err => console.error("Error loading analytics data:", err));
    }

    function renderTrendsChart(trendData) {
        if (!trendsChart) return;
        const isDark = document.body.classList.contains('dark');
        const dates = trendData.map(d => d.date);
        const counts = trendData.map(d => d.count);
        const option = {
            grid: { top: 30, right: 20, bottom: 40, left: 40 },
            tooltip: { trigger: 'axis' },
            xAxis: {
                type: 'category',
                data: dates.length > 0 ? dates : ['No Data'],
                axisLine: { lineStyle: { color: isDark ? '#71717a' : '#e4e4e7' } },
                axisLabel: { color: isDark ? '#d4d4d8' : '#52525b' }
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: isDark ? '#71717a' : '#e4e4e7' } },
                axisLabel: { color: isDark ? '#d4d4d8' : '#52525b' },
                splitLine: { lineStyle: { color: isDark ? '#1e1e24' : '#e4e4e7' } }
            },
            series: [{
                data: counts.length > 0 ? counts : [0],
                type: 'line',
                smooth: true,
                lineStyle: { color: '#059669', width: 3 },
                itemStyle: { color: '#059669' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(5, 150, 105, 0.4)' },
                        { offset: 1, color: 'rgba(5, 150, 105, 0)' }
                    ])
                }
            }]
        };
        trendsChart.setOption(option);
    }

    function renderDistributionChart(distributionData) {
        if (!distributionChart) return;
        const chartData = distributionData.map(d => ({
            name: d.disease,
            value: d.count
        }));
        const option = {
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            color: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#6366f1'],
            series: [{
                name: 'Diseases',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 6 },
                label: { show: true, formatter: '{b}\n({d}%)', fontSize: 11 },
                labelLine: { show: true },
                data: chartData.length > 0 ? chartData : [{ name: 'Healthy', value: 0 }]
            }]
        };
        distributionChart.setOption(option);
    }

    function renderConfidenceChart(recentDetections) {
        if (!confidenceChart) return;
        const isDark = document.body.classList.contains('dark');
        const items = recentDetections.slice(0, 5).reverse();
        const labels = items.map(d => `${d.crop}\n${d.disease}`);
        const confidences = items.map(d => d.confidence);
        const option = {
            grid: { top: 30, right: 20, bottom: 40, left: 50 },
            tooltip: { trigger: 'axis', formatter: '{b}: {c}%' },
            xAxis: {
                type: 'category',
                data: labels.length > 0 ? labels : ['No Data'],
                axisLabel: { interval: 0, fontSize: 9, color: isDark ? '#d4d4d8' : '#52525b' },
                axisLine: { lineStyle: { color: isDark ? '#71717a' : '#e4e4e7' } }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                axisLabel: { formatter: '{value}%', color: isDark ? '#d4d4d8' : '#52525b' },
                axisLine: { lineStyle: { color: isDark ? '#71717a' : '#e4e4e7' } },
                splitLine: { lineStyle: { color: isDark ? '#1e1e24' : '#e4e4e7' } }
            },
            series: [{
                data: confidences.length > 0 ? confidences : [0],
                type: 'bar',
                barWidth: '40%',
                itemStyle: {
                    color: function(params) {
                        const val = params.value;
                        if (val >= 80) return '#10b981'; 
                        if (val >= 55) return '#f59e0b'; 
                        return '#ef4444'; 
                    },
                    borderRadius: [4, 4, 0, 0]
                }
            }]
        };
        confidenceChart.setOption(option);
    }

    function loadWeatherData() {
        const success = (position) => {
            const lat = position.coords.latitude.toFixed(4);
            const lon = position.coords.longitude.toFixed(4);
            weatherLoc.textContent = `Location GPS (${lat}, ${lon})`;
            fetchOpenMeteo(lat, lon);
        };
        const error = () => {
            const lat = appState.config.latitude || '28.6139';
            const lon = appState.config.longitude || '77.2090';
            weatherLoc.textContent = `Delhi, IN (${lat}, ${lon})`;
            fetchOpenMeteo(lat, lon);
        };
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(success, error, { timeout: 5000 });
        } else {
            error();
        }
    }

    function fetchOpenMeteo(lat, lon) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
        fetch(url)
            .then(res => res.json())
            .then(data => {
                weatherLoading.classList.add('hidden');
                weatherContent.classList.remove('hidden');
                const tempVal = Math.round(data.current.temperature_2m);
                const humVal = Math.round(data.current.relative_humidity_2m);
                const windVal = Math.round(data.current.wind_speed_10m);
                const code = data.current.weather_code;
                weatherTemp.textContent = `${tempVal}°C`;
                weatherHum.textContent = `${humVal}%`;
                weatherWind.textContent = `${windVal} km/h`;
                const meta = weatherCodes[code] || { desc: 'Sunny', icon: 'sun' };
                weatherCond.textContent = meta.desc;
                weatherIcon.setAttribute('data-lucide', meta.icon);
                lucide.createIcons();
                evaluateIrrigationRisk(tempVal, humVal);
            })
            .catch(err => {
                console.error("Open-Meteo Weather API failed:", err);
                weatherLoading.innerHTML = `
                    <i data-lucide="cloud-off" style="color: var(--color-danger)"></i>
                    <p style="color: var(--color-danger)">Weather unavailable offline</p>
                `;
                lucide.createIcons();
                evaluateIrrigationRisk(26, 62); 
            });
    }

    function evaluateIrrigationRisk(temperature, humidity) {
        let riskText = "NORMAL RISK";
        let riskColor = "badge-success";
        let narrative = "Temperature and humidity values are standard. Regular crop checks recommended. Follow standard watering intervals.";
        let tips = [
            "Water early in the morning between 6:00 AM and 9:00 AM.",
            "Maintain baseline soil moisture check levels."
        ];
        if (humidity > 80 && temperature >= 15 && temperature <= 26) {
            riskText = "HIGH FUNGAL PROPAGATION RISK";
            riskColor = "badge-error";
            narrative = "High humidity combined with moderate warm temperatures creates extreme vulnerability for fungal spore development (Late Blight, Downy Mildew). Avoid overhead watering instantly to keep leaf surfaces dry.";
            tips = [
                "WARNING: DO NOT use overhead sprinklers.",
                "Switch irrigation systems strictly to drip lines.",
                "Inspect lower tomato and potato leaves immediately for dark spots."
            ];
            advRiskPill.style.backgroundColor = "var(--bg-danger-light)";
            advRiskPill.style.color = "var(--color-danger)";
        } 
        else if (humidity > 70) {
            riskText = "MODERATE PROPAGATION RISK";
            riskColor = "badge-warning";
            narrative = "Elevated humidity levels detected. Keep leaves clean. Fungal propagation matches medium risk levels.";
            tips = [
                "Water crops early in the morning to allow quick drying during sunlight.",
                "Check spacing between plants to maximize air circulation."
            ];
            advRiskPill.style.backgroundColor = "var(--bg-warning-light)";
            advRiskPill.style.color = "var(--color-warning)";
        }
        else if (temperature > 30 && humidity < 45) {
            riskText = "LOW FUNGAL RISK - HIGH EVAPORATION";
            riskColor = "badge-normal";
            narrative = "Hot, dry conditions discourage fungal spore activation. Evaporative water losses are high. Crops will require supplemental water irrigation.";
            tips = [
                "Extend watering cycles to offset solar evaporation.",
                "Water early morning or late evening to maximize absorption efficiency."
            ];
            advRiskPill.style.backgroundColor = "var(--bg-success-light)";
            advRiskPill.style.color = "var(--color-success)";
        } else {
            advRiskPill.style.backgroundColor = "var(--bg-success-light)";
            advRiskPill.style.color = "var(--color-success)";
        }
        advRiskText.textContent = riskText;
        advNarrative.textContent = narrative;
        advTipsList.innerHTML = '';
        tips.forEach(tip => {
            const li = document.createElement('li');
            li.textContent = tip;
            if (tip.startsWith("WARNING:") || tip.startsWith("🚨")) {
                li.style.color = "var(--color-danger)";
                li.style.fontWeight = "bold";
            }
            advTipsList.appendChild(li);
        });
    }
}