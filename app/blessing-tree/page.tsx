"use client";

import React, { useState, useEffect, useRef } from "react";

interface LocalSub {
  id: string;
  tableNo: number;
  nickname: string;
  message?: string;
  hasPhoto: boolean;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export default function GuestBlessingPage() {
  const [tableNo, setTableNo] = useState<number>(1);
  const [nickname, setNickname] = useState<string>("");
  const [isRepresentative, setIsRepresentative] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const [mySubmissions, setMySubmissions] = useState<LocalSub[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. 載入 LocalStorage 歷史提交紀錄與查詢暫停狀態
  useEffect(() => {
    // 取得暫停狀態
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/blessing-tree?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setIsPaused(data.settings?.isPaused || false);
          
          // 若有本地紀錄，更新他們的最新狀態
          const localData = localStorage.getItem("wedding_tree_subs");
          if (localData) {
            const parsed: LocalSub[] = JSON.parse(localData);
            const updated = parsed.map((local) => {
              const serverMatch = data.submissions.find((s: any) => s.id === local.id);
              if (serverMatch) {
                return { ...local, status: serverMatch.status };
              }
              return local;
            });
            localStorage.setItem("wedding_tree_subs", JSON.stringify(updated));
            setMySubmissions(updated);
          }
        }
      } catch (err) {
        console.error("Failed to check status", err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000); // 每 5 秒同步一次狀態
    return () => clearInterval(interval);
  }, []);

  // 2. 前端圖片壓縮處理 (Canvas)
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSubmitError("請選擇有效的圖片檔案！");
      return;
    }

    setIsCompressing(true);
    setSubmitError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setSubmitError("圖片解碼失敗");
          setIsCompressing(false);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // 壓縮成 JPEG, 畫質 0.75
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
        setPhotoBase64(compressedBase64);
        setPhotoPreview(compressedBase64);
        setIsCompressing(false);
      };
      img.onerror = () => {
        setSubmitError("圖片載入失敗");
        setIsCompressing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoBase64(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 3. 提交表單
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPaused) {
      setSubmitError("現場祝福上傳目前已暫停，請稍後再試！");
      return;
    }

    setSubmitError(null);
    
    // 基本驗證
    if (!nickname.trim()) {
      setSubmitError("請輸入您的暱稱！");
      return;
    }

    if (!message.trim() && !photoBase64) {
      setSubmitError("請輸入祝福留言或上傳照片！");
      return;
    }

    if (message && message.trim().length > 100) {
      setSubmitError("留言字數限制在 100 字以內");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/blessing-tree", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tableNo,
          nickname: nickname.trim(),
          isRepresentative,
          message: message.trim() || undefined,
          photo: photoBase64
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "送出失敗，請稍後再試");
      }

      const newSub = await response.json();

      // 儲存至本地歷史紀錄
      const newLocalSub: LocalSub = {
        id: newSub.id,
        tableNo: newSub.tableNo,
        nickname: newSub.nickname,
        message: newSub.message,
        hasPhoto: !!newSub.photo,
        status: newSub.status,
        createdAt: newSub.createdAt
      };

      const updatedHistory = [newLocalSub, ...mySubmissions];
      localStorage.setItem("wedding_tree_subs", JSON.stringify(updatedHistory));
      setMySubmissions(updatedHistory);

      // 清空表單
      setMessage("");
      removePhoto();
      setSubmitSuccess(true);
      
      // 3 秒後自動關閉成功畫面
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 4000);

    } catch (err: any) {
      setSubmitError(err.message || "發生未知錯誤");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 flex flex-col justify-between relative">
      {/* 觀看祝福之樹浮動入口 */}
      <div className="absolute top-4 right-4 z-30">
        <a
          href="/blessing-tree/screen"
          className="px-4 py-1.5 bg-rose/10 hover:bg-rose/20 text-rose border border-rose/15 rounded-full text-xs font-semibold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          觀看祝福之樹
        </a>
      </div>

      {/* 頂部 Header */}
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold text-ink tracking-wider font-en">The Blessing Tree</h1>
        <p className="text-sm text-ink/70 mt-1">
          留下您的真心祝福與合照，與我們一同灌溉祝福之樹。
        </p>
      </header>

      {/* 系統暫停展示 */}
      {isPaused ? (
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full glass-card rounded-3xl p-8 border border-white/40 shadow-card text-center my-8">
          <div className="w-16 h-16 bg-sage/20 text-sage rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">祝福上傳暫停中</h2>
          <p className="text-sm text-ink/75 leading-relaxed">
            目前現場大螢幕正在進行特別活動，祝福之樹上傳通道暫時關閉。請留意主持人公告，待會將再次開放喔！
          </p>
        </div>
      ) : submitSuccess ? (
        /* 提交成功畫面 */
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full glass-card rounded-3xl p-8 border border-white/40 shadow-card text-center my-8 animate-fade-in">
          <div className="w-20 h-20 bg-rose/20 text-rose rounded-full flex items-center justify-center mb-6 animate-bounce">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">送出成功！</h2>
          <p className="text-sm text-ink/80 leading-relaxed mb-4">
            您的祝福已送往祝福之樹！<br />
            留言會長出枝葉，照片果實經審核後即將於大螢幕綻放。
          </p>
          <button
            onClick={() => setSubmitSuccess(false)}
            className="px-6 py-2.5 bg-rose text-white rounded-full text-sm font-medium hover:bg-rose/90 transition-all shadow-md active:scale-95"
          >
            再寫一則祝福
          </button>
        </div>
      ) : (
        /* 祝福表單 */
        <main className="flex-1 max-w-md mx-auto w-full glass-card rounded-3xl p-6 border border-white/50 shadow-card mb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 桌號選擇與代表性 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink/75 mb-1.5">
                  座位桌號 <span className="text-rose">*</span>
                </label>
                <select
                  value={tableNo}
                  onChange={(e) => setTableNo(Number(e.target.value))}
                  className="w-full bg-white/60 border border-ink/10 rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose"
                >
                  {Array.from({ length: 25 }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num}>
                      第 {num} 桌
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/75 mb-1.5">
                  您的暱稱 <span className="text-rose">*</span>
                </label>
                <input
                  type="text"
                  placeholder="如: 國中同學 小明"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={15}
                  required
                  className="w-full bg-white/60 border border-ink/10 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose"
                />
              </div>
            </div>

            {/* 代表整桌留言 */}
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                id="isRepresentative"
                checked={isRepresentative}
                onChange={(e) => setIsRepresentative(e.target.checked)}
                className="w-4 h-4 rounded text-rose focus:ring-rose accent-rose border-ink/15 cursor-pointer"
              />
              <label htmlFor="isRepresentative" className="text-xs font-medium text-ink/80 select-none cursor-pointer">
                是否代表整桌賓客留言？
              </label>
            </div>

            {/* 留言輸入 */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-ink/75">
                  祝福留言
                </label>
                <span className="text-[10px] text-ink/50">
                  {message.length} / 100 字
                </span>
              </div>
              <textarea
                placeholder="寫下給新人的溫馨祝福（字數約 10~50 字長出來的枝葉最漂亮喔！）..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={100}
                rows={3}
                className="w-full bg-white/60 border border-ink/10 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose resize-none"
              />
            </div>

            {/* 照片上傳 */}
            <div>
              <label className="block text-xs font-semibold text-ink/75 mb-1.5">
                上傳合照 / 回憶照片
              </label>
              
              {photoPreview ? (
                /* 照片預覽 */
                <div className="relative rounded-xl overflow-hidden border border-ink/10 bg-white/50 aspect-video flex items-center justify-center group">
                  <img
                    src={photoPreview}
                    alt="上傳相片預覽"
                    className="max-h-full max-w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.6} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                /* 上傳按鈕 */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-ink/15 hover:border-rose/50 rounded-xl p-6 text-center cursor-pointer transition-all bg-white/30 hover:bg-white/55 flex flex-col items-center justify-center min-h-[120px]"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoChange}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  {isCompressing ? (
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 border-2 border-rose border-t-transparent rounded-full animate-spin mb-2"></div>
                      <span className="text-xs text-ink/70">圖片壓縮優化中...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-rose/10 text-rose rounded-full flex items-center justify-center mb-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-ink/80">拍攝照片或選擇相片</span>
                      <span className="text-[10px] text-ink/50 mt-1">檔案將自動壓縮以利流暢播放</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 錯誤提示 */}
            {submitError && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs flex items-center gap-2 border border-red-100 animate-shake">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{submitError}</span>
              </div>
            )}

            {/* 送出按鈕 */}
            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="w-full py-3 bg-rose text-white rounded-xl text-sm font-semibold hover:bg-rose/95 disabled:bg-rose/40 disabled:cursor-not-allowed transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>傳送中...</span>
                </>
              ) : (
                <span>送出我的祝福</span>
              )}
            </button>
          </form>
        </main>
      )}

      {/* 我的上傳紀錄 */}
      {mySubmissions.length > 0 && (
        <section className="max-w-md mx-auto w-full glass-card rounded-3xl p-5 border border-white/50 shadow-card">
          <h3 className="text-xs font-bold text-ink/75 mb-3 tracking-wider flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-rose" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
            我的祝福與照片紀錄
          </h3>
          <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
            {mySubmissions.map((sub) => (
              <div
                key={sub.id}
                className="flex items-start justify-between p-3 rounded-xl bg-white/40 border border-white/80 text-xs gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-ink">第 {sub.tableNo} 桌 {sub.nickname}</span>
                    {sub.message && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose/10 text-rose font-medium">
                        有留言
                      </span>
                    )}
                    {sub.hasPhoto && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sage/10 text-sage font-medium">
                        有照片
                      </span>
                    )}
                  </div>
                  {sub.message && (
                    <p className="text-ink/70 line-clamp-2 leading-relaxed mb-0.5">{sub.message}</p>
                  )}
                  <span className="text-[9px] text-ink/40">
                    {new Date(sub.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  {sub.status === "pending" ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200 animate-pulse">
                      審核中 (未熟果)
                    </span>
                  ) : sub.status === "approved" ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-green-100 text-green-800 border border-green-200">
                      已長在樹上
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-red-100 text-red-800 border border-red-200">
                      已落地 (堆積中)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 底部頁尾 */}
      <footer className="text-center text-[10px] text-ink/40 mt-6">
        &copy; 2026 Wedding Day. All Rights Reserved.
      </footer>
    </div>
  );
}
