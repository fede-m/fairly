from pydantic import BaseModel, Field, field_validator
from enum import Enum
from typing import List,Dict

class AlternativeTypes(Enum):
    CV = "Conservative Visibility"
    IO = "Innovative Obscuration"
    CO = "Conservative Obscuration"
    IV = "Innovative Visibility"


class Alternative(BaseModel):
    type: AlternativeTypes = Field(..., description="The type of strategy used")
    alternative: str = Field(..., description="Inclusive reformulation of the incorrect span using the current strategy") 

class Alternatives(BaseModel):
    span_id: str = Field(..., description="Unique ID for the span, e.g. start_end_tokens")
    alternatives: List[Alternative] = Field(..., description="Exactly 4 Alternative objects, one for each strategy" )

    # Validate there are exactly 4 alternatives
    @field_validator("alternatives")
    def check_length(cls, v):
        if len(v) != 4:
            raise ValueError("alternatives must contain exactly 4 items")
        return v

class LLMOutput(BaseModel):
    result: List[Alternatives]

class Span(BaseModel):
    span_id: str
    start_char: int
    end_char: int
    tokens: list[str]
    alternatives: Dict[str,str]

class InputData(BaseModel):
    id: str
    text: str

class OutputData(BaseModel):
    text: str
    unfair_spans: list[Span]

class Request(BaseModel):
    data: list[InputData]

class Response(BaseModel):
    data: dict[str,OutputData]