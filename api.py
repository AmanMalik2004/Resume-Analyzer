import io
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from analyzer import analyze, follow_up
from extract import extract_text
from models import AnalysisResult

app = FastAPI(title="ResumeLens API")

# CORS: lets the React dev server (port 5173) call this server (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "https://resume-analyzer-er-ten.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/analyze")
def analyze_endpoint(resume: UploadFile = File(...), job_description: str = Form(...)):
    # extract_text expects a file-like object with a .name, so wrap the bytes
    buf = io.BytesIO(resume.file.read())
    buf.name = resume.filename or "resume"

    try:
        resume_text = extract_text(buf)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=400, detail="Couldn't read that file. Try another PDF or DOCX.")

    try:
        result = analyze(resume_text, job_description)
        return {
            "result": result.model_dump(),
            "resume_text": resume_text,
            "job_description": job_description,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI call failed: {e}")


class ChatRequest(BaseModel):
    resume_text: str
    job_description: str
    result: AnalysisResult
    history: list[dict]
    question: str


@app.post("/api/chat")
def chat_endpoint(req: ChatRequest):
    try:
        answer = follow_up(req.resume_text, req.job_description, req.result, req.history, req.question)
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI call failed: {e}")

@app.get("/")
def root():
    return {"status": "ResumeLens API is running"}