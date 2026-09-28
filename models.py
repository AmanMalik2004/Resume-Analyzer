from pydantic import BaseModel, Field


class Improvement(BaseModel):
    section: str = Field(description="Resume section this applies to, e.g. 'Experience', 'Skills', 'Summary'")
    issue: str = Field(description="What is weak, vague, or missing in that section")
    suggestion: str = Field(description="A concrete fix, with example wording where possible")


class AnalysisResult(BaseModel):
    match_score: int = Field(ge=0, le=100, description="Overall fit between resume and job description, 0-100")
    summary: str = Field(description="2-3 sentence overall verdict on how well the candidate fits")
    matched_skills: list[str] = Field(description="Short skill/tool names (1-4 words) that the job asks for and the resume clearly demonstrates")
    missing_skills: list[str] = Field(description="Short skill/tool names (1-4 words) that the job asks for and the resume lacks")
    experience_gaps: list[str] = Field(description="Gaps in seniority, years, domain, or responsibilities vs. the job")
    recommended_improvements: list[Improvement] = Field(description="Specific, actionable resume improvements")
    strengths: list[str] = Field(description="Strong points of the resume that are relevant to this job")
    ats_keywords_to_add: list[str] = Field(description="Exact keywords from the job description worth adding to the resume")