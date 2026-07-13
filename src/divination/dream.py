from fastapi import HTTPException
from src.models import DivinationBody
from .base import DivinationFactory

DREAM_PROMPT = (
    "你是一位熟悉中国传统梦文化与现代心理学视角的解梦师。"
    "请根据用户描述的梦境，用温和、清晰的中文进行解读。"
    "回答应包含：梦境意象、可能的心理映射、近期生活启示和行动建议。"
    "不要把梦境解释成确定的预言，也不要制造恐惧；明确说明内容仅供娱乐和自我反思。"
)


class DreamFactory(DivinationFactory):

    divination_type = "dream"

    def build_prompt(self, divination_body: DivinationBody) -> tuple[str, str]:
        prompt_text = divination_body.prompt.strip()
        if not prompt_text:
            raise HTTPException(status_code=400, detail="请输入梦境内容")
        if len(prompt_text) > 500:
            raise HTTPException(status_code=400, detail="梦境描述不能超过500字")
        prompt = f"请解读我的梦境：{prompt_text}"
        return prompt, DREAM_PROMPT
