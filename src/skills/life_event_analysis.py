from src.skills.context import EmotionalContext


class LifeEventAnalysisSkill:
    name = "life_event_analysis"

    def run(self, context: EmotionalContext) -> None:
        context.add_instruction(
            "【生活事件解析能力】从用户记录中区分客观发生的事情、用户的主观感受和尚未确认的推测。"
            "提取最重要的情境、人物互动、压力来源或积极体验，不补写用户没有提供的经历，"
            "也不替用户判断他人的真实动机。"
        )
        context.mark_skill_complete(self.name)
