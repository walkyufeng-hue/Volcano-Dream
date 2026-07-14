from src.skills.context import EmotionalContext


class EmotionMappingSkill:
    name = "emotion_mapping"

    def __init__(self, source_label: str = "梦境") -> None:
        self.source_label = source_label

    def run(self, context: EmotionalContext) -> None:
        evidence_source = (
            "梦境中的场景、动作或意象"
            if context.scenario == "dream"
            else "记录中的情境、语言或行为"
        )
        context.add_instruction(
            f"【情绪映射能力】把{self.source_label}视为一次情绪表达，"
            "识别其中最有依据的主要感受、潜在需要或内在冲突。"
            f"情绪判断必须说明依据来自哪些{evidence_source}，"
            "并使用“可能、也许、如果”等审慎表达；"
            "不要给用户贴人格、疾病或关系标签。"
        )
        context.mark_skill_complete(self.name)
