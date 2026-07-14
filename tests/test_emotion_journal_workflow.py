import unittest

from src.divination import DivinationFactory
from src.divination.emotion_journal import EMOTION_JOURNAL_PROMPT
from src.models import DivinationBody
from src.workflows import EmotionJournalWorkflow


class EmotionJournalWorkflowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.workflow = EmotionJournalWorkflow()

    def test_journal_uses_shared_and_scenario_specific_skills(self) -> None:
        prepared = self.workflow.prepare(
            "今天完成了一项拖了很久的工作，松了一口气，也有些疲惫。"
        )

        self.assertEqual(
            prepared.context.skill_trace,
            [
                "input_guard",
                "safety_guard",
                "life_event_analysis",
                "emotion_mapping",
                "emotion_journal_response",
            ],
        )
        self.assertEqual(prepared.context.scenario, "emotion_journal")

    def test_journal_prompt_has_emotional_reflection_structure(self) -> None:
        expected_sections = (
            "01 今天发生了什么",
            "02 此刻的情绪线索",
            "03 情绪背后的需要",
            "04 换一个温柔的角度",
            "05 给此刻的一个小行动",
            "写给今天",
        )

        for section in expected_sections:
            self.assertIn(section, EMOTION_JOURNAL_PROMPT)

        self.assertIn("不替代专业心理或医疗建议", EMOTION_JOURNAL_PROMPT)

    def test_high_risk_journal_switches_to_safety_response(self) -> None:
        prepared = self.workflow.prepare("我现在想自杀，不知道该怎么办。")

        self.assertEqual(prepared.context.risk_level, "elevated")
        self.assertIn("安全支持回应", prepared.system_prompt)
        self.assertNotIn("life_event_analysis", prepared.context.skill_trace)
        self.assertNotIn("emotion_mapping", prepared.context.skill_trace)

    def test_emotion_journal_factory_is_registered(self) -> None:
        factory = DivinationFactory.get("emotion_journal")
        self.assertIsNotNone(factory)

        body = DivinationBody(
            prompt="今天有些累，但也完成了重要的事情。",
            prompt_type="emotion_journal",
        )
        prepared = factory.prepare(body) if factory else None

        self.assertIsNotNone(prepared)
        self.assertEqual(
            prepared.metadata["workflow"] if prepared else "",
            "emotion_journal_workflow",
        )


if __name__ == "__main__":
    unittest.main()
