import unittest
from pydantic import ValidationError

from src.divination.dream import DREAM_PROMPT, dream_analysis_to_markdown
from src.models import DreamAnalysis


class DreamPromptTests(unittest.TestCase):
    def test_prompt_defines_structured_dream_fields(self) -> None:
        expected_fields = (
            "schema_version",
            "title",
            "essence",
            "summary",
            "moods",
            "symbols",
            "people",
            "scenes",
            "traits",
            "psychological_view",
            "cultural_view",
            "reflection_questions",
            "image_prompt",
        )

        for field in expected_fields:
            self.assertIn(field, DREAM_PROMPT)

        self.assertIn("JSON Schema", DREAM_PROMPT)
        self.assertIn("不要输出 Markdown", DREAM_PROMPT)

    def test_prompt_keeps_both_views_safe_and_grounded(self) -> None:
        self.assertIn("不要把梦境解释成确定的预言", DREAM_PROMPT)
        self.assertIn("不得假定用户一定经历了某件事", DREAM_PROMPT)
        self.assertIn("不声称这是科学结论", DREAM_PROMPT)
        self.assertIn("不算命、不预测未来", DREAM_PROMPT)
        self.assertIn("仅供娱乐与自我反思", DREAM_PROMPT)

    def test_analysis_schema_rejects_unknown_fields_and_moods(self) -> None:
        payload = self.make_analysis_payload()
        payload["unknown"] = "not allowed"
        with self.assertRaises(ValidationError):
            DreamAnalysis.model_validate(payload)

        payload = self.make_analysis_payload()
        payload["moods"] = ["恐惧"]
        with self.assertRaises(ValidationError):
            DreamAnalysis.model_validate(payload)

    def test_analysis_allows_no_symbol_when_dream_has_no_grounded_image(self) -> None:
        payload = self.make_analysis_payload()
        payload["symbols"] = []
        analysis = DreamAnalysis.model_validate(payload)
        self.assertEqual(analysis.symbols, [])

    def test_legacy_markdown_contains_structured_content(self) -> None:
        analysis = DreamAnalysis.model_validate(self.make_analysis_payload())
        markdown = dream_analysis_to_markdown(analysis)
        self.assertIn("# 镜子森林", markdown)
        self.assertIn("## 关键符号", markdown)
        self.assertIn("来自：森林中的镜子", markdown)
        self.assertIn("## 可以继续想想", markdown)

    @staticmethod
    def make_analysis_payload() -> dict:
        return {
            "schema_version": 3,
            "title": "镜子森林",
            "essence": "在安静与迟疑之间，你似乎正在重新看见自己。",
            "summary": "你在一片安静的森林里遇见一面镜子，并带着困惑继续前行。梦里的环境并不危险，但未知的道路和镜中的自己形成了明显的张力。",
            "moods": ["困惑", "平静"],
            "symbols": [{
                "name": "镜子",
                "meaning": "它可能代表你正在观察自己，也可能是在重新确认当下的方向。",
                "evidence": "森林中的镜子",
            }],
            "people": [],
            "scenes": ["森林"],
            "traits": ["清晰"],
            "psychological_view": (
                "这段梦把安静和迟疑放在了同一个场景里。你没有急着离开，"
                "可能说明你正在给自己一些观察和停顿的空间。\n\n"
                "镜子不一定对应某个固定答案，它也许只是提醒你留意自己如何看待当前状态。"
                "森林带来的未知感，则可能与尚未完全确定的选择有关。"
            ),
            "cultural_view": (
                "在传统文化的象征联想里，镜子常与自省、辨认和内外之间的关系相连，"
                "森林则可能让人想到未知、成长或尚未走完的路径。\n\n"
                "这只是一种文化阅读，不代表固定吉凶，也不用于预测之后会发生什么。"
            ),
            "reflection_questions": ["镜子出现时，你最先注意到的是自己还是周围的森林？"],
            "image_prompt": "安静的森林深处立着一面镜子，四周光线柔和，画面保留克制的困惑与平静。",
        }


if __name__ == "__main__":
    unittest.main()
