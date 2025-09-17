from pydantic import BaseModel, Field, field_validator
from enum import Enum
from typing import List,Dict


class Span(BaseModel):
    """Represents a span of text identified as unfair."""
    span_id: str = Field(..., description="Unique identifier for the span")
    start_char: int = Field(..., description="Start character index of the span in the original text")
    end_char: int = Field(..., description="End character index of the span in the original text")
    tokens: list[str] = Field(..., description="List of tokens belonging to the span")
    alternative: str = Field(..., description="Reformulation for the span using the current strategy")

class Reformulation(BaseModel):
    """Represents a reformulated fair version of a text span."""
    span_id: str = Field(..., description="Unique identifier for the span")
    alternative: str = Field(..., description="Inclusive reformulation of the incorrect span using the current strategy")


class LLMOutput(BaseModel):
    """Result from the LLM containing reformulations for spans."""
    result: List[Reformulation] = Field(..., description="List of reformulated spans")

# Detection models
class DetectionInput(BaseModel):
    """Input for unfairness detection."""
    id: str = Field(..., description="Unique identifier for the document")
    text: str = Field(..., description="Text to analyze")

class DetectedSpans(BaseModel):
    """Detected spans that need to be reformulated"""
    text: str = Field(..., description="Original text")
    unfair_spans: List[Span] = Field(..., description="List of detected unfair spans within the text")


class DetectionRequest(BaseModel):
    """Request model for batch unfairness detection"""
    documents: List[DetectionInput] = Field(..., description="List of documents to analyze")

class DetectionResponse(BaseModel):
    """Response model for batch unfairness detection."""
    results: Dict[str, DetectedSpans] = Field(..., description="Mapping from document ID to detection output (containing the detected spans)")


# Generation Models
class GenerationRequest(BaseModel):
    """Request model for generating reformulations."""
    detected_spans: Dict[str, DetectedSpans] = Field(..., description="Unfair spans detected during detection that need to be reformulated")
    reformulation_type: str = Field(..., description = "Type of reformulation to apply")
    innovative_symbol: str = Field(..., description = "For the innovative reformulation types, provide the symbol to use")

class GenerationResponse(BaseModel):
    """Response model for generated reformulations."""
    reformulated_results: Dict[str, DetectedSpans] = Field(..., description="Mapping from document ID to unfair spans with reformulation")

