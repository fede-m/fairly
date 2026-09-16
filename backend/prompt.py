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

PROMPT_UNCERTAIN = """You are an Italian language assistant specializing in inclusive language.  

INPUT:
- Text: {text}
- Spans: {spans}  

The spans contain a list of dictionaries that have:
- as key: a unique id composed of the startChar_endChar indexes of the span in the text
- as value: the corresponding text segment from the text

TASK:
For each span, perform the following two steps:
1. Evaluation: Assess whether the span is genuinely non-inclusive within the context of the provided text.
2. Action:
   - If the span IS non-inclusive: rewrite it using the following reformulation strategy:
     {reformulation_strategy}
   - If the span IS NOT non-inclusive (already inclusive or neutral): return the original span text exactly as provided, without any changes.

NOTES:
- Process every span individually.
- Return an entry for every input span_id.
- Make sure that each span_id in the output matches its corresponding input span_id precisely.
- For spans judged inclusive, preserve identical casing, punctuation, and wording.
- Return only the resulting key-value pairs without adding commentary or justification.
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