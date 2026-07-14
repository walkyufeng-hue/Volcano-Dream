from src.models import DivinationBody
from src.workflows import DreamEmotionWorkflow

from .base import DivinationFactory, PreparedDivination


DREAM_WORKFLOW = DreamEmotionWorkflow()
DREAM_PROMPT = DREAM_WORKFLOW.build_default_system_prompt()


class DreamFactory(DivinationFactory):

    divination_type = "dream"

    def prepare(self, divination_body: DivinationBody) -> PreparedDivination:
        prepared = DREAM_WORKFLOW.prepare(divination_body.prompt)
        return PreparedDivination(
            prompt=prepared.user_prompt,
            system_prompt=prepared.system_prompt,
            metadata={
                "workflow": DREAM_WORKFLOW.name,
                "skills": prepared.context.skill_trace,
                "risk_level": prepared.context.risk_level,
            },
        )

    def build_prompt(self, divination_body: DivinationBody) -> tuple[str, str]:
        prepared = self.prepare(divination_body)
        return prepared.prompt, prepared.system_prompt
