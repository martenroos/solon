"""The agent tool loop, driven by a scripted fake LLM provider (no database or API key)."""

import asyncio
import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.llm import build_tool_registry
from app.llm.types import LLMMessage, LLMRequest, LLMResponse, LLMToolCall
from app.schemas.chat import ChatMessage, ChatRequest
from app.services import chat as chat_service
from app.services.chat import ChatOrchestrator
from app.services.chat_agents import build_chat_agent_registry


class ScriptedProvider:
    """Returns pre-baked responses in order and records every request it receives."""

    def __init__(self, responses: list[LLMResponse]) -> None:
        self._responses = list(responses)
        self.requests: list[LLMRequest] = []

    async def generate(self, llm_request: LLMRequest) -> LLMResponse:
        # Snapshot the messages: the orchestrator keeps appending to the same list.
        self.requests.append(
            LLMRequest(
                messages=list(llm_request.messages),
                system_prompt=llm_request.system_prompt,
                tools=llm_request.tools,
            )
        )
        return self._responses.pop(0)


def answer(text: str) -> LLMResponse:
    return LLMResponse(message=LLMMessage(role="assistant", content=text), model="fake-model")


def call_tool(name: str, arguments: dict, call_id: str = "call_1") -> LLMResponse:
    return LLMResponse(
        message=LLMMessage(
            role="assistant",
            content="",
            tool_calls=[LLMToolCall(id=call_id, name=name, arguments=arguments)],
        ),
        model="fake-model",
    )


@pytest.fixture
def persisted(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    """Replace conversation storage with an in-memory list."""
    stored: list[dict] = []

    async def fake_history(_session, *, conversation_id):
        return [ChatMessage(role="user", content="Who owes us the most?")]

    def fake_append(_session, **kwargs):
        stored.append(kwargs)

    monkeypatch.setattr(chat_service, "list_llm_messages_for_conversation", fake_history)
    monkeypatch.setattr(chat_service, "append_message", fake_append)
    return stored


def run_agent(provider: ScriptedProvider, *, max_round_trips: int = 4, tools: list[str] | None = None):
    settings = SimpleNamespace(
        llm_system_prompt="You are a test analyst.",
        llm_max_tool_round_trips=max_round_trips,
        llm_provider="fake",
        llm_model="fake-model",
    )
    orchestrator = ChatOrchestrator(
        settings=settings,
        provider=provider,
        tool_registry=build_tool_registry(),
        agent_registry=build_chat_agent_registry(),
    )
    request = ChatRequest(
        messages=[ChatMessage(role="user", content="Who owes us the most?")],
        tools=tools or [],
    )
    return asyncio.run(
        orchestrator._run_single_agent(request, SimpleNamespace(id=1), "conv-1", session=None)
    )


def test_plain_answer_without_tools(persisted: list[dict]) -> None:
    provider = ScriptedProvider([answer("Acme BV owes the most.")])

    result = run_agent(provider)

    assert result.message.content == "Acme BV owes the most."
    assert result.tool_calls == []
    assert result.model == "fake-model"
    assert len(provider.requests) == 1
    assert persisted[-1]["role"] == "assistant"
    assert persisted[-1]["message"] == "Acme BV owes the most."


def test_agent_gets_default_tools_and_schema_guide(persisted: list[dict]) -> None:
    provider = ScriptedProvider([answer("ok")])

    run_agent(provider)

    request = provider.requests[0]
    assert [tool.name for tool in request.tools] == ["query_finance_db"]
    assert "Finance warehouse query guide" in request.system_prompt


def test_tool_result_is_fed_back_and_artifact_emitted(persisted: list[dict]) -> None:
    provider = ScriptedProvider(
        [
            call_tool("add_task_to_board", {"title": "Chase Acme BV invoice", "priority": "High"}),
            answer("I added a follow-up task."),
        ]
    )

    result = run_agent(provider, tools=["add_task_to_board"])

    assert result.message.content == "I added a follow-up task."
    assert [(call.name, call.status) for call in result.tool_calls] == [("add_task_to_board", "completed")]
    assert len(result.artifacts) == 1
    assert result.artifacts[0].task.title == "Chase Acme BV invoice"

    # Second model call sees its own tool call followed by the tool result.
    second_messages = provider.requests[1].messages
    assert second_messages[-2].tool_calls[0].name == "add_task_to_board"
    tool_message = second_messages[-1]
    assert tool_message.role == "tool"
    assert tool_message.tool_call_id == "call_1"
    assert json.loads(tool_message.content)["result"]["status"] == "task_recorded"

    assert [record["message_type"] for record in persisted] == ["tool", "task", "message"]


def test_tool_error_is_returned_to_model_so_it_can_recover(persisted: list[dict]) -> None:
    provider = ScriptedProvider(
        [
            call_tool("query_finance_db", {"sql": "DELETE FROM core.fact_budget"}),
            answer("I can only read data, so I did not change anything."),
        ]
    )

    result = run_agent(provider)

    assert result.tool_calls[0].status == "failed"
    assert "Only SELECT or WITH" in result.tool_calls[0].error
    tool_message = provider.requests[1].messages[-1]
    assert "Only SELECT or WITH" in json.loads(tool_message.content)["error"]
    assert result.message.content.startswith("I can only read data")


def test_unknown_or_inactive_tool_is_reported_as_failed(persisted: list[dict]) -> None:
    # render_chart exists but was not enabled for this request.
    provider = ScriptedProvider(
        [
            call_tool("render_chart", {"type": "bar", "title": "x", "data": [{"a": 1}]}),
            answer("Charts are not available here."),
        ]
    )

    result = run_agent(provider)

    assert result.tool_calls[0].status == "failed"
    assert result.tool_calls[0].error == "Tool 'render_chart' is not registered."
    assert result.artifacts == []


def test_loop_stops_at_round_trip_limit(persisted: list[dict]) -> None:
    provider = ScriptedProvider(
        [call_tool("query_finance_db", {"sql": "DROP TABLE x"}, call_id=f"call_{i}") for i in range(3)]
    )

    result = run_agent(provider, max_round_trips=3)

    assert len(provider.requests) == 3
    assert len(result.tool_calls) == 3
    assert result.message.content.startswith("I could not complete the database query workflow.")
    assert persisted[-1]["message"] == result.message.content


def test_rejects_tools_the_agent_is_not_allowed_to_use(persisted: list[dict]) -> None:
    provider = ScriptedProvider([])

    with pytest.raises(HTTPException) as exc_info:
        run_agent(provider, tools=["delete_everything"])

    assert exc_info.value.status_code == 400
    assert "delete_everything" in exc_info.value.detail
    assert provider.requests == []
