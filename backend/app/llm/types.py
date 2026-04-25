from dataclasses import dataclass, field
from typing import Any, Literal


MessageRole = Literal["system", "user", "assistant", "tool"]


@dataclass(slots=True)
class LLMToolDefinition:
    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass(slots=True)
class LLMToolCall:
    id: str
    name: str
    arguments: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class LLMMessage:
    role: MessageRole
    content: str
    name: str | None = None
    tool_call_id: str | None = None
    tool_calls: list[LLMToolCall] = field(default_factory=list)


@dataclass(slots=True)
class LLMRequest:
    messages: list[LLMMessage]
    system_prompt: str | None = None
    tools: list[LLMToolDefinition] = field(default_factory=list)
    temperature: float | None = None
    max_output_tokens: int | None = None


@dataclass(slots=True)
class LLMResponse:
    message: LLMMessage
    model: str | None = None
    finish_reason: str | None = None
