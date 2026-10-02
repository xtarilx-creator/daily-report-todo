/**
 * 日報作成 Todo ダッシュボード - フロントエンドロジック (app.js)
 * Cloudflare Pages Functions / D1 API 連携 & LocalStorage フォールバック対応
 */

const RECIPIENT = 'h.osawa@tcdigital.jp';
const SUBJECT = 'Antigravityテスト';
const LOCAL_STORAGE_KEY = 'daily_report_todos_store';

let todos = [];
let isUsingApi = false;

// --- 日付ヘルパー ---
function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function updateDateHeader() {
  const d = new Date();
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const formatted = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${days[d.getDay()]})`;
  const el = document.getElementById('currentDateBadge');
  if (el) el.textContent = formatted;
}

// --- API 通信 / LocalStorage 同期レイヤー ---
async function initData() {
  updateDateHeader();
  try {
    const res = await fetch('/api/todos');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        todos = data.data;
        isUsingApi = true;
        setDbStatus(true, 'Cloudflare D1 接続中');
        render();
        return;
      }
    }
    throw new Error('API not available');
  } catch (err) {
    // APIが動いていない環境（直接ブラウザで開いた場合など）はLocalStorageを利用
    isUsingApi = false;
    setDbStatus(false, 'Local モード (D1準備中)');
    loadFromLocalStorage();
    render();
  }
}

function setDbStatus(connected, text) {
  const badge = document.getElementById('dbStatusBadge');
  const label = document.getElementById('dbStatusText');
  if (!badge || !label) return;

  label.textContent = text;
  if (connected) {
    badge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container border border-surface-highest text-xs text-tertiary';
  } else {
    badge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container border border-surface-highest text-xs text-on-surface-variant';
  }
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) {
    try {
      todos = JSON.parse(saved);
      return;
    } catch (e) {
      console.error(e);
    }
  }
  // 初回シードデータ
  const today = getTodayDateString();
  todos = [
    { id: 1, title: '要件定義とStitchデザインの作成', completed: 1, completed_at: today },
    { id: 2, title: 'Cloudflare D1データベース設計', completed: 1, completed_at: today },
    { id: 3, title: 'APIエンドポイントの実装', completed: 0, completed_at: null },
    { id: 4, title: '本番ダッシュボード画面の結合テスト', completed: 0, completed_at: null }
  ];
  saveToLocalStorage();
}

function saveToLocalStorage() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(todos));
}

// --- CRUD 操作 ---
async function addTodo(title) {
  const trimmed = title.trim();
  if (!trimmed) return;

  if (isUsingApi) {
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          todos.unshift(json.data);
          render();
          return;
        }
      }
    } catch (e) {
      console.error('API Error, falling back to local:', e);
    }
  }

  // Local フォールバック
  const newTodo = {
    id: Date.now(),
    title: trimmed,
    completed: 0,
    completed_at: null,
    created_at: new Date().toISOString()
  };
  todos.unshift(newTodo);
  saveToLocalStorage();
  render();
}

async function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;

  const nextCompleted = todo.completed ? 0 : 1;
  const today = getTodayDateString();

  if (isUsingApi) {
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: nextCompleted })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          todo.completed = json.data.completed;
          todo.completed_at = json.data.completed_at;
          render();
          return;
        }
      }
    } catch (e) {
      console.error('API Error, falling back to local:', e);
    }
  }

  // Local フォールバック
  todo.completed = nextCompleted;
  todo.completed_at = nextCompleted ? today : null;
  saveToLocalStorage();
  render();
}

async function deleteTodo(id) {
  if (isUsingApi) {
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        todos = todos.filter(t => t.id !== id);
        render();
        return;
      }
    } catch (e) {
      console.error('API Error, falling back to local:', e);
    }
  }

  // Local フォールバック
  todos = todos.filter(t => t.id !== id);
  saveToLocalStorage();
  render();
}

// --- 日報本文テンプレート生成ロジック ---
function generateDailyReportText() {
  const today = getTodayDateString();
  
  // completed_at が本日のタスクを抽出
  const completedToday = todos.filter(t => {
    if (!t.completed) return false;
    if (!t.completed_at) return false;
    // YYYY-MM-DD の前方一致で本日分を判定
    return t.completed_at.startsWith(today);
  });

  let taskListText = '';
  if (completedToday.length === 0) {
    taskListText = '・（本日の完了タスクはありません）';
  } else {
    taskListText = completedToday.map(t => `・${t.title}`).join('\n');
  }

  return `大澤様

お疲れ様です。本日の日報をお送りいたします。

【本日の完了タスク】
${taskListText}

以上です。引き続きよろしくお願いいたします。`;
}

// --- レンダリング & KPI 更新 ---
function render() {
  const today = getTodayDateString();
  const pendingTodos = todos.filter(t => !t.completed);
  const completedTodayTodos = todos.filter(t => t.completed && t.completed_at && t.completed_at.startsWith(today));

  // 1. KPI リボンの更新
  const pendingCount = pendingTodos.length;
  const completedCount = completedTodayTodos.length;
  const total = pendingCount + completedCount;
  const rate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  document.getElementById('statIncomplete').textContent = pendingCount;
  document.getElementById('statCompleted').textContent = completedCount;
  document.getElementById('statRate').textContent = `${rate}%`;
  document.getElementById('statTotalCount').textContent = `${completedCount}/${total} Tasks`;
  document.getElementById('taskTotalBadge').textContent = `${todos.length} 件`;
  document.getElementById('pendingBadge').textContent = `${pendingCount} 件`;
  document.getElementById('completedBadge').textContent = `${completedCount} 件`;

  // 円形プログレスバーの更新 (dashoffset: 100 - rate)
  const circle = document.getElementById('progressCircle');
  if (circle) {
    circle.style.strokeDashoffset = Math.max(0, 100 - rate);
  }

  // 2. 未完了リストのレンダリング
  const pendingListEl = document.getElementById('pendingList');
  if (pendingTodos.length === 0) {
    pendingListEl.innerHTML = `
      <li class="py-6 px-4 text-center text-xs text-on-surface-variant bg-surface-lowest/50 rounded-lg border border-dashed border-surface-highest">
        未完了のタスクはありません 🎉
      </li>`;
  } else {
    pendingListEl.innerHTML = pendingTodos.map(t => `
      <li class="group p-3 rounded-lg bg-surface-lowest/70 border border-surface-highest hover:border-secondary/50 flex items-center justify-between gap-3 transition-all">
        <label class="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
          <input 
            type="checkbox" 
            class="w-4 h-4 rounded bg-surface-container border-surface-highest text-tertiary focus:ring-tertiary focus:ring-offset-surface cursor-pointer"
            onchange="toggleTodo(${t.id})"
          />
          <span class="text-sm text-on-surface truncate group-hover:text-white transition-colors">${escapeHtml(t.title)}</span>
        </label>
        <button 
          type="button" 
          onclick="deleteTodo(${t.id})" 
          class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-surface-high text-on-surface-variant hover:text-red-400 transition-all"
          title="タスクを削除"
        >
          <span class="material-symbols-outlined text-base">delete</span>
        </button>
      </li>
    `).join('');
  }

  // 3. 本日完了リストのレンダリング
  const completedListEl = document.getElementById('completedList');
  if (completedTodayTodos.length === 0) {
    completedListEl.innerHTML = `
      <li class="py-5 px-4 text-center text-xs text-on-surface-variant bg-surface-lowest/50 rounded-lg border border-dashed border-surface-highest">
        本日完了したタスクはまだありません
      </li>`;
  } else {
    completedListEl.innerHTML = completedTodayTodos.map(t => `
      <li class="group p-3 rounded-lg bg-surface-lowest/40 border border-surface-highest/60 flex items-center justify-between gap-3 transition-all">
        <label class="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
          <input 
            type="checkbox" 
            checked 
            class="w-4 h-4 rounded bg-tertiary border-tertiary text-tertiary focus:ring-0 cursor-pointer"
            onchange="toggleTodo(${t.id})"
          />
          <span class="text-sm text-on-surface-variant line-through truncate">${escapeHtml(t.title)}</span>
        </label>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[10px] text-tertiary/80 font-mono px-1.5 py-0.5 rounded bg-tertiary-container/20 border border-tertiary/20">完了</span>
          <button 
            type="button" 
            onclick="deleteTodo(${t.id})" 
            class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-surface-high text-on-surface-variant hover:text-red-400 transition-all"
            title="タスクを削除"
          >
            <span class="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </li>
    `).join('');
  }

  // 4. 日報本文テキストエリアの自動更新
  const textarea = document.getElementById('reportBodyTextarea');
  if (textarea) {
    textarea.value = generateDailyReportText();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// --- クリップボードコピー & トースト通知 ---
function showToast(message) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMessage');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.remove('translate-y-12', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.add('translate-y-12', 'opacity-0', 'pointer-events-none');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 2500);
}

function copySingleField(elementId, successMsg) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.textContent.trim();
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg);
  }).catch(() => {
    showToast('コピーに失敗しました');
  });
}

// イベントリスナーの登録
document.addEventListener('DOMContentLoaded', () => {
  // 初期化
  initData();

  // フォーム送信
  const form = document.getElementById('todoForm');
  const input = document.getElementById('taskInput');
  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (input.value.trim()) {
        addTodo(input.value);
        input.value = '';
      }
    });
  }

  // 日報全文コピー
  const copyBtn = document.getElementById('copyFullReportBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const textarea = document.getElementById('reportBodyTextarea');
      const body = textarea ? textarea.value : '';
      const fullReport = `宛先: ${RECIPIENT}
件名: ${SUBJECT}

${body}`;

      navigator.clipboard.writeText(fullReport).then(() => {
        showToast('日報全文（宛先・件名・本文）をコピーしました！');
      }).catch(() => {
        showToast('コピーに失敗しました');
      });
    });
  }

  // メーラー起動
  const mailerBtn = document.getElementById('launchMailerBtn');
  if (mailerBtn) {
    mailerBtn.addEventListener('click', () => {
      const textarea = document.getElementById('reportBodyTextarea');
      const body = encodeURIComponent(textarea ? textarea.value : '');
      const subject = encodeURIComponent(SUBJECT);
      window.location.href = `mailto:${RECIPIENT}?subject=${subject}&body=${body}`;
    });
  }
});
