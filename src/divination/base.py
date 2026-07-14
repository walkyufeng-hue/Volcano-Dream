
from dataclasses import dataclass, field
from typing import Any, Optional

from src.models import DivinationBody


@dataclass(frozen=True)
class PreparedDivination:
    prompt: str
    system_prompt: str
    metadata: dict[str, Any] = field(default_factory=dict)


class MetaDivination(type):

    divination_map = {}

    def __init__(cls, name, bases, attrs):
        super().__init__(name, bases, attrs)
        if hasattr(cls, 'divination_type'):
            MetaDivination.divination_map[cls.divination_type] = cls


class DivinationFactory(metaclass=MetaDivination):

    @staticmethod
    def get(divination_type: str) -> Optional["DivinationFactory"]:
        cls = MetaDivination.divination_map.get(divination_type)
        if cls is None:
            return
        return cls()

    def build_prompt(self, divination_body: DivinationBody) -> tuple[str, str]:
        return '', ''

    def prepare(self, divination_body: DivinationBody) -> PreparedDivination:
        prompt, system_prompt = self.build_prompt(divination_body)
        return PreparedDivination(prompt=prompt, system_prompt=system_prompt)
