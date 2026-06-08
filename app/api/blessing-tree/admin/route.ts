import { NextRequest, NextResponse } from "next/server";
import {
  updateSubmissionStatus,
  updateSubmissionMessage,
  updateSettings,
  resetDb
} from "@/lib/blessing-tree-db";

export const dynamic = "force-dynamic";

const ADMIN_PASSCODE = "wedding2026";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (code !== ADMIN_PASSCODE) {
      return NextResponse.json({ error: "未經授權的存取，密碼錯誤！" }, { status: 401 });
    }

    const body = await request.json();
    const { action, id, message, settings } = body;

    if (!action) {
      return NextResponse.json({ error: "未指定操作！" }, { status: 400 });
    }

    switch (action) {
      case "approve":
        if (!id) return NextResponse.json({ error: "缺少 ID" }, { status: 400 });
        const approvedSub = await updateSubmissionStatus(id, "approved");
        if (!approvedSub) return NextResponse.json({ error: "找不到該筆資料" }, { status: 404 });
        return NextResponse.json({ success: true, submission: approvedSub });

      case "reject":
        if (!id) return NextResponse.json({ error: "缺少 ID" }, { status: 400 });
        const rejectedSub = await updateSubmissionStatus(id, "rejected");
        if (!rejectedSub) return NextResponse.json({ error: "找不到該筆資料" }, { status: 404 });
        return NextResponse.json({ success: true, submission: rejectedSub });

      case "editMessage":
        if (!id || typeof message !== "string") {
          return NextResponse.json({ error: "缺少 ID 或無效的留言內容" }, { status: 400 });
        }
        const editedSub = await updateSubmissionMessage(id, message);
        if (!editedSub) return NextResponse.json({ error: "找不到該筆資料" }, { status: 404 });
        return NextResponse.json({ success: true, submission: editedSub });

      case "updateSettings":
        if (!settings || typeof settings !== "object") {
          return NextResponse.json({ error: "無效的設定格式" }, { status: 400 });
        }
        const newSettings = await updateSettings(settings);
        return NextResponse.json({ success: true, settings: newSettings });

      case "reset":
        const resetData = await resetDb();
        return NextResponse.json({ success: true, message: "資料庫已重設", data: resetData });

      default:
        return NextResponse.json({ error: "不支援的操作項目" }, { status: 400 });
    }
  } catch (error) {
    console.error("Admin API Error:", error);
    return NextResponse.json({ error: "伺服器處理錯誤" }, { status: 500 });
  }
}
