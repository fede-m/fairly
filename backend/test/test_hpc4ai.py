import requests
import os
from dotenv import load_dotenv
from openai import OpenAI
import instructor
from pydantic import BaseModel, Field

load_dotenv()

hcp4ai_url = "https://utopia.hpc4ai.unito.it/api/"
API_KEY = os.getenv("OPENWEB_API", "")
MODEL = "SLURM.qwen3:32b-fp16"

client = OpenAI(
    base_url = hcp4ai_url,
    api_key = API_KEY
)

client = instructor.patch(client, mode = instructor.Mode.JSON)

class PersonInfo(BaseModel):
    name: str = Field(..., description= "name of the person")
    surname: str = Field(..., description= "surname of the person")
    age: str = Field(..., description= "age of the person")


response = client.chat.completions.create(
    model = MODEL,
    messages = [
        {"role": "user", "content": "Extract the info from the following text: 'John Steel, 14 years old, was found dead in a slump.'"}
    ],
    response_model = PersonInfo
)

print(response)



# REQUESTS  option
# headers = {
#     "Authorization": f'Bearer {API_KEY}',
#     'Content-Type': 'application/json'
# }

# data = {
#     "model": MODEL,
#     "messages": [
#         {
#             "role": "user",
#             "content": "Organize the information using the given 'John Steel, 14 years old, was found dead in a slump.'"
#         }
#     ]
# }

# response = requests.post(hcp4ai_url, headers=headers, json = data)
# print(response.json())
