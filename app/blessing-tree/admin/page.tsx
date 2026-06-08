"use client";

import React, { useState, useEffect } from "react";
import { Submission, TreeSettings } from "@/lib/blessing-tree-db";

export default function AdminDashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [settings, setSettings] = useState<TreeSettings>({
    isPaused: false,
    isClickDisabled: false,
    isSlideshowMode: false
  });
  
  const [activeTab, setActiveTab] = useState<"photos" | "messages" | "emergency">("photos");
  const [photoFilter, setPhotoFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const correctPasscode = "wedding2026";

  // 1. 檢查 sessionStorage 登入狀態
  useEffect(() => {
    const savedAuth = sessionStorage.getItem("wedding_tree_admin_auth");
    if (savedAuth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  // 2. 定時輪詢資料 (登入後才輪詢)
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/blessing-tree?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setSubmissions(data.submissions || []);
          setSettings(data.settings || { isPaused: false, isClickDisabled: false, isSlideshowMode: false });
        }
      } catch (err) {
        console.error("Failed to load admin data", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // 3. 處理登入提交
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === correctPasscode) {
      setIsAuthenticated(true);
      setAuthError(null);
      sessionStorage.setItem("wedding_tree_admin_auth", "true");
    } else {
      setAuthError("密碼錯誤，請重新輸入！");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("wedding_tree_admin_auth");
    setPasscode("");
  };

  // 4. API 操作助理
  const runAdminAction = async (payload: any) => {
    setActionLoading(payload.id || payload.action || "loading");
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/blessing-tree/admin?code=${correctPasscode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "操作失敗");
      }
      
      setStatusMessage({ text: "操作成功！", type: "success" });
      setTimeout(() => setStatusMessage(null), 3000);
      
      // 手動重新整理資料
      if (payload.action === "reset") {
        setSubmissions(data.data.submissions);
        setSettings(data.data.settings);
      } else {
        // 重新拉取
        const freshRes = await fetch(`/api/blessing-tree?t=${Date.now()}`, { cache: "no-store" });
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          setSubmissions(freshData.submissions || []);
          setSettings(freshData.settings || { isPaused: false, isClickDisabled: false, isSlideshowMode: false });
        }
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || "伺服器錯誤", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  // 審核通過
  const handleApprove = (id: string) => {
    runAdminAction({ action: "approve", id });
  };

  // 審核拒絕
  const handleReject = (id: string) => {
    runAdminAction({ action: "reject", id });
  };

  // 儲存修改的留言
  const handleSaveMessage = (id: string) => {
    runAdminAction({ action: "editMessage", id, message: editingText });
    setEditingId(null);
  };

  // 更新開關設定
  const handleToggleSetting = (key: keyof TreeSettings, val: boolean) => {
    runAdminAction({
      action: "updateSettings",
      settings: { [key]: val }
    });
  };

  // 重設資料庫 (還原基礎樹)
  const handleResetDb = () => {
    const doubleConfirm = window.confirm(
      "【警告】確定要重設祝福之樹資料庫嗎？\n這將清除所有現場賓客提交的資料（包含留言與照片），並回復成初始的基礎樹狀態！此操作不可還原。"
    );
    if (doubleConfirm) {
      runAdminAction({ action: "reset" });
    }
  };

  // 匯出資料為 JSON 檔案
  const handleExportData = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(submissions, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `wedding_blessing_tree_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert("匯出失敗");
    }
  };

  // 5. 篩選資料
  const filteredSubmissions = submissions.filter((sub) => {
    if (tableFilter !== "all" && sub.tableNo !== Number(tableFilter)) return false;
    return true;
  });

  const photoSubsFiltered = filteredSubmissions.filter((sub) => !!sub.photo && sub.status === photoFilter);
  const messageSubs = filteredSubmissions.filter((sub) => !!sub.message);

  if (!isAuthenticated) {
    /* 登入畫面 */
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcf7f2] p-4">
        <div className="w-full max-w-sm glass-card rounded-3xl p-8 border border-white/50 shadow-card">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-rose/10 text-rose rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-ink">祝福之樹管理後台</h1>
            <p className="text-xs text-ink/60 mt-1">請輸入現場管理密碼以存取審核面板</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="請輸入密碼"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-white/70 border border-ink/10 rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose"
                required
                autoFocus
              />
            </div>
            {authError && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg text-center border border-red-100">
                {authError}
              </div>
            )}
            <button
              type="submit"
              className="w-full py-2.5 bg-rose text-white rounded-xl text-sm font-semibold hover:bg-rose/90 transition-all shadow-md active:scale-95"
            >
              認證並登入後台
            </button>
          </form>
          <div className="text-center text-[10px] text-ink/35 mt-6">
            提示密碼為: wedding2026
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf5f0] text-ink p-4 md:p-6 pb-12">
      {/* 頂部 Header */}
      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-wide flex items-center gap-2">
            祝福之樹審核控制台
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sage text-white">
              現場管理版
            </span>
          </h1>
          <p className="text-xs text-ink/60 mt-0.5">現場人員照片即時審核與大螢幕狀態管控</p>
        </div>
        
        <div className="flex items-center gap-2.5">
          <a
            href="/blessing-tree/screen"
            className="px-4 py-1.5 bg-white border border-ink/10 text-rose rounded-xl text-xs font-semibold hover:bg-white/70 shadow-sm transition-all flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            返回祝福之樹
          </a>
          <button
            onClick={handleExportData}
            className="px-4 py-1.5 bg-white border border-ink/10 text-ink/80 rounded-xl text-xs font-semibold hover:bg-white/70 shadow-sm transition-all"
          >
            匯出資料 (JSON)
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-1.5 bg-ink text-white rounded-xl text-xs font-semibold hover:bg-ink/85 shadow-sm transition-all"
          >
            登出
          </button>
        </div>
      </header>

      {/* 主面板 */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* 左側選單 & 篩選器 */}
        <div className="lg:col-span-1 space-y-5">
          {/* 導覽 Tab */}
          <div className="bg-white rounded-2xl p-2.5 shadow-sm border border-ink/5 space-y-1">
            <button
              onClick={() => setActiveTab("photos")}
              className={`w-full text-left px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                activeTab === "photos"
                  ? "bg-rose text-white shadow-sm"
                  : "hover:bg-[#faf5f0] text-ink/75"
              }`}
            >
              <span>照片即時審核</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                activeTab === "photos" ? "bg-white text-rose" : "bg-ink/10 text-ink/80"
              }`}>
                {submissions.filter(s => !!s.photo && s.status === "pending").length} 待辦
              </span>
            </button>
            <button
              onClick={() => setActiveTab("messages")}
              className={`w-full text-left px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                activeTab === "messages"
                  ? "bg-rose text-white shadow-sm"
                  : "hover:bg-[#faf5f0] text-ink/75"
              }`}
            >
              <span>留言內容審核</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                activeTab === "messages" ? "bg-white text-rose" : "bg-ink/10 text-ink/80"
              }`}>
                {submissions.filter(s => !!s.message).length} 總計
              </span>
            </button>
            <button
              onClick={() => setActiveTab("emergency")}
              className={`w-full text-left px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "emergency"
                  ? "bg-rose text-white shadow-sm"
                  : "hover:bg-[#faf5f0] text-ink/75"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              現場緊急管控
            </button>
          </div>

          {/* 共用篩選器 */}
          {activeTab !== "emergency" && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-ink/5 space-y-4">
              <h3 className="text-xs font-bold text-ink/75 border-b border-ink/5 pb-2">資料篩選器</h3>
              
              {/* 桌號篩選 */}
              <div>
                <label className="block text-[10px] font-semibold text-ink/65 mb-1">
                  按桌次篩選
                </label>
                <select
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="w-full bg-[#faf5f0] border border-ink/5 rounded-lg px-2.5 py-1.5 text-xs text-ink focus:outline-none"
                >
                  <option value="all">所有桌次 (全部)</option>
                  {Array.from({ length: 25 }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num}>
                      第 {num} 桌
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* 右側主要工作區域 */}
        <div className="lg:col-span-3">
          
          {/* 操作反饋 */}
          {statusMessage && (
            <div className={`p-3 rounded-xl text-xs font-semibold mb-4 text-center border animate-fade-in ${
              statusMessage.type === "success" 
                ? "bg-green-50 text-green-700 border-green-100" 
                : "bg-red-50 text-red-700 border-red-100"
            }`}>
              {statusMessage.text}
            </div>
          )}

          {/* Tab 1: 照片審核 */}
          {activeTab === "photos" && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border border-ink/5">
                {/* 狀態切換子 Tab */}
                <div className="flex gap-1.5">
                  {(["pending", "approved", "rejected"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setPhotoFilter(filter)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        photoFilter === filter
                          ? "bg-ink text-white"
                          : "bg-[#faf5f0] text-ink/70 hover:bg-ink/5"
                      }`}
                    >
                      {filter === "pending" && "待審核照片 (未熟果)"}
                      {filter === "approved" && "已通過相片 (成熟果)"}
                      {filter === "rejected" && "未通過照片 (落地堆積)"}
                    </button>
                  ))}
                </div>

                <span className="text-[10px] text-ink/50 font-medium">
                  共 {photoSubsFiltered.length} 筆
                </span>
              </div>

              {photoSubsFiltered.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-ink/5 shadow-sm">
                  <div className="w-12 h-12 bg-sage/10 text-sage rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-ink">目前無符合條件的照片</h3>
                  <p className="text-xs text-ink/50 mt-0.5">待賓客上傳後將即時顯示在此</p>
                </div>
              ) : (
                /* 照片卡片網格 */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {photoSubsFiltered.map((sub) => (
                    <div
                      key={sub.id}
                      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-ink/5 flex flex-col justify-between"
                    >
                      {/* 照片預覽 */}
                      <div className="relative aspect-[4/3] bg-black/5 flex items-center justify-center">
                        <img
                          src={sub.photo}
                          alt="賓客照片"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/60 text-white font-bold text-[10px] backdrop-blur-sm">
                          第 {sub.tableNo} 桌
                        </span>
                      </div>
                      
                      {/* 資訊與審核按鈕 */}
                      <div className="p-3.5 space-y-3">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-bold text-ink">{sub.nickname}</span>
                            {sub.isRepresentative && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-bold border border-yellow-200">
                                桌代表
                              </span>
                            )}
                          </div>
                          {sub.message ? (
                            <p className="text-[11px] text-ink/75 leading-relaxed line-clamp-2 italic">
                              &ldquo;{sub.message}&rdquo;
                            </p>
                          ) : (
                            <span className="text-[10px] text-ink/35 italic">無附帶留言</span>
                          )}
                        </div>

                        {/* 按鈕組 */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-ink/5">
                          {sub.status !== "approved" && (
                            <button
                              onClick={() => handleApprove(sub.id)}
                              disabled={actionLoading === sub.id}
                              className="w-full py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 disabled:bg-green-600/40 flex items-center justify-center"
                            >
                              {actionLoading === sub.id ? "處理中..." : "通過 (成熟)"}
                            </button>
                          )}
                          
                          {sub.status !== "rejected" && (
                            <button
                              onClick={() => handleReject(sub.id)}
                              disabled={actionLoading === sub.id}
                              className="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 disabled:bg-red-600/40 flex items-center justify-center"
                            >
                              {actionLoading === sub.id ? "處理中..." : "拒絕 (落地)"}
                            </button>
                          )}

                          {/* 如果是已通過或已拒絕，提供反悔或重新審核機制 */}
                          {sub.status === "approved" && (
                            <button
                              onClick={() => handleReject(sub.id)}
                              disabled={actionLoading === sub.id}
                              className="w-full col-span-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold border border-red-200 transition-all text-center"
                            >
                              改為拒絕 (果實落地)
                            </button>
                          )}
                          {sub.status === "rejected" && (
                            <button
                              onClick={() => handleApprove(sub.id)}
                              disabled={actionLoading === sub.id}
                              className="w-full col-span-2 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg text-xs font-bold border border-green-200 transition-all text-center"
                            >
                              改為通過 (重新掛樹)
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: 留言審核與修改 */}
          {activeTab === "messages" && (
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-ink/5 animate-fade-in">
              <div className="flex justify-between items-center border-b border-ink/5 pb-3 mb-4">
                <h2 className="text-sm font-bold">留言明細表 (共 {messageSubs.length} 筆)</h2>
              </div>

              {messageSubs.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink/40">目前無符合條件的留言。</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#faf5f0] text-ink/60 border-b border-ink/5">
                        <th className="py-2.5 px-3 font-semibold w-16">桌號</th>
                        <th className="py-2.5 px-3 font-semibold w-28">暱稱</th>
                        <th className="py-2.5 px-3 font-semibold">留言內容 (點擊可編輯)</th>
                        <th className="py-2.5 px-3 font-semibold w-24 text-center">照片</th>
                        <th className="py-2.5 px-3 font-semibold w-20 text-center">狀態</th>
                        <th className="py-2.5 px-3 font-semibold w-32 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink/5">
                      {messageSubs.map((sub) => (
                        <tr key={sub.id} className="hover:bg-[#faf5f0]/40 transition-colors">
                          <td className="py-3 px-3 font-bold">第 {sub.tableNo} 桌</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1">
                              <span className="font-semibold">{sub.nickname}</span>
                              {sub.isRepresentative && (
                                <span className="text-[8px] px-1 rounded bg-yellow-100 text-yellow-700">表</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {editingId === sub.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="flex-1 bg-white border border-rose rounded px-2.5 py-1 text-xs text-ink focus:outline-none"
                                />
                                <button
                                  onClick={() => handleSaveMessage(sub.id)}
                                  className="px-2.5 py-1 bg-rose text-white rounded text-[10px] font-bold"
                                >
                                  儲存
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="px-2.5 py-1 bg-ink/5 text-ink/70 rounded text-[10px]"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setEditingId(sub.id);
                                  setEditingText(sub.message || "");
                                }}
                                className="cursor-pointer hover:bg-yellow-50/50 p-1 rounded transition-all italic text-ink/85 border border-transparent hover:border-yellow-200"
                              >
                                &ldquo;{sub.message}&rdquo;
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {sub.photo ? (
                              <div className="flex justify-center">
                                <img
                                  src={sub.photo}
                                  alt="照片"
                                  className="w-10 h-10 object-cover rounded-lg border border-ink/10 cursor-zoom-in hover:scale-105 transition-transform"
                                  onClick={() => setSelectedPhotoUrl(sub.photo!)}
                                />
                              </div>
                            ) : (
                              <span className="text-ink/30 italic">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {sub.status === "approved" || sub.isSeed ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-green-100 text-green-800 border border-green-200">
                                顯示中
                              </span>
                            ) : sub.status === "pending" ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                                審核中
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-red-100 text-red-800 border border-red-200">
                                已隱藏
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {sub.status !== "approved" && !sub.isSeed && (
                                <button
                                  onClick={() => handleApprove(sub.id)}
                                  className="px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 font-bold rounded"
                                >
                                  顯示
                                </button>
                              )}
                              {sub.status !== "rejected" && (
                                <button
                                  onClick={() => handleReject(sub.id)}
                                  className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded"
                                >
                                  隱藏
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: 緊急管控面板 */}
          {activeTab === "emergency" && (
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-ink/5 space-y-6 animate-fade-in">
              <h2 className="text-sm font-bold border-b border-ink/5 pb-2.5 mb-4">現場大螢幕與上傳控制</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 暫停賓客上傳 */}
                <div className="p-4 rounded-2xl bg-[#faf5f0] border border-ink/5 flex flex-col justify-between h-36">
                  <div>
                    <h3 className="text-xs font-bold flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${settings.isPaused ? "bg-red-500" : "bg-green-500"}`} />
                      賓客祝福上傳狀態
                    </h3>
                    <p className="text-[10px] text-ink/65 mt-1 leading-relaxed">
                      開啟後賓客掃描 QR code 將看見維護暫停提示，無法提交新祝福與照片。
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleSetting("isPaused", !settings.isPaused)}
                    className={`w-full py-1.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                      settings.isPaused ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {settings.isPaused ? "開放賓客上傳" : "暫停賓客上傳"}
                  </button>
                </div>

                {/* 大螢幕點擊 */}
                <div className="p-4 rounded-2xl bg-[#faf5f0] border border-ink/5 flex flex-col justify-between h-36">
                  <div>
                    <h3 className="text-xs font-bold flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${settings.isClickDisabled ? "bg-red-500" : "bg-green-500"}`} />
                      螢幕成熟果實點擊
                    </h3>
                    <p className="text-[10px] text-ink/65 mt-1 leading-relaxed">
                      關閉後大螢幕點擊成熟果實將無任何彈窗反應，避免現場滑鼠干擾。
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleSetting("isClickDisabled", !settings.isClickDisabled)}
                    className="w-full py-1.5 bg-ink text-white rounded-xl text-xs font-bold hover:bg-ink/80 transition-all shadow-sm"
                  >
                    {settings.isClickDisabled ? "開啟螢幕點擊" : "關閉螢幕點擊"}
                  </button>
                </div>

                {/* 自動輪播 */}
                <div className="p-4 rounded-2xl bg-[#faf5f0] border border-ink/5 flex flex-col justify-between h-36">
                  <div>
                    <h3 className="text-xs font-bold flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${settings.isSlideshowMode ? "bg-green-500" : "bg-slate-400"}`} />
                      照片自動輪播模式
                    </h3>
                    <p className="text-[10px] text-ink/65 mt-1 leading-relaxed">
                      開啟後大螢幕右上角將浮空自動循環輪播所有審核通過的照片卡片。
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleSetting("isSlideshowMode", !settings.isSlideshowMode)}
                    className={`w-full py-1.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                      settings.isSlideshowMode ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {settings.isSlideshowMode ? "關閉自動輪播" : "開啟自動輪播"}
                  </button>
                </div>
              </div>

              {/* 資料維護核心控制 */}
              <div className="border-t border-ink/5 pt-5 space-y-4">
                <h3 className="text-xs font-bold text-red-600">系統資料維護區</h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleResetDb}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 rounded-xl text-xs font-bold shadow-sm transition-all"
                  >
                    清除資料並重置種子資料
                  </button>
                  <button
                    onClick={handleExportData}
                    className="px-4 py-2 bg-white border border-ink/10 text-ink rounded-xl text-xs font-bold hover:bg-white/70 shadow-sm transition-all"
                  >
                    備份下載所有資料
                  </button>
                </div>
                <p className="text-[10px] text-ink/40">
                  注意：重置資料庫將會刪除所有客人在現場上傳的留言與合照，並恢復預載的 13 筆種子留言。請在活動前測試完畢後進行一次重置，以保證活動開始時樹上沒有測試殘留。
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedPhotoUrl(null)}
        >
          <div
            className="relative max-w-[90vw] max-h-[85vh] rounded-2xl overflow-hidden bg-white p-2 shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPhotoUrl(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center shadow-md transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={selectedPhotoUrl}
              alt="照片預覽"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
