// GET /api/todos - タスク一覧取得
// POST /api/todos - 新規タスク作成

export async function onRequestGet({ env }) {
  try {
    if (!env.DB) {
      return Response.json(
        { success: false, error: "Database binding (DB) is not configured" },
        { status: 500 }
      );
    }

    const { results } = await env.DB.prepare(
      "SELECT id, title, completed, completed_at, created_at FROM todos ORDER BY id DESC"
    ).all();

    return Response.json({
      success: true,
      data: results || []
    });
  } catch (err) {
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) {
      return Response.json(
        { success: false, error: "Database binding (DB) is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const title = (body.title || "").trim();

    if (!title) {
      return Response.json(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }

    const info = await env.DB.prepare(
      "INSERT INTO todos (title, completed, completed_at) VALUES (?1, 0, NULL)"
    ).bind(title).run();

    const newId = info.meta.last_row_id;
    const { results } = await env.DB.prepare(
      "SELECT id, title, completed, completed_at, created_at FROM todos WHERE id = ?1"
    ).bind(newId).all();

    return Response.json(
      {
        success: true,
        data: results[0] || { id: newId, title, completed: 0, completed_at: null }
      },
      { status: 201 }
    );
  } catch (err) {
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
