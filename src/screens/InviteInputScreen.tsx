import { useState } from "react";
import { BottomCTA, TextField, Top } from "@toss/tds-mobile";
import { useApp } from "../store";

// F-04 참여자 초대 링크 입력. 호스트가 공유한 링크(?groupId=...)를 붙여넣고 진입한다.
// 참여자는 익명(무로그인)이므로 로그인 없이 바로 응답 단계로 이동한다.

// 링크/문자열에서 groupId(=sessionId) 추출. URL·"groupId=xxx"·순수 id 모두 허용.
function parseGroupId(link: string): string | null {
  const trimmed = link.trim();
  if (!trimmed) return null;
  try {
    const g = new URL(trimmed).searchParams.get("groupId");
    if (g) return g;
  } catch {
    // URL 아님 — 아래 정규식/원문으로 폴백
  }
  const m = /groupId=([^&\s]+)/.exec(trimmed);
  return m ? m[1] : trimmed;
}

export function InviteInputScreen() {
  const { goto, setSessionId, setRole } = useApp();
  const [link, setLink] = useState("");

  function handleConfirm() {
    const groupId = parseGroupId(link);
    if (!groupId) return;
    setSessionId(groupId);
    setRole("participant");
    goto("participant-onboarding");
  }

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
            받으신 링크를 입력해주세요.
          </Top.TitleParagraph>
        }
      />

      <TextField
        variant="line"
        label="초대 링크"
        placeholder="초대 링크"
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />

      <div style={{ marginTop: "auto" }}>
        <BottomCTA.Single
          onClick={handleConfirm}
          disabled={!link.trim()}
          fixedAboveKeyboard
        >
          확인
        </BottomCTA.Single>
      </div>
    </div>
  );
}
