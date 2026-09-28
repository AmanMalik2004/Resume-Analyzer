import streamlit as st
from extract import extract_text
from analyzer import analyze, follow_up

st.set_page_config(page_title="AI Resume Analyzer", page_icon="📄", layout="wide")
st.title("📄 AI Resume Analyzer")

# Session state: survives Streamlit's rerun-on-every-click behavior
for key, default in {"result": None, "resume_text": "", "jd": "", "chat": []}.items():
    st.session_state.setdefault(key, default)

# ---------- Sidebar: inputs ----------
with st.sidebar:
    st.header("Inputs")
    resume_file = st.file_uploader("Resume (PDF or DOCX)", type=["pdf", "docx"])
    job_description = st.text_area("Job description", height=300)
    analyze_clicked = st.button("Analyze", type="primary", use_container_width=True)

if analyze_clicked:
    if not resume_file or not job_description.strip():
        st.warning("Please upload a resume and paste a job description.")
    else:
        try:
            with st.spinner("Analyzing..."):
                resume_text = extract_text(resume_file)
                result = analyze(resume_text, job_description)
            st.session_state.update(result=result, resume_text=resume_text, jd=job_description, chat=[])
        except ValueError as e:
            st.error(str(e))
        except Exception as e:
            st.error(f"Something went wrong: {e}")

result = st.session_state.result
if result is None:
    st.info("Upload a resume and paste a job description in the sidebar, then hit Analyze.")
    st.stop()

# ---------- Header metrics ----------
c1, c2, c3, c4 = st.columns(4)
c1.metric("Match score", f"{result.match_score}/100")
c2.metric("Skills matched", len(result.matched_skills))
c3.metric("Skills missing", len(result.missing_skills))
c4.metric("Improvements", len(result.recommended_improvements))
st.progress(result.match_score / 100)
st.write(result.summary)

# ---------- Tabs ----------
tab_skills, tab_gaps, tab_improve = st.tabs(["🎯 Skills", "📉 Experience gaps", "🛠️ Improvements"])

with tab_skills:
    col_a, col_b = st.columns(2)
    with col_a:
        st.subheader("✅ Matched")
        for skill in result.matched_skills:
            st.success(skill)
    with col_b:
        st.subheader("❌ Missing")
        for skill in result.missing_skills:
            st.error(skill)
    st.subheader("💪 Strengths")
    for s in result.strengths:
        st.success(s)
    st.subheader("🔑 Keywords to add")
    st.write(", ".join(result.ats_keywords_to_add))

with tab_gaps:
    for gap in result.experience_gaps:
        st.warning(gap)

with tab_improve:
    sections = sorted({imp.section for imp in result.recommended_improvements})
    chosen = st.multiselect("Filter by section", sections, default=sections)
    shown = [(i, imp) for i, imp in enumerate(result.recommended_improvements) if imp.section in chosen]

    done_count = sum(st.session_state.get(f"done_{i}", False) for i, _ in shown)
    st.caption(f"{done_count}/{len(shown)} done")

    for i, imp in shown:
        with st.expander(f"{imp.section}: {imp.issue}"):
            st.write(imp.suggestion)
            st.checkbox("Mark as done", key=f"done_{i}")

# ---------- Follow-up chat ----------
st.divider()
st.subheader("💬 Ask the coach")
st.caption("Try: \"Rewrite my BizBuddy bullets for this job\" or \"What should I learn first to close the gaps?\"")

for msg in st.session_state.chat:
    with st.chat_message(msg["role"]):
        st.write(msg["content"])

question = st.chat_input("Ask a follow-up about your resume...")
if question:
    with st.chat_message("user"):
        st.write(question)
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            try:
                answer = follow_up(
                    st.session_state.resume_text, st.session_state.jd,
                    result, st.session_state.chat, question,
                )
            except Exception as e:
                answer = f"Something went wrong: {e}"
        st.write(answer)
    st.session_state.chat += [
        {"role": "user", "content": question},
        {"role": "assistant", "content": answer},
    ]