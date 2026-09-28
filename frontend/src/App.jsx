import { useState, useEffect, useRef } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "";
const STEPS = [
  "Reading your resume…",
  "Comparing it against the job…",
  "Scoring the match…",
  "Writing recommendations…",
];
const IDEAS = [
  "Rewrite my experience bullets for this job",
  "What should I learn first to close the gaps?",
  "Write a tailored profile summary",
];

function ScoreRing({ score }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / 1200, 1);
      setShown(Math.round(score * (1 - Math.pow(1 - t, 3)))); // ease-out
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const r = 70;
  const c = 2 * Math.PI * r;
  const tone = score >= 75 ? "good" : score >= 50 ? "mid" : "low";

  return (
    <div className={`ring ${tone}`}>
      <svg viewBox="0 0 180 180">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--ring-a)" }} />
            <stop offset="100%" style={{ stopColor: "var(--ring-b)" }} />
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r={r} className="ring-bg" />
        <circle
          cx="90" cy="90" r={r} className="ring-fg" stroke="url(#ringGrad)"
          strokeDasharray={c} strokeDashoffset={c - (c * shown) / 100}
          transform="rotate(-90 90 90)"
        />
      </svg>
      <div className="ring-text">
        <span>{shown}</span>
        <small>/ 100</small>
      </div>
    </div>
  );
}

function Chips({ items, kind, onClick }) {
  if (!items?.length) return <p className="empty">Nothing here 🎉</p>;
  return (
    <div className="chips">
      {items.map((s, i) => (
        <span key={i} className={`chip ${kind}`} onClick={onClick ? () => onClick(s) : undefined}>
          {s}
        </span>
      ))}
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("skills");
  const [filter, setFilter] = useState(null);
  const [done, setDone] = useState({});
  const [copied, setCopied] = useState("");
  const [chat, setChat] = useState([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileInput = useRef(null);
  const chatEnd = useRef(null);

  // rotate the loading messages
  useEffect(() => {
    if (!loading) return;
    setStepIdx(0);
    const id = setInterval(() => setStepIdx((s) => (s + 1) % STEPS.length), 1800);
    return () => clearInterval(id);
  }, [loading]);

  // keep the chat scrolled to the newest message
  useEffect(() => {
    if (chat.length) chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat, thinking]);

  function pickFile(f) {
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) {
      setError("Please upload a PDF or DOCX file.");
      return;
    }
    setError("");
    setFile(f);
  }

  async function analyze() {
    if (!file || !jd.trim()) {
      setError("Add a resume and a job description first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("resume", file);
      form.append("job_description", jd);
      const res = await fetch(`${API}/api/analyze`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Analysis failed");
      setData(json);
      setDone({});
      setChat([]);
      setTab("skills");
      setFilter(null);
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "Can't reach the backend. Is uvicorn running on port 8000?" : e.message);
    } finally {
      setLoading(false);
    }
  }

  async function ask(q) {
    const text = (q ?? question).trim();
    if (!text || !data || thinking) return;
    const history = chat;
    setChat([...history, { role: "user", content: text }]);
    setQuestion("");
    setThinking(true);
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: data.resume_text,
          job_description: data.job_description,
          result: data.result,
          history,
          question: text,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Chat failed");
      setChat((c) => [...c, { role: "assistant", content: json.answer }]);
    } catch (e) {
      setChat((c) => [...c, { role: "assistant", content: `Something went wrong: ${e.message}` }]);
    } finally {
      setThinking(false);
    }
  }

  function copyKeyword(k) {
    navigator.clipboard?.writeText(k);
    setCopied(k);
    setTimeout(() => setCopied(""), 1200);
  }

  const result = data?.result;
  const imps = result ? result.recommended_improvements.map((imp, i) => ({ ...imp, i })) : [];
  const sections = [...new Set(imps.map((x) => x.section))];
  const shownImps = imps.filter((x) => !filter || x.section === filter);
  const doneCount = imps.filter((x) => done[x.i]).length;

  return (
    <div className="app">
      <div className="bg">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>

      <header className="top">
        <div className="logo">✦</div>
        <div>
          <h1>ResumeLens</h1>
          <p>See your resume the way a recruiter does</p>
        </div>
      </header>

      <main className="grid">
        {/* ---------- Inputs ---------- */}
        <aside className="card inputs">
          <h2>Your inputs</h2>

          <div
            className={`drop ${drag ? "over" : ""} ${file ? "has" : ""}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files[0]); }}
          >
            <input ref={fileInput} type="file" accept=".pdf,.docx" hidden onChange={(e) => pickFile(e.target.files[0])} />
            <div className="drop-icon">{file ? "📄" : "⬆️"}</div>
            {file ? (
              <>
                <strong>{file.name}</strong>
                <small>{(file.size / 1024).toFixed(1)} KB · click to replace</small>
              </>
            ) : (
              <>
                <strong>Drop your resume here</strong>
                <small>PDF or DOCX · or click to browse</small>
              </>
            )}
          </div>

          <label className="label">Job description</label>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the full job posting here…"
            rows={12}
          />

          {error && <div className="error">{error}</div>}

          <button className="go" onClick={analyze} disabled={loading}>
            {loading ? "Analyzing…" : "Analyze my resume ✦"}
          </button>
        </aside>

        {/* ---------- Results ---------- */}
        <section className="results">
          {loading ? (
            <div className="card loader">
              <div className="spinner" />
              <h3>{STEPS[stepIdx]}</h3>
              <p>This usually takes 10–20 seconds.</p>
            </div>
          ) : !result ? (
            <div className="card hero fade">
              <h2>
                Beat the <span className="grad-text">applicant filter.</span>
              </h2>
              <p>Upload your resume, paste a job posting, and get a structured breakdown in seconds.</p>
              <div className="features">
                <div><b>🎯</b><span>Skill match &amp; gaps</span></div>
                <div><b>🛠️</b><span>Fixes with rewrite wording</span></div>
                <div><b>💬</b><span>Chat with an AI coach</span></div>
              </div>
            </div>
          ) : (
            <div className="fade stack">
              {/* Overview */}
              <div className="card overview">
                <ScoreRing score={result.match_score} />
                <div>
                  <p className="summary">{result.summary}</p>
                  <div className="stats">
                    <span className="pill green">{result.matched_skills.length} matched</span>
                    <span className="pill red">{result.missing_skills.length} missing</span>
                    <span className="pill violet">{imps.length} fixes</span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="card">
                <div className="tabs">
                  {[
                    ["skills", "🎯 Skills"],
                    ["gaps", "📉 Gaps"],
                    ["fixes", "🛠️ Fixes"],
                  ].map(([id, label]) => (
                    <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
                      {label}
                    </button>
                  ))}
                </div>

                {tab === "skills" && (
                  <div className="fade">
                    <div className="two">
                      <div>
                        <h4 className="ok">✅ Matched</h4>
                        <Chips items={result.matched_skills} kind="match" />
                      </div>
                      <div>
                        <h4 className="bad">❌ Missing</h4>
                        <Chips items={result.missing_skills} kind="miss" />
                      </div>
                    </div>
                    {result.strengths?.length > 0 && (
                      <>
                        <h4>💪 Strengths</h4>
                        <ul className="list">
                          {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </>
                    )}
                    {result.ats_keywords_to_add?.length > 0 && (
                      <>
                        <h4>
                          🔑 Keywords to add <small className="hint">{copied ? `copied “${copied}”` : "click to copy"}</small>
                        </h4>
                        <Chips items={result.ats_keywords_to_add} kind="kw" onClick={copyKeyword} />
                      </>
                    )}
                  </div>
                )}

                {tab === "gaps" && (
                  <div className="fade">
                    {result.experience_gaps.length === 0 && <p className="empty">No major experience gaps 🎉</p>}
                    {result.experience_gaps.map((g, i) => (
                      <div key={i} className="gap">{g}</div>
                    ))}
                  </div>
                )}

                {tab === "fixes" && (
                  <div className="fade">
                    <div className="fixbar">
                      <div className="filters">
                        <button className={!filter ? "on" : ""} onClick={() => setFilter(null)}>All</button>
                        {sections.map((s) => (
                          <button key={s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>{s}</button>
                        ))}
                      </div>
                      <span className="hint">{doneCount}/{imps.length} done</span>
                    </div>
                    <div className="progress"><i style={{ width: `${imps.length ? (doneCount / imps.length) * 100 : 0}%` }} /></div>

                    {shownImps.map((imp) => (
                      <label key={imp.i} className={`imp ${done[imp.i] ? "done" : ""}`}>
                        <input
                          type="checkbox"
                          checked={!!done[imp.i]}
                          onChange={() => setDone((d) => ({ ...d, [imp.i]: !d[imp.i] }))}
                        />
                        <div>
                          <span className="tag">{imp.section}</span>
                          <div className="imp-issue">{imp.issue}</div>
                          <div className="imp-fix">{imp.suggestion}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat */}
              <div className="card chat">
                <h3>💬 Ask the coach</h3>
                {chat.length === 0 && (
                  <div className="chips ideas">
                    {IDEAS.map((q) => (
                      <button key={q} className="chip idea" onClick={() => ask(q)}>{q}</button>
                    ))}
                  </div>
                )}
                <div className="msgs">
                  {chat.map((m, i) => (
                    <div key={i} className={`msg ${m.role === "user" ? "user" : "bot"}`}>{m.content}</div>
                  ))}
                  {thinking && (
                    <div className="msg bot"><span className="dots"><i /><i /><i /></span></div>
                  )}
                  <div ref={chatEnd} />
                </div>
                <form
                  className="composer"
                  onSubmit={(e) => { e.preventDefault(); ask(); }}
                >
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a follow-up about your resume…"
                  />
                  <button type="submit" disabled={thinking || !question.trim()}>➤</button>
                </form>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}