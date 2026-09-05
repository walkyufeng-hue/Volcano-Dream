from dataclasses import dataclass, field
from typing import Any, Literal


RiskLevel = Literal["normal", "elevated"]


@dataclass
class EmotionalContext:
    """Shared state passed through the emotional AI skill workflow."""

    raw_input: str
    scenario: str = "dream"
    risk_level: RiskLevel = "normal"
    risk_signals: list[str] = field(default_factory=list)
    system_instructions: list[str] = field(default_factory=list)
    skill_trace: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def add_instruction(self, instruction: str) -> None:
        self.system_instructions.append(instruction.strip())

    def mark_skill_complete(self, skill_name: str) -> None:
        self.skill_trace.append(skill_name)
