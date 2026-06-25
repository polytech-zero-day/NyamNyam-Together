import { Asset, BottomCTA, Stepper, StepperRow, Top } from "@toss/tds-mobile";
import { useApp } from "../store";

// F-01 진입 시 공통 화면: 앱이 무엇을 해주는지 3스텝으로 설명하고 다음 단계로 보낸다.
// "다음" → WelcomeScreen(호스트 로그인/참여자 분기 화면).
export function IntroScreen() {
  const { goto } = useApp();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        background: "#fff",
      }}
    >
      <Top
        title={
          <Top.TitleParagraph size={22}>
            {`어디서 먹을지,\n3~4 곳으로 좁혀드려요`}
          </Top.TitleParagraph>
        }
      />

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "16px 0 40px",
        }}
      >
        <Asset.Icon
          name="icon-calendar-timetable"
          frameShape={{ width: 250, height: 250 }}
          backgroundColor="transparent"
        />
      </div>

      <Stepper>
        <StepperRow
          left={<StepperRow.NumberIcon number={1} />}
          center={
            <StepperRow.Texts
              type="A"
              title="모임 조건을 정하고 친구들을 초대해요"
            />
          }
        />
        <StepperRow
          left={<StepperRow.NumberIcon number={2} />}
          center={
            <StepperRow.Texts
              type="A"
              title="각자 술·예산·음식·분위기를 골라요"
            />
          }
        />
        <StepperRow
          hideLine
          left={<StepperRow.NumberIcon number={3} />}
          center={
            <StepperRow.Texts
              type="A"
              title="딱 맞는 식당 3~4 곳에 투표해요"
            />
          }
        />
      </Stepper>

      <div style={{ marginTop: "auto" }}>
        <BottomCTA.Single onClick={() => goto("welcome")}>
          다음
        </BottomCTA.Single>
      </div>
    </div>
  );
}
