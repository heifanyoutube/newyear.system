// functions/api/track.js

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const db = env.GIFT_KV; // 綁定的 KV 資料庫名稱，稍後在後台設定

    // 取得單號 (從網址參數 ?id=xxx)
    const id = url.searchParams.get("id");

    // === GET: 查詢進度 ===
    if (request.method === "GET") {
        if (!id) return new Response("Missing ID", { status: 400 });
        
        const data = await db.get(id);
        if (!data) return new Response(JSON.stringify({ error: "查無此單" }), { status: 404 });
        
        return new Response(data, {
            headers: { "Content-Type": "application/json" }
        });
    }

    // === POST: 更新/簽收/建立 ===
    if (request.method === "POST") {
        const body = await request.json();
        const action = body.action;
        const reqId = body.id; // POST 請求裡的 ID

        if (!reqId) return new Response("Missing ID", { status: 400 });

        let record = await db.get(reqId);
        record = record ? JSON.parse(record) : null;

        // 1. 建立新訂單
        if (action === "create") {
            const newOrder = {
                id: reqId,
                recipient: body.recipient,
                status: "已攬收",
                location: "秘密禮物倉庫",
                history: [{ time: new Date().toLocaleString("zh-TW", {timeZone: "Asia/Taipei"}), status: "已攬收", location: "秘密禮物倉庫" }],
                signature: null
            };
            await db.put(reqId, JSON.stringify(newOrder));
            return new Response(JSON.stringify({ success: true, msg: "建立成功" }));
        }

        if (!record) return new Response(JSON.stringify({ error: "單號不存在" }), { status: 404 });

        // 2. 更新位置
        if (action === "update") {
            record.status = body.status;
            record.location = body.location;
            record.history.push({
                time: new Date().toLocaleString("zh-TW", {timeZone: "Asia/Taipei"}),
                status: body.status,
                location: body.location
            });
        }

        // 3. 簽收
        if (action === "sign") {
            record.status = "已簽收";
            record.signature = body.signature; // Base64 圖片
            record.history.push({
                time: new Date().toLocaleString("zh-TW", {timeZone: "Asia/Taipei"}),
                status: "已簽收",
                location: "家人手中"
            });
        }

        // 儲存回資料庫
        await db.put(reqId, JSON.stringify(record));
        return new Response(JSON.stringify({ success: true }));
    }

    return new Response("Method not allowed", { status: 405 });
}
