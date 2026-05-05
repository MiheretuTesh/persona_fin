# The Complete Guide to Using Claude to Its Full Potential

A practical, plain-English guide that covers **Claude (the chat assistant)**, **Claude Code (the CLI for developers)**, and **the Claude API (for builders)**. Use the table of contents to jump to what you need.

---

## Table of Contents

1. [What Claude Is (and Which Version to Use)](#1-what-claude-is-and-which-version-to-use)
2. [Choosing the Right Model](#2-choosing-the-right-model)
3. [Prompting Fundamentals](#3-prompting-fundamentals)
4. [Advanced Prompting Techniques](#4-advanced-prompting-techniques)
5. [Claude Code: The Developer CLI](#5-claude-code-the-developer-cli)
6. [Claude Code Power Features](#6-claude-code-power-features)
7. [The Claude API for Developers](#7-the-claude-api-for-developers)
8. [Tool Use (Function Calling)](#8-tool-use-function-calling)
9. [Prompt Caching](#9-prompt-caching)
10. [Extended Thinking](#10-extended-thinking)
11. [Vision, Files, and Multimodal](#11-vision-files-and-multimodal)
12. [Memory, Context, and Long Conversations](#12-memory-context-and-long-conversations)
13. [Safety, Privacy, and Limitations](#13-safety-privacy-and-limitations)
14. [Workflows and Recipes](#14-workflows-and-recipes)
15. [Troubleshooting](#15-troubleshooting)
16. [References and Further Reading](#16-references-and-further-reading)

---

## 1. What Claude Is (and Which Version to Use)

**Claude** is Anthropic's family of AI assistants. You can access Claude through several products, each suited to different use cases.

| Product | Best For | Where |
|---|---|---|
| **Claude.ai** (web/mobile/desktop) | Chat, writing, research, image analysis | claude.ai |
| **Claude Code** | Coding, refactoring, repo-wide tasks in your terminal/IDE | CLI + VS Code/JetBrains extensions |
| **Claude API** | Building Claude into your own apps | api.anthropic.com |
| **Claude in Slack/Teams/Other** | Workplace integration | Via integrations |

> **Tip:** If you write code, install **Claude Code**. It can read, edit, and run your project — far more useful than copy-pasting code into a chat window.

---

## 2. Choosing the Right Model

The Claude 4.X family (latest at time of writing) has three tiers. Pick based on the trade-off between **quality**, **speed**, and **cost**.

| Model | Strength | Use When |
|---|---|---|
| **Claude Opus 4.7** | Highest reasoning, deepest analysis | Complex coding, architecture, tricky reasoning, long-form work |
| **Claude Sonnet 4.6** | Balanced — strong, fast, affordable | Day-to-day coding, drafting, most production apps |
| **Claude Haiku 4.5** | Fastest, cheapest | High-volume tasks, simple classifications, short responses |

**Rule of thumb:** Start with Sonnet. Move to Opus when Sonnet is making mistakes you can't easily correct. Use Haiku when latency or cost dominates.

When building applications, **default to the latest models** — they are typically smarter, faster, and cheaper than their predecessors.

---

## 3. Prompting Fundamentals

Good prompts share four ingredients. Forgetting any one of them is the most common cause of disappointing answers.

### 3.1 Be specific about the goal

> Bad: "Write something about climate."
>
> Good: "Write a 300-word executive summary of the IPCC AR6 findings on sea-level rise, aimed at a non-technical board of directors. Avoid jargon; use one analogy."

### 3.2 Give context

Tell Claude **who you are**, **who the audience is**, and **what success looks like**.

> "I'm a backend engineer reviewing a junior's PR. The code is Python 3.11 using FastAPI. Identify correctness bugs first, then suggest stylistic improvements separately."

### 3.3 Show, don't just tell

Few-shot examples are extremely powerful. Two or three good examples often beat a paragraph of instructions.

```
Convert these to API names:

Input: "user's full name" → Output: user_full_name
Input: "is account active?" → Output: is_account_active
Input: "last login timestamp" → Output:
```

### 3.4 Specify the format

Ask explicitly for JSON, a table, bullet points, a numbered list, or "no preamble." Claude will follow it.

> "Return only a JSON object with keys `summary` (string) and `risks` (array of strings). No commentary."

---

## 4. Advanced Prompting Techniques

### 4.1 Use structure — XML-style tags

Claude has been trained to recognize XML tags as structure. They reliably separate instructions from data.

```xml
<instructions>
Summarize the document in 3 bullets.
</instructions>

<document>
{paste content here}
</document>
```

### 4.2 Assign a role

```
You are a senior security engineer reviewing OAuth flows.
Be skeptical and assume the worst case.
```

### 4.3 Ask for reasoning ("think step by step")

For math, logic, or multi-step problems, prompt Claude to reason out loud before answering. Even better: use **extended thinking** mode (see §10).

### 4.4 Pre-fill the assistant's response

In the API you can start Claude's reply for it — useful for forcing a JSON response or a specific tone:

```python
messages=[
  {"role": "user", "content": "Give me JSON about Paris."},
  {"role": "assistant", "content": "{"}   # forces JSON start
]
```

### 4.5 Iterate, don't restart

If the first answer is close but not right, **say what's off** and ask for a revision. Don't re-engineer the whole prompt — Claude has the context already.

> "Good, but make it more concise and drop the second paragraph."

### 4.6 Define stopping criteria

Tell Claude when it's done.

> "Keep refactoring until every function in `auth.py` is under 30 lines, then stop and list what you changed."

---

## 5. Claude Code: The Developer CLI

Claude Code is Anthropic's official CLI for software engineering. It can read your repo, edit files, run commands, and use tools — all under your supervision.

### 5.1 Install

```bash
# macOS / Linux / Windows (via npm)
npm install -g @anthropic-ai/claude-code

# or with Homebrew
brew install claude-code
```

Then in any project directory:

```bash
claude
```

### 5.2 Where it runs

| Environment | How |
|---|---|
| **Terminal CLI** | `claude` in any directory |
| **VS Code / Cursor** | Install the Claude Code extension |
| **JetBrains IDEs** | Install the Claude Code plugin |
| **Web** | claude.ai/code |
| **Desktop App** | Available for Mac and Windows |

### 5.3 Core interactions

| Action | How |
|---|---|
| Ask a question | Just type it |
| Reference a file | `@path/to/file.ts` |
| Run a shell command | Type the command and confirm; Claude can run it for you |
| Plan before editing | Press <kbd>Shift</kbd>+<kbd>Tab</kbd> to enter Plan Mode |
| Cancel mid-action | <kbd>Esc</kbd> |
| Get help | `/help` |

### 5.4 Useful built-in slash commands

| Command | What It Does |
|---|---|
| `/init` | Generate a `CLAUDE.md` summarizing the project for future sessions |
| `/clear` | Reset the conversation |
| `/compact` | Summarize the conversation to free up context |
| `/review` | Review a pull request |
| `/security-review` | Run a security audit on pending changes |
| `/config` | Open settings |
| `/help` | List all commands |

---

## 6. Claude Code Power Features

### 6.1 `CLAUDE.md` — give Claude long-term project memory

Drop a `CLAUDE.md` file at the root of your repo. Claude reads it at the start of every session. Use it for:

- Coding conventions ("we use 2-space indents, no semicolons")
- Domain glossary ("a *Workspace* is a tenant; a *Project* belongs to one Workspace")
- Build/test commands ("run `pnpm test:unit` before committing")
- Things to avoid ("do not edit `legacy/` — it's auto-generated")

Run `/init` to bootstrap one automatically.

### 6.2 Subagents

Claude Code can spawn **specialized agents** for parallel work — e.g. one searches the codebase while another reviews a PR. These run in isolation and report back.

Common built-in agents:

- `Explore` — fast, read-only codebase search
- `Plan` — designs implementation strategies
- `general-purpose` — multi-step research and tasks

### 6.3 Hooks

Hooks are shell commands that fire on events (before/after tool use, on stop, etc.). Configure them in `.claude/settings.json`. Use them to:

- Run a linter automatically after Claude edits files
- Block writes to certain paths
- Notify you when a long task finishes

Ask: **"set up a hook that runs eslint after every edit"** — Claude can configure it for you.

### 6.4 MCP (Model Context Protocol) servers

MCP lets Claude connect to external tools — databases, GitHub, Slack, browser automation, your private APIs, etc. Hundreds of community servers are available.

```bash
claude mcp add github         # Add a server
claude mcp list               # See what's connected
```

### 6.5 Permission modes

Claude Code asks before doing risky things. You can adjust:

- **Default:** Confirms each new tool/command
- **Auto-accept edits:** Trusts file edits but still asks for shell commands
- **Plan mode:** Read-only — Claude proposes a plan but won't change anything

Toggle with <kbd>Shift</kbd>+<kbd>Tab</kbd>.

### 6.6 Resumable sessions

Closed your terminal? Run `claude --resume` to pick up where you left off, full context intact.

### 6.7 Background agents and scheduling

For long-running tasks (e.g. "watch the CI build and tell me when it fails"), Claude Code can run agents in the background or on a cron schedule.

---

## 7. The Claude API for Developers

To build Claude into your own product, use the API. Get a key at **console.anthropic.com**.

### 7.1 Minimal Python example

```python
from anthropic import Anthropic

client = Anthropic()  # reads ANTHROPIC_API_KEY from env

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Explain prompt caching in one paragraph."}
    ],
)
print(response.content[0].text)
```

### 7.2 Minimal TypeScript example

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const msg = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello, Claude" }],
});

console.log(msg.content[0].type === "text" ? msg.content[0].text : "");
```

### 7.3 The system prompt

The `system` parameter sets persistent instructions — role, tone, rules. It doesn't count as user input.

```python
client.messages.create(
    model="claude-sonnet-4-6",
    system="You are a terse SQL expert. Reply with only the query.",
    max_tokens=512,
    messages=[{"role": "user", "content": "Find users created in the last 7 days."}],
)
```

### 7.4 Streaming

For chat UIs, stream tokens as they arrive:

```python
with client.messages.stream(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Write a haiku."}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

---

## 8. Tool Use (Function Calling)

Tool use lets Claude call your code. You declare functions; Claude decides when to invoke them and with what arguments.

```python
tools = [{
    "name": "get_weather",
    "description": "Get current weather for a city.",
    "input_schema": {
        "type": "object",
        "properties": {
            "city": {"type": "string"}
        },
        "required": ["city"],
    },
}]

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "What's the weather in Tokyo?"}],
)
```

If Claude wants to use a tool, the response contains a `tool_use` block. You execute the tool, then send the result back as a `tool_result` message. Repeat until Claude returns a normal text reply.

**Tips:**

- Write **clear, detailed descriptions** for each tool — that's how Claude decides what to call.
- Keep argument schemas small and obvious. Don't expose 30 optional fields.
- For multi-step agents, let Claude call tools in a loop until it stops.

---

## 9. Prompt Caching

If your prompts include large, **repeated** content (a system prompt, a long document, a knowledge base), prompt caching can cut latency and cost dramatically — often by **5x to 10x** on cached portions.

```python
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": LARGE_KNOWLEDGE_BASE,  # 50,000 tokens of docs
            "cache_control": {"type": "ephemeral"},
        }
    ],
    messages=[{"role": "user", "content": "What does X mean?"}],
)
```

**Rules of thumb:**

- Cache content **once**, reuse it many times within ~5 minutes.
- Put cached content **first** (system prompt, then static context, then dynamic user input).
- A cache hit costs ~10% of a normal token; a write costs ~125%. The break-even is roughly **2 reads** of the same content.

> Always include prompt caching when building Claude API apps with stable system prompts or large fixed context.

---

## 10. Extended Thinking

Extended thinking gives Claude room to **reason internally** before answering. It's like "show your work" but private — Claude thinks longer for harder problems.

When to enable:

- Complex math or logic
- Multi-step coding tasks
- Strategic planning
- Anything where Claude has been making careless mistakes

```python
response = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 8000},
    messages=[{"role": "user", "content": "Solve this constraint problem..."}],
)
```

**Trade-off:** It uses more tokens and is slower. Worth it for hard problems; overkill for "what's the capital of France."

---

## 11. Vision, Files, and Multimodal

Claude can read **images** (PNG, JPG, GIF, WebP) and **PDFs** directly.

```python
import base64

with open("chart.png", "rb") as f:
    image_data = base64.standard_b64encode(f.read()).decode("utf-8")

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image_data}},
            {"type": "text", "text": "What's the trend shown here?"}
        ],
    }],
)
```

In **Claude.ai** and **Claude Code**, just paste or drag the file in.

**Good uses:**

- Reading screenshots, diagrams, whiteboard photos
- Extracting structured data from PDFs and tables
- UI critique from a screenshot
- Math from a hand-written photo

---

## 12. Memory, Context, and Long Conversations

### 12.1 Context windows

Recent Claude models have very large context windows — **200,000 tokens by default**, with **1,000,000-token** variants for tasks like reading entire codebases or long documents. Roughly: 1 token ≈ 4 characters in English.

### 12.2 What to do with all that space

- Drop in entire source files instead of summarizing
- Provide the whole spec, not excerpts
- Include past conversation logs for continuity

### 12.3 Compaction

When a conversation gets very long, use `/compact` (Claude Code) or summarize old messages yourself in API apps. It preserves the key points while freeing space.

### 12.4 Persistent memory (Claude Code)

Claude Code can write to a memory directory across sessions — facts about you, your preferences, ongoing projects. Just tell it: **"Remember that we use pnpm, never npm."**

---

## 13. Safety, Privacy, and Limitations

### 13.1 What Claude won't do

Claude refuses to help with content that's harmful, illegal, or dangerous. It will assist with **legitimate security work** (CTFs, audits, defensive engineering) when context is clear.

### 13.2 Hallucinations

Claude can be confidently wrong. **Always verify** anything load-bearing — citations, statistics, code that touches production, library APIs you can't recall.

A useful pattern:

> "Cite sources for any factual claim. If you're not sure, say so."

### 13.3 Data and privacy

- API and Claude Code data is **not used to train models** by default.
- Free-tier Claude.ai conversations may be reviewed; check the current policy.
- Don't paste secrets, customer PII, or proprietary code into systems you don't control.

### 13.4 Knowledge cutoff

Each model has a training-data cutoff date. For news, library versions, or very recent events, give Claude up-to-date context — or use a tool that does (web search, API calls).

---

## 14. Workflows and Recipes

### 14.1 Code review

> "Review the diff in `feature/payments`. Focus on: race conditions, missing error handling, and unsafe SQL. Output a checklist with file:line references."

### 14.2 Refactor with a budget

> "Refactor `auth.py` to remove the global state. Constraints: keep the public API identical, all existing tests must still pass, and don't change more than 200 lines."

### 14.3 Bug hunt

> "Tests in `cart.spec.ts` fail intermittently with a timeout. Read the test, the SUT, and recent changes. Hypothesize causes ranked by likelihood. Then write the smallest experiment to confirm the top one."

### 14.4 Documentation

> "Generate a README for this package. Include: install, quick-start example, API reference for the exported functions, and three common pitfalls."

### 14.5 Drafting and writing

> "Draft a 400-word product launch email. Voice: confident but not breathless. Audience: existing customers. End with a single CTA."

### 14.6 Data extraction

> "From the attached PDF, extract every line item into JSON: `{date, vendor, amount, currency}`. Skip headers and totals."

### 14.7 Research synthesis

> "Read these three papers (attached). Compare their methods on a table, then write a one-paragraph synthesis of where they agree and disagree."

---

## 15. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Vague or generic answer | Prompt under-specifies | Add role, audience, format, examples |
| Claude won't follow format | Instructions buried | Put format requirements **last** and use XML tags |
| Wrong info confidently | Hallucination | Provide source material; ask Claude to cite or say "unknown" |
| Refuses something benign | Over-cautious | Add legitimate context (your role, the use case) |
| Truncated answer | Hit `max_tokens` | Raise `max_tokens` or ask for a shorter answer |
| Slow response | Model too large or thinking enabled | Switch to Sonnet/Haiku, disable thinking |
| Claude Code can't see a file | Path wrong, or `.gitignore`'d | Use `@path` reference, check ignore rules |
| API: rate-limited | Burst exceeded | Implement exponential backoff; check tier limits |

---

## 16. References and Further Reading

### Official documentation

- **Claude API docs** — https://docs.anthropic.com
- **Claude Code docs** — https://docs.claude.com/en/docs/claude-code
- **Anthropic Cookbook** (recipes & examples) — https://github.com/anthropics/anthropic-cookbook
- **Prompt Engineering Guide** — https://docs.anthropic.com/claude/docs/prompt-engineering
- **Tool Use Guide** — https://docs.anthropic.com/claude/docs/tool-use
- **Prompt Caching Guide** — https://docs.anthropic.com/claude/docs/prompt-caching
- **Model Context Protocol (MCP)** — https://modelcontextprotocol.io

### Tools and SDKs

- **Python SDK** — https://github.com/anthropics/anthropic-sdk-python
- **TypeScript SDK** — https://github.com/anthropics/anthropic-sdk-typescript
- **Claude Code repo** — https://github.com/anthropics/claude-code
- **Anthropic Console** (API keys, usage) — https://console.anthropic.com

### Community

- **Anthropic Discord** — linked from anthropic.com
- **Claude Code issues / feedback** — https://github.com/anthropics/claude-code/issues
- **Awesome Claude Prompts** — search GitHub for community prompt libraries

---

## Quick Reference: Five Habits That Pay Off

1. **Front-load context.** Tell Claude who you are, what you want, and what "done" looks like — *before* asking the question.
2. **Use examples.** Two good examples beat a paragraph of instructions.
3. **Iterate.** Don't rewrite the prompt; tell Claude what to fix.
4. **Match the model to the task.** Sonnet for most things, Opus for hard reasoning, Haiku for volume.
5. **Verify what matters.** Treat Claude as a brilliant intern: fast and smart, but check the work before it ships.

---

*Last updated: 2026-04-29. Models, pricing, and feature availability change frequently — always check the official Anthropic docs for the current state.*
