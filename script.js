/* =========================================================
   見積書 作成ツール — script.js
   純粋なフロントエンドのみ。外部通信は行いません。
   ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     ユーティリティ
     --------------------------------------------------------- */

  // 全角英数字・記号を半角に正規化
  function toHalfWidth(str) {
    return String(str)
      .replace(/[！-～]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
      })
      .replace(/　/g, ' ');
  }

  // 通貨文字列 → 数値
  function parseMoney(str) {
    if (str === null || str === undefined) return 0;
    var cleaned = toHalfWidth(String(str)).replace(/[^\d.-]/g, '');
    var n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  }

  // 数値 → 千分位カンマ
  function comma(n) {
    var rounded = Math.round(n);
    var neg = rounded < 0;
    var s = String(Math.abs(rounded));
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + s;
  }

  // 数値 → ¥1,234
  function yen(n) {
    return '¥' + comma(n);
  }

  // "2026-10-11" → "2026年10月11日"
  function formatDate(iso) {
    if (!iso) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return Number(m[1]) + '年' + Number(m[2]) + '月' + Number(m[3]) + '日';
  }

  // 数量は小数第2位まで、整数ならそのまま
  function formatQty(n) {
    if (!isFinite(n)) return '0';
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  }

  function $(id) { return document.getElementById(id); }

  function todayISO() {
    return dateToISO(new Date());
  }

  function dateToISO(d) {
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  // "2026-10-11" に n 日を足した ISO 文字列を返す
  function addDays(iso, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    d.setDate(d.getDate() + Number(n));
    return dateToISO(d);
  }

  /* ---------------------------------------------------------
     状態
     --------------------------------------------------------- */

  var rowSeq = 0;
  var rows = []; // { id, name, qty, price }

  var DEFAULTS = {
    issuerName: '山田 太郎 / Yamada Design',
    issuerAddress: '〒150-0001\n東京都渋谷区神宮前1-2-3 サンプルビル5F',
    issuerPhone: '090-1234-5678',
    issuerEmail: 'info@yamada-design.example',
    clientName: '株式会社サンプル',
    clientHonorific: '御中',
    subject: 'Webサイトリニューアル制作の御見積',
    quoteNo: 'EST-2026-001',
    validityPreset: '30',
    notes: '納期：ご発注後 約6週間\n支払条件：納品後30日以内にお願いいたします。\n本見積は上記の有効期限まで有効です。',
    conditions: '本見積に含まれない作業（原稿執筆・写真素材の購入・追加修正など）は別途お見積いたします。\n表示価格はすべて税抜です。',
    taxRate: '10'
  };

  var DEFAULT_ROWS = [
    { name: 'Webサイト デザイン制作費', qty: 1, price: 250000 },
    { name: 'コーディング・実装費', qty: 1, price: 180000 },
    { name: '商品撮影（出張撮影）', qty: 3, price: 15000 },
    { name: 'ドメイン・サーバー 初期設定費', qty: 1, price: 12000 }
  ];

  /* ---------------------------------------------------------
     明細行の生成・操作
     --------------------------------------------------------- */

  function createRow(data) {
    rowSeq += 1;
    var row = {
      id: 'r' + rowSeq,
      name: data && data.name != null ? data.name : '',
      qty: data && data.qty != null ? data.qty : 1,
      price: data && data.price != null ? data.price : 0
    };
    rows.push(row);
    return row;
  }

  function buildRowElement(row) {
    var el = document.createElement('div');
    el.className = 'row';
    el.dataset.id = row.id;
    el.innerHTML =
      '<input type="text" class="i-name" aria-label="品名・作業内容" placeholder="品名・作業内容">' +
      '<input type="text" class="i-qty num" aria-label="数量" inputmode="decimal" placeholder="1">' +
      '<input type="text" class="i-price num" aria-label="単価（税抜）" inputmode="numeric" placeholder="0">' +
      '<button type="button" class="btn btn-icon i-del" aria-label="この行を削除">' +
        '<svg viewBox="0 0 16 16" class="ic" aria-hidden="true">' +
          '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8" ' +
          'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
      '</button>';

    el.querySelector('.i-name').value = row.name;
    el.querySelector('.i-qty').value = formatQty(row.qty);
    el.querySelector('.i-price').value = row.price ? comma(row.price) : '';

    return el;
  }

  function addRowToDOM(data) {
    var row = createRow(data);
    var el = buildRowElement(row);
    $('rowsContainer').appendChild(el);
    return el;
  }

  function renderAllRows() {
    var container = $('rowsContainer');
    container.innerHTML = '';
    rows = [];
    rowSeq = 0;
    DEFAULT_ROWS.forEach(function (r) { addRowToDOM(r); });
  }

  function findRow(id) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === id) return rows[i];
    }
    return null;
  }

  /* ---------------------------------------------------------
     計算（税率は全体で1つ）
     --------------------------------------------------------- */

  function currentTaxRate() {
    return $('taxRate').value === '8' ? 8 : 10;
  }

  function computeTotals() {
    var rate = currentTaxRate();

    var lines = rows.map(function (row) {
      return { row: row, amount: Math.round(row.qty * row.price) };
    });

    var subtotal = 0;
    lines.forEach(function (line) {
      if (line.amount > 0) subtotal += line.amount;
    });

    // 1円未満は切り捨て
    var tax = Math.floor(subtotal * rate / 100);

    return {
      lines: lines,
      rate: rate,
      subtotal: subtotal,
      tax: tax,
      grand: subtotal + tax
    };
  }

  /* ---------------------------------------------------------
     プレビューの描画
     --------------------------------------------------------- */

  function placeholder(text) {
    return '<span class="ph">' + text + '</span>';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function setOptionalText(el, value) {
    var text = String(value || '').trim();
    el.hidden = !text;
    el.textContent = text;
  }

  function renderPreview() {
    /* --- 発行元 --- */
    var issuerName = $('issuerName').value.trim();
    $('pvIssuerName').innerHTML = issuerName
      ? escapeHtml(issuerName)
      : placeholder('自社名・屋号を入力');

    setOptionalText($('pvIssuerAddress'), $('issuerAddress').value);
    setOptionalText($('pvIssuerPhone'), $('issuerPhone').value.trim() ? 'TEL：' + $('issuerPhone').value.trim() : '');
    setOptionalText($('pvIssuerEmail'), $('issuerEmail').value.trim() ? 'Email：' + $('issuerEmail').value.trim() : '');

    /* --- 宛名 --- */
    var clientName = $('clientName').value.trim();
    $('pvClientName').innerHTML = clientName
      ? escapeHtml(clientName)
      : placeholder('宛名を入力');
    $('pvHonorific').textContent = $('clientHonorific').value;

    /* --- 件名 --- */
    var subject = $('subject').value.trim();
    $('pvSubjectLine').hidden = !subject;
    $('pvSubject').textContent = subject;

    /* --- 発行日・見積番号・有効期限 --- */
    var dateISO = $('issueDate').value;
    $('pvDate').innerHTML = dateISO
      ? escapeHtml(formatDate(dateISO))
      : placeholder('未入力');

    var quoteNo = $('quoteNo').value.trim();
    $('pvQuoteNoLine').hidden = !quoteNo;
    $('pvQuoteNo').textContent = quoteNo;

    var validISO = $('validUntil').value;
    var preset = $('validityPreset').value;
    $('pvValidLine').hidden = !validISO;
    if (validISO) {
      var validText = formatDate(validISO);
      if (preset !== '0') validText += '（発行日から' + preset + '日）';
      $('pvValid').textContent = validText;
    } else {
      $('pvValid').textContent = '';
    }

    /* --- 明細 --- */
    var totals = computeTotals();
    var tbody = $('pvItems');
    tbody.innerHTML = '';

    if (!totals.lines.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">明細がありません</td></tr>';
    } else {
      totals.lines.forEach(function (line) {
        var tr = document.createElement('tr');

        var nameCell = document.createElement('td');
        nameCell.className = 'td-name';
        var nameText = line.row.name.trim();
        nameCell.innerHTML = '<span class="item-name">' +
          (nameText ? escapeHtml(nameText) : placeholder('品名未入力')) + '</span>';

        var qtyCell = document.createElement('td');
        qtyCell.className = 'td-qty';
        qtyCell.textContent = formatQty(line.row.qty);

        var priceCell = document.createElement('td');
        priceCell.className = 'td-price';
        priceCell.textContent = yen(line.row.price);

        var amountCell = document.createElement('td');
        amountCell.className = 'td-amount';
        amountCell.textContent = yen(line.amount);

        tr.appendChild(nameCell);
        tr.appendChild(qtyCell);
        tr.appendChild(priceCell);
        tr.appendChild(amountCell);
        tbody.appendChild(tr);
      });
    }

    /* --- 小計・消費税・合計 --- */
    $('pvSubtotal').textContent = yen(totals.subtotal);
    $('pvTaxLabel').textContent = '消費税（' + totals.rate + '%）';
    $('pvTaxTotal').textContent = yen(totals.tax);
    $('pvTotal').textContent = yen(totals.grand);
    $('pvGrand').textContent = yen(totals.grand);

    /* --- 備考・条件 --- */
    var notes = $('notes').value.trim();
    $('pvNotesBlock').hidden = !notes;
    $('pvNotes').textContent = notes;

    var conditions = $('conditions').value.trim();
    $('pvConditionsBlock').hidden = !conditions;
    $('pvConditions').textContent = conditions;

    /* --- 注記 --- */
    var paperNote = $('pvPaperNote');
    if (totals.lines.length) {
      paperNote.hidden = false;
      paperNote.textContent =
        '※ 消費税額は1円未満を切り捨てています。' +
        '※ 本見積書は適格請求書ではありません。正式なご請求は別途請求書を発行いたします。' +
        '※ 記載の金額は本見積の有効期限まで有効です。';
    } else {
      paperNote.hidden = true;
    }
  }

  /* ---------------------------------------------------------
     有効期限の自動計算
     --------------------------------------------------------- */

  function syncValidityFromIssueDate() {
    var preset = $('validityPreset').value;
    var dateISO = $('issueDate').value;
    if (preset === '0' || !dateISO) return;
    $('validUntil').value = addDays(dateISO, Number(preset));
  }

  function handleValidityPresetChange() {
    var preset = $('validityPreset').value;
    if (preset === '0') return; // 日付を指定する：今の値をそのまま使う
    syncValidityFromIssueDate();
  }

  // 日付を直接編集したら「日付を指定する」に切り替える
  function handleValidUntilInput() {
    $('validityPreset').value = '0';
  }

  /* ---------------------------------------------------------
     イベント
     --------------------------------------------------------- */

  function handleRowInput(event) {
    var rowEl = event.target.closest('.row');
    if (!rowEl) return;
    var row = findRow(rowEl.dataset.id);
    if (!row) return;

    if (event.target.classList.contains('i-name')) {
      row.name = event.target.value;
    } else if (event.target.classList.contains('i-qty')) {
      row.qty = parseMoney(event.target.value);
    } else if (event.target.classList.contains('i-price')) {
      row.price = parseMoney(event.target.value);
    }
    renderPreview();
  }

  function handleRowCommit(event) {
    // 単価の入力欄からフォーカスが外れたらカンマ区切りに整形
    if (event.target.classList.contains('i-price')) {
      var rowEl = event.target.closest('.row');
      var row = rowEl && findRow(rowEl.dataset.id);
      if (row) event.target.value = row.price ? comma(row.price) : '';
    } else if (event.target.classList.contains('i-qty')) {
      var rowEl2 = event.target.closest('.row');
      var row2 = rowEl2 && findRow(rowEl2.dataset.id);
      if (row2) event.target.value = formatQty(row2.qty);
    }
  }

  function handleRowDelete(event) {
    var btn = event.target.closest('.i-del');
    if (!btn) return;
    var rowEl = btn.closest('.row');
    if (!rowEl) return;

    var id = rowEl.dataset.id;
    rows = rows.filter(function (r) { return r.id !== id; });
    rowEl.remove();

    if (!rows.length) addRowToDOM({ name: '', qty: 1, price: 0 });

    renderPreview();
  }

  // フォーム項目に初期値を流し込む（明細行は別途）
  function applyFieldDefaults() {
    $('issuerName').value = DEFAULTS.issuerName;
    $('issuerAddress').value = DEFAULTS.issuerAddress;
    $('issuerPhone').value = DEFAULTS.issuerPhone;
    $('issuerEmail').value = DEFAULTS.issuerEmail;
    $('clientName').value = DEFAULTS.clientName;
    $('clientHonorific').value = DEFAULTS.clientHonorific;
    $('subject').value = DEFAULTS.subject;
    $('quoteNo').value = DEFAULTS.quoteNo;
    $('notes').value = DEFAULTS.notes;
    $('conditions').value = DEFAULTS.conditions;
    $('taxRate').value = DEFAULTS.taxRate;
    $('issueDate').value = todayISO();
    $('validityPreset').value = DEFAULTS.validityPreset;
    syncValidityFromIssueDate();
  }

  function resetForm() {
    applyFieldDefaults();
    renderAllRows();
    renderPreview();
  }

  /* ---------------------------------------------------------
     初期化
     --------------------------------------------------------- */

  function init() {
    applyFieldDefaults();

    rowSeq = 0;
    rows = [];
    DEFAULT_ROWS.forEach(function (r) { addRowToDOM(r); });

    $('quoteForm').addEventListener('input', function (event) {
      if (event.target.closest('.row')) return;
      if (event.target.id === 'validUntil') handleValidUntilInput();
      if (event.target.id === 'issueDate') syncValidityFromIssueDate();
      renderPreview();
    });
    $('quoteForm').addEventListener('change', function (event) {
      if (event.target.closest('.row')) return;
      if (event.target.id === 'validityPreset') handleValidityPresetChange();
      renderPreview();
    });

    var rowsContainer = $('rowsContainer');
    rowsContainer.addEventListener('input', handleRowInput);
    rowsContainer.addEventListener('change', handleRowInput);
    rowsContainer.addEventListener('focusout', handleRowCommit);
    rowsContainer.addEventListener('click', handleRowDelete);

    $('addRowBtn').addEventListener('click', function () {
      var el = addRowToDOM({ name: '', qty: 1, price: 0 });
      renderPreview();
      var input = el.querySelector('.i-name');
      if (input) input.focus();
    });

    $('printBtn').addEventListener('click', function () {
      window.print();
    });

    $('resetBtn').addEventListener('click', resetForm);

    renderPreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =========================================================
   シェア（バイラル導線） — 既存機能には触れない独立モジュール
   ========================================================= */
(function () {
  'use strict';

  var SHARE_URL  = "https://www.reveriel.com/mitsumori-pdf/";
  var CARD_TITLE = "見積書 作成ツール";
  var CARD_SUB   = "無料で使える見積書PDF生成ツール";
  var CARD_FOOT  = "www.reveriel.com/mitsumori-pdf";
  var FILE_NAME  = "mitsumori-pdf.png";

  var SHARE_TEXT = "無料で使える見積書PDF生成ツール";

  function byId(id) { return document.getElementById(id); }

  function shareText() { return SHARE_TEXT; }
  function cardSub()   { return CARD_SUB; }

  function openExternal(url) {
    if (!url) return;
    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function buildTweetUrl() {
    return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText()) +
      '&url=' + encodeURIComponent(SHARE_URL);
  }
  function buildLineUrl() {
    return 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(SHARE_URL);
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:absolute;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function copyText(text) {
    return new Promise(function (resolve) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(
            function () { resolve(true); },
            function () { resolve(fallbackCopy(text)); }
          );
          return;
        }
      } catch (e) { /* fallthrough */ }
      resolve(fallbackCopy(text));
    });
  }

  /* ---- 共有カード（1200 x 630） ---- */
  var CARD_W = 1200, CARD_H = 630;
  var FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif';

  function roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCard(ctx) {
    var g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    g.addColorStop(0, '#1e3a8a');
    g.addColorStop(1, '#2f5bd0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.beginPath(); ctx.arc(CARD_W - 130, 80, 230, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(CARD_W - 300, CARD_H + 10, 160, 0, Math.PI * 2); ctx.fill();

    var PAD = 80;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.font = '600 24px ' + FONT;
    ctx.fillText('FREE TOOL — BROWSER ONLY', PAD, 106);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 74px ' + FONT;
    ctx.fillText(CARD_TITLE, PAD, 260);

    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = '500 34px ' + FONT;
    ctx.fillText(cardSub(), PAD, 336);

    ctx.fillStyle = 'rgba(255,255,255,.85)';
    roundRect(ctx, PAD, CARD_H - 138, 64, 6, 3);
    ctx.fill();

    ctx.fillStyle = '#dbe6ff';
    ctx.font = '700 30px ' + FONT;
    ctx.fillText(CARD_FOOT, PAD, CARD_H - 80);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.font = '500 22px ' + FONT;
    ctx.fillText('無料・登録不要', CARD_W - PAD, CARD_H - 80);
    ctx.textAlign = 'left';
  }

  function renderCardBlob() {
    return new Promise(function (resolve) {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = CARD_W;
        canvas.height = CARD_H;
        var ctx = canvas.getContext('2d');
        var finish = function () {
          if (canvas.toBlob) canvas.toBlob(function (b) { resolve(b); }, 'image/png');
          else resolve(null);
        };
        var draw = function () {
          try { drawCard(ctx); } catch (e) {}
          finish();
        };
        if (document.fonts && document.fonts.ready) {
          var drawn = false;
          var once = function () { if (drawn) { return; } drawn = true; draw(); };
          document.fonts.ready.then(once).catch(once);
          // fonts.ready が解決しない環境でも保存ボタンが固まらないようタイムアウト競走させる
          setTimeout(once, 1500);
        } else {
          draw();
        }
      } catch (e) { resolve(null); }
    });
  }

  function flash(el, text) {
    if (!el) return;
    var old = el.textContent;
    el.textContent = text;
    setTimeout(function () { el.textContent = old; }, 1800);
  }

  function init() {
    var xBtn = byId('shareXBtn');
    var lBtn = byId('shareLineBtn');
    var cBtn = byId('shareCopyBtn');
    var sBtn = byId('shareSaveBtn');
    var urlText = byId('shareUrlText');
    if (!xBtn || !lBtn || !cBtn) return;

    if (urlText) urlText.textContent = SHARE_URL;

    xBtn.addEventListener('click', function () { openExternal(buildTweetUrl()); });
    lBtn.addEventListener('click', function () { openExternal(buildLineUrl()); });

    var copyLabel = byId('shareCopyLabel');
    var resetTimer = null;
    cBtn.addEventListener('click', function () {
      var original = copyLabel ? copyLabel.textContent : '';
      copyText(SHARE_URL).then(function (ok) {
        if (!copyLabel) return;
        copyLabel.textContent = ok ? 'コピーしました' : 'コピーできませんでした';
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(function () { copyLabel.textContent = original; }, 1800);
      });
    });

    if (sBtn) {
      var saveLabel = byId('shareSaveLabel');
      sBtn.addEventListener('click', function () {
        if (sBtn.disabled) return;
        sBtn.disabled = true;
        renderCardBlob().then(function (blob) {
          sBtn.disabled = false;
          if (!blob) { flash(saveLabel, '画像を生成できませんでした'); return; }
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = FILE_NAME;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
