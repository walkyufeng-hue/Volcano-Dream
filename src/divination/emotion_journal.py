from src.models import DivinationBody
from src.workflows import EmotionJournalWorkflow

from .base import DivinationFactory, PreparedDivination


EMOTION_JOURNAL_WORKFLOW = EmotionJournalWorkflow()
EMOTION_JOURNAL_PROMPT = (
    EMOTION_JOURNAL_WORKFLOW.build_default_system_prompt()
)


class EmotionJournalFactory(DivinationFactory):

    divination_type = "emotion_journal"

    def prepare(self, divination_body: DivinationBody) -> PreparedDivination:
        prepared = EMOTION_JOURNAL_WORKFLOW.prepare(divination_body.prompt)
        return PreparedDivination(
            prompt=prepared.user_prompt,
            system_prompt=prepared.system_prompt,
            metadata={
                "workflow": EMOTION_JOURNAL_WORKFLOW.name,
                "skills": prepared.context.skill_trace,
                "risk_level": prepared.context.risk_level,
            },
        )

    def build_prompt(self, divination_body: DivinationBody) -> tuple[str, str]:
        prepared = self.prepare(divination_body)
        return prepared.prompt, prepared.system_prompt
