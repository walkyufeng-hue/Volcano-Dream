import unittest

from src.image_router import build_emotion_image_prompt, build_image_prompt
from src.skills import DreamImageGenerationSkill


class DreamImagePromptTests(unittest.TestCase):
    def test_dream_is_the_highest_priority_visual_source(self) -> None:
        prompt = build_image_prompt(
            "我梦见站在海边，远处有一座发光的火山。",
            "这可能象征积蓄的力量。建议近期记录自己的情绪。",
        )

        self.assertIn("画面事实｜最高优先级", prompt)
        self.assertIn("不要因为下方解读而添加", prompt)
        self.assertIn("解读内容只能影响色彩、光线、天气、空间感和情绪张力", prompt)

    def test_prompt_requires_one_continuous_scene(self) -> None:
        prompt = build_image_prompt("我在森林里奔跑。", "可能代表寻找方向。")

        self.assertIn("完整连续的单一场景", prompt)
        self.assertIn("禁止拼贴、分屏、网格、漫画格", prompt)
        self.assertIn("横向16:9", prompt)

    def test_prompt_limits_interpretation_influence_and_length(self) -> None:
        dream = "梦" * 600
        interpretation = "解" * 900
        prompt = build_image_prompt(dream, interpretation)

        self.assertIn("梦" * 500, prompt)
        self.assertNotIn("梦" * 501, prompt)
        self.assertIn("解" * 700, prompt)
        self.assertNotIn("解" * 701, prompt)

    def test_image_generation_skill_keeps_primary_then_fallback_order(
        self,
    ) -> None:
        skill = DreamImageGenerationSkill(
            api_base="https://example.com/v1",
            api_key="test-key",
            primary_model="primary-image-model",
            fallback_model="fallback-image-model",
        )

        self.assertEqual(
            skill.model_candidates,
            ("primary-image-model", "fallback-image-model"),
        )

    def test_emotion_image_uses_event_facts_and_one_emotional_tone(
        self,
    ) -> None:
        prompt = build_emotion_image_prompt(
            "今天完成了一项重要工作，回家后坐在窗边休息。",
            "你可能同时感到放松和疲惫，需要一点安静的空间。",
        )

        self.assertIn("用户记录｜事实参考", prompt)
        self.assertIn("一种最主要的情绪", prompt)
        self.assertIn("完整连续的单一场景", prompt)
        self.assertIn("不要复刻真实人物面容", prompt)


if __name__ == "__main__":
    unittest.main()
