import { useEffect, useMemo } from "react";
import "./App.css";
import { AppProvider, useApp } from "./store";
import {
  SORT_TO_BACKEND,
  isNotReady,
  toRecommendationCards,
  toVoteResults,
  useProgress,
  useRecommendations,
  useSetSort,
  useStage2Vote,
} from "./api";
import { openExternal, shareText } from "./lib/appActions";
import { ToastHost } from "./lib/toast";
import { IntroScreen } from "./screens/IntroScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { LoginConsentScreen } from "./screens/LoginConsentScreen";
import { InviteInputScreen } from "./screens/InviteInputScreen";
import { CreateMeetingScreen } from "./screens/CreateMeetingScreen";
import { InviteGeneratedScreen } from "./screens/InviteGeneratedScreen";
import { VoteWaitingScreen } from "./screens/VoteWaitingScreen";
import { VoteInfoActiveScreen } from "./screens/VoteInfoActiveScreen";
import { VoteInfoClosedScreen } from "./screens/VoteInfoClosedScreen";
import { ParticipantIntroScreen } from "./screens/ParticipantIntroScreen";
import { PreferenceFormScreen } from "./screens/PreferenceFormScreen";
import { FoodSelectScreen } from "./screens/FoodSelectScreen";
import { VoteSentWaitingScreen } from "./screens/VoteSentWaitingScreen";
import { AllSettledScreen } from "./screens/AllSettledScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { RelaxedScreen } from "./screens/RelaxedScreen";
import { SortSelectScreen } from "./screens/SortSelectScreen";
import { VoteScreen } from "./screens/VoteScreen";
import { SecondVoteWaitingScreen } from "./screens/SecondVoteWaitingScreen";
import { VoteCountingScreen } from "./screens/VoteCountingScreen";
import { FinalResultScreen } from "./screens/FinalResultScreen";

// 추천 데이터(useRecommendations)를 폴링·구독하는 화면 집합. 그 외 화면에선 쿼리를 끈다.
// q-done(취향 보낸 뒤 대기) 도 포함 — 집계 완료(status=voting) 신호를 폴링해 자동 전환하기 위함.
const REC_SCREENS = new Set([
  "q-done",
  "finding",
  "relaxed",
  "sort-select",
  "vote-candidates",
  "second-vote-waiting",
  "vote-counting",
  "final-result",
]);

// 화면 라우팅. 화면 자체는 dumb (props 로 핸들러 받음) — goto 결정은 여기 한곳에서.
//
// 호스트 흐름:
//   intro → welcome → login-consent → create-meeting (시트 overlay)
//   → invite-generated → wait-others → vote(=VoteInfoActive) → vote-info-closed
//
// 참여자 흐름:
//   welcome ─(이미 초대 링크 있음)→ invite-input → participant-onboarding
//   → q-hub(=PreferenceForm, 시트 overlay) ─음식─→ q-food → (back) → q-hub
//   → q-done(=VoteSentWaiting) → all-done(=AllSettled) → finding(=Loading)
//   → sort-select → vote-candidates(=Vote) → second-vote-waiting → vote-counting
//   → final-result
function ScreenRouter() {
  const { screen, goto, sort, setSort, setVoted, sessionId } = useApp();

  // 추천 후보 조회(집계 전이면 NOT_READY 폴링). REC 화면에서만 활성.
  const recsQuery = useRecommendations(sessionId, SORT_TO_BACKEND[sort], {
    enabled: sessionId != null && REC_SCREENS.has(screen),
  });
  const recsData = recsQuery.data;
  const recs = recsData != null && !isNotReady(recsData) ? recsData : null;
  const ready = recs != null;
  const relaxed = recs?.relaxed ?? false;

  const cards = useMemo(
    () => (recs ? toRecommendationCards(recs.recommendations) : []),
    [recs],
  );
  const voteResults = useMemo(
    () => (recs ? toVoteResults(recs.recommendations) : []),
    [recs],
  );
  const mapUrlByRec = useMemo(
    () => new Map(cards.map((c) => [c.recId, c.mapUrl])),
    [cards],
  );

  // 참여자 1차 응답 진행률(N/M) — q-done 대기 화면에서만 폴링.
  const progressQuery = useProgress(sessionId, {
    enabled: sessionId != null && screen === "q-done",
  });
  const responded = progressQuery.data?.responded ?? 0;
  const total = progressQuery.data?.total ?? 0;

  const setSortMut = useSetSort(sessionId ?? "");
  const stage2 = useStage2Vote(sessionId ?? "");

  // 대기 게이팅: 취향을 보낸 참여자는 q-done 에 머물며, 집계가 끝나(status=voting,
  // 추천 준비 완료) ready 가 될 때만 다음으로 넘어간다. 그 전엔 탭/타이머로 못 건너뛴다.
  useEffect(() => {
    if (screen === "q-done" && ready) {
      goto("all-done");
    }
  }, [screen, ready, goto]);

  // F-10: 추천이 준비되면 로딩(finding)에서 자동 전환. 완화 발생 시 공지(relaxed) 경유.
  useEffect(() => {
    if (screen === "finding" && ready) {
      goto(relaxed ? "relaxed" : "sort-select");
    }
  }, [screen, ready, relaxed, goto]);

  return (
    <div className="screen-body">
      {screen === "intro" && <IntroScreen />}
      {screen === "welcome" && <WelcomeScreen />}
      {screen === "login-consent" && <LoginConsentScreen />}
      {screen === "invite-input" && <InviteInputScreen />}
      {screen === "create-meeting" && <CreateMeetingScreen />}
      {screen === "invite-generated" && <InviteGeneratedScreen />}
      {screen === "wait-others" && <VoteWaitingScreen />}
      {screen === "vote" && <VoteInfoActiveScreen />}
      {screen === "vote-info-closed" && <VoteInfoClosedScreen />}

      {/* 참여자 흐름 */}
      {screen === "participant-onboarding" && <ParticipantIntroScreen />}
      {screen === "q-hub" && <PreferenceFormScreen />}
      {screen === "q-food" && <FoodSelectScreen />}
      {screen === "q-done" && (
        <VoteSentWaitingScreen votedCount={responded} totalCount={total} />
      )}
      {screen === "all-done" && (
        <AllSettledScreen onComplete={() => goto("finding")} />
      )}
      {/* F-10 추천 로딩(33). 추천이 준비될 때까지 폴링하다가, 준비되면 위 useEffect 가
          정렬 기준 선택(35)으로(완화면 공지 34 경유) 자동 전환한다. */}
      {screen === "finding" && <LoadingScreen />}
      {/* F-11 조건완화 공지(34). "추천 결과 보기" → 정렬 기준 선택(35). */}
      {screen === "relaxed" && (
        <RelaxedScreen onConfirm={() => goto("sort-select")} />
      )}
      {screen === "sort-select" && (
        <SortSelectScreen
          onConfirm={async (s) => {
            try {
              await setSortMut.mutateAsync({ sortMode: SORT_TO_BACKEND[s] });
            } catch (err) {
              console.error("정렬 변경 실패:", err);
            }
            setSort(s);
            goto("vote-candidates");
          }}
        />
      )}
      {screen === "vote-candidates" && (
        <VoteScreen
          sort={sort}
          restaurants={cards}
          onVote={async (recId) => {
            try {
              await stage2.mutateAsync({ restaurantId: recId });
            } catch (err) {
              console.error("투표 실패:", err);
            }
            setVoted(recId);
            goto("second-vote-waiting");
          }}
        />
      )}
      {screen === "second-vote-waiting" && (
        <SecondVoteWaitingScreen onComplete={() => goto("vote-counting")} />
      )}
      {screen === "vote-counting" && (
        <VoteCountingScreen onComplete={() => goto("final-result")} />
      )}
      {screen === "final-result" && (
        <FinalResultScreen
          results={ready ? voteResults : undefined}
          onShare={() => {
            const winner = voteResults[0]?.restaurant;
            const msg = winner
              ? `이번 모임 장소는 '${winner.name}'으로 정해졌어요! · 냠냠투게더`
              : "냠냠투게더에서 모임 장소를 정해보세요!";
            void shareText(msg);
          }}
          onShowMap={(recId) => {
            const url = mapUrlByRec.get(recId);
            if (url) void openExternal(url);
          }}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <ScreenRouter />
      <ToastHost />
    </AppProvider>
  );
}

export default App;
