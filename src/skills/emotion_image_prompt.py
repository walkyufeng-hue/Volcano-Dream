class EmotionImagePromptSkill:
    name = "emotion_image_prompt"

    def run(self, journal: str, reflection: str) -> str:
        journal_content = journal.strip()[:500]
        reflection_clues = reflection.strip()[:700]
        return (
            "请创作一幅横向16:9的温柔情绪叙事插画。\n\n"
            "【用户记录｜事实参考】\n"
            f"{journal_content}\n\n"
            "保留记录中明确出现的环境、人物关系、物体或动作，但不要复刻真实人物面容，"
            "也不要补充用户没有提到的冲突、创伤或具体事件。\n\n"
            "【情绪回应｜氛围参考】\n"
            f"{reflection_clues}\n\n"
            "提取一种最主要的情绪作为画面基调，并通过色彩、光线、天气、距离和空间感表达。"
            "不要把心理分析、建议、诊断或抽象文字直接画进画面。\n\n"
            "【视觉要求】\n"
            "使用完整连续的单一场景和一个明确视觉焦点，采用细腻、克制、有呼吸感的梦幻插画风格；"
            "画面可以使用象征性环境表达感受，但不要出现夸张痛苦、猎奇或强刺激内容。"
            "禁止拼贴、分屏、漫画格、文字、字幕、标牌、水印、Logo和界面元素。"
        )
