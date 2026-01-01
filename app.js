// メインアプリケーションロジック

class BusinessCardScanner {
    constructor() {
        this.currentImageFile = null;
        this.stream = null;
        this.history = this.loadHistory();
        this.batchData = []; // 一時保存用の配列
        this.googleAccessToken = null;
        this.googleTokenExpiresAt = 0;
        this.tokenClient = null;
        this.savedSheetName = '';
        this.autoScanEnabled = false;
        this.autoScanLoopId = null;
        this.autoScanLastFrame = null;
        this.autoScanStableCount = 0;
        this.autoScanLastCaptureAt = 0;
        this.isAnalyzing = false;
        this.initElements();
        this.updateAutoScanButton();
        this.initEventListeners();
        this.renderHistory();
        this.renderBatchList();
        this.checkApiKey();
        this.loadSheetSettings();
        this.initGoogleAuth();
    }

    initElements() {
        // セクション
        this.cameraSection = document.getElementById('cameraSection');
        this.loadingSection = document.getElementById('loadingSection');
        this.resultSection = document.getElementById('resultSection');
        this.historySection = document.getElementById('historySection');
        this.settingsPanel = document.getElementById('settingsPanel');

        // カメラ関連
        this.cameraStreamContainer = document.getElementById('cameraStreamContainer');
        this.cameraStream = document.getElementById('cameraStream');
        this.canvas = document.getElementById('canvas');
        this.captureButtons = document.getElementById('captureButtons');

        // ボタン
        this.openCameraBtn = document.getElementById('openCameraBtn');
        this.selectFileBtn = document.getElementById('selectFileBtn');
        this.takePictureBtn = document.getElementById('takePictureBtn');
        this.closeCameraBtn = document.getElementById('closeCameraBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.saveSettingsBtn = document.getElementById('saveSettings');
        this.closeSettingsBtn = document.getElementById('closeSettings');
        this.copyCsvBtn = document.getElementById('copyCsvBtn');
        this.downloadCsvBtn = document.getElementById('downloadCsvBtn');
        this.retakeBtn = document.getElementById('retakeBtn');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');

        // バッチ処理用ボタン
        this.addToBatchBtn = document.getElementById('addToBatchBtn');
        this.batchCopyCsvBtn = document.getElementById('batchCopyCsvBtn');
        this.batchDownloadCsvBtn = document.getElementById('batchDownloadCsvBtn');
        this.clearBatchBtn = document.getElementById('clearBatchBtn');

        // バッチリスト
        this.batchList = document.getElementById('batchList');
        this.batchSection = document.getElementById('batchSection');

        // 入力
        this.fileInput = document.getElementById('fileInput');
        this.folderInput = document.getElementById('folderInput');
        this.apiKeyInput = document.getElementById('apiKey');
        this.preview = document.getElementById('preview');
        this.previewContainer = document.getElementById('previewContainer');
        this.connectGoogleBtn = document.getElementById('connectGoogleBtn');
        this.googleStatus = document.getElementById('googleStatus');
        this.spreadsheetIdInput = document.getElementById('spreadsheetId');
        this.loadSheetsBtn = document.getElementById('loadSheetsBtn');
        this.sheetSelect = document.getElementById('sheetSelect');
        this.writeSheetBtn = document.getElementById('writeSheetBtn');
        this.batchWriteSheetBtn = document.getElementById('batchWriteSheetBtn');
        this.autoScanToggleBtn = document.getElementById('autoScanToggleBtn');
        this.skipAfterScanBtn = document.getElementById('skipAfterScanBtn');
        this.tokenUsage = document.getElementById('tokenUsage');

        // 進捗表示用
        this.loadingText = document.getElementById('loadingText');
        this.progressText = document.getElementById('progressText');

        // フォームフィールド
        this.fields = {
            type: document.getElementById('type'),
            name: document.getElementById('name'),
            company: document.getElementById('company'),
            position: document.getElementById('position'),
            phone: document.getElementById('phone'),
            email: document.getElementById('email'),
            website: document.getElementById('website'),
            tag: document.getElementById('tag'),
            contactDate: document.getElementById('contactDate'),
            contactMethod: document.getElementById('contactMethod'),
            referrer: document.getElementById('referrer'),
            status: document.getElementById('status'),
            assignee: document.getElementById('assignee'),
            nextAction: document.getElementById('nextAction')
        };

        this.copyMessageBtn = document.getElementById('copyMessageBtn');
        this.historyList = document.getElementById('historyList');
    }

    initEventListeners() {
        // カメラボタン
        this.openCameraBtn.addEventListener('click', () => this.openCamera());
        this.selectFileBtn.addEventListener('click', () => this.fileInput.click());
        this.selectFolderBtn = document.getElementById('selectFolderBtn');
        this.selectFolderBtn.addEventListener('click', () => this.folderInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleImageCapture(e));
        this.folderInput.addEventListener('change', (e) => this.handleFolderSelect(e));
        this.takePictureBtn.addEventListener('click', () => this.takePicture());
        this.closeCameraBtn.addEventListener('click', () => this.closeCamera());

        // 設定ボタン
        this.settingsBtn.addEventListener('click', () => this.toggleSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.toggleSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());

        // 結果ボタン
        this.copyCsvBtn.addEventListener('click', () => this.copyCsvToClipboard());
        this.downloadCsvBtn.addEventListener('click', () => this.downloadCsv());
        this.retakeBtn.addEventListener('click', () => this.retake());
        this.addToBatchBtn.addEventListener('click', () => this.addToBatch());
        this.copyMessageBtn.addEventListener('click', () => this.copyMessage());
        if (this.writeSheetBtn) {
            this.writeSheetBtn.addEventListener('click', () => this.writeCurrentToSheet());
        }
        if (this.skipAfterScanBtn) {
            this.skipAfterScanBtn.addEventListener('click', () => this.skipAfterScan());
        }

        // バッチ処理ボタン
        this.batchCopyCsvBtn.addEventListener('click', () => this.batchCopyCsv());
        this.batchDownloadCsvBtn.addEventListener('click', () => this.batchDownloadCsv());
        this.clearBatchBtn.addEventListener('click', () => this.clearBatch());
        if (this.batchWriteSheetBtn) {
            this.batchWriteSheetBtn.addEventListener('click', () => this.writeBatchToSheet());
        }

        // 履歴
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());

        // Google Sheets
        if (this.connectGoogleBtn) {
            this.connectGoogleBtn.addEventListener('click', () => this.connectGoogle());
        }
        if (this.loadSheetsBtn) {
            this.loadSheetsBtn.addEventListener('click', () => this.loadSheets());
        }
        if (this.sheetSelect) {
            this.sheetSelect.addEventListener('change', () => this.saveSheetSelection());
        }

        // 自動スキャン
        if (this.autoScanToggleBtn) {
            this.autoScanToggleBtn.addEventListener('click', () => this.toggleAutoScan());
        }
    }

    async openCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });

            this.cameraStream.srcObject = this.stream;
            this.captureButtons.classList.add('hidden');
            this.cameraStreamContainer.classList.remove('hidden');
            this.startAutoScanLoop();

        } catch (error) {
            console.error('Camera access error:', error);
            this.showNotification('❌ カメラへのアクセスが拒否されました。ブラウザの設定を確認してください。', 'error');
        }
    }

    closeCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        this.cameraStream.srcObject = null;
        this.cameraStreamContainer.classList.add('hidden');
        this.captureButtons.classList.remove('hidden');
        this.stopAutoScanLoop();
    }

    takePicture() {
        if (this.isAnalyzing) return;
        const context = this.canvas.getContext('2d');
        const video = this.cameraStream;

        // キャンバスサイズを動画サイズに合わせる
        this.canvas.width = video.videoWidth;
        this.canvas.height = video.videoHeight;

        // 動画の現在のフレームをキャンバスに描画
        context.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);

        // キャンバスからBlobを作成
        this.canvas.toBlob(async (blob) => {
            const file = new File([blob], `business_card_${Date.now()}.jpg`, {
                type: 'image/jpeg'
            });

            this.currentImageFile = file;

            // プレビュー表示
            const url = URL.createObjectURL(blob);
            this.preview.src = url;
            this.previewContainer.classList.remove('hidden');

            // カメラを閉じる
            this.closeCamera();

            // 画像解析開始
            await this.analyzeImage(file);
        }, 'image/jpeg', 0.95);
    }

    checkApiKey() {
        const apiKey = localStorage.getItem('geminiApiKey');
        if (apiKey) {
            this.apiKeyInput.value = apiKey;
        } else {
            this.showNotification('⚠️ APIキーが未設定です。設定ボタンから設定してください。', 'warning');
        }
    }

    toggleSettings() {
        this.settingsPanel.classList.toggle('hidden');
    }

    saveSettings() {
        const apiKey = this.apiKeyInput.value.trim();
        if (!apiKey) {
            this.showNotification('❌ APIキーを入力してください', 'error');
            return;
        }

        localStorage.setItem('geminiApiKey', apiKey);
        this.saveSheetSelection();
        this.showNotification('✅ 設定を保存しました', 'success');
        this.toggleSettings();
    }

    loadSheetSettings() {
        const spreadsheetId = localStorage.getItem('spreadsheetId') || '';
        const sheetName = localStorage.getItem('sheetName') || '';
        this.spreadsheetIdInput.value = spreadsheetId;
        this.savedSheetName = sheetName;
        if (sheetName) {
            this.sheetSelect.value = sheetName;
        }
    }

    saveSheetSelection() {
        const rawInput = this.spreadsheetIdInput.value.trim();
        const spreadsheetId = this.extractSpreadsheetId(rawInput);

        if (spreadsheetId) {
            localStorage.setItem('spreadsheetId', spreadsheetId);
        } else if (!rawInput) {
            localStorage.removeItem('spreadsheetId');
        }

        const sheetName = this.sheetSelect.value;
        if (sheetName) {
            localStorage.setItem('sheetName', sheetName);
        } else {
            localStorage.removeItem('sheetName');
        }

        this.savedSheetName = sheetName;
    }

    toggleAutoScan() {
        this.autoScanEnabled = !this.autoScanEnabled;
        this.updateAutoScanButton();

        if (this.autoScanEnabled) {
            if (!this.stream) {
                this.openCamera();
            } else {
                this.startAutoScanLoop();
            }
        } else {
            this.stopAutoScanLoop();
        }
    }

    updateAutoScanButton() {
        if (!this.autoScanToggleBtn) return;
        const label = this.autoScanEnabled ? '⚡ 自動スキャン: ON' : '⚡ 自動スキャン: OFF';
        this.autoScanToggleBtn.textContent = label;
    }

    startAutoScanLoop() {
        if (!this.autoScanEnabled || !this.stream || this.autoScanLoopId) return;

        if (!this.autoScanCanvas) {
            this.autoScanCanvas = document.createElement('canvas');
            this.autoScanCanvas.width = 64;
            this.autoScanCanvas.height = 48;
            this.autoScanContext = this.autoScanCanvas.getContext('2d', { willReadFrequently: true });
        }

        const loop = () => {
            if (!this.autoScanEnabled || !this.stream) {
                this.stopAutoScanLoop();
                return;
            }

            this.processAutoScanFrame();
            this.autoScanLoopId = requestAnimationFrame(loop);
        };

        this.autoScanLoopId = requestAnimationFrame(loop);
    }

    stopAutoScanLoop() {
        if (this.autoScanLoopId) {
            cancelAnimationFrame(this.autoScanLoopId);
            this.autoScanLoopId = null;
        }
        this.autoScanLastFrame = null;
        this.autoScanStableCount = 0;
    }

    processAutoScanFrame() {
        if (this.isAnalyzing) return;
        if (this.cameraStreamContainer.classList.contains('hidden')) return;

        const video = this.cameraStream;
        if (!video || video.readyState < 2) return;

        const width = this.autoScanCanvas.width;
        const height = this.autoScanCanvas.height;
        this.autoScanContext.drawImage(video, 0, 0, width, height);
        const imageData = this.autoScanContext.getImageData(0, 0, width, height);
        const data = imageData.data;

        let brightnessSum = 0;
        const luminance = new Uint8Array(width * height);
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            const value = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
            luminance[j] = value;
            brightnessSum += value;
        }

        const avgBrightness = brightnessSum / luminance.length;

        if (!this.autoScanLastFrame) {
            this.autoScanLastFrame = luminance;
            return;
        }

        let diffSum = 0;
        for (let i = 0; i < luminance.length; i++) {
            diffSum += Math.abs(luminance[i] - this.autoScanLastFrame[i]);
        }

        const avgDiff = diffSum / luminance.length;
        this.autoScanLastFrame = luminance;

        const stable = avgDiff < 6 && avgBrightness > 40;
        this.autoScanStableCount = stable ? this.autoScanStableCount + 1 : 0;

        if (this.autoScanStableCount >= 8) {
            const now = Date.now();
            if (now - this.autoScanLastCaptureAt > 4000) {
                this.autoScanLastCaptureAt = now;
                this.autoScanStableCount = 0;
                this.takePicture();
            }
        }
    }

    returnToCameraAfterAction() {
        this.retake();
        if (this.autoScanEnabled) {
            setTimeout(() => this.openCamera(), 200);
        }
    }

    skipAfterScan() {
        this.returnToCameraAfterAction();
    }

    async prepareImageFile(file) {
        if (!file || !file.type || !file.type.startsWith('image/')) {
            return file;
        }

        const maxSize = 1280;
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const img = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = dataUrl;
        });

        const maxSide = Math.max(img.width, img.height);
        if (maxSide <= maxSize) {
            return file;
        }

        const scale = maxSize / maxSide;
        const targetWidth = Math.round(img.width * scale);
        const targetHeight = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const outputType = file.type || 'image/jpeg';
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, outputType, 0.9));
        if (!blob) return file;

        return new File([blob], file.name, { type: outputType });
    }

    initGoogleAuth() {
        const clientId = '688991323616-kp9hb8mc1plo9ipculu2voinh7vd4k1i.apps.googleusercontent.com';
        const scope = 'https://www.googleapis.com/auth/spreadsheets';

        const initTokenClient = () => {
            if (!window.google || !google.accounts || !google.accounts.oauth2) {
                return false;
            }

            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope,
                callback: (response) => this.handleTokenResponse(response)
            });

            this.updateGoogleStatus('未接続');
            return true;
        };

        if (!initTokenClient()) {
            const intervalId = setInterval(() => {
                if (initTokenClient()) {
                    clearInterval(intervalId);
                }
            }, 500);
        }
    }

    handleTokenResponse(response) {
        if (!response || !response.access_token) {
            this.showNotification('? Google認証に失敗しました', 'error');
            return;
        }

        this.googleAccessToken = response.access_token;
        this.googleTokenExpiresAt = Date.now() + (response.expires_in || 0) * 1000;
        this.updateGoogleStatus('接続済み');
    }

    updateGoogleStatus(text) {
        if (this.googleStatus) {
            this.googleStatus.textContent = text;
        }

        if (this.connectGoogleBtn) {
            this.connectGoogleBtn.textContent = text === '接続済み' ? '再接続' : 'Googleで接続';
        }
    }

    connectGoogle() {
        if (!this.tokenClient) {
            this.showNotification('? Google認証の準備中です。少し待ってから再試行してください。', 'warning');
            return;
        }

        const prompt = this.googleAccessToken ? '' : 'consent';
        this.tokenClient.requestAccessToken({ prompt });
    }

    ensureGoogleToken() {
        if (!this.googleAccessToken) {
            this.showNotification('? Googleで接続してください', 'warning');
            return false;
        }

        if (this.googleTokenExpiresAt && Date.now() > this.googleTokenExpiresAt) {
            this.showNotification('? 認証の有効期限が切れました。再接続してください。', 'warning');
            this.updateGoogleStatus('未接続');
            this.googleAccessToken = null;
            return false;
        }

        return true;
    }

    extractSpreadsheetId(input) {
        if (!input) return '';
        const trimmed = input.trim();
        const match = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) return match[1];
        if (/^[a-zA-Z0-9-_]+$/.test(trimmed)) return trimmed;
        return '';
    }

    async loadSheets() {
        if (!this.ensureGoogleToken()) return;

        const spreadsheetId = this.extractSpreadsheetId(this.spreadsheetIdInput.value);
        if (!spreadsheetId) {
            this.showNotification('? スプレッドシートのURLまたはIDを入力してください', 'error');
            return;
        }

        localStorage.setItem('spreadsheetId', spreadsheetId);

        try {
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
                headers: {
                    Authorization: `Bearer ${this.googleAccessToken}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'シート一覧の取得に失敗しました');
            }

            const data = await response.json();
            const sheets = data.sheets || [];
            const options = sheets.map(sheet => sheet.properties.title);

            this.sheetSelect.innerHTML = '<option value="">シートを選択</option>' +
                options.map(name => `<option value="${name}">${name}</option>`).join('');

            if (this.savedSheetName && options.includes(this.savedSheetName)) {
                this.sheetSelect.value = this.savedSheetName;
            }

            this.showNotification('? シート一覧を取得しました', 'success');
        } catch (error) {
            console.error('Load sheets error:', error);
            this.showNotification('? シート一覧の取得に失敗しました', 'error');
        }
    }

    getSelectedSheetInfo() {
        const spreadsheetId = this.extractSpreadsheetId(this.spreadsheetIdInput.value);
        const sheetName = this.sheetSelect.value;

        if (!spreadsheetId) {
            this.showNotification('? スプレッドシートURL / IDを設定してください', 'error');
            return null;
        }

        if (!sheetName) {
            this.showNotification('? 書き込み先シートを選択してください', 'error');
            return null;
        }

        return { spreadsheetId, sheetName };
    }

    sanitizeSheetValue(text) {
        if (!text) return '';
        return String(text).replace(/\n/g, ' ').replace(/\r/g, '');
    }

    buildSheetRow(data) {
        return [
            this.sanitizeSheetValue(data.type),
            this.sanitizeSheetValue(data.name),
            this.sanitizeSheetValue(data.company),
            this.sanitizeSheetValue(data.position),
            this.sanitizeSheetValue(data.phone),
            this.sanitizeSheetValue(data.email),
            this.sanitizeSheetValue(data.website),
            this.sanitizeSheetValue(data.tag),
            this.sanitizeSheetValue(data.contactDate),
            this.sanitizeSheetValue(data.contactMethod),
            this.sanitizeSheetValue(data.referrer),
            this.sanitizeSheetValue(data.status),
            this.sanitizeSheetValue(data.assignee),
            '', '', '', '', '', '', '', '', '', '', '',
            this.sanitizeSheetValue(data.nextAction)
        ];
    }

    async getNextAppendRow(spreadsheetId, sheetName) {
        const range = encodeURIComponent(`${sheetName}!A:A`);
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?majorDimension=ROWS`,
            {
                headers: {
                    Authorization: `Bearer ${this.googleAccessToken}`
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || '最終行の取得に失敗しました');
        }

        const data = await response.json();
        const values = data.values || [];
        let lastRow = 0;

        values.forEach((row, index) => {
            const hasValue = Array.isArray(row) && row.some(cell => String(cell).trim() !== '');
            if (hasValue) {
                lastRow = index + 1;
            }
        });

        return lastRow + 1;
    }

    async appendRowsToSheet(rows) {
        if (!this.ensureGoogleToken()) return;
        const selection = this.getSelectedSheetInfo();
        if (!selection) return;

        const { spreadsheetId, sheetName } = selection;

        try {
            const startRow = await this.getNextAppendRow(spreadsheetId, sheetName);
            const endRow = startRow + rows.length - 1;
            const range = encodeURIComponent(`${sheetName}!A${startRow}:Y${endRow}`);

            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${this.googleAccessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ values: rows })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'シートへの書き込みに失敗しました');
            }

            this.showNotification('? シートに追加しました', 'success');
        } catch (error) {
            console.error('Append to sheet error:', error);
            this.showNotification('? シートへの書き込みに失敗しました', 'error');
        }
    }

    async writeCurrentToSheet() {
        const data = this.getCurrentFormData();
        const row = this.buildSheetRow(data);
        await this.appendRowsToSheet([row]);
    }

    async writeBatchToSheet() {
        if (this.batchData.length === 0) {
            this.showNotification('? 一時保存されたデータがありません', 'error');
            return;
        }

        const rows = this.batchData.map(data => this.buildSheetRow(data));
        await this.appendRowsToSheet(rows);
    }

    async handleImageCapture(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        this.currentImageFile = file;

        // プレビュー表示
        const reader = new FileReader();
        reader.onload = (e) => {
            this.preview.src = e.target.result;
            this.previewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        // 画像解析開始
        await this.analyzeImage(file);
    }

    async analyzeImage(file) {
        this.isAnalyzing = true;
        try {
            // ローディング表示
            this.showSection('loading');

            // Gemini APIで解析
            const api = getGeminiAPI();
            const processedFile = await this.prepareImageFile(file);
            const result = await api.analyzeBusinessCard(processedFile);

            // 結果をフォームに反映
            this.fields.type.value = result.type;
            this.fields.name.value = result.name;
            this.fields.company.value = result.company;
            this.fields.position.value = result.position;
            this.fields.phone.value = result.phone;
            this.fields.email.value = result.email;
            this.fields.website.value = result.website;
            this.fields.tag.value = result.tag;
            this.fields.contactDate.value = result.contactDate || new Date().toISOString().split('T')[0];
            this.fields.contactMethod.value = result.contactMethod;
            this.fields.referrer.value = result.referrer;
            this.fields.status.value = result.status;
            this.fields.assignee.value = result.assignee;
            this.fields.nextAction.value = result.nextAction;
            this.renderTokenUsage(result.usage);

            // 結果セクション表示
            this.showSection('result');

            // 履歴に追加
            this.addToHistory(result);

        } catch (error) {
            console.error('Analysis error:', error);
            this.showNotification(`❌ ${error.message}`, 'error');
            this.showSection('camera');
        }
        this.isAnalyzing = false;
    }

    showSection(sectionName) {
        this.cameraSection.classList.add('hidden');
        this.loadingSection.classList.add('hidden');
        this.resultSection.classList.add('hidden');

        switch (sectionName) {
            case 'camera':
                this.cameraSection.classList.remove('hidden');
                break;
            case 'loading':
                this.loadingSection.classList.remove('hidden');
                break;
            case 'result':
                this.resultSection.classList.remove('hidden');
                break;
        }
    }

    addToHistory(data) {
        const entry = {
            ...data,
            timestamp: new Date().toISOString(),
            id: Date.now()
        };

        this.history.unshift(entry);
        if (this.history.length > 50) {
            this.history = this.history.slice(0, 50);
        }

        this.saveHistory();
        this.renderHistory();
    }

    renderTokenUsage(usage) {
        if (!this.tokenUsage) return;
        if (!usage) {
            this.tokenUsage.textContent = '';
            this.tokenUsage.classList.add('hidden');
            return;
        }

        const prompt = usage.promptTokenCount || 0;
        const output = usage.candidatesTokenCount || 0;
        const total = usage.totalTokenCount || 0;
        this.tokenUsage.textContent = `トークン: 入力 ${prompt} / 出力 ${output} / 合計 ${total}`;
        this.tokenUsage.classList.remove('hidden');
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.historyList.innerHTML = '<p class="empty-message">まだスキャンした名刺がありません</p>';
            this.clearHistoryBtn.classList.add('hidden');
            return;
        }

        this.clearHistoryBtn.classList.remove('hidden');

        this.historyList.innerHTML = this.history.map(entry => `
            <div class="history-item" data-id="${entry.id}">
                <h3>${entry.name || '名前なし'}</h3>
                <p><strong>${entry.company || '会社名なし'}</strong></p>
                <p>${entry.position || ''}</p>
                <small>${new Date(entry.timestamp).toLocaleString('ja-JP')}</small>
            </div>
        `).join('');

        // 履歴アイテムのクリックイベント
        this.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.id);
                this.loadHistoryItem(id);
            });
        });
    }

    loadHistoryItem(id) {
        const entry = this.history.find(e => e.id === id);
        if (!entry) return;

        this.fields.type.value = entry.type || '法人';
        this.fields.name.value = entry.name || '';
        this.fields.company.value = entry.company || '';
        this.fields.position.value = entry.position || '';
        this.fields.phone.value = entry.phone || '';
        this.fields.email.value = entry.email || '';
        this.fields.website.value = entry.website || '';
        this.fields.tag.value = entry.tag || '';
        this.fields.contactDate.value = entry.contactDate || '';
        this.fields.contactMethod.value = entry.contactMethod || '';
        this.fields.referrer.value = entry.referrer || '';
        this.fields.status.value = entry.status || '名刺交換';
        this.fields.assignee.value = entry.assignee || '';
        this.fields.nextAction.value = entry.nextAction || '';
        this.renderTokenUsage(entry.usage);

        this.showSection('result');
        this.showNotification('📋 履歴から読み込みました', 'info');
    }

    loadHistory() {
        try {
            const data = localStorage.getItem('businessCardHistory');
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    saveHistory() {
        localStorage.setItem('businessCardHistory', JSON.stringify(this.history));
    }

    clearHistory() {
        if (!confirm('履歴をすべて削除しますか？')) return;

        this.history = [];
        this.saveHistory();
        this.renderHistory();
        this.showNotification('🗑️ 履歴をクリアしました', 'info');
    }

    async copyCsvToClipboard() {
        const data = this.getCurrentFormData();

        // 改行をスペースに置換（TSVでは改行があると複数行になってしまうため）
        const sanitize = (text) => {
            if (!text) return '';
            return String(text).replace(/\n/g, ' ').replace(/\r/g, '');
        };

        // CSVデータを作成（データ行のみ、ヘッダーなし）
        // A～M列（13列）+ N～X列（11列空白）+ Y列（ネクストアクション）= 25列
        const row = [
            sanitize(data.type),           // A列: 属性
            sanitize(data.name),           // B列: 氏名
            sanitize(data.company),        // C列: 法人名
            sanitize(data.position),       // D列: 部署・役職
            sanitize(data.phone),          // E列: 電話番号
            sanitize(data.email),          // F列: メールアドレス
            sanitize(data.website),        // G列: HP
            sanitize(data.tag),            // H列: タグ
            sanitize(data.contactDate),    // I列: 初回接触日
            sanitize(data.contactMethod),  // J列: 接触方法
            sanitize(data.referrer),       // K列: 紹介者
            sanitize(data.status),         // L列: ステータス
            sanitize(data.assignee),       // M列: 担当者
            '', '', '', '', '', '', '', '', '', '', '',  // N～X列: 空白（11列）
            sanitize(data.nextAction)      // Y列: ネクストアクション
        ];

        // タブ区切り形式（スプレッドシートに貼り付けやすい）
        const tsvContent = row.join('\t');

        try {
            await navigator.clipboard.writeText(tsvContent);
            this.showNotification('✅ CSVをコピーしました！スプレッドシートに貼り付けてください', 'success');
        } catch (error) {
            console.error('Clipboard copy error:', error);
            this.showNotification('❌ コピーに失敗しました', 'error');
        }
    }

    downloadCsv() {
        const data = this.getCurrentFormData();

        // CSVヘッダー（スプレッドシートの列に対応）
        const headers = ['属性', '氏名', '法人名', '部署・役職', '電話番号', 'メールアドレス', 'HP', 'タグ', '初回接触日', '接触方法', '紹介者', 'ステータス', '担当者', 'ネクストアクション'];
        const row = [
            data.type,
            data.name,
            data.company,
            data.position,
            data.phone,
            data.email,
            data.website,
            data.tag,
            data.contactDate,
            data.contactMethod,
            data.referrer,
            data.status,
            data.assignee,
            data.nextAction
        ];

        // CSV作成
        const csvContent = [
            headers.map(h => `"${h}"`).join(','),
            row.map(r => `"${r}"`).join(',')
        ].join('\n');

        // BOM付きUTF-8でダウンロード
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `名刺_${data.name || 'unknown'}_${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        this.showNotification('📥 CSVをダウンロードしました', 'success');
    }


    getCurrentFormData() {
        return {
            type: this.fields.type.value,
            name: this.fields.name.value,
            company: this.fields.company.value,
            position: this.fields.position.value,
            phone: this.fields.phone.value,
            email: this.fields.email.value,
            website: this.fields.website.value,
            tag: this.fields.tag.value,
            contactDate: this.fields.contactDate.value,
            contactMethod: this.fields.contactMethod.value,
            referrer: this.fields.referrer.value,
            status: this.fields.status.value,
            assignee: this.fields.assignee.value,
            nextAction: this.fields.nextAction.value
        };
    }

    async copyMessage() {
        const message = this.fields.nextAction.value;

        if (!message) {
            this.showNotification('❌ メッセージがありません', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(message);
            this.showNotification('✅ メッセージをコピーしました！', 'success');
        } catch (error) {
            console.error('Clipboard copy error:', error);
            this.showNotification('❌ コピーに失敗しました', 'error');
        }
    }

    retake() {
        this.fileInput.value = '';
        this.previewContainer.classList.add('hidden');
        this.closeCamera();
        this.showSection('camera');
    }

    showNotification(message, type = 'info') {
        // シンプルなアラート（将来的にトーストUIに変更可能）
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const icon = icons[type] || icons.info;
        alert(`${icon} ${message}`);
    }

    // バッチ処理用メソッド
    addToBatch() {
        const data = this.getCurrentFormData();

        if (!data.name && !data.company) {
            this.showNotification('❌ 氏名または法人名を入力してください', 'error');
            return;
        }

        this.batchData.push(data);
        this.renderBatchList();
        this.showNotification(`✅ 一時保存しました（${this.batchData.length}件）`, 'success');

        // 次の撮影に進む
        this.returnToCameraAfterAction();
    }

    renderBatchList() {
        if (this.batchData.length === 0) {
            this.batchList.innerHTML = '<p class="empty-message">まだ一時保存されたデータがありません</p>';
            this.clearBatchBtn.classList.add('hidden');
            this.batchCopyCsvBtn.classList.add('hidden');
            this.batchDownloadCsvBtn.classList.add('hidden');
            this.batchWriteSheetBtn.classList.add('hidden');
            return;
        }

        this.clearBatchBtn.classList.remove('hidden');
        this.batchCopyCsvBtn.classList.remove('hidden');
        this.batchDownloadCsvBtn.classList.remove('hidden');
        this.batchWriteSheetBtn.classList.remove('hidden');

        this.batchList.innerHTML = this.batchData.map((entry, index) => `
            <div class="batch-item" data-index="${index}">
                <div class="batch-item-content">
                    <h3>${entry.name || '名前なし'}</h3>
                    <p><strong>${entry.company || '会社名なし'}</strong></p>
                    <p>${entry.position || ''}</p>
                </div>
                <button class="batch-item-delete" data-index="${index}">🗑️</button>
            </div>
        `).join('');

        // 削除ボタンのイベント
        this.batchList.querySelectorAll('.batch-item-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.removeFromBatch(index);
            });
        });
    }

    removeFromBatch(index) {
        this.batchData.splice(index, 1);
        this.renderBatchList();
        this.showNotification('🗑️ 削除しました', 'info');
    }

    clearBatch() {
        if (!confirm('一時保存されたデータをすべて削除しますか？')) return;

        this.batchData = [];
        this.renderBatchList();
        this.showNotification('🗑️ 一時保存データをクリアしました', 'info');
    }

    async batchCopyCsv() {
        if (this.batchData.length === 0) {
            this.showNotification('❌ 一時保存されたデータがありません', 'error');
            return;
        }

        // 改行をスペースに置換（TSVでは改行があると複数行になってしまうため）
        const sanitize = (text) => {
            if (!text) return '';
            return String(text).replace(/\n/g, ' ').replace(/\r/g, '');
        };

        // 複数行のTSVデータを作成
        // A～M列（13列）+ N～X列（11列空白）+ Y列（ネクストアクション）= 25列
        const rows = this.batchData.map(data => [
            sanitize(data.type),           // A列: 属性
            sanitize(data.name),           // B列: 氏名
            sanitize(data.company),        // C列: 法人名
            sanitize(data.position),       // D列: 部署・役職
            sanitize(data.phone),          // E列: 電話番号
            sanitize(data.email),          // F列: メールアドレス
            sanitize(data.website),        // G列: HP
            sanitize(data.tag),            // H列: タグ
            sanitize(data.contactDate),    // I列: 初回接触日
            sanitize(data.contactMethod),  // J列: 接触方法
            sanitize(data.referrer),       // K列: 紹介者
            sanitize(data.status),         // L列: ステータス
            sanitize(data.assignee),       // M列: 担当者
            '', '', '', '', '', '', '', '', '', '', '',  // N～X列: 空白（11列）
            sanitize(data.nextAction)      // Y列: ネクストアクション
        ].join('\t'));

        const tsvContent = rows.join('\n');

        try {
            await navigator.clipboard.writeText(tsvContent);
            this.showNotification(`✅ ${this.batchData.length}件のCSVをコピーしました！スプレッドシートに貼り付けてください`, 'success');
        } catch (error) {
            console.error('Clipboard copy error:', error);
            this.showNotification('❌ コピーに失敗しました', 'error');
        }
    }

    batchDownloadCsv() {
        if (this.batchData.length === 0) {
            this.showNotification('❌ 一時保存されたデータがありません', 'error');
            return;
        }

        // CSVヘッダー
        const headers = ['属性', '氏名', '法人名', '部署・役職', '電話番号', 'メールアドレス', 'HP', 'タグ', '初回接触日', '接触方法', '紹介者', 'ステータス', '担当者', 'ネクストアクション'];

        // データ行
        const rows = this.batchData.map(data => [
            data.type,
            data.name,
            data.company,
            data.position,
            data.phone,
            data.email,
            data.website,
            data.tag,
            data.contactDate,
            data.contactMethod,
            data.referrer,
            data.status,
            data.assignee,
            data.nextAction
        ].map(r => `"${r}"`).join(','));

        // CSV作成
        const csvContent = [
            headers.map(h => `"${h}"`).join(','),
            ...rows
        ].join('\n');

        // BOM付きUTF-8でダウンロード
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `名刺一括_${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        this.showNotification(`📥 ${this.batchData.length}件のCSVをダウンロードしました`, 'success');
    }

    // フォルダ一括スキャン
    async handleFolderSelect(event) {
        const files = Array.from(event.target.files || []);

        if (files.length === 0) return;

        // 画像ファイルのみフィルタリング
        const imageFiles = files.filter(file => file.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            this.showNotification('❌ 画像ファイルが見つかりませんでした', 'error');
            return;
        }

        // 確認ダイアログ
        if (!confirm(`${imageFiles.length}枚の名刺画像をスキャンします。よろしいですか？\n\n処理には時間がかかる場合があります。`)) {
            this.folderInput.value = '';
            return;
        }

        // バッチデータをクリア（必要に応じて）
        const clearBatch = this.batchData.length > 0 &&
            confirm('既存の一時保存データがあります。クリアしますか？\n\n「キャンセル」を選ぶと既存データに追加されます。');

        if (clearBatch) {
            this.batchData = [];
        }

        // ローディング表示
        this.showSection('loading');
        this.loadingText.textContent = 'フォルダをスキャン中...';
        this.progressText.classList.remove('hidden');

        let successCount = 0;
        let errorCount = 0;

        // 1枚ずつ順次処理
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];

            // 進捗表示を更新
            this.progressText.textContent = `処理中: ${i + 1} / ${imageFiles.length}枚`;

            try {
                // Gemini APIで解析
                const api = getGeminiAPI();
                const processedFile = await this.prepareImageFile(file);
                const result = await api.analyzeBusinessCard(processedFile);

                // バッチデータに追加
                this.batchData.push(result);

                // 履歴に追加
                this.addToHistory(result);

                successCount++;

                // APIレート制限対策: 1秒待機
                if (i < imageFiles.length - 1) {
                    await this.sleep(1000);
                }

            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                errorCount++;
            }
        }

        // バッチリストを更新
        this.renderBatchList();

        // 完了メッセージ
        this.progressText.classList.add('hidden');
        this.loadingText.textContent = '解析中...';

        let message = `✅ スキャン完了！\n\n成功: ${successCount}件`;
        if (errorCount > 0) {
            message += `\n失敗: ${errorCount}件`;
        }
        message += '\n\n一時保存データから「まとめてCSVコピー」できます。';

        this.showNotification(message, 'success');

        // カメラセクションに戻る
        this.showSection('camera');

        // input をリセット
        this.folderInput.value = '';
    }

    // sleep関数（APIレート制限対策）
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// アプリ初期化
document.addEventListener('DOMContentLoaded', () => {
    new BusinessCardScanner();
});
