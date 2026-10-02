-- Cloudflare D1 todos テーブル定義
CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_todos_completed_completed_at ON todos(completed, completed_at);

-- 初期シードデータ
INSERT INTO todos (title, completed, completed_at) VALUES 
('要件定義とStitchデザインの作成', 1, datetime('now', 'localtime')),
('Cloudflare D1データベース設計', 1, datetime('now', 'localtime')),
('APIエンドポイントの実装', 0, NULL),
('本番ダッシュボード画面の結合テスト', 0, NULL);
