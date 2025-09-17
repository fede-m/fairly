PROMPT = """You are an Italian language assistant specializing in rewriting non-inclusive spans.  

INPUT:
- Text: {text}
- Spans: {spans}  

The spans contain a list of dictionaries that have:
- as key a unique id composed by the startChar_endChar indexes of the span in the text
- as value the corresponding part in the text that needs to be changed

TASK:
For each span, provide 4 alternative rewritings according to these strategies:
1. Conservative Visibility (CV): Provide both masculine and feminine forms of the expression. 
  - Example: "i professori" → "i professori e le professoresse"
2. Innovative Obscuration (IO): Use novel, gender-neutral markers like the schwa "ə".
  - Example: "i professori" → "lə professorə"
3. Conservative Obscuration (CO):  Reformulate the span to avoid indicating gender.
  - Example: "i professori" → "il corpo docente" or "coloro che insegnano"
4. Innovative Visibility (IV): Provide masculine and feminine forms **and** the gender-neutral form with schwa "ə".
  - Example: "i professori" → "i professori, le professoresse e lə professorə"

NOTES:
- Ensure each span has exactly 4 alternatives.
- Always include all 4 strategy types, labeled with their names.
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