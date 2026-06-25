import { Asset, Button, Top } from "@toss/tds-mobile";
import { useApp } from "../store";
import heroIllustration from "../assets/welcome-hero.png";

// F-01 인트로 랜딩: 호스트(토스 로그인) / 참여자(초대 링크) 두 경로로 분기.
export function WelcomeScreen() {
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
      <div
        style={{
          padding: "16px 20px 0",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Asset.Image
          src={heroIllustration}
          frameShape={{ width: 335, height: 220, radius: 20 }}
          scaleType="crop"
          alt="냠냠투게더 메인 일러스트"
          backgroundColor="transparent"
        />
      </div>

      <Top
        title={
          <Top.TitleParagraph size={22}>
            {`다 같이 갈 식당,\n같이 정해요.`}
          </Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>
            {`흩어진 의견 그만.\n조건 모아서 갈 만한 곳만 골라드려요`}
          </Top.SubtitleParagraph>
        }
      />

      <div
        style={{
          marginTop: "auto",
          padding: "35px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <Button
          color="primary"
          variant="fill"
          display="block"
          size="xlarge"
          onClick={() => goto("login-consent")}
        >
          토스로 로그인하기
        </Button>
        <Button
          color="dark"
          variant="weak"
          display="block"
          size="xlarge"
          onClick={() => goto("invite-input")}
        >
          이미 초대받은 링크가 있어요
        </Button>
      </div>
    </div>
  );
}
