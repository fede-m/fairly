from pydantic import BaseModel, Field, field_validator
from enum import Enum
from typing import List,Dict

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
    result: List[Reformulation] = Field(..., description="List of reformulated spans")

class InputData(BaseModel):
    id: str = Field(..., description="Unique id identifying the document")
    text: str = Field(..., description="The text of the document to analyse")

class OutputData(BaseModel):
    text: str = Field(..., description="The text of the analysed document")
    unfair_spans: list[Span] = Field(..., description="A list of detected spans together with their reformulation according to the selected strategy")

class Request(BaseModel):
    data: list[InputData] = Field(..., description="List of documents sent from the frontend")
    strategy: str = Field(..., description="String describyng the strategy type (CV, CO, IO, IV) and the specific option as an id (e.g. CV-1)")

class Response(BaseModel):
    results: dict[str,OutputData] = Field(..., description="The results of the analysis to send to the frontend")