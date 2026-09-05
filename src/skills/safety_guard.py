import re

from src.skills.context import EmotionalContext


class SafetyGuardSkill:
    name = "safety_guard"

    _direct_risk_patterns = tuple(
        re.compile(pattern)
        for pattern in (
            r"我(现在)?想自杀",
            r"我(现在)?不想活了",
            r"我(已经)?准备(自杀|跳楼|结束生命)",
            r"我想伤害自己",
            r"我要结束(自己|生命)",
        )
    )

    @staticmethod
    def _is_dream_only_expression(text: str, match_start: int) -> bool:
        nearby_prefix = text[max(0, match_start - 4):match_start]
        return nearby_prefix.endswith(("梦见", "梦到"))

    def run(self, context: EmotionalContext) -> None:
        for pattern in self._direct_risk_patterns:
            for match in pattern.finditer(context.raw_input):
                if not self._is_dream_only_expression(
                    context.raw_input,
                    match.start(),
                ):
                    context.risk_signals.append(
                        "direct_self_harm_expression"
                    )
                    break
            if context.risk_signals:
                break

        if context.risk_signals:
            context.risk_level = "elevated"
            regular_analysis = (
                "象征化解梦"
                if context.scenario == "dream"
                else "常规情绪分析"
            )
            context.add_instruction(
                "检测到用户文字中可能存在现实层面的自伤或轻生表达。"
                f"不要继续进行{regular_analysis}，也不要评价或说教；"
                "先用简短、直接、温和的语言确认安全，"
                "建议用户立即联系可信任的人、当地急救或危机干预资源。"
                "不得声称已完成专业风险评估。"
            )
        else:
            context.add_instruction(
                "保持非诊断、非预言边界。不要把梦境解释成确定的预言，"
                "也不得把梦境等同于心理疾病、现实意图或未来事件；"
                "涉及焦虑、抑郁等词语时只能描述感受，不得下临床结论。"
            )

        context.metadata["risk_level"] = context.risk_level
        context.mark_skill_complete(self.name)
