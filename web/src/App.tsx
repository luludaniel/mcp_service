import { useMemo, useState, type ChangeEvent } from 'react'
import './App.css'

type TabId = 'legal-research' | 'contract-review' | 'document-draft'

interface ReportPolicy {
  informationalOnly: boolean
  draftOnly: boolean
  prohibitsFinalJudgment: boolean
  prohibitsGuaranteedOutcome: boolean
  prohibitsDefinitiveIllegalityFinding: boolean
  requiresExpertReview: boolean
  disclaimers: string[]
  warnings: string[]
}

interface AuthoritySearch {
  provider: string
  notices: string[]
  manualReviewRequired: boolean
}

interface SafetyReview {
  changed: boolean
  expertReviewRequired: boolean
  detections: {
    phrase: string
    category: string
    riskLevel: 'medium' | 'high'
  }[]
}

interface CitationVerification {
  sourceSufficiency: 'sufficient' | 'partial' | 'insufficient'
  limitations: string[]
  blocksDefinitiveAnalysis: boolean
}

interface LegalReport {
  allowed: boolean
  reason?: string
  workflow?: string
  summary?: string
  nextSteps?: string[]
  reviewScope?: Record<string, string>
  draftScope?: Record<string, string>
  mockResult?: Record<string, unknown>
  authoritySearch?: AuthoritySearch
  safetyReview?: SafetyReview
  citationVerification?: CitationVerification
  policy?: ReportPolicy
  expertReviewRequired?: boolean
}

interface ExtraField {
  key: string
  label: string
  placeholder: string
  required: boolean
  fallback?: string
}

interface TabConfig {
  id: TabId
  label: string
  endpoint: string
  placeholder: string
  buttonLabel: string
  extraFields?: ExtraField[]
  buildBody: (text: string, extra: Record<string, string>) => Record<string, string>
}

const API_BASE = 'http://localhost:3000'

const fieldLabels: Record<string, string> = {
  issue: '쟁점',
  likelySources: '확인할 근거',
  limitations: '한계',
  riskLevel: '위험 수준',
  detectedIssues: '탐지된 쟁점',
  suggestedReviewPoints: '검토 포인트',
  sections: '초안 구성',
  placeholders: '확인 필요 항목',
  deliveryChecklist: '발송 전 체크리스트',
  partyRole: '당사자 지위',
  concern: '검토 관심사항',
  documentType: '문서 유형',
  recipient: '수신인',
  requestedOutcome: '요청 결과',
}

const tabs = [
  {
    id: 'legal-research',
    label: '법률 질문',
    endpoint: '/api/legal-research',
    placeholder: '예: 프리랜서 용역대금을 지급받지 못한 경우 검토할 수 있는 민사 조치를 알려주세요.',
    buttonLabel: '법률 리서치 실행',
    buildBody: (text: string) => ({ question: text }),
  },
  {
    id: 'contract-review',
    label: '계약서 검토',
    endpoint: '/api/contract-review',
    placeholder: '검토할 계약 조항이나 계약서 본문을 붙여넣으세요. 예: 공급자가 언제든 해지할 수 있고 고객은 남은 대금을 모두 부담한다는 조항',
    buttonLabel: '계약서 검토 실행',
    extraFields: [
      { key: 'partyRole', label: '당사자 지위', placeholder: '예: 을, 공급자, 임차인', required: true, fallback: '검토 요청자' },
      { key: 'concern', label: '검토 관심사항 (선택)', placeholder: '예: 일방적 해지 조항', required: false },
    ],
    buildBody: (text: string, extra: Record<string, string>) => ({
      contractText: text,
      partyRole: extra.partyRole?.trim() || '검토 요청자',
      ...(extra.concern?.trim() ? { concern: extra.concern.trim() } : {}),
    }),
  },
  {
    id: 'document-draft',
    label: '문서 초안',
    endpoint: '/api/document-draft',
    placeholder: '작성할 문서의 목적과 사실관계를 입력하세요. 예: 미지급 용역대금 지급을 요청하는 내용증명 초안',
    buttonLabel: '문서 초안 생성',
    extraFields: [
      { key: 'documentType', label: '문서 유형', placeholder: '예: 내용증명, 합의서 초안', required: true, fallback: '법률 문서 초안' },
      { key: 'recipient', label: '수신인 (선택)', placeholder: '예: 계약 상대방', required: false },
      { key: 'requestedOutcome', label: '요청 결과 (선택)', placeholder: '예: 대금 지급', required: false },
    ],
    buildBody: (text: string, extra: Record<string, string>) => ({
      documentType: extra.documentType?.trim() || '법률 문서 초안',
      facts: text,
      ...(extra.recipient?.trim() ? { recipient: extra.recipient.trim() } : {}),
      requestedOutcome: extra.requestedOutcome?.trim() || '초안 작성',
    }),
  },
] satisfies [TabConfig, ...TabConfig[]]

function formatKey(key: string) {
  if (fieldLabels[key]) {
    return fieldLabels[key]
  }

  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (first: string) => first.toUpperCase())
}

function stringifyValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => stringifyValue(item)).join(', ')
  }

  if (value !== null && typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }

  return String(value ?? '')
}

function formatProvider(provider?: string): string {
  if (provider === 'mock') {
    return '개발용 모의 검색'
  }

  if (provider === 'korean-law') {
    return '한국 법령 검색'
  }

  return provider ?? '개발용 모의 검색'
}

function formatSourceSufficiency(value: CitationVerification['sourceSufficiency']): string {
  if (value === 'sufficient') {
    return '충분'
  }

  if (value === 'partial') {
    return '일부 확인'
  }

  return '부족'
}

function ExpertBadge({ report }: { report: LegalReport }) {
  const required =
    report.expertReviewRequired ?? report.policy?.requiresExpertReview ?? report.authoritySearch?.manualReviewRequired ?? true

  return (
    <div className={required ? 'expert-badge required' : 'expert-badge optional'}>
      <span className="badge-dot" />
      <strong>{required ? '전문가 검토 필요' : '전문가 검토 선택'}</strong>
      <span>
        {required
          ? '출처, 사실관계, 기한 확인 후 사용하세요.'
          : '현재 입력 기준으로 중대한 위험 신호는 제한적입니다.'}
      </span>
    </div>
  )
}

function ReportView({ activeTab, report }: { activeTab: TabConfig; report: LegalReport }) {
  if (!report.allowed) {
    return (
      <section className="report-panel blocked">
        <div className="report-header">
          <p className="eyebrow">요청 제한</p>
          <h2>처리할 수 없는 맥락입니다</h2>
        </div>
        <p className="muted">사유: {report.reason ?? '정책상 제한된 요청'}</p>
        {report.policy ? <ExpertBadge report={report} /> : null}
      </section>
    )
  }

  const isDraft = activeTab.id === 'document-draft' || Boolean(report.policy?.draftOnly)

  return (
    <section className="report-panel">
      <div className="report-header">
        <div>
          <p className="eyebrow">{activeTab.label} 리포트</p>
          <h2>{isDraft ? '초안 리포트' : '정보 제공 리포트'}</h2>
        </div>
        <span className="status-pill">{formatProvider(report.authoritySearch?.provider)} 제공자</span>
      </div>

      <ExpertBadge report={report} />

      <div className="report-section">
        <h3>요약</h3>
        <p>{report.summary ?? '요청이 처리되었습니다.'}</p>
      </div>

      {report.reviewScope ? <KeyValueSection title="검토 범위" values={report.reviewScope} /> : null}
      {report.draftScope ? <KeyValueSection title="초안 범위" values={report.draftScope} /> : null}

      {report.mockResult ? (
        <div className="report-section">
          <h3>분석 항목</h3>
          <div className="result-grid">
            {Object.entries(report.mockResult).map(([key, value]) => (
              <div className="result-item" key={key}>
                <span>{formatKey(key)}</span>
                <p>{stringifyValue(value)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {report.nextSteps?.length ? (
        <div className="report-section">
          <h3>다음 조치</h3>
          <ol className="steps-list">
            {report.nextSteps.map((step: string) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {report.authoritySearch?.notices.length ? (
        <div className="report-section notice-section">
          <h3>출처 확인</h3>
          <ul>
            {report.authoritySearch.notices.map((notice: string) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.citationVerification ? (
        <div className="report-section notice-section">
          <h3>인용 검증</h3>
          <p>출처 충분성: {formatSourceSufficiency(report.citationVerification.sourceSufficiency)}</p>
          {report.citationVerification.blocksDefinitiveAnalysis ? (
            <p>근거가 부족한 단정적 분석은 제한됩니다.</p>
          ) : null}
          {report.citationVerification.limitations.length ? (
            <ul>
              {report.citationVerification.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {report.safetyReview ? (
        <div className="report-section">
          <h3>안전 검토</h3>
          <p>{report.safetyReview.detections.length ? '위험 표현이 감지되었습니다.' : '단정적 위험 표현은 감지되지 않았습니다.'}</p>
          {report.safetyReview.detections.length ? (
            <ul>
              {report.safetyReview.detections.map((detection) => (
                <li key={`${detection.phrase}-${detection.category}`}>
                  {detection.phrase} · {detection.riskLevel === 'high' ? '고위험' : '중위험'}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {report.policy?.warnings.length ? (
        <div className="report-section warning-section">
          <h3>주의 사항</h3>
          <ul>
            {report.policy.warnings.map((warning: string) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function KeyValueSection({ title, values }: { title: string; values: Record<string, string> }) {
  return (
    <div className="report-section">
      <h3>{title}</h3>
      <dl className="key-values">
        {Object.entries(values).map(([key, value]) => (
          <div key={key}>
            <dt>{formatKey(key)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function App() {
  const [activeTabId, setActiveTabId] = useState<TabId>('legal-research')
  const [inputs, setInputs] = useState<Record<TabId, string>>({
    'legal-research': '',
    'contract-review': '',
    'document-draft': '',
  })
  const [extraInputs, setExtraInputs] = useState<Record<TabId, Record<string, string>>>({
    'legal-research': {},
    'contract-review': {},
    'document-draft': {},
  })
  const [report, setReport] = useState<LegalReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeTab = useMemo<TabConfig>(
    () => tabs.find((tab: TabConfig) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId],
  )
  const activeInput = inputs[activeTab.id]

  async function runWorkflow() {
    const text = activeInput.trim()
    if (!text) {
      setError('검토할 내용을 입력해 주세요.')
      return
    }

    setLoading(true)
    setError(null)
    setReport(null)

    try {
      const response = await fetch(`${API_BASE}${activeTab.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeTab.buildBody(text, extraInputs[activeTab.id])),
      })
      const data = (await response.json()) as LegalReport

      if (!response.ok && response.status !== 422) {
        throw new Error(data.reason ?? '요청 처리 중 오류가 발생했습니다.')
      }

      setReport(data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '요청 처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">법률 MCP 하네스</p>
          <h1>법률 서비스 최소 기능 제품</h1>
        </div>
        <p className="header-copy">
          법률 자문이 아닌 정보 제공과 문서 초안 작성 보조를 위한 하네스 화면입니다.
        </p>
      </header>

      <section className="workspace">
        <div className="tabs" role="tablist" aria-label="법률 서비스 기능">
          {tabs.map((tab: TabConfig) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab.id === tab.id}
              className={activeTab.id === tab.id ? 'tab active' : 'tab'}
              onClick={() => {
                setActiveTabId(tab.id)
                setError(null)
                setReport(null)
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="work-grid">
          <section className="input-panel">
            <label htmlFor="workflow-input">{activeTab.label}</label>
            {activeTab.extraFields?.length ? (
              <div className="extra-fields">
                {activeTab.extraFields.map((field: ExtraField) => (
                  <label key={field.key} className="extra-field">
                    <span>{field.label}</span>
                    <input
                      type="text"
                      value={extraInputs[activeTab.id]?.[field.key] ?? ''}
                      placeholder={field.placeholder}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setExtraInputs((current: Record<TabId, Record<string, string>>) => ({
                          ...current,
                          [activeTab.id]: {
                            ...current[activeTab.id],
                            [field.key]: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            ) : null}
            <textarea
              id="workflow-input"
              value={activeInput}
              placeholder={activeTab.placeholder}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setInputs((current: Record<TabId, string>) => ({
                  ...current,
                  [activeTab.id]: event.target.value,
                }))
              }
            />
            <div className="input-actions">
              <span>{activeInput.trim().length}자</span>
              <button type="button" onClick={runWorkflow} disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    실행 중
                  </>
                ) : (
                  activeTab.buttonLabel
                )}
              </button>
            </div>
            {error ? <p className="error-message">{error}</p> : null}
          </section>

          <section className="output-panel">
            {loading ? (
              <div className="empty-state loading-state" role="status" aria-live="polite">
                <span className="spinner spinner-lg" aria-hidden="true" />
                <h2>결과를 불러오는 중입니다</h2>
                <p>한국 법령 검색 제공자 호출은 몇 초 정도 걸릴 수 있습니다.</p>
              </div>
            ) : report ? (
              <ReportView activeTab={activeTab} report={report} />
            ) : (
              <div className="empty-state">
                <p className="eyebrow">리포트 대기</p>
                <h2>입력 후 실행하면 결과가 표시됩니다</h2>
                <p>요약, 분석 항목, 출처 확인, 전문가 검토 필요 여부를 나눠 보여줍니다.</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  )
}

export default App
