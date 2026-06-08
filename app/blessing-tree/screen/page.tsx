"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Submission, TreeSettings } from "@/lib/blessing-tree-db";

// 螢幕大小設計
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 800;

interface FruitPos {
  id: string;
  tableNo: number;
  nickname: string;
  message?: string;
  photo?: string;
  status: "pending" | "approved" | "rejected";
  x: number;
  y: number;
  rad: number;
}

export default function BigScreenTreePage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [settings, setSettings] = useState<TreeSettings>({
    isPaused: false,
    isClickDisabled: false,
    isSlideshowMode: false
  });

  const [currentShowcase, setCurrentShowcase] = useState<Submission | null>(null);
  const [showcaseQueue, setShowcaseQueue] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [activeSlideshowIndex, setActiveSlideshowIndex] = useState<number>(-1);

  // 儲存先前的提交狀態，用於比對哪些是「剛被審核通過」的
  const previousSubsRef = useRef<Submission[]>([]);
  const isFirstLoadRef = useRef<boolean>(true);
  const showcaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const slideshowTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. 定時取得最新資料 (每 3 秒)
  const fetchTreeData = async () => {
    try {
      const res = await fetch(`/api/blessing-tree?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      
      const newSubs: Submission[] = data.submissions || [];
      setSettings(
        data.settings || { isPaused: false, isClickDisabled: false, isSlideshowMode: false }
      );
      setSubmissions(newSubs);

      // 比對資料，找出新核准的留言/照片 (狀態從 pending -> approved，或全新直接 approved)
      if (!isFirstLoadRef.current) {
        const newlyApproved = newSubs.filter((newSub) => {
          if (newSub.status !== "approved" || !newSub.photo) return false;
          const oldSub = previousSubsRef.current.find((o) => o.id === newSub.id);
          // 之前沒有，或是之前狀態不是 approved
          return !oldSub || oldSub.status !== "approved";
        });

        if (newlyApproved.length > 0) {
          setShowcaseQueue((prev) => [...prev, ...newlyApproved]);
        }
      } else {
        isFirstLoadRef.current = false;
      }

      previousSubsRef.current = newSubs;
    } catch (err) {
      console.error("Failed to fetch tree data", err);
    }
  };

  useEffect(() => {
    fetchTreeData();
    const interval = setInterval(fetchTreeData, 3000);
    return () => {
      clearInterval(interval);
      if (showcaseTimerRef.current) clearTimeout(showcaseTimerRef.current);
      if (slideshowTimerRef.current) clearTimeout(slideshowTimerRef.current);
    };
  }, []);

  // 2. 處理新相片彈出展示佇列 (5 秒中央彈出效果)
  useEffect(() => {
    if (currentShowcase || showcaseQueue.length === 0) return;

    // 取得佇列中第一個項目
    const nextShowcase = showcaseQueue[0];
    setCurrentShowcase(nextShowcase);
    setShowcaseQueue((prev) => prev.slice(1));

    // 5 秒後關閉
    showcaseTimerRef.current = setTimeout(() => {
      setCurrentShowcase(null);
    }, 5000);
  }, [showcaseQueue, currentShowcase]);

  // 3. 樹木分枝骨架定義
  const skeletonBranches = useMemo(() => [
    // Trunk
    { id: "trunk", d: "M 500 760 Q 495 620 500 500", strokeWidth: 24, delay: "0s" },
    // Limbs
    { id: "limb-l", d: "M 500 500 Q 430 480 380 430", strokeWidth: 16, delay: "0.4s" },
    { id: "limb-c", d: "M 500 500 Q 500 440 500 380", strokeWidth: 16, delay: "0.4s" },
    { id: "limb-r", d: "M 500 500 Q 570 480 620 430", strokeWidth: 16, delay: "0.4s" },
    // Secondary branches
    { id: "branch-lo", d: "M 380 430 Q 300 410 250 350", strokeWidth: 10, delay: "0.8s" },
    { id: "branch-li", d: "M 380 430 Q 390 380 400 330", strokeWidth: 10, delay: "0.8s" },
    { id: "branch-cl", d: "M 500 380 Q 460 330 460 280", strokeWidth: 10, delay: "0.8s" },
    { id: "branch-cr", d: "M 500 380 Q 540 330 540 280", strokeWidth: 10, delay: "0.8s" },
    { id: "branch-ri", d: "M 620 430 Q 610 380 600 330", strokeWidth: 10, delay: "0.8s" },
    { id: "branch-ro", d: "M 620 430 Q 700 410 750 350", strokeWidth: 10, delay: "0.8s" }
  ], []);

  const tableBranchStartPoints = useMemo(() => [
    { x: 250, y: 350, startAngle: -105, endAngle: -65 },  // Left-Outer (Tables 1-4)
    { x: 400, y: 330, startAngle: -60, endAngle: -25 },   // Left-Inner (Tables 5-8)
    { x: 460, y: 280, startAngle: -20, endAngle: -5 },    // Center-Left (Tables 9-12)
    { x: 540, y: 280, startAngle: 5, endAngle: 20 },      // Center-Right (Tables 13-16)
    { x: 600, y: 330, startAngle: 25, endAngle: 60 },     // Right-Inner (Tables 17-20)
    { x: 750, y: 350, startAngle: 65, endAngle: 105 }     // Right-Outer (Tables 21-25)
  ], []);

  const mainBranches = useMemo(() => {
    const branches = [];
    
    const getTableBranch = (tableNo: number) => {
      let groupIndex = 0;
      let indexInGroup = 0;
      let groupSize = 4;

      if (tableNo >= 1 && tableNo <= 4) {
        groupIndex = 0;
        indexInGroup = tableNo - 1;
        groupSize = 4;
      } else if (tableNo >= 5 && tableNo <= 8) {
        groupIndex = 1;
        indexInGroup = tableNo - 5;
        groupSize = 4;
      } else if (tableNo >= 9 && tableNo <= 12) {
        groupIndex = 2;
        indexInGroup = tableNo - 9;
        groupSize = 4;
      } else if (tableNo >= 13 && tableNo <= 16) {
        groupIndex = 3;
        indexInGroup = tableNo - 13;
        groupSize = 4;
      } else if (tableNo >= 17 && tableNo <= 20) {
        groupIndex = 4;
        indexInGroup = tableNo - 17;
        groupSize = 4;
      } else if (tableNo >= 21 && tableNo <= 25) {
        groupIndex = 5;
        indexInGroup = tableNo - 21;
        groupSize = 5;
      }

      const group = tableBranchStartPoints[groupIndex];
      const ratio = groupSize > 1 ? indexInGroup / (groupSize - 1) : 0.5;
      const theta = group.startAngle + ratio * (group.endAngle - group.startAngle);
      const rad = (theta * Math.PI) / 180;
      
      const length = 90 + (tableNo % 3) * 15;
      const endX = group.x + length * Math.sin(rad);
      const endY = group.y - length * Math.cos(rad);
      const ctrlX = group.x + length * 0.45 * Math.sin(rad * 0.85);
      const ctrlY = group.y - length * 0.45 * Math.cos(rad * 0.85);

      return {
        tableNo,
        startX: group.x,
        startY: group.y,
        endX,
        endY,
        ctrlX,
        ctrlY,
        rad,
        length
      };
    };

    for (let i = 1; i <= 25; i++) {
      branches.push(getTableBranch(i));
    }
    return branches;
  }, [tableBranchStartPoints]);

  // 4. 篩選留言與照片
  const { messagesByTable, photoSubmissions } = useMemo(() => {
    const messages: Record<number, Submission[]> = {};
    const photos: Submission[] = [];

    // 初始化 1-25 桌
    for (let i = 1; i <= 25; i++) {
      messages[i] = [];
    }

    submissions.forEach((sub) => {
      if (sub.message && (sub.status === "approved" || sub.isSeed)) {
        messages[sub.tableNo].push(sub);
      }
      if (sub.photo) {
        photos.push(sub);
      }
    });

    return { messagesByTable: messages, photoSubmissions: photos };
  }, [submissions]);

  // 5. 根據照片狀態，計算果實位置（含落果堆積邏輯）
  const fruitPositions = useMemo(() => {
    const positions: FruitPos[] = [];
    
    // 記錄每一個「落地槽」堆積的果實數量
    const groundSlots: Record<number, number> = {};

    photoSubmissions.forEach((sub) => {
      const branch = mainBranches[sub.tableNo - 1];
      if (!branch) return;

      // 預設在主枝幹末端周圍叢生，加入隨機性防止完全重疊
      const seedIndex = sub.id.startsWith("seed") 
        ? (parseInt(sub.id.split("-")[1]) || 1) 
        : (parseInt(sub.id.split("-")[1]?.slice(-2)) || 3);
      const angleOffset = (seedIndex * 1.5) % (Math.PI * 2);
      const dist = 18 + (seedIndex % 3) * 6;

      const fruitBranchX = branch.endX + Math.sin(branch.rad + angleOffset) * dist;
      const fruitBranchY = branch.endY - Math.cos(branch.rad + angleOffset) * dist;

      let x = fruitBranchX;
      let y = fruitBranchY;

      if (sub.status === "rejected") {
        // 落果：掉落到最下方 (Y 軸在 735 上下)
        // 根據 X 軸的位置分配至堆積槽，使落果能疊起來
        const slotX = Math.round(branch.endX / 25) * 25; // 每 25px 一個槽
        const countInSlot = groundSlots[slotX] || 0;
        groundSlots[slotX] = countInSlot + 1;

        x = slotX + (seedIndex % 3 === 0 ? 5 : seedIndex % 3 === 1 ? -5 : 0);
        y = 745 - countInSlot * 12; // 每個落果高度 12px 往上疊
      }

      positions.push({
        id: sub.id,
        tableNo: sub.tableNo,
        nickname: sub.nickname,
        message: sub.message,
        photo: sub.photo,
        status: sub.status,
        x,
        y,
        rad: branch.rad
      });
    });

    return positions;
  }, [photoSubmissions, mainBranches]);

  // 6. 輪播模式計時器
  const approvedPhotos = useMemo(() => {
    return photoSubmissions.filter((p) => p.status === "approved");
  }, [photoSubmissions]);

  useEffect(() => {
    if (slideshowTimerRef.current) clearInterval(slideshowTimerRef.current);

    if (settings.isSlideshowMode && approvedPhotos.length > 0 && !currentShowcase && !selectedSubmission) {
      slideshowTimerRef.current = setInterval(() => {
        setActiveSlideshowIndex((prevIndex) => (prevIndex + 1) % approvedPhotos.length);
      }, 7000); // 7 秒輪播一次
    } else {
      setActiveSlideshowIndex(-1);
    }

    return () => {
      if (slideshowTimerRef.current) clearInterval(slideshowTimerRef.current);
    };
  }, [settings.isSlideshowMode, approvedPhotos, currentShowcase, selectedSubmission]);

  // 7. 點擊果實開啟卡片
  const handleFruitClick = (fruit: FruitPos) => {
    if (settings.isClickDisabled) return;
    if (fruit.status === "rejected") return; // 落地果實不可點擊

    const matchedSub = submissions.find((s) => s.id === fruit.id);
    if (matchedSub) {
      setSelectedSubmission(matchedSub);
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden relative select-none">
      {/* 頂部浮動導覽入口 */}
      <div className="absolute top-6 left-6 z-30 flex items-center gap-3">
        <a
          href="/blessing-tree"
          className="px-4 py-2 bg-white/12 hover:bg-white/20 backdrop-blur-md border border-white/15 text-white rounded-full text-xs font-semibold tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          我要送出祝福
        </a>
        <a
          href="/blessing-tree/admin"
          className="px-4 py-2 bg-white/12 hover:bg-white/20 backdrop-blur-md border border-white/15 text-white rounded-full text-xs font-semibold tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          後台管理端
        </a>
      </div>

      {/* 嵌入動畫專屬 CSS */}
      <style>{`
        /* 星空微閃 */
        @keyframes starBlink {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .star { animation: starBlink 3s infinite ease-in-out; }
        
        /* 樹枝生長 */
        @keyframes branchGrow {
          from { stroke-dashoffset: 1000; }
          to { stroke-dashoffset: 0; }
        }
        .branch-path {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: branchGrow 2.5s cubic-bezier(0.1, 0.8, 0.2, 1) forwards;
        }

        /* 葉子/吊飾長出 */
        @keyframes popIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .leaf-pop {
          transform-origin: center;
          animation: popIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        /* 未熟果實閃爍 */
        @keyframes pulseUnripe {
          0%, 100% { opacity: 0.4; r: 9px; filter: drop-shadow(0 0 2px rgba(255,255,255,0.2)); }
          50% { opacity: 0.8; r: 12px; filter: drop-shadow(0 0 8px rgba(255,255,255,0.6)); }
        }
        .fruit-unripe {
          animation: pulseUnripe 1.8s infinite ease-in-out;
        }

        /* 成熟果實微動 */
        @keyframes pulseRipe {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(217, 143, 149, 0.4)); }
          50% { transform: scale(1.15); filter: drop-shadow(0 0 12px rgba(217, 143, 149, 0.8)); }
        }
        .fruit-ripe {
          transform-origin: center;
          animation: pulseRipe 2.5s infinite ease-in-out;
          cursor: pointer;
        }

        /* 落果重力掉落 */
        .fruit-rejected {
          transition: cx 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                      cy 1.5s cubic-bezier(0.55, 0.055, 0.675, 0.19);
        }

        /* 新生審核通過爆破效果 */
        @keyframes burstParticle {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--x), var(--y)) scale(0); opacity: 0; }
        }
        .particle {
          animation: burstParticle 1.2s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
        }
      `}</style>

      {/* 1. 星空深邃背景 */}
      <div 
        className="absolute inset-0 z-0 transition-all duration-1000"
        style={{
          background: "radial-gradient(circle at 50% 70%, #17101c 0%, #08040a 100%)"
        }}
      >
        {/* 背景隨機繁星 */}
        <div className="absolute inset-0 opacity-40">
          {Array.from({ length: 45 }).map((_, i) => (
            <div
              key={i}
              className="star absolute w-1 h-1 bg-white rounded-full"
              style={{
                top: `${(Math.sin(i * 1.7) * 0.5 + 0.5) * 75}%`,
                left: `${(Math.cos(i * 2.3) * 0.5 + 0.5) * 100}%`,
                animationDelay: `${(i % 5) * 0.6}s`
              }}
            />
          ))}
        </div>
        
        {/* 浪漫香檳粉光暈 */}
        <div className="absolute top-[25%] left-[25%] w-[45vw] h-[45vw] bg-rose/5 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[15%] w-[55vw] h-[55vw] bg-champagne/5 rounded-full blur-[200px] pointer-events-none" />
      </div>

      {/* 2. 動態繪製 SVG 祝福之樹 */}
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full h-full relative z-10 select-none pointer-events-auto"
      >
        {/* 樹木分枝骨架渲染 */}
        {skeletonBranches.map((b) => (
          <path
            key={b.id}
            d={b.d}
            stroke={b.id === "trunk" ? "url(#trunkGrad)" : "url(#branchGrad)"}
            strokeWidth={b.strokeWidth}
            strokeLinecap="round"
            fill="none"
            className="branch-path"
            style={{ 
              animationDelay: b.delay,
              filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.45))" 
            }}
          />
        ))}
        
        {/* 地面橫線 (Ground) */}
        <line x1="100" y1="755" x2="900" y2="755" stroke="rgba(255,255,255,0.06)" strokeWidth="3" strokeLinecap="round" />

        {/* 渲染主枝幹與留言分岔 */}
        {mainBranches.map((branch) => {
          const tableMsgs = messagesByTable[branch.tableNo] || [];

          return (
            <g key={branch.tableNo}>
              {/* 主枝幹 */}
              <path
                d={`M ${branch.startX} ${branch.startY} Q ${branch.ctrlX} ${branch.ctrlY} ${branch.endX} ${branch.endY}`}
                stroke="url(#branchGrad)"
                strokeWidth={7 - Math.min(branch.length / 50, 3)}
                strokeLinecap="round"
                fill="none"
                className="branch-path"
                style={{ 
                  animationDelay: "1.2s",
                  filter: "drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35))"
                }}
              />

              {/* 根據該桌留言長出子枝葉 */}
              {tableMsgs.map((msg, idx) => {
                // 分布在主枝幹長度 25% 至 90% 區間
                const t = 0.25 + (idx * 0.6) / Math.max(tableMsgs.length, 1);
                
                // 近似計算二次貝氏曲線上的座標點
                const ptX = (1 - t) * (1 - t) * branch.startX + 2 * (1 - t) * t * branch.ctrlX + t * t * branch.endX;
                const ptY = (1 - t) * (1 - t) * branch.startY + 2 * (1 - t) * t * branch.ctrlY + t * t * branch.endY;

                // 左右交錯交替角度
                const side = idx % 2 === 0 ? 1 : -1;
                const sproutAngle = branch.rad + side * (35 * Math.PI / 180);
                
                // 枝芽長度取決於留言長度
                const textLen = msg.message?.length || 0;
                const sproutLen = 22 + Math.min(textLen, 50) * 0.4;

                const leafX = ptX + sproutLen * Math.sin(sproutAngle);
                const leafY = ptY - sproutLen * Math.cos(sproutAngle);

                return (
                  <g key={msg.id} className="leaf-pop" style={{ animationDelay: `${idx * 0.15}s` }}>
                    {/* 子樹枝 */}
                    <line
                      x1={ptX}
                      y1={ptY}
                      x2={leafX}
                      y2={leafY}
                      stroke="#49363c"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    
                    {/* 綠色/粉色發光葉子 */}
                    <path
                      d={`M ${leafX} ${leafY} C ${leafX + 6 * side} ${leafY - 6} ${leafX + 12 * side} ${leafY - 2} ${leafX + 14 * side} ${leafY + 6} C ${leafX + 8 * side} ${leafY + 12} ${leafX + 2 * side} ${leafY + 8} ${leafX} ${leafY}`}
                      fill={msg.isRepresentative ? "url(#goldLeafGrad)" : "url(#leafGrad)"}
                      opacity="0.85"
                    />

                    {/* 吊飾圓圈 (Ornament) */}
                    <circle
                      cx={leafX + 16 * side}
                      cy={leafY + 14}
                      r="12"
                      fill="rgba(255, 255, 255, 0.12)"
                      stroke={msg.isRepresentative ? "#f6ecd9" : "rgba(255, 255, 255, 0.35)"}
                      strokeWidth="1"
                      style={{ backdropFilter: "blur(4px)" }}
                    />
                    <text
                      x={leafX + 16 * side}
                      y={leafY + 17}
                      fontSize="8"
                      fill="#ffffff"
                      textAnchor="middle"
                      fontWeight="bold"
                      opacity="0.9"
                    >
                      {branch.tableNo}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* 渲染照片果實 (Fruits) */}
        {fruitPositions.map((fruit) => {
          if (fruit.status === "pending") {
            // 待審核：半透明閃爍果實
            return (
              <circle
                key={fruit.id}
                cx={fruit.x}
                cy={fruit.y}
                r="10"
                fill="rgba(255,255,255,0.15)"
                stroke="#fffaf5"
                strokeWidth="1.5"
                strokeDasharray="3,3"
                className="fruit-unripe"
              />
            );
          } else if (fruit.status === "approved") {
            // 審核通過：發光彩色成熟果實
            return (
              <g
                key={fruit.id}
                onClick={() => handleFruitClick(fruit)}
                className="fruit-ripe"
                style={{ transformBox: "fill-box" }}
              >
                <circle
                  cx={fruit.x}
                  cy={fruit.y}
                  r="13"
                  fill="url(#fruitGrad)"
                />
                <circle
                  cx={fruit.x - 3}
                  cy={fruit.y - 3}
                  r="3"
                  fill="rgba(255,255,255,0.4)"
                />
                {/* 輕微的桌號標示 */}
                <text
                  x={fruit.x}
                  y={fruit.y + 3}
                  fontSize="7"
                  fill="#49363c"
                  fontWeight="bold"
                  textAnchor="middle"
                  opacity="0.85"
                >
                  {fruit.tableNo}
                </text>
              </g>
            );
          } else {
            // 審核不通過：掉落至地面堆積的落果
            return (
              <g key={fruit.id} className="fruit-rejected">
                <circle
                  cx={fruit.x}
                  cy={fruit.y}
                  r="7"
                  fill="url(#rejectedFruitGrad)"
                  opacity="0.75"
                />
              </g>
            );
          }
        })}

        {/* SVG 定義漸層 */}
        <defs>
          {/* 樹幹漸層 */}
          <linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: "#2a1e24" }} />
            <stop offset="50%" style={{ stopColor: "#49363c" }} />
            <stop offset="100%" style={{ stopColor: "#2a1e24" }} />
          </linearGradient>
          {/* 樹枝漸層 */}
          <linearGradient id="branchGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" style={{ stopColor: "#49363c" }} />
            <stop offset="100%" style={{ stopColor: "#674d56" }} />
          </linearGradient>
          {/* 葉子漸層 - 莫蘭迪 Sage 綠 */}
          <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#cbdac9" }} />
            <stop offset="100%" style={{ stopColor: "#8ea48b" }} />
          </linearGradient>
          {/* 金黃葉子漸層 (桌代表) */}
          <linearGradient id="goldLeafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#fff2cc" }} />
            <stop offset="100%" style={{ stopColor: "#d4a373" }} />
          </linearGradient>
          {/* 成熟果實漸層 - 暖玫瑰紅 */}
          <radialGradient id="fruitGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" style={{ stopColor: "#fff0f0" }} />
            <stop offset="40%" style={{ stopColor: "#e69b9e" }} />
            <stop offset="100%" style={{ stopColor: "#c76e73" }} />
          </radialGradient>
          {/* 落地果實漸層 - 黯淡灰褐色 */}
          <radialGradient id="rejectedFruitGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" style={{ stopColor: "#bfa3aa" }} />
            <stop offset="100%" style={{ stopColor: "#6e595e" }} />
          </radialGradient>
        </defs>
      </svg>

      {/* 3. 桌次發光標誌與標題 (底欄) */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex flex-col items-center justify-center pointer-events-none">
        <h2 className="text-xl font-bold text-[#faf0eb] font-en tracking-[0.2em] opacity-90 drop-shadow-md">
          OUR WEDDING BLESSING TREE
        </h2>
        <div className="w-16 h-0.5 bg-rose/40 mt-1.5 mb-1" />
        <p className="text-[10px] text-champagne/60 tracking-wider">
          留言長出枝葉，相片結成果實
        </p>
      </div>

      {/* 4. 新核准相片：大螢幕中央 5 秒強效彈窗 (Showcase Popup) */}
      {currentShowcase && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 backdrop-blur-sm animate-fade-in">
          {/* 爆破粒子特效 */}
          <div className="absolute pointer-events-none">
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i * 15 * Math.PI) / 180;
              const dX = Math.sin(angle) * (180 + Math.random() * 80);
              const dY = -Math.cos(angle) * (180 + Math.random() * 80);
              return (
                <div
                  key={i}
                  className="particle absolute w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: i % 2 === 0 ? "#e69b9e" : "#f6ecd9",
                    boxShadow: "0 0 10px rgba(255,255,255,0.8)",
                    left: 0,
                    top: 0,
                    "--x": `${dX}px`,
                    "--y": `${dY}px`,
                    animationDelay: `${Math.random() * 0.1}s`
                  } as React.CSSProperties}
                />
              );
            })}
          </div>

          {/* 展示卡片 */}
          <div className="w-[90%] max-w-[450px] bg-[#fffcfb] rounded-[32px] p-6 shadow-[0_24px_64px_rgba(73,54,60,0.35)] border border-rose/15 flex flex-col items-center transform scale-100 transition-transform duration-500 animate-scale-up">
            {/* 照片區 */}
            {currentShowcase.photo && (
              <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-inner bg-champagne/10 mb-4 border border-rose/5">
                <img
                  src={currentShowcase.photo}
                  alt="現場祝福相片"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            {/* 桌號與姓名 */}
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose/10 text-rose border border-rose/15">
                第 {currentShowcase.tableNo} 桌
              </span>
              <span className="text-base font-bold text-ink">{currentShowcase.nickname}</span>
              {currentShowcase.isRepresentative && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 font-medium">
                  桌代表
                </span>
              )}
            </div>

            {/* 祝福內容 */}
            {currentShowcase.message ? (
              <p className="text-sm text-ink/85 text-center leading-relaxed font-medium bg-champagne/15 px-4 py-3 rounded-2xl w-full">
                「 {currentShowcase.message} 」
              </p>
            ) : (
              <p className="text-xs text-ink/40 text-center italic mt-1">傳送了一張合照祝福</p>
            )}

            <div className="w-8 h-1.5 bg-rose/20 rounded-full mt-4 animate-pulse" />
          </div>
        </div>
      )}

      {/* 5. 輪播照片展示卡片 (星空浮空相框 - 僅在 Slideshow 啟用且無 Showcase 時展示) */}
      {settings.isSlideshowMode && approvedPhotos.length > 0 && !currentShowcase && activeSlideshowIndex >= 0 && (
        <div className="absolute top-6 right-6 z-30 w-72 bg-white/10 backdrop-blur-md rounded-2xl p-4 shadow-card border border-white/10 flex flex-col animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-champagne tracking-wider">
              MEMORIES SLIDESHOW
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose animate-ping" />
          </div>

          {approvedPhotos[activeSlideshowIndex] && (
            <div 
              key={approvedPhotos[activeSlideshowIndex].id}
              onClick={() => handleFruitClick({
                id: approvedPhotos[activeSlideshowIndex].id,
                tableNo: approvedPhotos[activeSlideshowIndex].tableNo,
                nickname: approvedPhotos[activeSlideshowIndex].nickname,
                message: approvedPhotos[activeSlideshowIndex].message,
                photo: approvedPhotos[activeSlideshowIndex].photo,
                status: approvedPhotos[activeSlideshowIndex].status,
                x: 0,
                y: 0,
                rad: 0
              })}
              className="cursor-pointer group"
            >
              <div className="w-full aspect-[4/3] rounded-xl overflow-hidden mb-2 bg-black/20">
                <img
                  src={approvedPhotos[activeSlideshowIndex].photo}
                  alt="輪播照片"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/90">
                <span className="px-1.5 py-0.5 rounded bg-rose/25 text-rose-200">
                  第 {approvedPhotos[activeSlideshowIndex].tableNo} 桌
                </span>
                <span>{approvedPhotos[activeSlideshowIndex].nickname}</span>
              </div>
              {approvedPhotos[activeSlideshowIndex].message && (
                <p className="text-[9px] text-white/70 line-clamp-1 mt-1 italic">
                  &ldquo;{approvedPhotos[activeSlideshowIndex].message}&rdquo;
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. 手動點擊燈箱 (LightBox Modal) */}
      {selectedSubmission && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedSubmission(null)}
        >
          <div
            className="w-[90%] max-w-[480px] bg-white rounded-3xl p-5 shadow-card max-h-[85vh] flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 頂部關閉 */}
            <div className="flex justify-between items-center mb-3.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-rose/10 text-rose font-bold text-xs border border-rose/15">
                  第 {selectedSubmission.tableNo} 桌
                </span>
                <span className="font-bold text-sm text-ink">{selectedSubmission.nickname}</span>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="w-7 h-7 bg-ink/5 hover:bg-ink/10 text-ink/70 rounded-full flex items-center justify-center transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 照片 */}
            {selectedSubmission.photo && (
              <div className="w-full aspect-[4/3] rounded-xl overflow-hidden mb-4 bg-black/5">
                <img
                  src={selectedSubmission.photo}
                  alt="照片祝福"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* 留言 */}
            {selectedSubmission.message && (
              <p className="text-sm text-ink/80 text-center italic bg-champagne/15 p-4 rounded-xl leading-relaxed">
                「 {selectedSubmission.message} 」
              </p>
            )}

            <div className="text-center text-[9px] text-ink/40 mt-4">
              上傳時間：{new Date(selectedSubmission.createdAt).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
