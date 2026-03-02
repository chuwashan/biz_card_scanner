/**
 * 既存の既定エントリポイント互換。
 * Apps Script上で「myFunction」を実行してもセットアップが動くようにする。
 */
function myFunction() {
  setupCRM();
}
/**
 * 名刺CRM用の初期セットアップを行う。
 * - 4シート作成（取引先マスター / 担当者 / 案件パイプライン / 活動ログ）
 * - ヘッダー装飾
 * - 条件付き書式 / データ検証 / フィルタビュー
 * - ダッシュボード作成
 */
function setupCRM() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var SHEETS = {
    company: '取引先マスター',
    contacts: '担当者',
    pipeline: '案件パイプライン',
    activity: '活動ログ',
    dashboard: 'ダッシュボード'
  };

  var headers = {};
  headers[SHEETS.company] = ['会社ID', '法人名', '業種', '住所', '電話', 'HP', 'ステータス', '担当者', 'タグ', 'メモ', '登録日'];
  headers[SHEETS.contacts] = ['担当者ID', '会社ID', '顧客種別', '氏名', '部署・役職', 'TEL', 'メール', 'HP', '住所', 'タグ', '初回接触日', '接触方法', '紹介者', 'ステータス', '担当者', 'スキャン日時', 'メモ'];
  headers[SHEETS.pipeline] = ['案件ID', '会社ID', '担当者ID', '案件名', '金額', 'フェーズ', '確度%', '契約予定日', '担当者', 'ネクストアクション', '期日', 'メモ'];
  headers[SHEETS.activity] = ['ログID', '担当者ID', '会社ID', '氏名', '法人名', '日付', '活動種別', '内容', '担当者', 'ネクストアクション'];

  var targetSheetNames = [SHEETS.company, SHEETS.contacts, SHEETS.pipeline, SHEETS.activity, SHEETS.dashboard];
  var existing = targetSheetNames.filter(function (name) { return !!ss.getSheetByName(name); });
  var overwriteMode = true;

  if (existing.length > 0) {
    var msg = '以下のシートが既に存在します:\n- ' + existing.join('\n- ') + '\n\n上書きして再作成しますか？\n（いいえ: 既存シートを残して不足分のみ作成）\n（キャンセル: 処理中止）';
    var response = ui.alert('CRMセットアップ確認', msg, ui.ButtonSet.YES_NO_CANCEL);

    if (response === ui.Button.CANCEL) {
      ui.alert('処理を中止しました。');
      return;
    }
    overwriteMode = (response === ui.Button.YES);
  }

  // 4シート + ダッシュボードを用意
  var companySheet = getOrCreateSheet_(ss, SHEETS.company);
  var contactSheet = getOrCreateSheet_(ss, SHEETS.contacts);
  var pipelineSheet = getOrCreateSheet_(ss, SHEETS.pipeline);
  var activitySheet = getOrCreateSheet_(ss, SHEETS.activity);
  var dashboardSheet = getOrCreateSheet_(ss, SHEETS.dashboard);

  // 既存シートの扱い（YES: 上書き / NO: スキップ）
  var shouldSetup = {};
  targetSheetNames.forEach(function (name) {
    var existed = existing.indexOf(name) !== -1;
    shouldSetup[name] = overwriteMode || !existed;
  });

  // ヘッダー設定と見た目調整
  if (shouldSetup[SHEETS.company]) initializeSheet_(companySheet, headers[SHEETS.company]);
  if (shouldSetup[SHEETS.contacts]) initializeSheet_(contactSheet, headers[SHEETS.contacts]);
  if (shouldSetup[SHEETS.pipeline]) initializeSheet_(pipelineSheet, headers[SHEETS.pipeline]);
  if (shouldSetup[SHEETS.activity]) initializeSheet_(activitySheet, headers[SHEETS.activity]);

  // 条件付き書式 / データ検証 / フィルタビュー / ダッシュボード
  if (shouldSetup[SHEETS.contacts]) {
    setupConditionalFormatForContacts_(contactSheet);
    setupFilterViews_(contactSheet);
  }
  if (shouldSetup[SHEETS.contacts] || shouldSetup[SHEETS.pipeline] || shouldSetup[SHEETS.activity]) {
    setupDataValidations_(contactSheet, pipelineSheet, activitySheet);
  }
  if (shouldSetup[SHEETS.dashboard] || shouldSetup[SHEETS.contacts]) {
    setupDashboard_(dashboardSheet, contactSheet);
  }

  ui.alert('CRMセットアップが完了しました。');
}

/**
 * onEditトリガーでID列を自動採番する。
 * 対象:
 * - 担当者(A列): BC-001
 * - 案件パイプライン(A列): DEAL-001
 * - 活動ログ(A列): LOG-001
 */
function autoId(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  var row = e.range.getRow();
  if (row <= 1) return;

  var sheetName = sheet.getName();
  var config = {
    '担当者': { prefix: 'BC-', width: 3 },
    '案件パイプライン': { prefix: 'DEAL-', width: 3 },
    '活動ログ': { prefix: 'LOG-', width: 3 }
  }[sheetName];

  if (!config) return;

  // A列に既にIDがある場合は何もしない
  var idCell = sheet.getRange(row, 1);
  if (idCell.getValue()) return;

  // 行内の入力有無を確認（A列以外）
  var lastCol = sheet.getLastColumn();
  if (lastCol < 2) return;
  var rowValues = sheet.getRange(row, 2, 1, lastCol - 1).getValues()[0];
  var hasAnyInput = rowValues.some(function (v) { return v !== '' && v !== null; });
  if (!hasAnyInput) return;

  var nextNumber = findNextIdNumber_(sheet, config.prefix);
  var id = config.prefix + leftPad_(nextNumber, config.width);
  idCell.setValue(id);
}

/**
 * onEditシンプルトリガーの入口。
 */
function onEdit(e) {
  autoId(e);
}

/**
 * 指定名のシートを取得。なければ作成。
 */
function getOrCreateSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (sh) return sh;

  // 一部環境で直前のシート操作直後にinsertが失敗することがあるため、短時間リトライする
  var lastErr;
  for (var i = 0; i < 3; i++) {
    try {
      SpreadsheetApp.flush();
      return ss.insertSheet(name);
    } catch (err) {
      lastErr = err;
      Utilities.sleep(300);
    }
  }
  throw lastErr;
}

/**
 * シートのヘッダー設定・書式初期化。
 */
function initializeSheet_(sheet, headerRow) {
  sheet.clear();
  sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);

  // ヘッダーの見た目
  var headerRange = sheet.getRange(1, 1, 1, headerRow.length);
  headerRange
    .setFontWeight('bold')
    .setBackground('#d9e1f2')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // 先頭行固定、フィルタ、列幅自動調整
  sheet.setFrozenRows(1);
  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, sheet.getMaxRows(), headerRow.length).createFilter();
  }
  sheet.autoResizeColumns(1, headerRow.length);
}

/**
 * 担当者シートのステータス列に条件付き書式を設定。
 */
function setupConditionalFormatForContacts_(contactSheet) {
  var statusCol = 14; // N列: ステータス
  var range = contactSheet.getRange(2, statusCol, Math.max(contactSheet.getMaxRows() - 1, 1), 1);
  var rules = [];

  var colorMap = [
    { status: '名刺交換', color: '#f3f3f3' },
    { status: '進行中', color: '#cfe2f3' },
    { status: '検討中', color: '#fff2cc' },
    { status: '受注', color: '#d9ead3' },
    { status: '失注', color: '#f4cccc' }
  ];

  colorMap.forEach(function (item) {
    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(item.status)
        .setBackground(item.color)
        .setRanges([range])
        .build()
    );
  });

  contactSheet.setConditionalFormatRules(rules);
}

/**
 * データ検証（ドロップダウン）を設定する。
 */
function setupDataValidations_(contactSheet, pipelineSheet, activitySheet) {
  var maxRowsContacts = Math.max(contactSheet.getMaxRows() - 1, 1);
  var maxRowsPipeline = Math.max(pipelineSheet.getMaxRows() - 1, 1);
  var maxRowsActivity = Math.max(activitySheet.getMaxRows() - 1, 1);

  // ステータス（担当者シート N列）
  var statusList = ['名刺交換', '進行中', '検討中', '受注', '失注'];
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(statusList, true)
    .setAllowInvalid(false)
    .build();
  contactSheet.getRange(2, 14, maxRowsContacts, 1).setDataValidation(statusRule);

  // フェーズ（案件パイプライン F列）
  var phaseList = ['初回接触', '関係構築', 'ニーズ把握', '提案', 'クロージング', '受注', '失注'];
  var phaseRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(phaseList, true)
    .setAllowInvalid(false)
    .build();
  pipelineSheet.getRange(2, 6, maxRowsPipeline, 1).setDataValidation(phaseRule);

  // 活動種別（活動ログ G列）
  var activityTypeList = ['名刺交換', 'LINE', 'メール', '電話', '訪問', '勉強会', '提案', 'その他'];
  var activityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(activityTypeList, true)
    .setAllowInvalid(false)
    .build();
  activitySheet.getRange(2, 7, maxRowsActivity, 1).setDataValidation(activityRule);
}

/**
 * 担当者シートにフィルタビューを2つ作成する。
 * 軽量版では通常フィルタのみ作成する（API依存なし）。
 */
function setupFilterViews_(contactSheet) {
  if (contactSheet.getFilter()) return;
  var lastCol = Math.max(contactSheet.getLastColumn(), 1);
  contactSheet.getRange(1, 1, contactSheet.getMaxRows(), lastCol).createFilter();
}

/**
 * ダッシュボードを作成する（COUNTIF集計）。
 */
function setupDashboard_(dashboardSheet, contactSheet) {
  dashboardSheet.clear();

  dashboardSheet.getRange('A1').setValue('名刺CRM ダッシュボード');
  dashboardSheet.getRange('A1').setFontWeight('bold').setFontSize(14);

  dashboardSheet.getRange('A3').setValue('ステータス');
  dashboardSheet.getRange('B3').setValue('件数');
  dashboardSheet.getRange('A3:B3').setFontWeight('bold').setBackground('#d9e1f2');

  var statuses = ['名刺交換', '進行中', '検討中', '受注', '失注'];
  var sheetName = contactSheet.getName();

  for (var i = 0; i < statuses.length; i++) {
    var row = 4 + i;
    dashboardSheet.getRange(row, 1).setValue(statuses[i]);
    dashboardSheet.getRange(row, 2).setFormula('=COUNTIF(\'' + sheetName + '\'!N:N,A' + row + ')');
  }

  dashboardSheet.getRange('A10').setValue('総担当者数');
  dashboardSheet.getRange('B10').setFormula('=COUNTA(\'' + sheetName + '\'!A:A)-1');

  dashboardSheet.autoResizeColumns(1, 2);
}

/**
 * プレフィックスに基づいて次の連番を求める。
 */
function findNextIdNumber_(sheet, prefix) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;

  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var maxNum = 0;

  values.forEach(function (row) {
    var id = String(row[0] || '');
    if (id.indexOf(prefix) !== 0) return;
    var n = parseInt(id.replace(prefix, ''), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  });

  return maxNum + 1;
}

/**
 * 左ゼロ埋めを行う。
 */
function leftPad_(num, width) {
  var str = String(num);
  while (str.length < width) str = '0' + str;
  return str;
}

