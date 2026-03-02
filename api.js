// Gemini API連携モジュール

class GeminiAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        // 2025年最新モデル: gemini-2.5-flash（高速・効率的）
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    }

    /**
     * 画像をBase64に変換
     */
    async imageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // data:image/jpeg;base64, の部分を削除
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * 画像のMIMEタイプを取得
     */
    getMimeType(file) {
        return file.type || 'image/jpeg';
    }

    /**
     * 名刺画像を解析してデータを抽出
     */
    async analyzeBusinessCard(imageFile, signal) {
        if (!this.apiKey) {
            throw new Error('Gemini APIキーが設定されていません。設定パネルから設定してください。');
        }

        try {
            // 画像をBase64に変換
            const base64Image = await this.imageToBase64(imageFile);
            const mimeType = this.getMimeType(imageFile);

            // Gemini APIにリクエスト
            const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
                method: 'POST',
                signal: signal || null,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `この名刺画像から以下の情報を抽出してください。情報が見つからない場合は空文字列を返してください。
必ずJSON形式で回答してください。他のテキストは含めないでください。

また、名刺の情報を元に、LINEやFacebookメッセンジャーで送る初回連絡メッセージ案を生成してください。
メッセージは以下の要件を満たしてください：
- 丁寧で親しみやすいトーン
- 適宜絵文字を使ってフレンドリーさを出す（例：😊、🙌、✨、💡など）
- 名刺交換の機会に感謝する
- 簡潔で200文字程度
- 相手の会社名や役職に触れる
- 今後の連絡を促す一言を含める

{
  "type": "法人 or 個人（会社名があれば法人、なければ個人）",
  "name": "氏名（フルネーム）",
  "company": "法人名・会社名",
  "position": "部署・役職（例: 営業部 部長）",
  "phone": "電話番号",
  "email": "メールアドレス",
  "website": "WebサイトURL・HP",
  "address": "住所（都道府県から番地まで。複数行は半角スペースで連結）",
  "tag": "空文字列（後で手動入力）",
  "contactDate": "空文字列（後で手動入力）",
  "contactMethod": "空文字列（後で手動入力）",
  "referrer": "空文字列（後で手動入力）",
  "status": "名刺交換（デフォルト）",
  "assignee": "空文字列（後で手動入力）",
  "nextAction": "初回連絡メッセージ案を生成（LINEやメッセンジャーで送る用）"
}`
                            },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: base64Image
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        topK: 32,
                        topP: 1,
                        maxOutputTokens: 2048,
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Gemini API Error:', errorData);
                throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();

            // レスポンスからテキストを抽出
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
                throw new Error('APIからの応答が不正です');
            }

            // JSONを抽出（マークダウンのコードブロックを削除）
            let jsonText = text.trim();
            jsonText = jsonText.replace(/```json\n?/g, '');
            jsonText = jsonText.replace(/```\n?/g, '');
            jsonText = jsonText.trim();

            // JSONをパース
            const result = JSON.parse(jsonText);

            // 結果を正規化
            const usage = data.usageMetadata || {};

            return {
                type: result.type || '法人',
                name: result.name || '',
                company: result.company || '',
                position: result.position || '',
                phone: result.phone || '',
                email: result.email || '',
                website: result.website || '',
                address: result.address || '',
                tag: result.tag || '',
                contactDate: result.contactDate || '',
                contactMethod: result.contactMethod || '',
                referrer: result.referrer || '',
                status: result.status || '名刺交換',
                assignee: result.assignee || '',
                nextAction: result.nextAction || '',
                usage: {
                    promptTokenCount: usage.promptTokenCount || 0,
                    candidatesTokenCount: usage.candidatesTokenCount || 0,
                    totalTokenCount: usage.totalTokenCount || 0
                }
            };

        } catch (error) {
            console.error('Business card analysis error:', error);
            throw new Error(`名刺の解析に失敗しました: ${error.message}`);
        }
    }

    /**
     * APIキーの有効性をチェック
     */
    async validateApiKey() {
        try {
            const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: 'Hello'
                        }]
                    }]
                })
            });

            return response.ok;
        } catch (error) {
            console.error('API key validation error:', error);
            return false;
        }
    }
}

// シングルトンインスタンス
let geminiAPIInstance = null;

function getGeminiAPI() {
    const apiKey = localStorage.getItem('geminiApiKey');
    if (!geminiAPIInstance || geminiAPIInstance.apiKey !== apiKey) {
        geminiAPIInstance = new GeminiAPI(apiKey);
    }
    return geminiAPIInstance;
}
