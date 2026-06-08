import fs from "fs";
import path from "path";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy, 
  writeBatch 
} from "firebase/firestore";

export interface Submission {
  id: string;
  tableNo: number; // 1-25
  nickname: string;
  isRepresentative: boolean;
  message?: string;
  photo?: string; // Base64 data URL or SVG data URL
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  isSeed?: boolean;
}

export interface TreeSettings {
  isPaused: boolean;
  isClickDisabled: boolean;
  isSlideshowMode: boolean;
}

export interface BlessingTreeDb {
  submissions: Submission[];
  settings: TreeSettings;
}

const DB_DIR = process.cwd().endsWith("祝福之樹專案") 
  ? process.cwd() 
  : path.join(process.cwd(), "祝福之樹專案");
const DB_FILE = path.join(DB_DIR, "db.json");

// Firebase 雙模配置檢測
const isFirebaseConfigured = !!(
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
  process.env.FIREBASE_PROJECT_ID
);

let dbInstance: any = null;

if (isFirebaseConfigured) {
  try {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID
    };
    
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    dbInstance = getFirestore(app);
    console.log("Firebase Firestore initialized successfully in Blessing Tree DB Layer.");
  } catch (err) {
    console.error("Failed to initialize Firebase in Blessing Tree DB Layer:", err);
  }
} else {
  console.log("Using local JSON file database for Blessing Tree (Firebase not configured).");
}

// 產生一個帶有漸層和婚禮祝福文字的 SVG Data URL 作為種子照片，模擬真實照片
function generateSeedPhotoSvg(text: string, bgColor1: string, bgColor2: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${bgColor1};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${bgColor2};stop-opacity:1" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <stop offset="0%" style="stop-color:#000;stop-opacity:0.3"/>
        <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#49363c" flood-opacity="0.15" />
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)" />
    <!-- 裝飾邊框 -->
    <rect x="30" y="30" width="740" height="540" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" rx="10" />
    <rect x="40" y="40" width="720" height="520" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1" rx="8" />
    
    <!-- 婚禮英文裝飾 -->
    <text x="400" y="240" font-family="'Times New Roman', serif" font-style="italic" font-size="28" fill="rgba(255, 255, 255, 0.7)" text-anchor="middle" letter-spacing="4">WEDDING DAY</text>
    
    <!-- 祝福主體 -->
    <text x="400" y="320" font-family="'PingFang TC', 'Noto Sans TC', sans-serif" font-weight="bold" font-size="44" fill="#ffffff" text-anchor="middle" filter="url(#shadow)">${text}</text>
    
    <!-- 愛心點綴 -->
    <path d="M400,380 C395,370 380,370 380,385 C380,400 400,415 400,415 C400,415 420,400 420,385 C420,370 405,370 400,380 Z" fill="rgba(255,255,255,0.8)" transform="scale(1.2) translate(-66, -60)" />
  </svg>`;
  
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SEED_SUBMISSIONS: Omit<Submission, "id" | "createdAt">[] = [
  {
    tableNo: 1,
    nickname: "伴娘 晴晴",
    isRepresentative: false,
    message: "親愛的，看著妳走上紅毯，眼眶都濕了。一定要超級幸福喔！永遠愛妳！",
    photo: generateSeedPhotoSvg("Best Wishes to Our Dearest", "#f7d9d9", "#d98f95"),
    status: "approved",
    isSeed: true
  },
  {
    tableNo: 1,
    nickname: "伴郎 小強",
    isRepresentative: false,
    message: "恭喜兄弟娶得美人歸！以後要聽老婆的話，新婚快樂！",
    status: "approved",
    isSeed: true
  },
  {
    tableNo: 2,
    nickname: "叔叔 建立",
    isRepresentative: true,
    message: "祝你們百年好合，早生貴子！家族因你們的結合而更加圓滿。",
    status: "approved",
    isSeed: true
  },
  {
    tableNo: 3,
    nickname: "大學好友 宇軒",
    isRepresentative: false,
    message: "從大學看你們一路走來，終於開花結果！恭喜！今晚不醉不歸！",
    photo: generateSeedPhotoSvg("從大學到婚禮的友情見證", "#a9b9a7", "#49363c"),
    status: "approved",
    isSeed: true
  },
  {
    tableNo: 5,
    nickname: "同事 雅婷",
    isRepresentative: false,
    message: "祝最美的新娘新婚快樂！天天甜蜜，永遠像今天這樣閃耀！",
    status: "approved",
    isSeed: true
  },
  {
    tableNo: 8,
    nickname: "阿公 阿嬤",
    isRepresentative: true,
    message: "祝福乖孫跟孫媳婦白頭偕老，相親相愛一輩子。",
    status: "approved",
    isSeed: true
  },
  {
    tableNo: 10,
    nickname: "國中閨蜜 涵涵",
    isRepresentative: false,
    message: "最棒的妳配上最溫柔的他，這就是愛情的模樣。百年好合！",
    photo: generateSeedPhotoSvg("見證最幸福的時刻", "#f6ecd9", "#d98f95"),
    status: "approved",
    isSeed: true
  },
  {
    tableNo: 12,
    nickname: "主管 偉哥",
    isRepresentative: true,
    message: "恭喜成家立業！祝兩位生活美滿、事業家庭兩得意！",
    status: "approved",
    isSeed: true
  },
  {
    tableNo: 15,
    nickname: "高中同學 志明",
    isRepresentative: false,
    message: "恭喜啊！終於把女神娶回家了，以後要好好疼愛她喔！",
    status: "approved",
    isSeed: true
  },
  {
    tableNo: 18,
    nickname: "表姐 怡君",
    isRepresentative: false,
    message: "看你們兩個這麼有默契，真的是天作之合。永浴愛河！",
    photo: generateSeedPhotoSvg("永遠甜蜜蜜", "#f7d9d9", "#a9b9a7"),
    status: "approved",
    isSeed: true
  },
  {
    tableNo: 20,
    nickname: "社團夥伴 阿慶",
    isRepresentative: false,
    message: "祝最酷的夫妻檔新婚快樂！攜手踏上人生的新冒險！",
    status: "approved",
    isSeed: true
  },
  {
    tableNo: 22,
    nickname: "鄰居 美玲阿姨",
    isRepresentative: true,
    message: "從小看你長大，今天娶媳婦真的好高興。祝你們美滿一生。",
    status: "approved",
    isSeed: true
  },
  {
    tableNo: 25,
    nickname: "研究所同學 冠宇",
    isRepresentative: false,
    message: "恭喜畢業、恭喜結婚！祝雙喜臨門，生活美滿！",
    photo: generateSeedPhotoSvg("璀璨的未來攜手同行", "#49363c", "#d98f95"),
    status: "approved",
    isSeed: true
  }
];

export function getDb(): BlessingTreeDb {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialDb: BlessingTreeDb = {
      submissions: SEED_SUBMISSIONS.map((sub, index) => ({
        ...sub,
        id: `seed-${index + 1}`,
        createdAt: new Date(Date.now() - (15 - index) * 60000).toISOString()
      })),
      settings: {
        isPaused: false,
        isClickDisabled: false,
        isSlideshowMode: false
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), "utf8");
    return initialDb;
  }

  try {
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading database file:", error);
    return { submissions: [], settings: { isPaused: false, isClickDisabled: false, isSlideshowMode: false } };
  }
}

export function saveDb(db: BlessingTreeDb): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function getSubmissions(): Promise<Submission[]> {
  if (dbInstance) {
    try {
      const colRef = collection(dbInstance, "submissions");
      const q = query(colRef, orderBy("createdAt", "asc"));
      const snapshot = await getDocs(q);
      const submissionsList: Submission[] = [];
      
      snapshot.forEach((doc) => {
        submissionsList.push({ id: doc.id, ...doc.data() } as Submission);
      });

      // 首次執行，若資料庫為空則寫入種子資料
      if (submissionsList.length === 0) {
        console.log("Firestore 'submissions' collection is empty. Seeding initial data...");
        const batch = writeBatch(dbInstance);
        const seededList: Submission[] = [];
        
        SEED_SUBMISSIONS.forEach((sub, index) => {
          const id = `seed-${index + 1}`;
          const createdAt = new Date(Date.now() - (15 - index) * 60000).toISOString();
          const newSub: Submission = {
            ...sub,
            id,
            createdAt
          };
          const docRef = doc(dbInstance, "submissions", id);
          batch.set(docRef, JSON.parse(JSON.stringify(newSub)));
          seededList.push(newSub);
        });
        
        await batch.commit();
        return seededList;
      }
      
      return submissionsList;
    } catch (error) {
      console.error("Error fetching submissions from Firestore:", error);
    }
  }

  const db = getDb();
  return db.submissions;
}

export async function addSubmission(submission: Omit<Submission, "id" | "status" | "createdAt">): Promise<Submission> {
  const id = `guest-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const newSubmission: Submission = {
    ...submission,
    id,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  if (dbInstance) {
    try {
      const docRef = doc(dbInstance, "submissions", id);
      await setDoc(docRef, JSON.parse(JSON.stringify(newSubmission)));
      return newSubmission;
    } catch (error) {
      console.error("Error adding submission to Firestore:", error);
    }
  }

  const db = getDb();
  db.submissions.push(newSubmission);
  saveDb(db);
  return newSubmission;
}

export async function updateSubmissionStatus(id: string, status: "approved" | "rejected"): Promise<Submission | null> {
  if (dbInstance) {
    try {
      const docRef = doc(dbInstance, "submissions", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await updateDoc(docRef, { status });
        return { ...(docSnap.data() as Submission), status };
      }
      return null;
    } catch (error) {
      console.error("Error updating submission status in Firestore:", error);
    }
  }

  const db = getDb();
  const index = db.submissions.findIndex((s) => s.id === id);
  if (index === -1) return null;
  
  db.submissions[index].status = status;
  saveDb(db);
  return db.submissions[index];
}

export async function updateSubmissionMessage(id: string, message: string): Promise<Submission | null> {
  if (dbInstance) {
    try {
      const docRef = doc(dbInstance, "submissions", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await updateDoc(docRef, { message });
        return { ...(docSnap.data() as Submission), message };
      }
      return null;
    } catch (error) {
      console.error("Error updating submission message in Firestore:", error);
    }
  }

  const db = getDb();
  const index = db.submissions.findIndex((s) => s.id === id);
  if (index === -1) return null;
  
  db.submissions[index].message = message;
  saveDb(db);
  return db.submissions[index];
}

export async function getSettings(): Promise<TreeSettings> {
  if (dbInstance) {
    try {
      const docRef = doc(dbInstance, "settings", "global");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as TreeSettings;
      } else {
        const initialSettings: TreeSettings = {
          isPaused: false,
          isClickDisabled: false,
          isSlideshowMode: false
        };
        await setDoc(docRef, JSON.parse(JSON.stringify(initialSettings)));
        return initialSettings;
      }
    } catch (error) {
      console.error("Error fetching settings from Firestore:", error);
    }
  }

  const db = getDb();
  return db.settings;
}

export async function updateSettings(settings: Partial<TreeSettings>): Promise<TreeSettings> {
  if (dbInstance) {
    try {
      const docRef = doc(dbInstance, "settings", "global");
      const docSnap = await getDoc(docRef);
      let newSettings: TreeSettings;
      
      if (docSnap.exists()) {
        newSettings = {
          ...(docSnap.data() as TreeSettings),
          ...settings
        };
        await updateDoc(docRef, JSON.parse(JSON.stringify(settings)) as any);
      } else {
        newSettings = {
          isPaused: false,
          isClickDisabled: false,
          isSlideshowMode: false,
          ...settings
        };
        await setDoc(docRef, JSON.parse(JSON.stringify(newSettings)));
      }
      return newSettings;
    } catch (error) {
      console.error("Error updating settings in Firestore:", error);
    }
  }

  const db = getDb();
  db.settings = {
    ...db.settings,
    ...settings
  };
  saveDb(db);
  return db.settings;
}

export async function resetDb(): Promise<BlessingTreeDb> {
  if (dbInstance) {
    try {
      // 刪除 Firestore 中的所有 submissions
      const colRef = collection(dbInstance, "submissions");
      const snapshot = await getDocs(colRef);
      const batch = writeBatch(dbInstance);
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // 重設 settings
      const settingsRef = doc(dbInstance, "settings", "global");
      const initialSettings: TreeSettings = {
        isPaused: false,
        isClickDisabled: false,
        isSlideshowMode: false
      };
      await setDoc(settingsRef, JSON.parse(JSON.stringify(initialSettings)));

      // 重新寫入種子資料
      const seedBatch = writeBatch(dbInstance);
      const seededSubmissions: Submission[] = [];
      
      SEED_SUBMISSIONS.forEach((sub, index) => {
        const id = `seed-${index + 1}`;
        const createdAt = new Date(Date.now() - (15 - index) * 60000).toISOString();
        const newSub: Submission = {
          ...sub,
          id,
          createdAt
        };
        const docRef = doc(dbInstance, "submissions", id);
        seedBatch.set(docRef, JSON.parse(JSON.stringify(newSub)));
        seededSubmissions.push(newSub);
      });
      
      await seedBatch.commit();
      console.log("Firestore database successfully reset and seeded.");
      return {
        submissions: seededSubmissions,
        settings: initialSettings
      };
    } catch (error) {
      console.error("Error resetting database in Firestore:", error);
    }
  }

  if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE);
  }
  return getDb();
}
