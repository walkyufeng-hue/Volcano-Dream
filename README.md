# 火山梦绘AI（Volcano Dream AI）

火山梦绘AI是一个 AI 梦境解读与配图网站，结合中国传统梦文化与现代心理学视角，从梦境意象、心理映射、生活启示和行动建议等方面生成流式解读。

> 解梦结果仅供娱乐和自我反思，不是对未来的确定预言，也不能替代医学或心理专业建议。

## 功能

- 通过 OpenRouter 调用 DeepSeek V4 Flash，流式生成梦境解读
- 最多 500 字的梦境描述
- 每个 IP 在滚动 24 小时内免费解梦 1 次
- 首页实时显示当前 24 小时窗口内的剩余次数
- 全站文字与图片每日费用总闸门
- 浏览器本地保存最近 10 条历史记录
- 支持停止生成、防重复提交和响应式页面
- 支持复制解读文字、下载梦境配图和示例梦境
- 可选 GitHub OAuth 登录

## 技术栈

- 后端：FastAPI、Pydantic、OpenAI Python SDK
- 前端：React、TypeScript、Vite、Tailwind CSS、Zustand
- 文字模型：OpenRouter 上的 DeepSeek V4 Flash（关闭思考模式）
- 图片模型：Nano Banana 2（1K、16:9）
- 地区限制回退：Recraft V4.1（仅当主图片模型明确提示地区不支持时启用）

## 本地运行

在根目录创建 `.env`，不要将该文件提交到仓库：

```env
api_key=你的_OpenRouter_API_Key
api_base=https://openrouter.ai/api/v1
model=deepseek/deepseek-v4-flash
image_model=google/gemini-3.1-flash-image
jwt_secret=请替换为足够长的随机字符串
```

构建并启动前端：

```bash
cd frontend
pnpm install
VITE_API_BASE=http://127.0.0.1:8000 pnpm dev
```

启动后端：

```bash
python3 -m venv ./venv
./venv/bin/python3 -m pip install -r requirements.txt
./venv/bin/python3 main.py
```

运行基础安全回归测试：

```bash
./venv/bin/python3 -m unittest discover -s tests
```

- 前端开发地址：`http://127.0.0.1:5173`
- 后端地址：`http://127.0.0.1:8000`

## 公开部署

生产环境必须使用 Redis 或 Upstash 保存共享限流记录，并在部署平台的 Secret/Environment Variables 中配置 API Key。不要把 API Key 写入前端代码、Dockerfile 或 GitHub 仓库。

上线前至少确认：

- 在 OpenRouter 后台给 API Key 设置消费上限
- 根据预算调整 `global_text_limit` 和 `global_image_limit`，紧急时设为 `0` 可关闭对应能力
- 前后端分开部署时，将正式前端域名写入 `allowed_origins`
- 只有在受信任反向代理之后才开启 `trust_proxy_headers`，并配置 `trusted_proxy_networks`
- 意见反馈数据库目录已挂载持久化磁盘；Serverless 平台应改用托管数据库
- 使用随机生成的长字符串替换默认 `jwt_secret` 后再开启登录

`docker-compose up -d` 会同时启动网站和带持久化存储的 Redis。直接运行 `main.py` 时仍使用适合本地开发的内存缓存。

## 项目信息

- 开发者：火山
- GitHub：<https://github.com/walkyufeng-hue/Volcano-Dream>
- 联系邮箱：<walkyufeng@gmail.com>

## License

本项目基于 MIT 许可的开源项目修改，详见 [LICENSE](LICENSE)。
