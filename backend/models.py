from pydantic import BaseModel, Field, model_validator
from enum import Enum
from datetime import datetime, timezone

class Span(BaseModel):
    """Represents a span of text identified as unfair."""
    span_id: str = Field(..., description="Unique identifier for the span")
    start_char: int = Field(..., description="Start character index of the span in the original text")
    end_char: int = Field(..., description="End character index of the span in the original text")
    tokens: list[str] = Field(..., description="List of tokens belonging to the span")
    reformulation: str = Field(..., description="Reformulation for the span using the current strategy")

class Reformulation(BaseModel):
    """Represents a reformulated fair version of a text span."""
    span_id: str = Field(..., description="Unique identifier for the span")
    reformulation: str = Field(..., description="Inclusive reformulation of the incorrect span using the current strategy")


class LLMOutput(BaseModel):
    """Result from the LLM containing reformulations for spans."""
    result: list[Reformulation] = Field(..., description="List of reformulated spans")

class InputData(BaseModel):
    id: str = Field(..., description="Unique id identifying the document")
    text: str = Field(..., description="The text of the document to analyse")

class OutputData(BaseModel):
    text: str = Field(..., description="The text of the analysed document")
    unfair_spans: list[Span] = Field(..., description="A list of detected spans together with their reformulation according to the selected strategy")

class Request(BaseModel):
    data: list[InputData] = Field(..., description="List of documents sent from the frontend")
    strategy: str = Field(..., description="String describyng the strategy type (CV, CO, IO, IV) and the specific option as an id (e.g. CV-1)")
    session_id: str = Field(..., description="Current session id")
    user_id: str = Field(..., description="User identifier")
class Response(BaseModel):
    results: dict[str,OutputData] = Field(..., description="The results of the analysis to send to the frontend")

class EventType(str, Enum):
    ACCEPT = "accept"
    REFUSE = "refuse"
    EDIT = "edit"
    REVERT = "revert"
    ANALYSIS = "analysis"

class RefuseReason(str, Enum):
    FAILURE = "request_failure"
    USER_REFUSE = "user_refuse"
    REFRESH = "analysis_refresh"
class SpanEvent(BaseModel):
    original: str
    reformulation: str
    current_used: str
    user_form: str | None = None # Only used for edit event
    
class EventRequest(BaseModel):
    event: EventType
    spans: list[SpanEvent]
    session_id: str
    user_id: str
    email_id: str
    timestamp: datetime = Field(default_factory= lambda: datetime.now(timezone.utc))
    strategy: str | None = None
    refuse_reason: RefuseReason | None = None

    @model_validator(mode="after")
    def validate_user_form(self):
        if self.event == EventType.REFUSE and self.refuse_reason is None:
            raise ValueError("reason is required for refuse events")
        for span in self.spans:
            if self.event == EventType.EDIT and span.user_form is None:
                raise ValueError("user_form is required for edit events")
        
        return self