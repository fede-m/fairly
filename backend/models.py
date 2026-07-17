from pydantic import BaseModel, Field, model_validator
from enum import Enum
from datetime import datetime, timezone


class Span(BaseModel):
    """Represents a span of text identified as unfair."""

    span_id: str = Field(..., description="Unique identifier for the span")
    start_char: int = Field(
        ..., description="Start character index of the span in the original text"
    )
    end_char: int = Field(
        ..., description="End character index of the span in the original text"
    )
    tokens: list[str] = Field(..., description="List of tokens belonging to the span")
    reformulation: str = Field(
        ..., description="Reformulation for the span using the current strategy"
    )


class Reformulation(BaseModel):
    """Represents a reformulated fair version of a text span."""

    span_id: str = Field(..., description="Unique identifier for the span")
    reformulation: str = Field(
        ...,
        description="Inclusive reformulation of the incorrect span using the current strategy",
    )


class LLMOutput(BaseModel):
    """Result from the LLM containing reformulations for spans."""

    result: list[Reformulation] = Field(..., description="List of reformulated spans")


class InputData(BaseModel):
    id: str = Field(..., description="Unique id identifying the document")
    text: str = Field(..., description="The text of the document to analyse")
    char_length: int = Field(..., description="Number of characters in text")
    word_count: int = Field(..., description="Number of words in text")


class OutputData(BaseModel):
    text: str = Field(..., description="The text of the analysed document")
    unfair_spans: list[Span] = Field(
        ...,
        description="A list of detected spans together with their reformulation according to the selected strategy",
    )


class Request(BaseModel):
    data: list[InputData] = Field(
        ..., description="List of documents sent from the frontend"
    )
    strategy: str = Field(
        ...,
        description="String describyng the strategy type (CV, CO, IO, IV) and the specific option as an id (e.g. CV-1)",
    )
    session_id: str = Field(..., description="Current session id")
    user_id: str = Field(..., description="User identifier")


class Response(BaseModel):
    results: dict[str, OutputData] = Field(
        ..., description="The results of the analysis to send to the frontend"
    )


class EventType(str, Enum):
    ACCEPT = "accept"
    REFUSE = "refuse"
    EDIT = "edit"
    ANALYSIS = "analysis"
    SEND = "send"


class RefuseReason(str, Enum):
    FAILURE = "request_failure"
    USER_REFUSE = "user_refuse"
    REFRESH = "analysis_refresh"


class SpanEvent(BaseModel):
    span_id: str
    # start_char: int
    # end_char: int
    original: str
    reformulation: str
    current_used: str
    user_form: str | None = None  # Optional: Only used for edit event


class StoreEventRequest(BaseModel):
    event: EventType
    text: str | None = (
        None  # On send event, if fairly was not used, text is None, otherwise it is the anonymized text
    )
    spans: list[SpanEvent]
    session_id: str
    user_id: str
    email_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    fairly_used: bool | None = (
        None  # flag for send event (whether user used Fairly in that email or not)
    )
    strategy: str | None = None
    is_all: bool | None = None  # refuse or accept single spans or all spans
    refuse_reason: RefuseReason | None = None
    email_char_count: int | None = None
    email_word_count: int | None = None

    @model_validator(mode="after")
    def validate_user_form(self):
        if self.event == EventType.REFUSE and self.refuse_reason is None:
            raise ValueError("reason is required for refuse events")
        if (self.event == EventType.ANALYSIS) and (
            self.email_char_count is None or self.email_word_count is None
        ):
            raise ValueError(
                "email length metrics are required for send and analysis events"
            )
        if (
            self.event == EventType.ACCEPT or self.event == EventType.REFUSE
        ) and self.is_all is None:
            raise ValueError("is_all is required for accept and refuse events")
        if self.event == EventType.EDIT:
            for span in self.spans:
                if span.user_form is None:
                    raise ValueError("user_form is required for edit events")
        return self


class InfoEventRequest(BaseModel):
    event: str = Field(default_factory=lambda: "info")
    user_id: str
    session_id: str
    strategy: str
    findout_more: bool
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class User(BaseModel):
    user_id: str
    inserted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    strategy_order: list[str]
