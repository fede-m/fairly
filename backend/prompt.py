# TODO: For each strategy, specify how to deal with:
# - adjectives
# - articles
# - explicit relative pronous (i quali, le quali etc.)
STRATEGIES = {
    "CV": """Conservative Visibility (CV): Provide both masculine and feminine forms of the expression. 
              - Example: i professori → i professori e le professoresse
          """,
    "IO":"""Innovative Obscuration (IO): Use novel, gender-neutral markers. In this case, use symbol {symbol}.
              - Example: i professori → {example}
         """,
    "CO": """Conservative Obscuration (CO):  Reformulate the span to avoid indicating gender.
              - Example: "i professori" → "il corpo docente" or "coloro che insegnano" 
          """,
    "IV": """Innovative Visibility (IV): Provide masculine and feminine forms **and** the gender-neutral form using symbol {symbol}.
              - Example: "i professori" → "i professori, le professoresse e {example}"
          """
}


INNOVATIVE_SYMBOLS_EXAMPLES = {
    "ə": """lə professorə""",
    "*": """l* professor*""",
    "@": """l@ professor@""",
    "x": """lx professorx""",
    "u": """lu professoru"""
}



PROMPT = """You are an Italian language assistant specializing in rewriting non-inclusive spans.  

INPUT:
- Text: {text}
- Spans: {spans}  

The spans contain a list of dictionaries that have:
- as key a unique id composed by the startChar_endChar indexes of the span in the text
- as value the corresponding part in the text that needs to be changed

TASK:
For each span, provide a reformulation of the span text using the following reformulation strategy:
{reformulation_strategy}

NOTES:
- Return one alternative for each span in the input
- Make sure that the span_id corresponds precisely with the corresponding input span_id
"""


# {{
#   "spans": [
#     {{
#       "span_id": str, 
#       "alternatives": [
#         {{"type": "Conservative Visibility", "alternative": "..."}},
#         {{"type": "Innovative Obscuration", "alternative": "..."}},
#         {{"type": "Conservative Obscuration", "alternative": "..."}},
#         {{"type": "Innovative Visibility", "alternative": "..."}}
#       ]
#     }}
#   ]
# }}