
export function initIrrigation(appState) {
    const valveBadge = document.getElementById('valve-status-badge');
    const valveStateText = document.getElementById('valve-state-text');
    const valveIndicator = document.getElementById('valve-state-indicator');
    const btnManualIrrigation = document.getElementById('btn-manual-irrigation');
    const recentLogsList = document.getElementById('irrigation-recent-logs-list');
    const btnAddRule = document.getElementById('btn-add-rule');
    const btnRestoreRules = document.getElementById('btn-restore-rules');
    const rulesTableBody = document.getElementById('rules-table-tbody');
    const ruleEditorPanel = document.getElementById('rule-editor-panel');
    const ruleEditorTitle = document.getElementById('rule-editor-title');
    const ruleEditorForm = document.getElementById('rule-editor-form');
    const btnCloseRuleEditor = document.getElementById('btn-close-rule-editor');
    const editRuleId = document.getElementById('edit-rule-id');
    const ruleCrop = document.getElementById('rule-crop');
    const ruleDisease = document.getElementById('rule-disease');
    const ruleConfidence = document.getElementById('rule-confidence');
    const ruleConfidenceVal = document.getElementById('rule-confidence-val');
    const ruleAction = document.getElementById('rule-action');
    const ruleActive = document.getElementById('rule-active');

    refreshStatus();
    loadRulesTable();
    const statusInterval = setInterval(refreshStatus, 5000);
    appState.refreshIrrigation = refreshStatus;
    appState.refreshRules = loadRulesTable;

    if (ruleConfidence) {
        ruleConfidence.addEventListener('input', (e) => {
            if (ruleConfidenceVal) ruleConfidenceVal.textContent = `${e.target.value}%`;
        });
    }

    if (btnManualIrrigation) {
        btnManualIrrigation.addEventListener('click', () => {
            btnManualIrrigation.disabled = true;
            fetch('/api/irrigation/toggle', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    refreshStatus();
                    if (appState.refreshAnalytics) appState.refreshAnalytics();
                })
                .catch(err => console.error("Relay toggle failed:", err))
                .finally(() => {
                    btnManualIrrigation.disabled = false;
                });
        });
    }

    if (btnAddRule) {
        btnAddRule.addEventListener('click', () => {
            openRuleEditor(null);
        });
    }

    if (btnRestoreRules) {
        btnRestoreRules.addEventListener('click', () => {
            if (confirm("Are you sure you want to restore the default decision rules? This will overwrite any custom edits.")) {
                btnRestoreRules.disabled = true;
                fetch('/api/rules/restore', { method: 'POST' })
                    .then(res => res.json())
                    .then(data => {
                        loadRulesTable();
                        alert("Default rules successfully restored!");
                    })
                    .catch(err => console.error("Restore rules failed:", err))
                    .finally(() => {
                        btnRestoreRules.disabled = false;
                    });
            }
        });
    }
    if (btnCloseRuleEditor) {
        btnCloseRuleEditor.addEventListener('click', () => {
            closeRuleEditor();
        });
    }

    if (ruleEditorForm) {
        ruleEditorForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const payload = {
                id: editRuleId.value ? parseInt(editRuleId.value) : null,
                crop: ruleCrop.value.trim(),
                disease: ruleDisease.value.trim(),
                min_confidence: parseFloat(ruleConfidence.value),
                action: ruleAction.value,
                is_active: ruleActive.checked ? 1 : 0
            };
            fetch('/api/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                closeRuleEditor();
                loadRulesTable();
            })
            .catch(err => console.error("Error saving rule:", err));
        });
    }

    function refreshStatus() {
        fetch('/api/irrigation')
            .then(res => res.json())
            .then(status => {
                if (status.hardware) {
                    valveBadge.textContent = 'Hardware';
                    valveBadge.className = 'badge badge-success';
                } else {
                    valveBadge.textContent = 'Simulated';
                    valveBadge.className = 'badge badge-warning';
                }
                if (status.active) {
                    valveStateText.textContent = 'OPEN';
                    valveStateText.style.color = 'var(--color-info)';
                    valveIndicator.classList.add('active');
                    btnManualIrrigation.classList.remove('btn-secondary');
                    btnManualIrrigation.classList.add('btn-destructive');
                    btnManualIrrigation.querySelector('span').textContent = 'Manual Stop';
                    const irrIcon = btnManualIrrigation.querySelector('i, svg');
                    if (irrIcon) irrIcon.setAttribute('data-lucide', 'square');
                } else {
                    valveStateText.textContent = 'CLOSED';
                    valveStateText.style.color = 'var(--text-secondary)';
                    valveIndicator.classList.remove('active');
                    btnManualIrrigation.classList.add('btn-secondary');
                    btnManualIrrigation.classList.remove('btn-destructive');
                    btnManualIrrigation.querySelector('span').textContent = 'Manual Start';
                    const irrIcon = btnManualIrrigation.querySelector('i, svg');
                    if (irrIcon) irrIcon.setAttribute('data-lucide', 'play');
                }
                lucide.createIcons();
                renderRecentLogs(status.recent_logs);
            })
            .catch(err => {
                console.error("Irrigation status retrieval failed:", err);
                valveBadge.textContent = 'Offline';
                valveBadge.className = 'badge badge-error';
                valveStateText.textContent = 'DISCONNECTED';
            });
    }

    function renderRecentLogs(logs) {
        if (!recentLogsList) return;
        if (logs.length === 0) {
            recentLogsList.innerHTML = `<li class="empty-state">No recent activity logs.</li>`;
            return;
        }
        recentLogsList.innerHTML = '';
        logs.forEach(log => {
            const li = document.createElement('li');
            const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const actionText = log.action.includes('start') ? '🟢 Valve OPEN' : '🔴 Valve CLOSE';
            const detailText = log.duration ? `(${log.duration}s)` : (log.status === 'active' ? '(active)' : '');
            const triggerInfo = log.trigger_detection_id ? `[Rule Trigger]` : `[Manual Override]`;
            li.innerHTML = `
                <div>
                    <strong>${actionText}</strong> ${detailText}
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${triggerInfo}</div>
                </div>
                <span class="page-indicator" style="font-size:11px;">${timeStr}</span>
            `;
            recentLogsList.appendChild(li);
        });
    }

    function loadRulesTable() {
        if (!rulesTableBody) return;
        fetch('/api/rules')
            .then(res => res.json())
            .then(rules => {
                rulesTableBody.innerHTML = '';
                if (rules.length === 0) {
                    rulesTableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="text-center" style="color: var(--text-muted); padding: 30px;">
                                No smart decision rules configured. Click "Add Decision Rule" to create one.
                            </td>
                        </tr>
                    `;
                    return;
                }
                rules.forEach(rule => {
                    const tr = document.createElement('tr');
                    const actionLabel = {
                        start_irrigation: '💧 Start Irrigation',
                        stop_irrigation: '🛑 Stop Irrigation (Cutoff)',
                        notify_only: '✉️ Notify Farmer Only',
                        do_nothing: '➖ Log and Do Nothing'
                    }[rule.action] || rule.action;
                    const activeBadge = rule.is_active 
                        ? '<span class="badge badge-success">Active</span>' 
                        : '<span class="badge" style="background-color: var(--border-color); color: var(--text-muted)">Disabled</span>';
                    tr.innerHTML = `
                        <td><strong>${escapeHtml(rule.crop)}</strong></td>
                        <td><span class="badge" style="background-color: var(--bg-zinc-light); color: var(--text-primary); font-family: var(--font-mono);">${escapeHtml(rule.disease)}</span></td>
                        <td style="font-family: var(--font-mono);">${rule.min_confidence}%</td>
                        <td><strong>${actionLabel}</strong></td>
                        <td>${activeBadge}</td>
                        <td>
                            <div class="table-actions">
                                <button class="btn btn-secondary btn-sm btn-edit-rule" data-id="${rule.id}">Edit</button>
                                <button class="btn btn-destructive btn-sm btn-delete-rule" data-id="${rule.id}">Delete</button>
                            </div>
                        </td>
                    `;
                    tr.querySelector('.btn-edit-rule').addEventListener('click', () => {
                        openRuleEditor(rule);
                    });
                    tr.querySelector('.btn-delete-rule').addEventListener('click', () => {
                        if (confirm(`Are you sure you want to delete rule for ${rule.crop} - ${rule.disease}?`)) {
                            deleteRule(rule.id);
                        }
                    });
                    rulesTableBody.appendChild(tr);
                });
            })
            .catch(err => console.error("Error loading rules:", err));
    }

    function deleteRule(id) {
        fetch(`/api/rules/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                loadRulesTable();
            });
    }

    function openRuleEditor(rule) {
        ruleEditorPanel.classList.remove('hidden');
        if (rule) {
            ruleEditorTitle.textContent = 'Edit Decision Rule';
            editRuleId.value = rule.id;
            ruleCrop.value = rule.crop;
            ruleDisease.value = rule.disease;
            ruleConfidence.value = rule.min_confidence;
            ruleConfidenceVal.textContent = `${rule.min_confidence}%`;
            ruleAction.value = rule.action;
            ruleActive.checked = rule.is_active === 1;
        } else {
            ruleEditorTitle.textContent = 'Create Smart Rule';
            editRuleId.value = '';
            ruleCrop.value = '';
            ruleDisease.value = '';
            ruleConfidence.value = 80;
            ruleConfidenceVal.textContent = '80%';
            ruleAction.value = 'start_irrigation';
            ruleActive.checked = true;
        }
    }

    function closeRuleEditor() {
        ruleEditorPanel.classList.add('hidden');
        ruleEditorForm.reset();
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
}