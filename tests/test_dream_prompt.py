import unittest

from src.divination.dream import DREAM_PROMPT


class DreamPromptTests(unittest.TestCase):
    def test_prompt_defines_immersive_reading_sections(self) -> None:
        expected_sections = (
            "01 梦里发生了什么",
            "02 意象正在诉说什么",
            "03 你内心的回声",
            "04 它与近期生活的连接",
            "05 给今天的一个小行动",
            "梦醒之后",
        )

        for section in expected_sections:
            self.assertIn(section, DREAM_PROMPT)

        self.assertNotIn("梦境关键词", DREAM_PROMPT)
        self.assertNotIn("反引号包裹", DREAM_PROMPT)

    def test_prompt_keeps_interpretation_safe_and_grounded(self) -> None:
        self.assertIn("不要把梦境解释成确定的预言", DREAM_PROMPT)
        self.assertIn("不得假定用户一定经历了某件事", DREAM_PROMPT)
        self.assertIn("仅供娱乐与自我反思", DREAM_PROMPT)


if __name__ == "__main__":
    unittest.main()
