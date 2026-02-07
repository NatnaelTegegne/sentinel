# app.py
import os 
import asyncio
import httpx
from dedalus_labs import AsyncDedalus
from dedalus_labs.utils.stream import stream_async
from dedalus_labs.lib.runner import DedalusRunner

from fastapi import FastAPI
from fastapi.responses import StreamingResponse

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

**Draft Memo:**
[Write a formal 3-sentence legal SAR paragraph clearing the client.]
"""

async def get_customer_profile(customer_id: str) -> str:
    """
    Retrieves the legal name and address of a customer from Nessie.
    Use this to identify the person before running news searches.
    """
    print(customer_id)
    url = f"{NESSIE_BASE_URL}/customers/{customer_id}?key={NESSIE_API_KEY}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        if resp.status_code == 200:
            data = resp.json()
            return f"Name: {data.get('first_name')} {data.get('last_name')}, Address: {data.get('address')}"
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

# 1. Retrieve ALL Customer Information
@app.get("/customers")
async def get_all_customers():
    """Fetches the list of all customers from the Nessie database."""
    url = f"{NESSIE_BASE_URL}/customers?key={NESSIE_API_KEY}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        return resp.json() if resp.status_code == 200 else {"error": "Failed to fetch customers"}

# 2. Retrieve Raw Data for Single Customer
@app.get("/customers/{customer_id}")
async def get_single_customer(customer_id: str):
    """Fetches raw profile data for a single customer ID (for UI display)."""
    url = f"{NESSIE_BASE_URL}/customers/{customer_id}?key={NESSIE_API_KEY}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        return resp.json() if resp.status_code == 200 else {"error": "Customer not found"}

# 3. Stream Agent Adjudication
@app.get("/adjudicate/{customer_id}")
async def adjudicate_customer(customer_id: str):
    """
    Runs the Dedalus Agent for a specific customer and streams the reasoning 
    and final verdict back to the client token-by-token.
    """
    async def event_generator():
        client = AsyncDedalus()
        runner = DedalusRunner(client, verbose=False)
        
        # Initial instruction with the specific ID
        initial_input = f"Investigate Customer ID: {customer_id}"

        # Create the stream generator
        stream = runner.run(
            instructions=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": initial_input}],
            mcp_servers=MCP_SERVERS,
            model=MODEL_ID,
            tools=[get_customer_profile], # Pass the python tool directly
            max_steps=10,
            stream=True, 
        )

        # Iterate through the stream events and yield them to the HTTP client
        async for event in stream:
            # We yield the string representation of the event (or event.content)
            # You may format this as Server-Sent Events (SSE) if needed.
            yield str(event) + "\n"

    return StreamingResponse(event_generator(), media_type="text/plain")

# if __name__ == "__main__":
#     # Test run
#     # Using David Hines (ID: 6986e2c495150878eaff1dba)
#     asyncio.run(run_dedalus_agent("Investigate Customer ID: 6986e2c495150878eaff1dba"))

