import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Alcohol,
  BudgetTierLabel,
  FoodCategory,
  Mood,
  Purpose,
  ScreenId,
  SortOrder,
} from "./types";

interface MeetingForm {
  purpose?: Purpose;
  minMembers?: number;
  regionId?: string; // GET /stations 권역 id
  station?: string;
  // 역 좌표 — GET /stations 응답에서 선택 시 함께 저장(백엔드 station_places 미시드 대비 back-compat).
  stationLat?: number;
  stationLng?: number;
  deadline?: string; // "YYYY-MM-DD HH:MM"
}

export type Role = "host" | "participant";

interface ParticipantForm {
  alcohol?: Alcohol;
  // 예산은 단일선택(시안 24). 선택 시 BUDGET_TIERS 한 구간의 라벨 + min~max(원)가 채워진다.
  //   · budgetLabel: 허브 요약/체크 표시용 (예: "1만원 이하")
  //   · budgetMin/Max: 추천엔진 3.3(priceLevel 밴드)에 그대로 전달
  budgetLabel?: BudgetTierLabel;
  budgetMin?: number;
  budgetMax?: number;
  foods: FoodCategory[];
  mood?: Mood;
}

interface AppState {
  screen: ScreenId;
  goto: (s: ScreenId) => void;
  back: () => void;
  meeting: MeetingForm;
  participant: ParticipantForm;
  patchMeeting: (patch: Partial<MeetingForm>) => void;
  patchParticipant: (patch: Partial<ParticipantForm>) => void;
  voted: string | null;
  setVoted: (id: string | null) => void;
  // F-16 정렬 기준. SortSelectScreen 에서 정해 VoteScreen 이 읽음 (세션 공유 1회 선택).
  // 기본값은 "reviews" — CLAUDE.md 3.6 "미선택 시 기본값=리뷰순".
  sort: SortOrder;
  setSort: (s: SortOrder) => void;
  // 백엔드 세션 식별자. host=생성 응답에서, 참여자=초대 링크(?groupId=)에서 채워진다.
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  // 역할 — host(모임 생성자) / participant(링크 입장). 인증·권한 분기에 사용.
  role: Role | null;
  setRole: (r: Role | null) => void;
}

// 초대 링크의 groupId = 백엔드 sessionId.
function getInitialGroupId(): string | null {
  if (typeof window === "undefined") return null;
  const g = new URLSearchParams(window.location.search).get("groupId");
  return g != null && g !== "" ? g : null;
}

const AppCtx = createContext<AppState | null>(null);

// 진입 분기: 초대 링크(?groupId=)로 들어오면 "참여자", 아니면 "생성자".
//   · groupId 있음 → 참여자 → participant-onboarding 부터 시작
//   · groupId 없음 → 생성자 → 기존대로 intro 부터 시작
// TODO(backend): 지금은 groupId 존재 여부만 보는 목업이다. 백엔드 연동 시
//   여기(또는 participant-onboarding 진입 시점)에서 groupId 유효성/마감 여부를
//   검증하고, 잘못된 링크면 안내 화면으로 보내도록 교체한다.
function getInitialScreen(): ScreenId {
  if (typeof window === "undefined") return "intro";
  const groupId = new URLSearchParams(window.location.search).get("groupId");
  return groupId != null && groupId !== "" ? "participant-onboarding" : "intro";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<ScreenId>(getInitialScreen);
  const [, setHistory] = useState<ScreenId[]>([]);
  const [meeting, setMeeting] = useState<MeetingForm>({});
  const [participant, setParticipant] = useState<ParticipantForm>({
    foods: [],
  });
  const [voted, setVoted] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOrder>("reviews");
  const initialGroupId = getInitialGroupId();
  const [sessionId, setSessionId] = useState<string | null>(initialGroupId);
  const [role, setRole] = useState<Role | null>(
    initialGroupId != null ? "participant" : null,
  );

  const goto = useCallback(
    (s: ScreenId) => {
      setHistory((h) => [...h, screen]);
      setScreen(s);
    },
    [screen],
  );

  const back = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      setScreen(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }, []);

  const patchMeeting = useCallback(
    (patch: Partial<MeetingForm>) => setMeeting((prev) => ({ ...prev, ...patch })),
    [],
  );
  const patchParticipant = useCallback(
    (patch: Partial<ParticipantForm>) =>
      setParticipant((prev) => ({ ...prev, ...patch })),
    [],
  );

  const value = useMemo<AppState>(
    () => ({
      screen,
      goto,
      back,
      meeting,
      participant,
      patchMeeting,
      patchParticipant,
      voted,
      setVoted,
      sort,
      setSort,
      sessionId,
      setSessionId,
      role,
      setRole,
    }),
    [
      screen,
      goto,
      back,
      meeting,
      participant,
      patchMeeting,
      patchParticipant,
      voted,
      sort,
      sessionId,
      role,
    ],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(AppCtx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}
