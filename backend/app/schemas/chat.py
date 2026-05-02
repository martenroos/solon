from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator


ChatRole = Literal["system", "user", "assistant", "tool"]
ExecutionMode = Literal["single_agent", "multi_agent"]


class ChatMessage(BaseModel):
    role: ChatRole
    content: str = Field(min_length=1)
    name: str | None = None
    tool_call_id: str | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    conversation_id: str | None = None
    system_prompt: str | None = None
    tools: list[str] = Field(default_factory=list)
    agent: str = "analyst"
    execution_mode: ExecutionMode = "single_agent"
    metadata: dict[str, Any] = Field(default_factory=dict)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_output_tokens: int | None = Field(default=None, ge=1, le=8192)


class ChatToolCall(BaseModel):
    id: str
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    status: Literal["requested", "completed", "failed"]
    output: Any | None = None
    error: str | None = None


class ChatToolInfo(BaseModel):
    name: str
    description: str
    input_schema: dict[str, Any] = Field(default_factory=dict)


ChartType = Literal["line", "bar", "area", "pie"]
TaskStatus = Literal["backlog", "in_progress", "review", "done"]
TaskPriority = Literal["High", "Medium", "Low"]


class ChatChartSeries(BaseModel):
    key: str = Field(min_length=1)
    label: str = Field(min_length=1)
    color: str | None = None


class ChatChart(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    type: ChartType
    title: str = Field(min_length=1)
    description: str | None = None
    data: list[dict[str, Any]] = Field(min_length=1)
    series: list[ChatChartSeries] = Field(default_factory=list)
    x_key: str | None = None
    label_key: str | None = None
    value_key: str | None = None
    stacked: bool = False
    source_query_sql: str | None = None

    @model_validator(mode="after")
    def validate_chart_shape(self) -> "ChatChart":
        if self.type in {"line", "bar", "area"}:
            if not self.x_key:
                raise ValueError(f"{self.type} charts require x_key.")
            if not self.series:
                raise ValueError(f"{self.type} charts require at least one series.")

            for index, row in enumerate(self.data):
                if self.x_key not in row:
                    raise ValueError(f"Row {index} is missing x_key '{self.x_key}'.")
                for series in self.series:
                    if series.key not in row:
                        raise ValueError(f"Row {index} is missing series key '{series.key}'.")
                    if not isinstance(row[series.key], (int, float)):
                        raise ValueError(
                            f"Row {index} field '{series.key}' must be numeric for {self.type} charts."
                        )

        if self.type == "pie":
            if not self.label_key:
                raise ValueError("Pie charts require label_key.")
            if not self.value_key:
                raise ValueError("Pie charts require value_key.")

            for index, row in enumerate(self.data):
                if self.label_key not in row:
                    raise ValueError(f"Row {index} is missing label_key '{self.label_key}'.")
                if self.value_key not in row:
                    raise ValueError(f"Row {index} is missing value_key '{self.value_key}'.")
                if not isinstance(row[self.value_key], (int, float)):
                    raise ValueError(
                        f"Row {index} field '{self.value_key}' must be numeric for pie charts."
                    )

        return self


class ChatTask(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str = Field(min_length=1, max_length=160)
    owner_id: int | None = None
    owner_name: str = Field(default="Unassigned", min_length=1, max_length=120)
    priority: TaskPriority = "Medium"
    status: TaskStatus = "backlog"


class ChatArtifact(BaseModel):
    type: Literal["chart", "task"]
    chart: ChatChart | None = None
    task: ChatTask | None = None

    @model_validator(mode="after")
    def validate_artifact_payload(self) -> "ChatArtifact":
        if self.type == "chart" and self.chart is None:
            raise ValueError("Chart artifacts require a chart payload.")
        if self.type == "task" and self.task is None:
            raise ValueError("Task artifacts require a task payload.")
        return self


class ChatAgentInfo(BaseModel):
    id: str
    name: str
    description: str
    default_tools: list[str] = Field(default_factory=list)
    allowed_tools: list[str] = Field(default_factory=list)


class ChatCapabilitiesResponse(BaseModel):
    provider: str
    default_model: str | None = None
    supported_execution_modes: list[ExecutionMode]
    available_agents: list[ChatAgentInfo] = Field(default_factory=list)
    available_tools: list[ChatToolInfo]


class ChatResponse(BaseModel):
    conversation_id: str
    agent: str
    execution_mode: ExecutionMode
    message: ChatMessage
    tool_calls: list[ChatToolCall] = Field(default_factory=list)
    artifacts: list[ChatArtifact] = Field(default_factory=list)
    model: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class StoredConversationMessage(BaseModel):
    id: int
    role: ChatRole
    agent_name: str | None = None
    type: str
    message: str
    artifact: ChatArtifact | None = None
    created_at: str


class ConversationResponse(BaseModel):
    conversation_id: str
    agent: str
    messages: list[StoredConversationMessage]


class ConversationListItem(BaseModel):
    conversation_id: str
    agent: str
    title: str
    preview: str | None = None
    created_at: str


class ConversationListResponse(BaseModel):
    conversations: list[ConversationListItem]
