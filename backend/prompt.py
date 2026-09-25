# TODO: For each strategy, specify how to deal with:
# - adjectives
# - articles
# - explicit relative pronous (i quali, le quali etc.)
STRATEGIES = {
    "CV": ["""Conservative Visibility (CV): Provide both masculine and feminine forms of the expression. 
              - Examples: 
                    1) i professori → i professori e le professoresse
                    2) i docenti → i docenti e le docenti
                    3) gli studenti → gli studenti e le studentesse
                    4) i rappresentanti degli studenti → i rappresentanti e le rappresentanti degli e delle studenti
                    5) tutti → tutti e tutte
              """
            , 
          """Conservative Visibility (CV): Provide both masculine and feminine forms of the expression. 
              - Examples: 
                    1) i professori → i/le professori/esse
                    2) i docenti → i/le docenti
                    3) gli studenti → gli/le studenti
                    4) i rappresentanti degli studenti → i/le rappresentanti degli/delle studenti
                    5) tutti → tutti/e
          """
          ],

    "CO": ["""Conservative Obscuration (CO):  Reformulate the span to avoid indicating gender.
              - Examples: 
                1) "i professori" → "il corpo docente" or "coloro che insegnano" 
                2) i docenti → il corpo docente
                3) gli studenti → la comunità studentesca
                4) i rappresentanti degli studenti → il personale di rappresentanza studentesca
                5) tutti → tutte le persone               
            """],
              
    "IO":"""Innovative Obscuration (IO): Use novel, gender-neutral markers. In this case, use symbol {symbol}.
              - Examples: 
                1) i professori → l{symbol} professor{symbol}
                2) i docenti → l{symbol} docenti
                3) gli studenti → l{symbol} studenti
                4) i rappresentanti degli studenti → l{symbol} rappresentant{symbol} de{symbol} student{symbol}
                5) tutti → tutt{symbol}
                6) invitati → invitat{symbol}
                7) numerosi → numeros{symbol}
         """,
    
    "IV": ["""Innovative Visibility (IV): Provide masculine and feminine forms **and** the gender-neutral form using symbol *.
              - Example: "i professori" → "i professori, le professoresse e l* professor*"
          """,

          """Innovative Visibility (IV): Provide masculine and feminine forms **and** the gender-neutral form using symbol *.
              - Example: "i professori" → "i/le/l* professori/e/*"
          """
           ]
}


INNOVATIVE_SYMBOLS_EXAMPLES = ["*", "@", "x", "u", "ə"]
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