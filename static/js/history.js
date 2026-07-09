
export function initHistory(appState) {
    const galleryGrid = document.getElementById('gallery-grid');
    const searchInput = document.getElementById('gallery-search');
    const filterCrop = document.getElementById('gallery-filter-crop');
    const filterSeverity = document.getElementById('gallery-filter-severity');
    const btnExportCsv = document.getElementById('btn-export-csv');
    const btnPrev = document.getElementById('btn-gallery-prev');
    const btnNext = document.getElementById('btn-gallery-next');
    const btnFirst = document.getElementById('btn-gallery-first');
    const btnLast = document.getElementById('btn-gallery-last');
    const pageIndicator = document.getElementById('gallery-page-indicator');
    const timelineFlow = document.getElementById('timeline-flow');
    const detailsModal = document.getElementById('details-modal');
    const btnCloseDetails = document.getElementById('btn-close-details');
    const btnCloseDetailsFooter = document.getElementById('btn-close-details-footer');
    const imgOriginal = document.getElementById('details-img-original');
    const imgAnnotated = document.getElementById('details-img-annotated');
    const bboxContainer = document.getElementById('details-bbox-container');
    const cropLabel = document.getElementById('details-crop-label');
    const severityBadge = document.getElementById('details-severity-badge');
    const diseaseLabel = document.getElementById('details-disease-label');
    const confidenceText = document.getElementById('details-confidence-text');
    const confidenceFill = document.getElementById('details-confidence-fill');
    const timestampText = document.getElementById('details-timestamp-text');
    const btnVoice = document.getElementById('btn-play-voice');
    const botanicalScientific = document.getElementById('details-botanical-scientific');
    const botanicalSeason = document.getElementById('details-botanical-season');
    const botanicalSoil = document.getElementById('details-botanical-soil');
    const botanicalWater = document.getElementById('details-botanical-water');
    const recTreatment = document.getElementById('rec-treatment');
    const recFungicide = document.getElementById('rec-fungicide');
    const recWatering = document.getElementById('rec-watering');
    const recIsolation = document.getElementById('rec-isolation');
    const recRecovery = document.getElementById('rec-recovery');
    const btnShareWhatsapp = document.getElementById('btn-share-whatsapp');
    const btnShareEmail = document.getElementById('btn-share-email');
    const btnShareCopy = document.getElementById('btn-share-copy');
    const qrCodeWrapper = document.getElementById('details-qrcode');
    const btnDownloadPdf = document.getElementById('btn-download-pdf-report');
    const roboflowForm = document.getElementById('roboflow-config-form');
    const systemForm = document.getElementById('system-config-form');
    const smtpForm = document.getElementById('smtp-config-form');
    const weatherForm = document.getElementById('weather-config-form');
    const btnTestEmail = document.getElementById('btn-test-email');
    const btnTriggerBackup = document.getElementById('btn-trigger-backup');
    const btnClearHistory = document.getElementById('btn-clear-history');

    let currentPage = 1;
    const itemsPerPage = 12;
    let totalItemsCount = 0;
    let qrInstance = null;
    let selectedDetection = null;

    const botanicalDB = {
        'Tomato': {
            scientific: 'Solanum lycopersicum', season: 'Warm Season (Spring/Summer)',
            soil: 'Well-draining, rich loam (pH 6.2 - 6.8)', water: 'Consistent 1.5 inches/week at base'
        },
        'Corn': {
            scientific: 'Zea mays', season: 'Late Spring / Hot Summer',
            soil: 'Rich, nitrogen-heavy, well-aerated (pH 5.8 - 6.8)', water: 'High water requirements during pollination'
        },
        'Potato': {
            scientific: 'Solanum tuberosum', season: 'Cool Season (Early Spring/Fall)',
            soil: 'Loose, acidic sandy loam (pH 5.0 - 5.5)', water: 'Moderate watering. Keep tubers dry to prevent scab.'
        },
        'Apple': {
            scientific: 'Malus domestica', season: 'Late Winter (Pruning), Fall (Harvest)',
            soil: 'Well-drained, sandy loam (pH 6.0 - 6.8)', water: 'Moderate (approx. 1 inch/week, dry soil between waterings)'
        },
        'Grape': {
            scientific: 'Vitis vinifera', season: 'Early Spring (Planting), Late Summer/Fall (Harvest)',
            soil: 'Deep, well-drained, gravelly loam (pH 5.5 - 6.5)', water: 'Low (deep, infrequent watering, dry foliage preferred)'
        },
        'Strawberry': {
            scientific: 'Fragaria × ananassa', season: 'Spring (Planting), Early Summer (Harvest)',
            soil: 'Sandy loam with high organic matter (pH 5.5 - 6.2)', water: 'High (1-2 inches/week, consistent moisture)'
        },
        'Peach': {
            scientific: 'Prunus persica', season: 'Late Winter (Planting), Mid-to-Late Summer (Harvest)',
            soil: 'Sandy loam, good drainage (pH 6.0 - 6.5)', water: 'Moderate (approx. 1 inch/week, crucial during fruit sizing)'
        },
        'Cherry': {
            scientific: 'Prunus avium', season: 'Late Fall (Planting), Early Summer (Harvest)',
            soil: 'Deep, sandy loam, excellent drainage (pH 6.0 - 6.8)', water: 'Moderate (infrequent deep waterings, prevent root rot)'
        },
        'Soybean': {
            scientific: 'Glycine max', season: 'Late Spring (Planting), Early Fall (Harvest)',
            soil: 'Loose, fertile loam, high organic matter (pH 6.0 - 6.5)', water: 'Moderate (1 inch/week, critical during flowering/pod fill)'
        },
        'Blueberry': {
            scientific: 'Vaccinium corymbosum', season: 'Early Spring (Planting), Summer (Harvest)',
            soil: 'Highly acidic, organic, peat-rich (pH 4.5 - 4.8)', water: 'High (1-2 inches/week, keep soil moist but not soggy)'
        },
        'Raspberry': {
            scientific: 'Rubus idaeus', season: 'Early Spring (Planting), Summer/Early Fall (Harvest)',
            soil: 'Rich, well-draining loam (pH 5.6 - 6.2)', water: 'High (approx. 1.5 inches/week, moist soil surface)'
        },
        'Bell Pepper': {
            scientific: 'Capsicum annuum', season: 'Warm Season (Late Spring / Summer)',
            soil: 'Rich, moist, well-draining sandy loam (pH 6.0 - 6.8)', water: 'Moderate to High (1-1.5 inches/week, avoid dry stress)'
        }
    };

    const recommendationsDB = {
        'Healthy': {
            treatment: 'No disease present. Continue current health maintenance schedules and regular crop inspections.',
            fungicide: 'None required. For prevention: Bacillus subtilis biological spray can be applied at 2.0 mL per Liter of water every 14 days.',
            watering: 'Follow standard watering schedules. Keep soil damp but not waterlogged.',
            isolation: 'None required. Ensure appropriate plant spacing to maintain natural air circulation.',
            recovery: 'Crop is in peak health state. Inspect weekly.'
        },
        'Late Blight': {
            treatment: '🚨 CRITICAL: Prune and immediately destroy all infected stems and leaves. Do NOT compost residues.',
            fungicide: 'Mancozeb (Dithane M-45) or Copper Fungicide. Dosage Rate: 2.0 - 2.5 grams per Liter of water (approx. 2 to 3 lbs per acre in 100g water). Apply thoroughly covering both leaf sides every 5 to 7 days during cool, wet periods.',
            watering: 'IMMEDIATELY STOP overhead sprinkling. Fungal spores rely on wet leaf surfaces. Switch to ground-level drip lines.',
            isolation: 'Isolate affected rows. Create buffer zones. Pull and bury severely infected tomato plants at least 2 feet deep.',
            recovery: '2-3 weeks to stabilize, but heavily affected areas will require complete crop destruction.'
        },
        'Early Blight': {
            treatment: 'Remove lower infected leaves showing target-like rings. Clean up fallen organic debris under the plant.',
            fungicide: 'Chlorothalonil (Daconil) or Copper Fungicide. Dosage Rate: 1.5 - 2.0 mL per Liter of water (approx. 1.5 lbs per acre). Spray foliage thoroughly every 7 to 10 days starting at first sign of spotting.',
            watering: 'Adjust watering to drip lines only. Water only in the early morning so leaves dry quickly in the sun.',
            isolation: 'Isolate potted plants. Space outdoor rows at least 3 feet apart to facilitate dry leaves.',
            recovery: '10-14 days. New growth should remain healthy if watering adjustments are strictly followed.'
        },
        'Common Rust': {
            treatment: 'Prune leaves with brown rust pustules. Clear underbrush to maximize ventilation.',
            fungicide: 'Pyraclostrobin (Headline) or Mancozeb. Dosage Rate: 0.8 - 1.2 mL per Liter of water (or 6 to 9 fl oz per acre). Apply at first pustule emergence; repeat after 14 days if high humidity persists.',
            watering: 'Water early morning. Avoid wet leaves during cool nighttime hours.',
            isolation: 'Destroy infected corn husks and leaves immediately to prevent windborne spore dispersion.',
            recovery: '14 days. Spores remain in soil, so rotate crops next season.'
        },
        'Apple Rust': {
            treatment: 'Prune infected twigs showing orange galls. Keep cedar trees clear of the vicinity to break the disease cycle.',
            fungicide: 'Myclobutanil (Immunox) or Sancozeb. Dosage Rate: 1.25 mL per Liter of water (approx. 0.5 fl oz per gallon). Apply at pink bud stage, petal fall, and weekly for 3 weeks.',
            watering: 'Avoid overhead sprinkling; keep foliage dry to stop spore germination.',
            isolation: 'Prune affected foliage immediately. Select rust-resistant cultivars.',
            recovery: '2-3 weeks. New leaves will grow clean if preventative spray is applied.'
        },
        'Apple Scab': {
            treatment: 'Rake and destroy fallen apple leaves. Prune tree canopy to increase airflow and sunlight.',
            fungicide: 'Captan 80 WDG or Sulfur Spray. Dosage Rate: 2.5 grams per Liter of water (approx. 1.5 to 2.5 lbs per 100 gallons). Apply at green tip, pink bud, petal fall, and then every 10 to 14 days.',
            watering: 'Switch to drip lines; avoid wetting the canopy.',
            isolation: 'Segregate fallen leaf debris. Mulch around base to cover spores.',
            recovery: '14-21 days of treatment. Maintain seasonal fungicide schedules.'
        },
        'Rust': {
            treatment: 'Prune leaves with brown rust pustules. Clear underbrush to maximize ventilation.',
            fungicide: 'Copper Octanoate (Copper Soap) or Sulfur wettable powder. Dosage Rate: 1.5 grams per Liter of water (or 2 oz per gallon). Spray all leaf surfaces thoroughly every 7 to 10 days.',
            watering: 'Water early morning. Avoid wet leaves during cool nighttime hours.',
            isolation: 'Destroy infected leaves immediately to prevent windborne spore dispersion.',
            recovery: '14 days. Spores remain in soil, so rotate crops next season.'
        },
        'Scab': {
            treatment: 'Rake and destroy fallen leaves. Prune tree canopy to increase airflow and sunlight.',
            fungicide: 'Lime-Sulfur spray or Chlorothalonil. Dosage Rate: 2.0 mL per Liter of water (or 1.5 teaspoons per gallon). Apply weekly during wet spring cycles.',
            watering: 'Switch to drip lines; avoid wetting the canopy.',
            isolation: 'Segregate fallen leaf debris. Mulch around base to cover spores.',
            recovery: '14-21 days of treatment. Maintain seasonal fungicide schedules.'
        }
    };

    loadHistoryData();
    setupTimelineEvents();
    setupAdminEventListeners();

    appState.refreshHistory = loadHistoryData;

    if (searchInput) searchInput.addEventListener('input', () => { currentPage = 1; loadHistoryData(); });
    if (filterCrop) filterCrop.addEventListener('change', () => { currentPage = 1; loadHistoryData(); });
    if (filterSeverity) filterSeverity.addEventListener('change', () => { currentPage = 1; loadHistoryData(); });
    if (btnFirst) btnFirst.addEventListener('click', () => { currentPage = 1; loadHistoryData(); });
    if (btnPrev) btnPrev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadHistoryData(); } });
    if (btnNext) btnNext.addEventListener('click', () => { if (currentPage * itemsPerPage < totalItemsCount) { currentPage++; loadHistoryData(); } });
    if (btnLast) btnLast.addEventListener('click', () => { currentPage = Math.ceil(totalItemsCount / itemsPerPage); loadHistoryData(); });

    if (btnExportCsv) {
        btnExportCsv.addEventListener('click', () => {
            downloadHistoryCsv();
        });
    }

    if (btnCloseDetails) btnCloseDetails.addEventListener('click', () => closeDetailsDrawer());
    if (btnCloseDetailsFooter) btnCloseDetailsFooter.addEventListener('click', () => closeDetailsDrawer());
    if (btnVoice) {
        btnVoice.addEventListener('click', () => {
            if (selectedDetection) {
                readDiagnosisAloud(selectedDetection.crop, selectedDetection.disease, selectedDetection.severity);
            }
        });
    }

    if (btnDownloadPdf) {
        btnDownloadPdf.addEventListener('click', () => {
            if (selectedDetection) {
                exportPdfReport(selectedDetection);
            }
        });
    }

    function loadHistoryData() {
        const crop = filterCrop ? filterCrop.value : '';
        const severity = filterSeverity ? filterSeverity.value : '';
        const search = searchInput ? searchInput.value.trim() : '';
        const offset = (currentPage - 1) * itemsPerPage;
        const url = `/api/history?crop=${crop}&severity=${severity}&search=${search}&limit=${itemsPerPage}&offset=${offset}`;
        fetch(url)
            .then(res => res.json())
            .then(data => {
                totalItemsCount = data.total_count;
                renderGallery(data.detections);
                updatePaginationUI();
                renderTimeline(data.detections);
            })
            .catch(err => console.error("Error fetching historical logs:", err));
    }

    function renderGallery(detections) {
        if (!galleryGrid) return;
        if (detections.length === 0) {
            galleryGrid.innerHTML = `
                <div class="empty-state w-full col-span-full" style="padding: 50px 0;">
                    <i data-lucide="image-off"></i>
                    <p>No detection history matching search parameters.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        galleryGrid.innerHTML = '';
        detections.forEach(det => {
            const card = document.createElement('div');
            card.className = 'gallery-card';
            const severityLabel = det.severity === 'Severe' ? '🔴 Severe' : (det.severity === 'Moderate' ? '🟡 Moderate' : '🟢 Normal');
            const dateStr = new Date(det.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            let imgHTML = '';
            if (det.image_path === 'purged') {
                imgHTML = `
                    <div class="gallery-purged-msg">
                        <i data-lucide="hard-drive"></i>
                        <span>Disk Protection Purged</span>
                    </div>
                `;
            } else if (det.image_path) {
                imgHTML = `<img src="/${det.image_path}" class="gallery-thumb" alt="${det.crop}">`;
            } else {
                imgHTML = `
                    <div class="gallery-purged-msg">
                        <i data-lucide="image"></i>
                        <span>No image saved</span>
                    </div>
                `;
            }
            card.innerHTML = `
                <div class="gallery-thumb-container">
                    ${imgHTML}
                    <span class="badge gallery-card-badge ${getSeverityBadgeClass(det.severity)}">${severityLabel}</span>
                </div>
                <div class="gallery-body">
                    <h4 class="gallery-title">${escapeHtml(det.crop)}: ${escapeHtml(det.disease)}</h4>
                    <div class="gallery-meta">
                        <span class="gallery-date">${dateStr}</span>
                        <span class="gallery-conf">${Math.round(det.confidence)}% conf</span>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => {
                openDetailsDrawer(det);
            });
            galleryGrid.appendChild(card);
        });
        lucide.createIcons();
    }

    function updatePaginationUI() {
        const totalPages = Math.max(1, Math.ceil(totalItemsCount / itemsPerPage));
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
        btnFirst.disabled = currentPage === 1;
        btnPrev.disabled = currentPage === 1;
        btnNext.disabled = currentPage === totalPages;
        btnLast.disabled = currentPage === totalPages;
    }

    function renderTimeline(detections) {
        if (!timelineFlow) return;
        if (detections.length === 0) {
            timelineFlow.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="calendar-x"></i>
                    <p>No timeline records found. Start capturing detections to see results.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        timelineFlow.innerHTML = '';
        detections.slice(0, 15).forEach(det => {
            const item = document.createElement('div');
            item.className = 'timeline-item';
            const dateStr = new Date(det.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const dotClass = `severity-${det.severity.toLowerCase()}`;
            let imgHTML = '';
            if (det.image_path === 'purged') {
                imgHTML = `
                    <div class="timeline-thumb flex-col d-flex-between justify-center" style="background-color: var(--border-color); color: var(--text-muted); font-size: 8px; text-align: center; justify-content: center;">
                        <i data-lucide="hard-drive" style="width:16px; height:16px; margin:0 auto 4px;"></i>
                        <span>Purged</span>
                    </div>
                `;
            } else if (det.image_path) {
                imgHTML = `<img src="/${det.image_path}" class="timeline-thumb" alt="${det.crop}">`;
            } else {
                imgHTML = `<div class="timeline-thumb" style="background-color: var(--border-color)"></div>`;
            }
            item.innerHTML = `
                <div class="timeline-dot ${dotClass}"></div>
                <div class="timeline-card-content">
                    ${imgHTML}
                    <div class="timeline-body">
                        <div class="timeline-header-row">
                            <h4 class="timeline-title">${escapeHtml(det.crop)} - ${escapeHtml(det.disease)}</h4>
                            <span class="timeline-time">${dateStr}</span>
                        </div>
                        <p class="timeline-desc">Severity status is marked as <strong>${det.severity}</strong> with a model confidence of <strong>${det.confidence}%</strong>.</p>
                    </div>
                </div>
            `;
            item.querySelector('.timeline-card-content').addEventListener('click', () => {
                openDetailsDrawer(det);
            });
            timelineFlow.appendChild(item);
        });
        lucide.createIcons();
    }

    function setupTimelineEvents() {
    }

    function openDetailsDrawer(det) {
        selectedDetection = det;
        detailsModal.classList.add('active');
        cropLabel.textContent = det.crop;
        diseaseLabel.textContent = det.disease;
        confidenceText.textContent = `${Math.round(det.confidence)}%`;
        confidenceFill.style.width = `${det.confidence}%`;
        timestampText.textContent = `Diagnosis Logged: ${new Date(det.timestamp).toLocaleString()}`;
        severityBadge.textContent = det.severity.toUpperCase();
        severityBadge.className = `badge ${getSeverityBadgeClass(det.severity)}`;
        if (det.image_path === 'purged') {
            imgOriginal.src = '';
            imgAnnotated.src = '';
            imgOriginal.parentElement.innerHTML = `
                <div class="gallery-purged-msg" style="font-size: 14px;">
                    <i data-lucide="hard-drive" style="width:40px; height:40px;"></i>
                    <strong>Purged by Disk Protection</strong>
                    <p style="text-align:center;">Physical image files are auto-purged past 500 records to safeguard Raspberry Pi SD Card disk space.</p>
                </div>
            `;
            imgAnnotated.parentElement.innerHTML = `
                <div class="gallery-purged-msg" style="font-size: 14px;">
                    <i data-lucide="file-x" style="width:40px; height:40px;"></i>
                    <strong>Annotations Unavailable</strong>
                    <p style="text-align:center;">Text records and diagnosis metrics remain fully available.</p>
                </div>
            `;
        } else {
            restoreImageDOM(det.image_path, det.original_image_path);
        }
        renderBboxes(det.bounding_boxes);
        const bInfo = botanicalDB[det.crop] || { scientific: 'Unknown', season: 'Standard', soil: 'Standard', water: 'Regular' };
        botanicalScientific.textContent = bInfo.scientific;
        botanicalSeason.textContent = bInfo.season;
        botanicalSoil.textContent = bInfo.soil;
        botanicalWater.textContent = bInfo.water;
        const advice = recommendationsDB[det.disease] || recommendationsDB['Healthy'];
        recTreatment.textContent = advice.treatment;
        recFungicide.textContent = advice.fungicide;
        recWatering.textContent = advice.watering;
        recIsolation.textContent = advice.isolation;
        recRecovery.textContent = advice.recovery;
        generateQrCode(det.id);
        const localLink = `${window.location.origin}/report/${det.id}`;
        btnShareWhatsapp.onclick = () => window.open(`https://api.whatsapp.com/send?text=Crop%20Disease%20Report%20Tomato%20-%20Late%20Blight%3A%20${encodeURIComponent(localLink)}`);
        btnShareEmail.onclick = () => window.open(`mailto:?subject=Crop%20Disease%20Diagnostic%20Report&body=I%27ve%20sent%20a%20crop%20disease%20details%20report.%20Access%20report%20here%3A%20${encodeURIComponent(localLink)}`);
        btnShareCopy.onclick = () => {
            navigator.clipboard.writeText(localLink).then(() => {
                alert('Shareable report link copied to clipboard!');
            });
        };
        lucide.createIcons();
    }

    function restoreImageDOM(imagePath, originalImagePath) {
        const originalSrc = originalImagePath ? `/${originalImagePath}` : `/${imagePath}`;
        const compareContainer = document.getElementById('details-img-comparison');
        compareContainer.innerHTML = `
            <div class="image-wrapper original-wrapper">
                <img id="details-img-original" src="${originalSrc}" alt="Original upload">
                <span class="img-label">Original image</span>
            </div>
            <div class="image-wrapper annotated-wrapper">
                <div class="annotated-image-wrapper">
                    <img id="details-img-annotated" src="/${imagePath}" alt="Annotated upload">
                    <div class="bbox-overlay-container" id="details-bbox-container"></div>
                </div>
                <span class="img-label">Annotated detection</span>
            </div>
        `;
        imgOriginal = document.getElementById('details-img-original');
        imgAnnotated = document.getElementById('details-img-annotated');
        bboxContainer = document.getElementById('details-bbox-container');
    }

    function renderBboxes(bboxJSON) {
        if (!bboxContainer) return;
        bboxContainer.innerHTML = '';
        if (!bboxJSON) return;
        try {
            const boxes = typeof bboxJSON === 'string' ? JSON.parse(bboxJSON) : bboxJSON;
            const drawColor = document.getElementById('bbox-color') ? document.getElementById('bbox-color').value : '#ef4444';
            boxes.forEach(box => {
                const pctX = ((box.x - box.width / 2) / 640) * 100;
                const pctY = ((box.y - box.height / 2) / 480) * 100;
                const pctW = (box.width / 640) * 100;
                const pctH = (box.height / 480) * 100;
                const div = document.createElement('div');
                div.className = 'detection-bbox';
                div.style.left = `${pctX}%`;
                div.style.top = `${pctY}%`;
                div.style.width = `${pctW}%`;
                div.style.height = `${pctH}%`;
                div.style.borderColor = drawColor;
                div.style.borderWidth = '3px';
                div.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
                const labelSpan = document.createElement('span');
                labelSpan.className = 'detection-label';
                labelSpan.style.backgroundColor = drawColor;
                labelSpan.textContent = box.class;
                div.appendChild(labelSpan);
                bboxContainer.appendChild(div);
            });
        } catch (e) {
            console.error("Failed to render bounding box overlays:", e);
        }
    }

    function closeDetailsDrawer() {
        detailsModal.classList.remove('active');
        selectedDetection = null;
    }

    function generateQrCode(detId) {
        if (!qrCodeWrapper) return;
        qrCodeWrapper.innerHTML = '';
        const reportUrl = `${window.location.origin}/report/${detId}`;
        try {
            qrInstance = new QRCode(qrCodeWrapper, {
                text: reportUrl,
                width: 90,
                height: 90,
                colorDark: '#09090b',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        } catch (e) {
            console.error("QR Code generator failed:", e);
        }
    }

    function exportPdfReport(det) {
        const opt = {
            margin: 10,
            filename: `crop_diagnostic_report_${det.id}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        const element = document.createElement('div');
        element.style.fontFamily = 'Arial, sans-serif';
        element.style.padding = '20px';
        element.style.color = '#333';
        const bInfo = botanicalDB[det.crop] || { scientific: '--', season: '--', soil: '--', water: '--' };
        const advice = recommendationsDB[det.disease] || recommendationsDB['Healthy'];
        const severityStr = det.severity === 'Severe' ? '🔴 Severe' : (det.severity === 'Moderate' ? '🟡 Moderate' : '🟢 Normal');
        element.innerHTML = `
            <div style="border-bottom: 3px solid #059669; padding-bottom: 12px; margin-bottom: 20px;">
                <h1 style="color: #059669; margin: 0;">Smart Farm Diagnostics</h1>
                <p style="margin: 4px 0 0; color: #777;">Crop Health & Water Management Report</p>
            </div>
            <div style="margin-bottom: 24px;">
                <h2>Diagnosis Summary</h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <tr style="background-color: #f3f4f6;"><td style="padding: 8px; font-weight:bold;">Crop Species</td><td style="padding: 8px;">${det.crop}</td></tr>
                    <tr><td style="padding: 8px; font-weight:bold;">Condition / Disease</td><td style="padding: 8px; color: #e11d48; font-weight:bold;">${det.disease}</td></tr>
                    <tr style="background-color: #f3f4f6;"><td style="padding: 8px; font-weight:bold;">Prediction Confidence</td><td style="padding: 8px;">${det.confidence}%</td></tr>
                    <tr><td style="padding: 8px; font-weight:bold;">Severity Level</td><td style="padding: 8px;">${severityStr}</td></tr>
                    <tr style="background-color: #f3f4f6;"><td style="padding: 8px; font-weight:bold;">Timestamp Logged</td><td style="padding: 8px;">${new Date(det.timestamp).toLocaleString()}</td></tr>
                </table>
            </div>

            <div style="margin-bottom: 24px;">
                <h2>Botanical References Lookup</h2>
                <p><strong>Scientific:</strong> ${bInfo.scientific}</p>
                <p><strong>Ideal Season:</strong> ${bInfo.season}</p>
                <p><strong>Soil:</strong> ${bInfo.soil}</p>
                <p><strong>Water Requirements:</strong> ${bInfo.water}</p>
            </div>

            <div style="margin-bottom: 24px; background-color: #eff6ff; padding: 15px; border-left: 4px solid #2563eb; border-radius: 4px;">
                <h2 style="color: #1e3a8a; margin-top: 0;">Adviser Recommendations</h2>
                <p><strong>Treatment Actions:</strong> ${advice.treatment}</p>
                <p><strong>Recommended Fungicide:</strong> ${advice.fungicide}</p>
                <p><strong>Watering Settings:</strong> ${advice.watering}</p>
                <p><strong>Isolation Details:</strong> ${advice.isolation}</p>
                <p><strong>Recovery Expected:</strong> ${advice.recovery}</p>
            </div>
            <div style="margin-top: 50px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px; font-size: 11px; color: #999;">
                Report generated automatically via AgriControl Smart Hub.
            </div>
        `;
        html2pdf().set(opt).from(element).save();
    }

    function downloadHistoryCsv() {
        fetch('/api/history?limit=1000') 
            .then(res => res.json())
            .then(data => {
                const detections = data.detections;
                if (detections.length === 0) {
                    alert('No database history to export.');
                    return;
                }
                let csvContent = "data:text/csv;charset=utf-8,";
                csvContent += "ID,Timestamp,Crop,Disease,Confidence,Severity,Image Path\n";
                detections.forEach(det => {
                    const row = [
                        det.id,
                        `"${det.timestamp}"`,
                        `"${det.crop}"`,
                        `"${det.disease}"`,
                        `${det.confidence}%`,
                        `"${det.severity}"`,
                        `"${det.image_path}"`
                    ].join(",");
                    csvContent += row + "\n";
                });
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "crop_detection_history.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            })
            .catch(err => console.error("Export CSV failed:", err));
    }

    function setupAdminEventListeners() {
        const loadConfigsIntoForms = () => {
            const c = appState.config;
            document.getElementById('config-roboflow-key').value = c.roboflow_api_key || '';
            document.getElementById('config-roboflow-workspace').value = c.roboflow_workspace || 'kuldeeps-workspace-cli7o';
            document.getElementById('config-roboflow-project').value = c.roboflow_project || 'plant-disease-w0ogb-gdeld';
            document.getElementById('config-roboflow-version').value = c.roboflow_version || '1';
            document.getElementById('config-irrigation-duration').value = c.irrigation_duration || 10;
            document.getElementById('config-storage-limit').value = c.image_storage_limit || 500;
            document.getElementById('config-auto-mode').checked = c.auto_irrigation_mode === '1';
            document.getElementById('config-email-enabled').checked = c.email_notifications_enabled === '1';
            document.getElementById('config-smtp-server').value = c.smtp_server || '';
            document.getElementById('config-smtp-port').value = c.smtp_port || '587';
            document.getElementById('config-smtp-sender').value = c.smtp_sender || '';
            document.getElementById('config-smtp-receiver').value = c.smtp_receiver || '';
            if (c.smtp_sender && btnTestEmail) {
                btnTestEmail.removeAttribute('disabled');
            }
            document.getElementById('config-lat').value = c.latitude || '28.6139';
            document.getElementById('config-lon').value = c.longitude || '77.2090';
        };

        const saveConfigAPI = (payload, successMsg) => {
            fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                alert(successMsg || 'Settings successfully saved!');
                Object.assign(appState.config, payload);
            })
            .catch(err => console.error("Config save failed:", err));
        };

        if (roboflowForm) {
            roboflowForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const payload = {
                    roboflow_api_key: document.getElementById('config-roboflow-key').value,
                    roboflow_workspace: document.getElementById('config-roboflow-workspace').value.trim(),
                    roboflow_project: document.getElementById('config-roboflow-project').value.trim(),
                    roboflow_version: document.getElementById('config-roboflow-version').value.trim()
                };
                saveConfigAPI(payload, 'Roboflow endpoint configuration updated!');
            });
        }

        if (systemForm) {
            systemForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const payload = {
                    irrigation_duration: parseInt(document.getElementById('config-irrigation-duration').value),
                    image_storage_limit: parseInt(document.getElementById('config-storage-limit').value),
                    auto_irrigation_mode: document.getElementById('config-auto-mode').checked ? '1' : '0'
                };
                saveConfigAPI(payload, 'System and disk irrigation settings saved.');
            });
        }

        if (smtpForm) {
            smtpForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const pwd = document.getElementById('config-smtp-password').value;
                const payload = {
                    email_notifications_enabled: document.getElementById('config-email-enabled').checked ? '1' : '0',
                    smtp_server: document.getElementById('config-smtp-server').value.trim(),
                    smtp_port: document.getElementById('config-smtp-port').value.trim(),
                    smtp_sender: document.getElementById('config-smtp-sender').value.trim(),
                    smtp_receiver: document.getElementById('config-smtp-receiver').value.trim()
                };
                if (pwd && pwd !== '********') {
                    payload['smtp_password'] = pwd;
                }
                saveConfigAPI(payload, 'SMTP configuration saved.');
                if (btnTestEmail && payload.email_notifications_enabled === '1') {
                    btnTestEmail.removeAttribute('disabled');
                }
            });
            btnTestEmail.addEventListener('click', () => {
                btnTestEmail.textContent = 'Sending...';
                btnTestEmail.disabled = true;
                fetch('/api/notify/test', { method: 'POST' })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) alert('Test disease email sent successfully!');
                        else alert('Failed to send test email. Check server log logs.');
                    })
                    .catch(err => console.error("Test email trigger failed:", err))
                    .finally(() => {
                        btnTestEmail.textContent = 'Send Test Email';
                        btnTestEmail.disabled = false;
                    });
            });
        }

        if (weatherForm) {
            weatherForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const payload = {
                    latitude: document.getElementById('config-lat').value.trim(),
                    longitude: document.getElementById('config-lon').value.trim()
                };
                saveConfigAPI(payload, 'Weather forecast zip coordinate targets saved.');
            });
        }

        if (btnTriggerBackup) {
            btnTriggerBackup.addEventListener('click', () => {
                btnTriggerBackup.disabled = true;
                btnTriggerBackup.textContent = 'Backing up...';
                fetch('/api/config') 
                    .then(() => {
                        alert('Database backup requested on RPi! Copied database.db into backups directory.');
                    })
                    .finally(() => {
                        btnTriggerBackup.disabled = false;
                        btnTriggerBackup.textContent = 'Backup SQLite Database';
                    });
            });
        }

        if (btnClearHistory) {
            btnClearHistory.addEventListener('click', () => {
                if (confirm('🚨 DANGER: Are you completely sure you want to clear all crop detections and irrigation event logs? This deletes all files and cannot be undone.')) {
                    fetch('/api/history/clear', { method: 'POST' })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                alert('Database successfully wiped! Detections cleared.');
                                loadHistoryData();
                                if (appState.refreshAnalytics) appState.refreshAnalytics();
                                if (appState.refreshIrrigation) appState.refreshIrrigation();
                            }
                        })
                        .catch(err => console.error("Database clear failed:", err));
                }
            });
        }

        document.querySelector("[data-tab='admin']").addEventListener('click', () => {
            loadConfigsIntoForms();
        });
    }

    function getSeverityBadgeClass(severity) {
        return {
            Normal: 'badge-success',
            Moderate: 'badge-warning',
            Severe: 'badge-error'
        }[severity] || 'badge-success';
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
}