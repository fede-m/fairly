# TODO: For each strategy, specify how to deal with:
# - adjectives
# - articles
# - explicit relative pronous (i quali, le quali etc.)
STRATEGIES = {
    "CV": ["""Conservative Visibility (CV): Provide both masculine and feminine forms of the expression. 
              - Example: i professori → i professori e le professoresse"""
            , 
          """Conservative Visibility (CV): Provide both masculine and feminine forms of the expression. 
              - Example: i professori → i/le professori/esse"""
          ],

    "CO": ["""Conservative Obscuration (CO):  Reformulate the span to avoid indicating gender.
              - Example: "i professori" → "il corpo docente" or "coloro che insegnano" """],
              
    "IO":"""Innovative Obscuration (IO): Use novel, gender-neutral markers. In this case, use symbol {symbol}.
              - Example: i professori → {example}
         """,
    
    "IV": ["""Innovative Visibility (IV): Provide masculine and feminine forms **and** the gender-neutral form using symbol *.
              - Example: "i professori" → "i professori, le professoresse e l* professor*"
          """,

          """Innovative Visibility (IV): Provide masculine and feminine forms **and** the gender-neutral form using symbol *.
              - Example: "i professori" → "i/le/l* professori/e/*"
          """
           ]
}


INNOVATIVE_SYMBOLS_EXAMPLES = [("*", "l* professor*"), ("@","l@ professor@"), ("x", "lx professorx"), "lu professoru", "lə professorə"]

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
- Return one alternative for each span in the input. You MUST provide an alternative for each span.
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