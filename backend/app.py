# app.py
import os 
from dotenv import load_dotenv
import json, time
from fastapi.responses import StreamingResponse
from fastapi.encoders import jsonable_encoder


load_dotenv() 
import asyncio
import httpx
from dedalus_labs import AsyncDedalus
from dedalus_labs.utils.stream import stream_async
from dedalus_labs.lib.runner import DedalusRunner

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# Nessie API Configuration (Capital One Hackathon API)
NESSIE_BASE_URL = os.getenv("NESSIE_BASE_URL", "http://api.nessieisreal.com")
NESSIE_API_KEY = os.getenv("NESSIE_API_KEY")

# Agent Configuration
MODEL_ID = os.getenv("MODEL_ID", "anthropic/claude-opus-4-5")
SEARCH_MCP_IMAGE = os.getenv("SEARCH_MCP_IMAGE", "tsion/exa") # Using Exa for high-quality news search
MCP_SERVERS = [SEARCH_MCP_IMAGE]

SYSTEM_PROMPT = """\
You are an expert Compliance Adjudication Agent. Your goal is to clear innocent clients of false positive "Adverse Media" alerts.

**Customer Data Tools** - for identifying customer information: 
- get_customer_profile: Given a Customer ID, returns their legal name and address. Use this to identify the person before running news searches.

**Exa Search Tools** — for research:
- exa_search: Web search for news, analysis, SEC filings, earnings reports
- exa_find_similar: Find pages similar to a given URL
- exa_get_contents: Fetch full text content from URLs

**YOUR WORKFLOW:**
1. **Enrich Profile:** You will receive a Customer ID or Name. Use the tool `get_customer_profile` immediately to get their Location.
2. **Scan News:** Use `exa_search` (or search tool) to find "adverse news" or "money laundering" allegations associated with the client's name.
3. **Adjudicate (The Reasoning Engine):**
   - Compare the Customer Profile (Age, Location) vs. the Suspect in the news.
   - IF the ages/locations don't match -> Verdict: FALSE POSITIVE.
   - IF they match and the crime is real -> Verdict: ESCALATE.

**OUTPUT FORMAT:**
Always output your final answer as a "Decision Card":

## Decision Card
**Verdict:** [False Positive / Escalate]
**Confidence:** [0-100%]
**Evidence:** [One sentence explaining the mismatch, e.g., "Client is 24, Suspect is 55."]
**Sources:** [If ESCALATE, you MUST include links and sources of the news articles. If FALSE POSITIVE, list "None" or relevant clearings.]

**Draft Memo:**
[Write a formal 3-sentence legal SAR paragraph clearing the client or detailing the findings.]

**JSON Summary:**
At the very end of your response, you MUST output a single valid JSON block (surrounded by ```json and ```) containing:
{
  "full_name": "Name of the person investigated",
  "initials": "Initials (e.g. JD)",
  "date": "Today's date (YYYY-MM-DD)",
  "status": "Positive" or "Negative" (Use Positive if adverse media is found/escalated, Negative if clear/false positive),
  "match_score": "A score from 0-100 indicating how strong the match is",
  "description": "A very concise 1-sentence summary of the finding."
}
"""

# Helper: Parse hacked fields from street name
def parse_customer_data(data):
    """
    Parses the raw Nessie customer data to extract Age and Occupation 
    which are hacked into the street_name field with '||' delimiters.
    """
    if not data:
        return None
        
    address = data.get('address', {})
    street_name = address.get('street_name', '')
    
    # Defaults
    age = None
    occupation = None
    
    # Parse "Pine Street || Age: 68 || Occupation: Teacher"
    if '||' in street_name:
        parts = street_name.split('||')
        clean_street = parts[0].strip()
        
        # Update address to remove the hacked part
        address['street_name'] = clean_street
        data['address'] = address
        
        # Extract fields
        for part in parts[1:]:
            part = part.strip()
            lower = part.lower()
            if lower.startswith('age:'):
                try:
                    age = int(part.split(':')[1].strip())
                except:
                    pass
            elif lower.startswith('occupation:') or lower.startswith('role:'):
                occupation = part.split(':')[1].strip()
            elif lower.startswith('citizenship:') or lower.startswith('citizen:'):
                data['citizenship'] = part.split(':')[1].strip()
            elif lower.startswith('tenure:'):
                data['tenure'] = part.split(':')[1].strip()
            elif lower.startswith('products:'):
                products_str = part.split(':')[1].strip()
                data['products'] = [p.strip() for p in products_str.split(',')]
            elif lower.startswith('taxresidency:') or lower.startswith('tax:'):
                data['taxResidency'] = part.split(':')[1].strip()
    
    # Inject into top-level
    if age:
        data['age'] = age
    if occupation:
        data['occupation'] = occupation
        
    return data

async def get_customer_profile(customer_id: str) -> str:
    """
    Retrieves the legal name, address, age, and occupation of a customer from Nessie.
    Use this to identify the person before running news searches.
    """
    print(customer_id)
    url = f"{NESSIE_BASE_URL}/customers/{customer_id}?key={NESSIE_API_KEY}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        if resp.status_code == 200:
            data = parse_customer_data(resp.json())
            
            profile = f"Name: {data.get('first_name')} {data.get('last_name')}"
            profile += f", Address: {data.get('address')}"
            
            if data.get('age'):
                profile += f", Age: {data.get('age')}"
            if data.get('occupation'):
                profile += f", Occupation: {data.get('occupation')}"
                
            return profile
        return f"Error: Customer {customer_id} not found."
    

async def run_dedalus_agent(initial_input: str):
    """Initializes and runs the Dedalus agent for a single turn."""
    client = AsyncDedalus()
    runner = DedalusRunner(client, verbose=False)

    messages = [{"role": "user", "content": initial_input}]

    print(f"\n\033[94mInput Customer Data:\033[0m {initial_input}")
    print("\033[90mAgent is thinking... (Scanning Database & Web)\033[0m")

    stream = runner.run(
        instructions=SYSTEM_PROMPT,
        messages=messages,
        mcp_servers=MCP_SERVERS,
        model=MODEL_ID,
        tools=[get_customer_profile],
        max_steps=10,
        stream=True,
    )
    await stream_async(stream)


# --- FastAPI App ---
app = FastAPI(title="Compliance Adjudication API")

origins = [
    "https://sentinel-gva5.onrender.com/*",
    "https://sentinel-gva5.onrender.com",
    "https://sentinel-pi-steel.vercel.app",
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Retrieve ALL Customer Information
@app.get("/customers")
async def get_all_customers():
    """Fetches the list of all customers from the Nessie database."""
    url = f"{NESSIE_BASE_URL}/customers?key={NESSIE_API_KEY}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        if resp.status_code == 200:
            customers = resp.json()
            # Parse all customers
            return [parse_customer_data(c) for c in customers]
        return {"error": "Failed to fetch customers"}

# 2. Retrieve Raw Data for Single Customer
@app.get("/customers/{customer_id}")
async def get_single_customer(customer_id: str):
    """Fetches raw profile data for a single customer ID (for UI display)."""
    url = f"{NESSIE_BASE_URL}/customers/{customer_id}?key={NESSIE_API_KEY}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        if resp.status_code == 200:
            return parse_customer_data(resp.json())
        return {"error": "Customer not found"}
    
def sse(event_type: str, data: dict) -> str:
    return f"event: {event_type}\n" + "data: " + json.dumps(data, ensure_ascii=False) + "\n\n"

@app.get("/adjudicate/{customer_id}")
async def adjudicate_customer(customer_id: str):
    async def event_generator():
        client = AsyncDedalus()
        runner = DedalusRunner(client, verbose=False)

        stream = runner.run(
            instructions=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Investigate Customer ID: {customer_id}"}],
            mcp_servers=MCP_SERVERS,
            model=MODEL_ID,
            tools=[get_customer_profile],
            max_steps=10,
            stream=True,
        )

        yield sse("run_started", {"customer_id": customer_id, "ts": time.time()})

        seen_tool_call_ids = set()

        async for event in stream:
            # normalize event
            try:
                evt = event.model_dump()
            except Exception:
                evt = jsonable_encoder(event)

            if isinstance(evt, dict) and evt.get("choices"):
                delta = (evt["choices"][0].get("delta") or {})

                # 1) text
                content = delta.get("content")
                if content:
                    yield sse("token", {"delta": content})

                # 2) tool calls (dedupe by tool_call.id)
                tool_calls = delta.get("tool_calls") or []
                for tc in tool_calls:
                    tc_id = tc.get("id")
                    fn = (tc.get("function") or {})
                    name = fn.get("name")

                    if tc_id and tc_id not in seen_tool_call_ids:
                        seen_tool_call_ids.add(tc_id)
                        yield sse("tool_call_started", {
                            "id": tc_id,
                            "tool": name,
                            "ts": time.time(),
                        })

        yield sse("run_finished", {"customer_id": customer_id, "ts": time.time()})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# if __name__ == "__main__":
#     # Test run
#     # Using David Hines (ID: 6986e2c495150878eaff1dba)
#     asyncio.run(run_dedalus_agent("Investigate Customer ID: 6986e2c495150878eaff1dba"))

