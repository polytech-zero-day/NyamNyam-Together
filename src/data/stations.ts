// 권역별 주요 역 목록(목업).
// CLAUDE.md 6장: 역 목록은 백엔드 API로 받는 게 정식 — 이 파일은 그 전까지의 목업 데이터.
//                서울 권역 + 인천 + 광명 기준.
// 백엔드 연동 시 이 export(REGIONS, RegionId)만 동일 시그니처로 바꿔주면
// 화면 코드를 건드리지 않아도 된다.

export const REGIONS = [
  {
    id: "gangnam",
    name: "강남·서초·송파",
    stations: [
      "강남역",
      "신논현역",
      "양재역",
      "교대역",
      "서초역",
      "잠실역",
      "삼성역",
      "선릉역",
      "가락시장역",
    ],
  },
  {
    id: "yongsan",
    name: "용산·마포·서대문",
    stations: ["용산역", "이태원역", "홍대입구역", "합정역", "공덕역", "신촌역"],
  },
  {
    id: "jongno",
    name: "종로·동대문",
    stations: [
      "종로3가역",
      "광화문역",
      "동대문역",
      "동대문역사문화공원역",
      "혜화역",
    ],
  },
  {
    id: "seongsu",
    name: "성수·건대입구",
    stations: ["성수역", "건대입구역", "뚝섬역", "왕십리역"],
  },
  {
    id: "gwanak",
    name: "관악·영등포",
    stations: ["서울대입구역", "신림역", "영등포역", "여의도역", "당산역"],
  },
  // 인천·광명은 CLAUDE.md 6장 기준대로 추가. 시안엔 없어서 주요 역만 목업으로.
  {
    id: "incheon",
    name: "인천",
    stations: [
      "인천역",
      "동인천역",
      "부평역",
      "주안역",
      "송도역",
      "인천터미널역",
    ],
  },
  {
    id: "gwangmyeong",
    name: "광명",
    stations: ["광명사거리역", "철산역", "광명역(KTX)"],
  },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];
