from fastapi import HTTPException
from src.models import DivinationBody, DreamAnalysis
from .base import DivinationFactory

DREAM_PROMPT = (
    "你是一位熟悉中国传统梦文化与现代心理学视角的梦境叙事者。"
    "请忠于用户提供的梦境，用温和、具体、有画面感但不过度玄化的中文进行理解。"
    "不要把梦境解释成确定的预言，不要制造恐惧，不要进行心理或医疗诊断，"
    "也不要虚构用户没有提供的经历、人物、场景或物品。"
    "所有推断都使用‘可能、也许、如果’等审慎表达。\n\n"
    "请严格按照响应 JSON Schema 返回，不要输出 Markdown、代码围栏或结构外文字。"
    "字段要求如下：\n"
    "1. schema_version 固定为 3。\n"
    "2. title 是克制、有辨识度的中文梦境标题，不使用‘梦见’或‘梦境解析’等套话。\n"
    "3. essence 用一句简短的话提炼这个梦最值得记住的感受或张力，"
    "忠于原文、不要下确定结论，也不要与 title 重复。\n"
    "4. summary 用 2 至 4 个短句概括梦里发生的事、主要感受和关键线索，"
    "不添加原文没有的事实。\n"
    "5. moods 提取 1 至 3 个核心情绪，只能从‘平静、喜悦、害怕、焦虑、悲伤、愤怒、"
    "困惑、孤独、惊讶、压迫、期待、安心、释然、怀念、复杂、说不清’中选择；"
    "没有足够依据时选择‘说不清’。\n"
    "6. symbols 提取 0 至 4 个关键意象。name 是意象名称；"
    "meaning 同时结合传统梦文化与现代心理学，"
    "但只表达可能性；evidence 必须简短指出它来自用户梦里的哪个具体细节。\n"
    "7. people 和 scenes 只提取梦中明确出现的人物与场景，没有就返回空数组，不得补全。\n"
    "8. traits 只能从‘清晰、零碎、重复出现、清醒梦、噩梦、情节完整’中选择；"
    "只有用户叙述足以支持时才添加，否则返回空数组。\n"
    "9. psychological_view 使用现代心理学的审慎视角，从整体情绪、内在需要和可能的现实连接"
    "理解这个梦；使用 2 至 3 个短段落，不进行诊断，不声称这是科学结论，"
    "不得假定用户一定经历了某件事。\n"
    "10. cultural_view 从中国传统梦文化和常见象征联想提供另一种文化阅读；"
    "使用 2 至 3 个短段落，不算命、不预测未来、不把象征解释为固定答案。\n"
    "11. reflection_questions 给出 1 至 3 个开放、非诱导的问题，帮助用户继续思考。\n"
    "12. image_prompt 只整理梦中真实出现的主体、动作、场景、光线和情绪，"
    "供后续生成一幅单场景 16:9 插画；"
    "不得加入梦里没有的主要内容，也不得包含文字、Logo、分屏或心理诊断。\n"
    "梦境解读仅供娱乐与自我反思，不替代专业心理或医疗建议。"
)


def dream_analysis_to_markdown(analysis: DreamAnalysis) -> str:
    """Keep one release window compatible with the legacy web client."""
    symbols = "\n".join(
        f"- **{symbol.name}**：{symbol.meaning}（来自：{symbol.evidence}）"
        for symbol in analysis.symbols
    )
    questions = "\n".join(
        f"{index}. {question}"
        for index, question in enumerate(analysis.reflection_questions, start=1)
    )
    context = []
    if analysis.people:
        context.append(f"**人物**：{'、'.join(analysis.people)}")
    if analysis.scenes:
        context.append(f"**场景**：{'、'.join(analysis.scenes)}")
    context_markdown = "\n\n".join(context)

    sections = [
        f"# {analysis.title}",
        f"> **精华**：{analysis.essence}",
        f"## 摘要\n\n{analysis.summary}",
        f"**核心情绪**：{'、'.join(analysis.moods)}",
        f"**梦境状态**：{'、'.join(analysis.traits)}" if analysis.traits else "",
        f"## 关键符号\n\n{symbols}" if symbols else "",
        f"## 人物与场景\n\n{context_markdown}" if context else "",
        f"## 心理视角\n\n{analysis.psychological_view}",
        f"## 文化象征\n\n{analysis.cultural_view}",
        f"## 可以继续想想\n\n{questions}",
        "*梦境解读仅供娱乐与自我反思，不替代专业心理或医疗建议。*",
    ]
    return "\n\n".join(section for section in sections if section)


class DreamFactory(DivinationFactory):

    divination_type = "dream"

    def build_prompt(self, divination_body: DivinationBody) -> tuple[str, str]:
        prompt_text = divination_body.prompt.strip()
        if len(prompt_text) < 20:
            raise HTTPException(
                status_code=400,
                detail="梦境描述至少需要20个字符",
            )
        if len(prompt_text) > 500:
            raise HTTPException(
                status_code=400,
                detail="梦境描述不能超过500字",
            )
        prompt = f"请解读我的梦境：{prompt_text}"
        return prompt, DREAM_PROMPT
