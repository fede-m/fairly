DETECTION_MODEL = "fairly-org/fairly-detection-v1"
# The tokenizer is shipped with the detection model
TOKENIZER_MODEL = DETECTION_MODEL
# Same as "char_map" in the model's detection_config.json: applied to each word before tokenization
DETECTION_CHAR_MAP = {"ə": "*", "Ə": "*", "ǝ": "*", "ɜ": "*", "з": "*"}
# GENERATION_MODEL = "groq/llama-3.3-70b-versatile"
#GENERATION_MODEL = "SLURM.utopia/qwen3.8:27b"
GENERATION_MODEL = "SLURM.utopia/gpt-oss:120b"