
export function initBatch(appState) {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('batch-file-input');
    const progressCard = document.getElementById('batch-progress-card');
    const progressFill = document.getElementById('batch-progress-fill');
    const summaryText = document.getElementById('batch-summary-text');
    const itemsList = document.getElementById('batch-items-list');
    const summaryResults = document.getElementById('batch-summary-results');

    let totalFiles = 0;
    let completedCount = 0;
    let batchResults = [];

    ['dragover', 'drop'].forEach(eventName => {
        window.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    if (dropZone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('highlight');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('highlight');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            const files = fileInput.files;
            handleFiles(files);
        });
    }

    function handleFiles(fileList) {
        const files = Array.from(fileList);
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            alert('Please drop or select valid image files (JPG, PNG).');
            return;
        }

        totalFiles = imageFiles.length;
        completedCount = 0;
        batchResults = [];
        progressCard.classList.remove('hidden');
        progressFill.style.width = '0%';
        summaryText.textContent = `0 / ${totalFiles} Completed`;
        itemsList.innerHTML = '';
        imageFiles.forEach((file, index) => {
            const row = document.createElement('div');
            row.className = 'batch-queue-item';
            row.id = `batch-item-${index}`;
            row.innerHTML = `
                <div class="batch-item-left">
                    <img class="batch-thumbnail" id="thumb-${index}" src="" alt="preview">
                    <div class="batch-item-info">
                        <span class="batch-item-name">${escapeHtml(file.name)}</span>
                        <span class="batch-item-status-text" id="status-text-${index}">Queued...</span>
                    </div>
                </div>
                <div class="batch-item-right" id="status-icon-container-${index}">
                    <span class="spinner inline-spinner" id="spinner-${index}"></span>
                </div>
            `;
            itemsList.appendChild(row);
            const reader = new FileReader();
            reader.onload = (e) => {
                const thumbImg = document.getElementById(`thumb-${index}`);
                if (thumbImg) thumbImg.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
        lucide.createIcons();
        processFileQueue(0, imageFiles);
    }

    function processFileQueue(index, files) {
        if (index >= files.length) {
            renderBatchSummary();
            return;
        }

        const file = files[index];
        const statusText = document.getElementById(`status-text-${index}`);
        const spinner = document.getElementById(`spinner-${index}`);
        const iconContainer = document.getElementById(`status-icon-container-${index}`);
        if (statusText) statusText.textContent = 'Uploading & Analyzing...';
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Image = e.target.result;
            fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: base64Image
                })
            })
            .then(res => {
                if (!res.ok) throw new Error(`Inference returned status ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (!data.success) throw new Error(data.message || 'Analysis failed');
                if (statusText) {
                    statusText.textContent = `🟢 ${data.crop}: ${data.disease} (${Math.round(data.confidence)}%)`;
                    statusText.style.color = 'var(--color-success)';
                }
                if (iconContainer) {
                    iconContainer.innerHTML = `<i data-lucide="check-circle-2" style="color: var(--color-success)"></i>`;
                }
                batchResults.push(data);
                completedCount++;
                updateProgressBar();
                setTimeout(() => processFileQueue(index + 1, files), 300);
            })
            .catch(err => {
                console.error(`Batch item ${index} failed:`, err);
                if (statusText) {
                    statusText.textContent = '🔴 Processing Error';
                    statusText.style.color = 'var(--color-danger)';
                }
                if (iconContainer) {
                    iconContainer.innerHTML = `<i data-lucide="x-circle" style="color: var(--color-danger)"></i>`;
                }
                completedCount++;
                updateProgressBar();
                setTimeout(() => processFileQueue(index + 1, files), 300);
            })
            .finally(() => {
                lucide.createIcons();
            });
        };
        reader.readAsDataURL(file);
    }

    function updateProgressBar() {
        const pct = Math.round((completedCount / totalFiles) * 100);
        progressFill.style.width = `${pct}%`;
        summaryText.textContent = `${completedCount} / ${totalFiles} Completed`;
        if (appState.refreshHistory) appState.refreshHistory();
        if (appState.refreshAnalytics) appState.refreshAnalytics();
    }

    function renderBatchSummary() {
        if (!summaryResults) return;
        if (batchResults.length === 0) {
            summaryResults.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="file-bar-chart-2"></i>
                    <p>All items encountered processing errors.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        const cropCounts = {};
        const diseaseCounts = {};
        let totalConf = 0;
        let severeCount = 0;
        batchResults.forEach(item => {
            cropCounts[item.crop] = (cropCounts[item.crop] || 0) + 1;
            const diseaseKey = `${item.crop} - ${item.disease}`;
            diseaseCounts[diseaseKey] = (diseaseCounts[diseaseKey] || 0) + 1;
            totalConf += item.confidence;
            if (item.severity === 'Severe') {
                severeCount++;
            }
        });

        const avgConfidence = Math.round(totalConf / batchResults.length);
        let cropLinesHTML = '';
        Object.entries(cropCounts).forEach(([crop, count]) => {
            cropLinesHTML += `<div class="botanical-row"><span>${escapeHtml(crop)}:</span> <strong>${count} items</strong></div>`;
        });
        let diseaseLinesHTML = '';
        Object.entries(diseaseCounts).forEach(([dis, count]) => {
            const isSevere = dis.includes('Late') || dis.includes('Rust') || dis.includes('Scab');
            const colorStyle = isSevere ? 'color: var(--color-danger); font-weight: bold;' : '';
            diseaseLinesHTML += `<li class="d-flex-between" style="font-size:13px; padding: 4px 0; border-bottom: 1px dashed var(--border-color); ${colorStyle}"><span>${escapeHtml(dis)}</span> <span>${count}</span></li>`;
        });

        summaryResults.innerHTML = `
            <div class="diagnosis-summary-box">
                <div class="d-flex-between">
                    <strong>Processed Crops</strong>
                    <span class="badge badge-success">${batchResults.length} Files</span>
                </div>
                <div class="botanical-info-box" style="margin: 12px 0 8px; padding: 10px;">
                    ${cropLinesHTML}
                </div>
                <div class="confidence-bar-wrapper">
                    <div class="d-flex-between">
                        <span>Average Confidence</span>
                        <strong>${avgConfidence}%</strong>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${avgConfidence}%"></div>
                    </div>
                </div>
                ${severeCount > 0 ? `
                    <div class="alert alert-info" style="margin-top: 12px; background-color: var(--bg-danger-light); color: var(--color-danger); border-color: rgba(239, 68, 68, 0.2);">
                        <i data-lucide="shield-alert"></i>
                        <span><strong>Warning:</strong> ${severeCount} high-severity crop infections identified! Check details in history drawer.</span>
                    </div>
                ` : `
                    <div class="alert alert-info" style="margin-top: 12px; background-color: var(--bg-success-light); color: var(--color-success); border-color: rgba(16, 185, 129, 0.2);">
                        <i data-lucide="check-circle-2"></i>
                        <span>All processed batch items are normal or minor warning status.</span>
                    </div>
                `}
            </div>
            <div class="meta-section" style="margin-top: 16px;">
                <h4>Aggregated Diagnosis Breakdown</h4>
                <ul style="list-style: none; padding-left: 0;">
                    ${diseaseLinesHTML}
                </ul>
            </div>
        `;
        lucide.createIcons();
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
}