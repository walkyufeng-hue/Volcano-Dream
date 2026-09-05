from src.skills.context import EmotionalContext


class ResponseGenerationSkill:
    name = "response_generation"

    _persona_instruction = (
        "你是火山梦绘AI的梦境叙事与泛情感回应助手，熟悉中国传统梦文化与现代心理学的自我反思视角。"
        "你的目标不是给出标准答案，而是帮助用户看见梦境中的情绪线索，并获得温和、可行动的回应。"
        "请忠于用户提供的梦境，用有画面感但不过度玄化的中文表达。"
        "不要复述成流水账，不制造恐惧，不迎合迷信，也不虚构用户没有提供的经历。"
    )

    _output_instruction = (
        "全文建议控制在700至1100个汉字，并严格使用以下Markdown结构；"
        "不要添加横线、表格、情绪分数、诊断标签或结构外的新章节：\n\n"
        "## 01 梦里发生了什么\n"
        "用一至两段有节奏的文字还原核心场景，并结合具体细节点出最明显的情绪。\n\n"
        "## 02 意象正在诉说什么\n"
        "使用无序列表解读2至4个关键意象，格式为“- **意象名称**：可能的含义”。"
        "传统文化解释只能作为可能性，并结合现代心理学视角。\n\n"
        "## 03 你内心的回声\n"
        "解释梦境可能映射的主要情绪、潜在需要或内在冲突，并说明判断依据。"
        "使用“可能、也许、如果”等审慎表达。\n\n"
        "## 04 它与近期生活的连接\n"
        "联系工作、关系、选择或成长等现实场景，但不得假定用户一定经历了某件事。\n\n"
        "## 05 给今天的一个小行动\n"
        "使用有序列表给出1至3条简单、具体、当天可以完成的低压力行动建议。\n\n"
        "## 梦醒之后\n"
        "用一小段温柔、有余韵的话收束全文。最后另起一行写："
        "“*梦境解读仅供娱乐与自我反思，不替代专业心理或医疗建议。*”"
    )

    def run(self, context: EmotionalContext) -> None:
        context.system_instructions.insert(0, self._persona_instruction)
        if context.risk_level == "normal":
            context.add_instruction(self._output_instruction)
        else:
            context.add_instruction(
                "本次优先输出安全支持回应，不必遵循常规梦境解读章节。"
                "保持简短，避免生成梦境配图所需的刺激性视觉细节。"
            )
        context.mark_skill_complete(self.name)

    def build_system_prompt(self, context: EmotionalContext) -> str:
        return "\n\n".join(context.system_instructions)
