from src.skills.context import EmotionalContext


class EmotionMappingSkill:
    name = "emotion_mapping"

    def run(self, context: EmotionalContext) -> None:
        context.add_instruction(
            "【情绪映射能力】把梦境视为一次情绪表达，识别其中最有依据的主要感受、潜在需要或内在冲突。"
            "情绪判断必须说明来自哪些场景、动作或意象，并使用“可能、也许、如果”等审慎表达；"
            "不要给用户贴人格、疾病或关系标签。"
        )
        context.mark_skill_complete(self.name)
