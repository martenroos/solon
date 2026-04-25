from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from app.models.user import User
from app.schemas.chat import ChatArtifact, ChatChart, ChatToolInfo

ToolHandler = Callable[[dict[str, Any], "ToolExecutionContext"], Awaitable[Any]]


@dataclass(slots=True)
class ToolEmittedMessage:
    message_type: str
    message: str
    artifact: ChatArtifact | None = None


@dataclass(slots=True)
class ToolExecutionContext:
    user: User
    metadata: dict[str, Any]
    emitted_messages: list[ToolEmittedMessage] = field(default_factory=list)

    def emit_artifact(self, artifact: ChatArtifact) -> None:
        self.emitted_messages.append(
            ToolEmittedMessage(
                message_type=artifact.type,
                message=artifact.model_dump_json(),
                artifact=artifact,
            )
        )

    def consume_emitted_messages(self) -> list[ToolEmittedMessage]:
        emitted = list(self.emitted_messages)
        self.emitted_messages.clear()
        return emitted


@dataclass(slots=True)
class ChatTool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: ToolHandler

    async def execute(self, arguments: dict[str, Any], context: ToolExecutionContext) -> Any:
        return await self.handler(arguments, context)

    def to_info(self) -> ChatToolInfo:
        return ChatToolInfo(
            name=self.name,
            description=self.description,
            input_schema=self.input_schema,
        )


class ToolRegistry:
    def __init__(self, tools: list[ChatTool] | None = None) -> None:
        self._tools: dict[str, ChatTool] = {}
        for tool in tools or []:
            self.register(tool)

    def register(self, tool: ChatTool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> ChatTool | None:
        return self._tools.get(name)

    def list_tools(self, names: list[str] | None = None) -> list[ChatTool]:
        if not names:
            return list(self._tools.values())
        return [tool for name in names if (tool := self._tools.get(name)) is not None]

    def list_tool_info(self) -> list[ChatToolInfo]:
        return [tool.to_info() for tool in self._tools.values()]


async def render_chart_tool(arguments: dict[str, Any], context: ToolExecutionContext) -> dict[str, Any]:
    chart = ChatChart.model_validate(arguments)
    context.emit_artifact(ChatArtifact(type="chart", chart=chart))
    return {
        "status": "chart_recorded",
        "chart_id": chart.id,
        "chart_type": chart.type,
        "title": chart.title,
    }


def build_tool_registry() -> ToolRegistry:
    return ToolRegistry(
        tools=[
            ChatTool(
                name="render_chart",
                description=(
                    "Create a chart artifact for the frontend sidebar. "
                    "Use this when a visual helps explain the answer. "
                    "Supported chart types: line, bar, area, pie. "
                    "Always include non-empty data. "
                    "For line/bar/area charts include x_key and at least one series, and every data row must include numeric values for each series key. "
                    "For pie charts include label_key and value_key, and every data row must include a label plus a numeric value."
                ),
                input_schema={
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "id": {"type": "string"},
                        "type": {"type": "string", "enum": ["line", "bar", "area", "pie"]},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "data": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": ["string", "number", "boolean", "null"]
                                },
                            },
                        },
                        "series": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "key": {"type": "string"},
                                    "label": {"type": "string"},
                                    "color": {"type": "string"},
                                },
                                "required": ["key", "label"],
                            },
                        },
                        "x_key": {"type": "string"},
                        "label_key": {"type": "string"},
                        "value_key": {"type": "string"},
                        "stacked": {"type": "boolean"},
                    },
                    "required": ["type", "title", "data"],
                },
                handler=render_chart_tool,
            )
        ]
    )
