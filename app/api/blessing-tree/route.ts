import { NextRequest, NextResponse } from "next/server";
import { getSubmissions, getSettings, addSubmission } from "@/lib/blessing-tree-db";

// 設定 Next.js 15 路由為動態，不進行靜態快取
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const submissions = await getSubmissions();
    const settings = await getSettings();
    
    return NextResponse.json(
      { submissions, settings },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate"
        }
      }
    );
  } catch (error) {
    console.error("GET API Error:", error);
    return NextResponse.json({ error: "無法取得資料" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const settings = await getSettings();
    if (settings.isPaused) {
      return NextResponse.json(
        { error: "現場祝福上傳目前已暫停，請稍後再試！" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { tableNo, nickname, isRepresentative, message, photo } = body;

    // 基本驗證
    if (!tableNo || typeof tableNo !== "number" || tableNo < 1 || tableNo > 25) {
      return NextResponse.json({ error: "請提供有效的桌號 (1-25)！" }, { status: 400 });
    }
    if (!nickname || typeof nickname !== "string" || nickname.trim() === "") {
      return NextResponse.json({ error: "請輸入您的暱稱！" }, { status: 400 });
    }

    // 驗證是否至少提供留言或照片之一
    if ((!message || typeof message !== "string" || message.trim() === "") && !photo) {
      return NextResponse.json({ error: "請提供祝福留言或上傳照片！" }, { status: 400 });
    }

    // 字數驗證 (僅在有留言時驗證)
    if (message && typeof message === "string") {
      const len = message.trim().length;
      if (len > 100) {
        return NextResponse.json({ error: "留言字數需限制在 100 字以內！" }, { status: 400 });
      }
    }

    const newSub = await addSubmission({
      tableNo,
      nickname: nickname.trim(),
      isRepresentative: !!isRepresentative,
      message: message ? message.trim() : undefined,
      photo: photo || undefined
    });

    return NextResponse.json(newSub, { status: 201 });
  } catch (error) {
    console.error("POST API Error:", error);
    return NextResponse.json({ error: "伺服器處理錯誤" }, { status: 500 });
  }
}
