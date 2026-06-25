import { colors } from "@toss/tds-colors";
import { Asset, BottomCTA, TableRow, Text } from "@toss/tds-mobile";
import checkFillIcon from "../assets/check-fill-circle.svg";

// F-11 조건 완화 안내 화면.
// 후보가 0개일 때만 뜨는 예외 흐름(항상 X) — 백엔드가 0개 판정 후 완화 항목 들고 라우팅함.
// CLAUDE.md 3.4 완화 순서: 예산 하한 → 예산 상한 완충 → 음식 → 위치 반경 (술 제약은 끝까지 유지).
// CLAUDE.md F-11 화면 구성:
//   ① 안내 ② 완화된 항목 before→after ③ "술자리 조건은 그대로 지켰어요" 명시 ④ CTA
// 완화 항목은 백엔드 응답에서 받음 — 데모는 props 기본값(예산 ~2만 → ~2.5만)으로.
interface RelaxedField {
  label: string; // 예: "예산 범위"
  before: string; // 예: "2만원"
  after: string; // 예: "2.5만원"
}

interface Props {
  relaxedFields?: RelaxedField[];
  onConfirm?: () => void;
}

const DEMO_FIELDS: RelaxedField[] = [
  { label: "예산 범위", before: "2만원", after: "2.5만원" },
];

export function RelaxedScreen({
  relaxedFields = DEMO_FIELDS,
  onConfirm,
}: Props) {
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
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "60px 24px 24px",
        }}
      >
        <Asset.Image
          src={checkFillIcon}
          frameShape={{ width: 100, height: 100 }}
          scaleType="fit"
          alt=""
          backgroundColor="transparent"
        />
        <Text
          typography="t3"
          fontWeight="bold"
          color={colors.grey800}
          style={{ margin: "24px 0 8px", textAlign: "center" }}
        >
          {`딱 맞는 곳이 없어\n조건을 살짝 풀었어요`}
        </Text>
        <Text
          typography="t5"
          color={colors.grey500}
          style={{ textAlign: "center", whiteSpace: "pre-line" }}
        >
          {`입력하신 조건보다\n범위를 더 넓혀서 추천해드릴게요`}
        </Text>

        {/* 완화 항목: 항목명(좌) → before→after(우). 백엔드가 보낸 필드만 노출(여러 개 가능). */}
        <div
          style={{
            width: "100%",
            marginTop: 32,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {relaxedFields.map((f) => (
            <div
              key={f.label}
              style={{
                background: colors.grey50,
                borderRadius: 12,
                padding: "4px 16px",
              }}
            >
              <TableRow
                align="space-between"
                left={
                  <Text typography="t6" fontWeight="medium" color={colors.grey700}>
                    {f.label}
                  </Text>
                }
                right={
                  <Text typography="t6" fontWeight="medium" color={colors.grey800}>
                    {`${f.before}  →  ${f.after}`}
                  </Text>
                }
              />
            </div>
          ))}
        </div>

        {/* CLAUDE.md F-11 ③ 술자리 조건은 끝까지 유지된다는 보장 안내. */}
        <Text
          typography="t7"
          color={colors.grey400}
          style={{ margin: "16px 0 0", textAlign: "center" }}
        >
          술자리 조건은 그대로 지켰어요
        </Text>
      </div>

      <BottomCTA.Single
        onClick={() => {
          if (onConfirm) onConfirm();
          else console.log("[relaxed] onConfirm 미연결");
        }}
      >
        추천 결과 보기
      </BottomCTA.Single>
    </div>
  );
}
