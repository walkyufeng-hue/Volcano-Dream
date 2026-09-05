from src.skills.context import EmotionalContext


class DreamAnalysisSkill:
    name = "dream_analysis"

    def run(self, context: EmotionalContext) -> None:
        context.add_instruction(
            "【梦境解析能力】先区分梦境事实与解释：提取人物、地点、事件、动作和2至4个关键意象；"
            "所有解释都必须锚定用户实际提供的内容，不补写不存在的经历。"
            "传统梦文化只能作为一种可能的叙事视角，并与现代心理学的自我反思视角并列呈现。"
        )
        context.mark_skill_complete(self.name)
