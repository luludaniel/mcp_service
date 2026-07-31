import type { LegalDomain, LitigationChecklistTemplate } from "../types/litigationPrep.types.js";

/**
 * 소송준비 체크리스트는 규칙 기반(LLM 미사용)으로 큐레이션합니다.
 * 사건 유형별 세부 요건은 실제 사안마다 달라질 수 있어 일반적인 절차 안내로만 제공하고,
 * 각 항목은 반드시 전문가 확인이 필요하다는 전제를 둡니다.
 */

export const DOMAIN_LABELS: Record<LegalDomain, string> = {
  criminal: "형사",
  civil: "민사",
  family: "가정법원",
};

export const DOMAIN_ORDER: readonly LegalDomain[] = ["civil", "criminal", "family"];

/** 특정 사건 유형 키워드에 걸리지 않을 때 분야만이라도 안내하기 위한 보조 키워드입니다. */
export const DOMAIN_KEYWORDS: Record<LegalDomain, readonly string[]> = {
  criminal: [
    "고소",
    "고발",
    "경찰",
    "검찰",
    "구속",
    "기소",
    "피의자",
    "피고인",
    "형사",
    "사기죄",
    "폭행",
    "절도",
    "무고",
  ],
  civil: [
    "손해배상",
    "계약",
    "대금",
    "채무",
    "임대차",
    "소유권",
    "미지급",
    "용역비",
    "용역대금",
    "매매",
    "민사",
    "지급명령",
  ],
  family: [
    "이혼",
    "양육권",
    "친권",
    "상속",
    "재산분할",
    "혼인",
    "위자료",
    "양육비",
    "가정법원",
    "가사",
  ],
};

export const LITIGATION_CHECKLISTS: readonly LitigationChecklistTemplate[] = [
  {
    id: "civil-unpaid-fee",
    domain: "civil",
    label: "대금/용역비 미지급",
    keywords: [
      "용역대금",
      "용역비",
      "대금 미지급",
      "대금미지급",
      "미수금",
      "하도급대금",
      "체불",
      "물품대금",
    ],
    summary:
      "용역대금이나 물품대금을 지급받지 못한 경우 민사소송(지급명령 또는 소액사건심판 등) 준비를 위한 일반 안내입니다.",
    requiredEvidence: [
      "계약서, 발주서, 견적서 등 거래관계를 증명하는 서류",
      "업무 수행 사실을 보여주는 자료(작업 결과물, 이메일, 문자, 카카오톡 대화 등)",
      "세금계산서, 청구서 등 대금 청구 근거 자료",
      "입금 내역 또는 미입금을 보여주는 통장 거래내역",
      "독촉 사실을 보여주는 문자·내용증명 발송 기록",
    ],
    requiredDocuments: [
      "소장(민사소송) 또는 지급명령신청서",
      "증거설명서",
      "송달용 주소 확인 자료(사업자등록증, 주민등록초본 등)",
      "청구금액 산정 근거 자료",
    ],
    deadlinesAndLimitations: [
      "일반 채권의 소멸시효는 원칙적으로 10년이나, 상행위로 인한 채권은 5년으로 단축될 수 있습니다.",
      "지급명령은 소송보다 절차가 간이하지만 채무자가 이의신청하면 통상 소송으로 전환됩니다.",
      "소가 3,000만원 이하인 경우 소액사건심판 절차를 검토할 수 있습니다.",
    ],
    jurisdictionNotes: [
      "원칙적으로 피고(채무자)의 주소지 관할 법원에 제기합니다.",
      "계약서에 관할 합의 조항이 있는지 먼저 확인합니다.",
    ],
    preLitigationSteps: [
      "내용증명을 발송해 이행을 최종 촉구하고 증거로 남깁니다.",
      "지급명령 절차가 더 신속할 수 있는지 검토합니다.",
      "소송 전 조정이나 협상 가능성을 확인합니다.",
    ],
  },
  {
    id: "criminal-complaint-prep",
    domain: "criminal",
    label: "고소장 제출 준비",
    keywords: ["고소장", "고소", "형사고소", "고소 준비", "고소하고싶어요"],
    summary:
      "특정 범죄 혐의에 대해 고소장을 제출하기 위한 일반적인 준비 절차 안내입니다. 죄명별 세부 요건은 반드시 전문가 확인이 필요합니다.",
    requiredEvidence: [
      "피해 사실을 증명하는 자료(사진, 영상, 진단서, 문자·통화 기록 등)",
      "가해자를 특정할 수 있는 정보(성명, 연락처, 인상착의 등 확인 가능한 범위)",
      "피해 발생 일시와 장소를 특정할 수 있는 자료",
      "목격자가 있다면 진술서 또는 연락처",
    ],
    requiredDocuments: [
      "고소장(육하원칙에 따른 범죄사실 기재)",
      "증거자료 목록 및 사본",
      "고소인 신분증 사본",
      "위임장(대리인을 통해 제출하는 경우)",
    ],
    deadlinesAndLimitations: [
      "친고죄, 반의사불벌죄 등 일부 범죄는 고소기간(예: 범인을 안 날로부터 6개월 등) 제한이 있을 수 있습니다.",
      "공소시효가 지나면 형사처벌이 어려울 수 있으므로 죄명별 공소시효를 확인해야 합니다.",
    ],
    jurisdictionNotes: [
      "범죄지, 피고소인의 주소지, 또는 고소인의 주소지 관할 경찰서·검찰청에 제출할 수 있습니다.",
    ],
    preLitigationSteps: [
      "변호사 상담을 통해 죄명 해당 여부와 증거의 충분성을 먼저 확인하는 것이 권장됩니다.",
      "무고죄 위험을 피하기 위해 사실관계를 정확히 정리합니다.",
      "증거 수집 과정에서 불법 녹음 등 다른 위법행위가 되지 않는지 확인합니다.",
    ],
  },
  {
    id: "family-divorce-prep",
    domain: "family",
    label: "이혼 소송 준비",
    keywords: ["이혼소송", "이혼", "이혼 준비", "이혼하고싶어요", "협의이혼", "재판이혼"],
    summary:
      "이혼 소송 또는 협의이혼 절차 준비를 위한 일반 안내입니다. 양육권, 재산분할 등은 사안별 편차가 커 전문가 상담이 특히 중요합니다.",
    requiredEvidence: [
      "혼인관계증명서, 가족관계증명서",
      "이혼 사유를 뒷받침하는 자료(외도, 폭력, 유기 등 관련 증거)",
      "재산 목록 및 관련 자료(부동산 등기부등본, 예금 잔액증명, 대출 내역 등)",
      "자녀가 있는 경우 양육 상황을 보여주는 자료",
    ],
    requiredDocuments: [
      "이혼소장 또는 협의이혼의사확인신청서",
      "재산분할 청구를 위한 재산목록표",
      "양육권·양육비 청구 관련 서류(해당 시)",
      "혼인관계증명서, 가족관계증명서, 주민등록등본",
    ],
    deadlinesAndLimitations: [
      "재판상 이혼의 재산분할청구권은 이혼 후 2년 이내에 행사해야 합니다.",
      "협의이혼은 가정법원의 이혼숙려기간(자녀 유무에 따라 1~3개월)을 거쳐야 합니다.",
    ],
    jurisdictionNotes: [
      "원칙적으로 상대방 주소지 관할 가정법원에 제기합니다.",
      "가사소송은 조정전치주의가 적용되어 소송 전 조정 절차를 먼저 거치는 경우가 많습니다.",
    ],
    preLitigationSteps: [
      "협의이혼이 가능한지 먼저 상대방과 협의를 시도합니다.",
      "재산 목록을 미리 정리해 재산분할 분쟁에 대비합니다.",
      "자녀가 있다면 양육 계획(양육권, 양육비, 면접교섭)을 구체적으로 준비합니다.",
    ],
  },
];

export function getChecklistById(id: string): LitigationChecklistTemplate | undefined {
  return LITIGATION_CHECKLISTS.find((template) => template.id === id);
}

export function getChecklistsByDomain(domain: LegalDomain): readonly LitigationChecklistTemplate[] {
  return LITIGATION_CHECKLISTS.filter((template) => template.domain === domain);
}

/** UI가 "직접 선택" 목록을 렌더링할 때 쓰는 분야 → 사건 유형 요약입니다. */
export function buildCatalogIndex(): Record<string, string> {
  const index: Record<string, string> = {};

  for (const domain of DOMAIN_ORDER) {
    const caseTypes = getChecklistsByDomain(domain).map((template) => template.label);
    index[DOMAIN_LABELS[domain]] = caseTypes.length > 0 ? caseTypes.join(", ") : "준비 중";
  }

  return index;
}
