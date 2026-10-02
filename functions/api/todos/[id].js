// PATCH /api/todos/:id - タスク完了状態の切り替え
// DELETE /api/todos/:id - タスク削除

export async function onRequestPatch({ params, request, env }) {
  try {
    if (!env.DB) {
      return Response.json(
        { success: false, error: "Database binding (DB) is not configured" },
        { status: 500 }
      );
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return Response.json(
        { success: false, error: "Invalid task ID" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const completed = body.completed ? 1 : 0;
    
    // completed_at の設定 (completed=1なら現在時刻、0ならnull)
    const query = completed === 1
      ? "UPDATE todos SET completed = 1, completed_at = datetime('now', 'localtime') WHERE id = ?1"
      : "UPDATE todos SET completed = 0, completed_at = NULL WHERE id = ?1";

    const result = await env.DB.prepare(query).bind(id).run();

    if (result.meta.changes === 0) {
      return Response.json(
        { success: false, error: "Task not found" },
        { status: 404 }
      );
    }

    const { results } = await env.DB.prepare(
      "SELECT id, title, completed, completed_at, created_at FROM todos WHERE id = ?1"
    ).bind(id).all();

    return Response.json({
      success: true,
      data: results[0]
    });
  } catch (err) {
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function onRequestDelete({ params, env }) {
  try {
    if (!env.DB) {
      return Response.json(
        { success: false, error: "Database binding (DB) is not configured" },
        { status: 500 }
      );
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return Response.json(
        { success: false, error: "Invalid task ID" },
        { status: 400 }
      );
    }

    const result = await env.DB.prepare("DELETE FROM todos WHERE id = ?1").bind(id).run();

    if (result.meta.changes === 0) {
      return Response.json(
        { success: false, error: "Task not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: "Task deleted successfully"
    });
  } catch (err) {
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
